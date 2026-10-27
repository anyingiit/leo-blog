#!/usr/bin/env python3
"""发布一个译本版本的全文下载文件（完整 HTML + PDF），只在版本定稿时运行一次。

    bash build.sh -d /tmp/s1site                       # 用正式域名构建（main 分支的设置）
    python3 tools/s1-import/release.py --vdir content/translations/anthropic-s1/v1.0 \
        --full /tmp/s1site/translations/anthropic-s1/v1.0/full.html

做的事：
  1. 把 Hugo 生成的 full.html（单文件完整 HTML）原样冻结到 <版本>/files/anthropic-s1-zh-unofficial-<版本>.html.raw（网站上发布为 .html）
  2. 用 pdf.cjs 把它打印成同名 .pdf（每页 612×810pt：原文页 + 底部「非官方」页边，首页声明、末页再附声明）
  3. 修 PDF：Chrome 内嵌中文字体时把部分汉字的文字层写成形近的部首字符（复制、搜索会出错），改回对应汉字；
     写入标题、作者、主题、关键词，打开时显示书签栏；逐页检查都有「非官方」标记
  4. 把两个文件的大小和 sha256 写进版本页 front matter 的 downloads，去掉 outputs 里的 s1full
     （之后网站只发布冻结的文件，模板改动不会再改变已发布版本的下载内容）
需要 Playwright（tests/ 里 npm ci）和 pypdf、pikepdf（pip install -r tools/s1-import/requirements.txt）。
默认要求：full.html 里的网址是 hugo.yaml 的正式域名、hugo.yaml 设置了下架联系方式 params.s1Contact；
预览演示用 --preview 跳过这两项检查。
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MAX_BYTES = 20 * 1024 * 1024  # Cloudflare Pages 单个文件上限 25 MiB，留余量


# CJK 部首补充（U+2E80–2EFF）没有 NFKC 映射，按 Unicode EquivalentUnifiedIdeograph.txt 对应到常用汉字
SUPPLEMENT = dict(zip(
    "⺁⺅⺆⺇⺉⺊⺋⺌⺍⺎⺏⺐⺒⺓⺔⺕⺖⺗⺘⺙⺛⺜⺝⺞⺟⺠⺡⺢⺣⺤⺥⺦⺧⺨⺩⺪⺫⺬⺭⺮⺯⺰⺱⺲⺳⺹⺺⺻⺼⺽⺾⺿⻀⻁⻂⻃⻄⻅⻆⻈⻉⻊⻋⻌⻍⻎⻏⻐⻑⻒⻓⻔⻖⻗⻘⻙⻚⻛⻜⻝⻟⻠⻢⻣⻤⻥⻦⻧⻨⻩⻪⻫⻬⻭⻮⻯⻰⻱⻲⻳",
    "厂亻冂几刂卜㔾小小兀尣尢巳幺彑彐忄㣺扌攵旡日月歺母民氵氺灬爫爫丬牛犭王疋罒示礻竹糹纟罓罒㓁耂肀聿月臼艹艹艹虎衤覀西见角讠贝足车辶辶辶阝钅長镸长门阝雨青韦页风飞食飠饣马骨鬼鱼鸟卤麦黄黾斉齐歯齿竜龙龜亀龟"))


def die(msg):
    sys.exit(f"release.py: {msg}")


RADICAL = re.compile(rb"<([0-9A-Fa-f]{4})>")


def _unradical(m):
    cp = int(m.group(1), 16)
    if 0x2E80 <= cp <= 0x2FDF:  # CJK 部首补充（查表）、康熙部首（NFKC）
        n = SUPPLEMENT.get(chr(cp)) or unicodedata.normalize("NFKC", chr(cp))
        if len(n) == 1 and ord(n) <= 0xFFFF and not 0x2E80 <= ord(n) <= 0x2FDF:
            return b"<%04X>" % ord(n)
    return m.group(0)


def fix_tounicode(data):
    """把 ToUnicode CMap 里映射到部首字符的 <XXXX> 改成对应的汉字"""
    return RADICAL.sub(_unradical, data)


def check_pdf(path, pages, excerpt=False):
    """发布前（以及 CI 里对已发布文件）的检查：页数、页面尺寸、每页的「非官方」标记、文字层没有部首字符、有书签和元数据"""
    from pypdf import PdfReader

    r = PdfReader(path)
    if len(r.pages) != pages:
        fail(f"PDF 有 {len(r.pages)} 页，应为 {pages} 页（声明页 + 原文页 + 末页声明）")
    for i, p in enumerate(r.pages, 1):
        text = p.extract_text() or ""
        if "非官方" not in text:
            fail(f"PDF 第 {i} 页找不到「非官方」标记")
        bad = [ch for ch in text if 0x2E80 <= ord(ch) <= 0x2FDF]
        if bad:
            fail(f"PDF 第 {i} 页的文字层还有部首字符 {''.join(bad[:10])}")
        box = p.mediabox
        if (round(float(box.width)), round(float(box.height))) not in ((612, 810), (792, 630)):
            fail(f"PDF 第 {i} 页尺寸 {box.width}×{box.height}，应为 612×810pt（原文横版页 792×630pt）")
    if not r.outline:
        fail("PDF 没有章节书签")
    dests = r.named_destinations
    lost = sorted({str(a["/Dest"]) for p in r.pages for a in (x.get_object() for x in p.get("/Annots", []))
                   if a.get("/Subtype") == "/Link" and "/Dest" in a and dests.get(str(a["/Dest"])) is None})
    if lost and not excerpt:  # 节选版本里指向未收录页面的链接本来就没有目标
        fail(f"PDF 里 {len(lost)} 个链接目标没有落到任何页：{', '.join(lost[:5])}")
    if "非官方" not in (r.metadata.title or "") or "非官方" not in (r.metadata.author or ""):
        fail("PDF 元数据缺少「非官方」标题或作者")
    if r.trailer["/Root"].get("/PageMode") != "/UseOutlines":
        fail("PDF 打开时不显示书签栏")
    if "/StructTreeRoot" not in r.trailer["/Root"]:
        fail("PDF 没有标签结构（屏幕阅读器读不了）")


def fail(msg):
    raise ValueError(msg)


def fix_pdf(path, title, version, pages, excerpt=False):
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    w = PdfWriter(clone_from=path)

    # 所有字体（包括表单 XObject、Type 3 字形里用到的）的 ToUnicode 都改一遍
    fixed = 0
    for obj in list(w._objects):
        if not isinstance(obj, DictionaryObject) or "/ToUnicode" not in obj:
            continue
        tu = obj["/ToUnicode"].get_object()
        data = tu.get_data()
        new = fix_tounicode(data)
        if new != data:
            fixed += 1
            s = DecodedStreamObject()
            s.set_data(new)
            obj[NameObject("/ToUnicode")] = w._add_object(s)
    w.add_metadata({
        "/Title": title,
        "/Author": "非官方译本（译者与 Anthropic, PBC 无关）",
        "/Subject": f"Anthropic, PBC Form S-1 的非官方中文译本 {version}。AI 翻译，译文一致性未经人工核对，以 SEC 英文原文为准；仅供参考，不构成投资建议，后果自负。原文权利归 Anthropic, PBC 及相应权利人所有。",
        "/Keywords": "非官方译本, AI 翻译, Anthropic, S-1",
    })
    w._root_object[NameObject("/PageMode")] = NameObject("/UseOutlines")
    w.write(path)

    # Chrome 输出的带标签 PDF 有几万个未压缩的结构对象（全文约 10 MB），收进对象流里压缩，内容不变
    import pikepdf
    with pikepdf.open(path, allow_overwriting_input=True) as pdf:
        pdf.save(path, object_stream_mode=pikepdf.ObjectStreamMode.generate, compress_streams=True)

    check_pdf(path, pages, excerpt)
    return fixed


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vdir", required=True, help="版本目录，如 content/translations/anthropic-s1/v1.0")
    ap.add_argument("--full", required=True, help="构建出的 <版本>/full.html")
    ap.add_argument("--preview", action="store_true", help="预览演示：不检查正式域名和下架联系方式")
    a = ap.parse_args()

    index = os.path.join(a.vdir, "_index.md")
    with open(index, encoding="utf-8") as f:
        fm = f.read()
    if re.search(r"^downloads:", fm, re.M):
        die(f"{index} 已经发布过下载文件（历史版本只增不改）")
    version = json.loads(re.search(r"^version: (.+)$", fm, re.M).group(1))
    chapters = json.loads(re.search(r"^chapters: (.+)$", fm, re.M).group(1))
    pages = sum(c["pages"][1] - c["pages"][0] + 1 for c in chapters if c["included"]) + 2

    html = open(a.full, encoding="utf-8").read()
    if not a.preview:
        base = re.search(r"^baseURL: (\S+)", open(os.path.join(REPO, "hugo.yaml"), encoding="utf-8").read(), re.M).group(1)
        canon = re.search(r'rel="?canonical"? href="?([^" >]+)', html)
        if not canon or not canon.group(1).startswith(base):
            die(f"full.html 的网址不是正式域名 {base}（{canon and canon.group(1)}）：请用 main 分支的设置构建")
        if "联系方式待定" in html:
            die("hugo.yaml 还没有设置下架联系方式 params.s1Contact")

    name = f"anthropic-s1-zh-unofficial-{version}"
    out = os.path.join(a.vdir, "files")
    os.makedirs(out, exist_ok=True)
    # 内容目录里的 .html 会被 Hugo 当成文章，所以完整 HTML 存成 .html.raw，由 downloads.html 模板以 .html 的名字发布
    html_path, pdf_path = os.path.join(out, name + ".html.raw"), os.path.join(out, name + ".pdf")
    shutil.copyfile(a.full, html_path)
    # 用 .html 文件名打印（.raw 浏览器会当成下载），内容和冻结的副本相同
    subprocess.run(["node", os.path.join(HERE, "pdf.cjs"), a.full, pdf_path], check=True)
    title = re.search(r"<title>([^<]+)</title>", html).group(1)
    try:
        fixed = fix_pdf(pdf_path, title, version, pages, any(not c["included"] for c in chapters))
    except ValueError as e:
        die(str(e))

    dl = {}
    for kind, p in (("html", html_path), ("pdf", pdf_path)):
        b = open(p, "rb").read()
        if len(b) > MAX_BYTES:
            die(f"{p} 有 {len(b) / 1048576:.1f} MiB，超过 {MAX_BYTES // 1048576} MiB（Cloudflare Pages 单文件上限 25 MiB）")
        dl[kind] = {"file": "files/" + os.path.basename(p), "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
    fm = re.sub(r'^outputs: .*\n', "", fm, flags=re.M)
    fm = fm.replace("\n---\n", f"\ndownloads: {json.dumps(dl, ensure_ascii=False)}\n---\n", 1)
    open(index, "w", encoding="utf-8").write(fm)
    for kind, d in dl.items():
        print(f"{d['file']}  {d['bytes'] / 1048576:.1f} MiB  sha256 {d['sha256'][:12]}…")
    print(f"PDF {pages} 页，修正了 {fixed} 个字体的文字层")


if __name__ == "__main__":
    main()
