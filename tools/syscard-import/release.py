#!/usr/bin/env python3
"""给系统卡的全文下载文件加上译者声明，样式和 S-1 译本的下载文件相同（用户 2026-10-31）。import.py 导入后自动运行，
也可以单独运行（只处理还没加过声明的版本）：

    python3 tools/syscard-import/release.py

导入时 files/ 里放的是译文仓库的原文件（PDF 超限的已无损瘦身）。这里在它们上面加声明，原文内容不动：
  HTML：<head> 里加 noindex 和声明用的样式；<body> 开头加 S-1 那样的「非官方 AI 译本」横幅、版本信息和完整的译者声明，
        结尾再附一份声明。译文仓库自带的「关于本译本」（各卡措辞不一，和网站上的声明不同）换成这份声明，其余逐字节不变
  PDF：  同 S-1 译本的 PDF（tools/s1-import）：第一页是声明和目录，最后一页再附声明；原文每页 612×792pt 原样，
        下面另加 18pt 页边，印「非官方」标记和页码（第 N / 总页数 页），不压到原文内容
声明的文字取自网站卡片首页（layouts/_partials/syscards/notice.html），所以先用 build.sh 构建一次站点；
声明页、目录和页脚用 Chromium 打印（tools/s1-import/pdf.cjs），再用 pikepdf 拼到原文页上。
处理前的文件大小和 sha256 记在 downloads.<html|pdf>.source，test_import.py 用它核对原文部分没有变。
需要 Playwright（tests/ 里 npm ci）、Hugo 和 requirements.txt 里的 Python 包。
"""
import argparse, hashlib, html, importlib.util, json, os, re, shutil, subprocess, sys, tempfile

import pikepdf

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(REPO, "content/translations/system-cards")
LIMIT = 25 * 1024 * 1024  # Cloudflare Pages 单个文件上限 25 MiB
FOOT = 18  # 页脚高度（pt），同 S-1
MARK = "sc-dl"  # 加进 HTML 的每一段都用 <!-- sc-dl --> … <!-- /sc-dl --> 包起来，测试据此去掉后核对原文部分

# Chrome 内嵌中文字体时文字层里的部首字符改回汉字（S-1 同款，tools/s1-import/release.py）
_spec = importlib.util.spec_from_file_location("s1_release", os.path.join(REPO, "tools/s1-import/release.py"))
_s1 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_s1)
fix_tounicode = _s1.fix_tounicode

# 样式同 S-1 的完整 HTML（layouts/s1/list.s1full.html）；只用 dl-、s1-notice 开头的类名，不影响译文仓库 HTML 自己的样式
CSS = """
.dl-banner { position: sticky; top: 0; z-index: 5; background: #fff8e1; border-bottom: 1px solid #e3c770; padding: 6px 16px; font: 13px/1.7 -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; text-align: center; color: #1f2328; }
.dl-banner a, .dl-notice a { color: #0b57d0; }
@media (max-width: 600px) { .dl-banner { padding: 4px 10px; font-size: 12px; } .dl-banner .dl-long { display: none; } }
.dl-notice { color: #1f2328; font: 15px/1.7 -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; margin: 16px 0; }
.dl-meta { color: #57606a; font-size: 14px; margin: 0 0 16px; }
.dl-notice .s1-notice { border: 1px solid #d0d7de; border-left: 4px solid #9a6700; border-radius: 8px; background: #fff; padding: 12px 16px; margin: 16px 0; }
.dl-notice .s1-notice ul { margin: 0; padding-inline-start: 20px; }
.dl-notice .s1-notice li { margin: 4px 0; }
.dl-notice .s1-notice-title { font-weight: 700; margin: 0 0 6px; }
.dl-notice .sc-nobr { white-space: nowrap; }
@media print { .dl-banner { display: none; } }
"""

# PDF 的声明页（首页、末页）：同 S-1 完整 HTML 的打印样式，一页 612×792pt，之后和原文页一样在下面加页脚
PAGE_CSS = """
@page { size: 612pt 792pt; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; color: #1f2328; font: 11pt/1.7 "Noto Sans CJK SC", "PingFang SC", sans-serif; }
a { color: #0b57d0; }
.dl-cover { height: 792pt; padding: 48pt 54pt; overflow: hidden; break-after: page; }
.dl-cover h1 { font-size: 20pt; line-height: 1.3; margin: 0 0 6px; }
.dl-meta { color: #57606a; font-size: 10pt; margin: 0 0 12pt; }
.s1-notice { border: 1px solid #d0d7de; border-left: 4px solid #9a6700; border-radius: 8px; background: #fff; padding: 12px 16px; margin: 12pt 0;
  font-size: 9.5pt; line-height: 1.6; }
.s1-notice ul { margin: 0; padding-inline-start: 20px; }
.s1-notice li { margin: 4px 0; }
.s1-notice-title { font-weight: 700; margin: 0 0 6px; }
.sc-nobr { white-space: nowrap; }
.dl-toc { border: 1px solid #d0d7de; border-radius: 8px; padding: 6pt 10pt; font-size: 8.5pt; line-height: 1.45; }
.dl-toc ol { margin: 3pt 0 0; padding-inline-start: 24px; columns: 2; column-gap: 32px; }
.dl-toc li { break-inside: avoid; }
.dl-toc small { color: #57606a; margin-inline-start: 6px; }
.dl-sep { color: #9a6700; margin-inline-start: 4px; }
"""


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def fm_of(path):
    """import.py 写的 front matter：每项一行 JSON"""
    head = open(path, encoding="utf-8").read().split("\n---\n", 1)[0]
    return {l[:l.index(": ")]: json.loads(l[l.index(": ") + 2:]) for l in head.split("\n")[1:]}


def set_fm(path, key, value):
    text = open(path, encoding="utf-8").read()
    line = f"{key}: {json.dumps(value, ensure_ascii=False)}"
    new, n = re.subn(rf"^{key}: .*$", lambda _: line, text, count=1, flags=re.M)
    if not n:
        sys.exit(f"{path} 没有 {key}")
    open(path, "w", encoding="utf-8").write(new)


def wrap(s):
    return f"<!-- {MARK} -->{s}<!-- /{MARK} -->"


def notice_of(site, slug):
    """网站上这份卡的完整译者声明（卡片首页的 aside#notice）"""
    page = open(os.path.join(site, "translations/system-cards", slug, "index.html"), encoding="utf-8").read()
    m = re.search(r'<aside class="?s1-notice"?[^>]*>[\s\S]*?</aside>', page)
    if not m:
        sys.exit(f"{slug}：卡片首页找不到译者声明")
    # 网页上的 id=notice 是站内锚点；下载文件首末各一份，去掉 id 免得重复
    return re.sub(r'\s+id="?notice"?', "", m.group(0))


def meta_line(root, v, url):
    return (f'<p class="dl-meta">译本 {v["version"]}（{v["versionDate"]} 定稿）· 对应原版 {root["released"]} 发布，{v["pages"]}&nbsp;页'
            f' · 在线版 <a href="{url}">{url}</a></p>')


def release_html(src, dst, root, v, notice, url):
    raw = open(src, encoding="utf-8").read()
    e = html.escape
    banner = (f'<div class="dl-banner" role="note"><strong>非官方 AI 译本 {v["version"]}</strong><span class="dl-long">，与 Anthropic 无关，译文一致性未经人工核对</span>'
              f' · 不是 Anthropic 原文<span class="dl-long"> · 以 <a href="{e(v["official"])}">英文原版</a>为准</span> · 后果自负</div>')
    head = f'<meta name="robots" content="noindex"><style>{CSS}</style>'
    top = f'<div class="dl-notice">{meta_line(root, v, url)}{notice}</div>'
    end = f'<div class="dl-notice">{notice}</div>'
    # 译文仓库 HTML 标题下的「关于本译本」：换成网站上的完整声明
    note = re.search(r'<div class="note"><b>关于本译本：</b>[\s\S]*?</div>\n?', raw)
    m_head, m_body, m_end = re.search(r"<head[^>]*>", raw), re.search(r"<body[^>]*>", raw), raw.rfind("</body>")
    if not (note and m_head and m_body and m_end > note.end() > m_body.end()):
        sys.exit(f"{src}：找不到 <head>、<body>、</body> 或「关于本译本」")
    out = (raw[:m_head.end()] + wrap(head) + raw[m_head.end():m_body.end()] + wrap(banner) + raw[m_body.end():note.start()]
           + wrap(top) + raw[note.end():m_end] + wrap(end) + raw[m_end:])
    open(dst, "w", encoding="utf-8").write(out)


def strip_added(text):
    """去掉 release_html 加的部分（测试用）：得到原文件去掉「关于本译本」之后的样子"""
    return re.sub(rf"<!-- {MARK} -->[\s\S]*?<!-- /{MARK} -->", "", text)


def chromium_pdf(doc, path):
    html_path = path[:-4] + ".html"
    open(html_path, "w", encoding="utf-8").write(doc)
    subprocess.run(["node", os.path.join(REPO, "tools/s1-import/pdf.cjs"), html_path, path], check=True, stdout=subprocess.DEVNULL)
    return pikepdf.open(path)


def notice_pages(tmp, root_title, root, v, notice, url, total):
    """首页（标题、版本信息、声明、目录）和末页（声明）。目录的链接先写成占位网址，拼好后改成跳到 PDF 里的对应页"""
    items = "".join(
        f'<li><a href="https://pdf.invalid/page/{ch["pages"][0]}">{html.escape(ch["title"])}</a>'
        + ('<span class="dl-sep">（含另行翻译）</span>' if ch["separate"] else "")
        + f'<small>第&nbsp;{ch["pages"][0]}{"–" + str(ch["pages"][1]) if ch["pages"][1] != ch["pages"][0] else ""}&nbsp;页</small></li>'
        for ch in v["chapters"])
    doc = (f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>{PAGE_CSS}</style></head><body>'
           f'<section class="dl-cover"><h1>{html.escape(root_title)}</h1>{meta_line(root, v, url)}{notice}'
           f'<nav class="dl-toc"><strong>目录</strong>（页码为原版页码）<ol>{items}</ol></nav></section>'
           f'<section class="dl-cover">{notice}</section></body></html>')
    pdf = chromium_pdf(doc, os.path.join(tmp, "notice.pdf"))
    if len(pdf.pages) != 2:
        sys.exit(f"声明页排出了 {len(pdf.pages)} 页（应为首页、末页各一页）：目录太长")
    return pdf


def footers(tmp, v, total):
    """每页底部的页脚，一页一条，文字同 S-1：非官方 AI 译本 vX · 与 Anthropic 无关…… · 第 N / M 页"""
    rows = "".join(f'<div class="f">非官方 AI 译本 {v["version"]} · 与 Anthropic 无关，译文一致性未经人工核对，以 Anthropic 英文原版为准 · 第 {i} / {total} 页</div>'
                   for i in range(1, total + 1))
    doc = (f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>@page {{ size: 612pt {FOOT}pt; margin: 0; }} body {{ margin: 0; }}'
           f'.f {{ height: {FOOT}pt; display: flex; align-items: center; justify-content: center; break-after: page;'
           f' font: 7pt/1 "Noto Sans CJK SC", "PingFang SC", sans-serif; color: #555; }}</style></head><body>{rows}</body></html>')
    pdf = chromium_pdf(doc, os.path.join(tmp, "footers.pdf"))
    if len(pdf.pages) != total:
        sys.exit(f"页脚排出了 {len(pdf.pages)} 页，应为 {total}")
    return pdf


def fix_fonts(pdf):
    for obj in pdf.objects:
        if isinstance(obj, pikepdf.Dictionary) and "/ToUnicode" in obj:
            tu = obj["/ToUnicode"]
            data = tu.read_bytes()
            new = fix_tounicode(data)
            if new != data:
                tu.write(new)


def release_pdf(src, dst, root_title, root, v, notice, url, tmp):
    pdf = pikepdf.open(src)
    n = len(pdf.pages)
    total = n + 2
    cover = notice_pages(tmp, root_title, root, v, notice, url, total)
    foot = footers(tmp, v, total)
    fix_fonts(cover)
    fix_fonts(foot)
    pdf.pages.insert(0, cover.pages[0])
    pdf.pages.append(cover.pages[1])
    originals = [pdf.pages[i].obj for i in range(1, n + 1)]
    for i, page in enumerate(pdf.pages):
        x0, y0, x1, y1 = [float(x) for x in page.mediabox]
        if (round(x1 - x0), round(y1 - y0)) != (612, 792) or "/Rotate" in page.obj:
            sys.exit(f"{src} 第 {i} 页不是 612×792pt 的竖版页")
        box = pikepdf.Array([x0, y0 - FOOT, x1, y1])
        page.obj.MediaBox = box
        for k in ("/CropBox", "/BleedBox", "/TrimBox", "/ArtBox"):
            if k in page.obj:
                del page.obj[k]
        page.add_overlay(foot.pages[i], pikepdf.Rectangle(x0, y0 - FOOT, x1, y0))
    # 首页目录：占位网址改成跳到 PDF 里那一页（原版第 N 页是 PDF 第 N+1 页）
    for a in pdf.pages[0].obj.get("/Annots", []):
        uri = str(a.get("/A", {}).get("/URI", ""))
        m = re.fullmatch(r"https://pdf\.invalid/page/(\d+)", uri)
        if m:
            a.A = pikepdf.Dictionary(S=pikepdf.Name.GoTo, D=pikepdf.Array([originals[int(m.group(1)) - 1], pikepdf.Name.Fit]))
    with pdf.open_outline() as ol:
        if ol.root:  # 原文有书签的，最前面加一条「译者声明」
            ol.root.insert(0, pikepdf.OutlineItem("译者声明", 0))
    pdf.docinfo["/Title"] = f"{root_title} {v['version']}"
    pdf.docinfo["/Author"] = "非官方译本（译者与 Anthropic, PBC 无关）"
    pdf.docinfo["/Subject"] = (f"Anthropic, PBC《{v['titleEn']}》的非官方中文译本 {v['version']}。AI 翻译，译文一致性未经人工核对，"
                               "以 Anthropic 官网英文原版为准；译者不对译文承担责任。原文权利归 Anthropic, PBC 所有。")
    pdf.docinfo["/Keywords"] = "非官方译本, AI 翻译, Anthropic, System Card, 系统卡"
    if "/Metadata" in pdf.Root:  # XMP 里的旧标题会盖过上面的信息字典，去掉
        del pdf.Root["/Metadata"]
    pdf.save(dst, object_stream_mode=pikepdf.ObjectStreamMode.generate, compress_streams=True, deterministic_id=True)
    return total


def check_pdf(path, pages, sample=False):
    """每页都有「非官方」标记、页码；声明页和页脚的文字层没有部首字符；原文页尺寸不变。
    sample：只查首末两页和中间几页（测试里用；逐页取文字很慢，发布时查全部）"""
    import pypdf
    r = pypdf.PdfReader(path)
    if len(r.pages) != pages + 2:
        raise ValueError(f"{path} 有 {len(r.pages)} 页，应为 {pages + 2}（声明页 + 原文 + 末页声明）")
    which = sorted({1, 2, (pages + 2) // 2, pages + 1, pages + 2}) if sample else range(1, pages + 3)
    for i in which:
        p = r.pages[i - 1]
        box = p.mediabox
        if (round(float(box.width)), round(float(box.height))) != (612, 792 + FOOT):
            raise ValueError(f"{path} 第 {i} 页尺寸 {box.width}×{box.height}")
        text = re.sub(r"\s+", " ", p.extract_text() or "")
        if f"第 {i} / {pages + 2} 页" not in text or "非官方" not in text:
            raise ValueError(f"{path} 第 {i} 页没有「非官方」页脚")
        if i in (1, pages + 2) and "译者声明" not in text:
            raise ValueError(f"{path} 第 {i} 页不是译者声明")
    for i in (0, len(r.pages) - 1):
        bad = [ch for ch in r.pages[i].extract_text() if 0x2E80 <= ord(ch) <= 0x2FDF]
        if bad:
            raise ValueError(f"{path} 第 {i + 1} 页的文字层还有部首字符 {''.join(bad[:10])}")


def build_site(dst):
    env = dict(os.environ)
    env.pop("CF_PAGES_URL", None)
    subprocess.run(["bash", "build.sh", "-d", dst], cwd=REPO, env=env, check=True, stdout=subprocess.DEVNULL)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="只处理这些卡（逗号分隔的目录名）")
    a = ap.parse_args(argv)
    base = re.search(r"^baseURL: (\S+)", open(os.path.join(REPO, "hugo.yaml"), encoding="utf-8").read(), re.M).group(1).rstrip("/")
    todo = []
    for slug in sorted(os.listdir(OUT)):
        if not os.path.isfile(os.path.join(OUT, slug, "_index.md")) or (a.only and slug not in a.only.split(",")):
            continue
        root = fm_of(os.path.join(OUT, slug, "_index.md"))
        for ver in sorted(os.listdir(os.path.join(OUT, slug))):
            index = os.path.join(OUT, slug, ver, "_index.md")
            if os.path.isfile(index) and "source" not in fm_of(index)["downloads"]["html"]:
                todo.append((slug, ver, root, index))
    if not todo:
        print("没有要处理的版本（都已加过声明；要重做先重新导入）")
        return
    with tempfile.TemporaryDirectory() as tmp:
        site = os.path.join(tmp, "site")
        build_site(site)
        for slug, ver, root, index in todo:
            v = fm_of(index)
            if ver != root["latest"]:
                sys.exit(f"{slug} {ver} 不是最新版本：卡片首页的声明是最新版的，旧版本不能用")
            notice = notice_of(site, slug)
            url = f"{base}/translations/system-cards/{slug}/{ver}/"
            title = open(os.path.join(OUT, slug, "_index.md"), encoding="utf-8").read()
            root_title = json.loads(re.search(r"^title: (.+)$", title, re.M).group(1)).replace("中文译本", "非官方中文译本")
            vdir = os.path.join(OUT, slug, ver)
            dl = v["downloads"]
            for kind in ("html", "pdf"):
                path = os.path.join(vdir, dl[kind]["file"])
                if sha256(path) != dl[kind]["sha256"]:
                    sys.exit(f"{path} 和 front matter 记的 sha256 不同")
                orig = os.path.join(tmp, f"{slug}-orig.{kind}")
                shutil.copyfile(path, orig)
                if kind == "html":
                    release_html(orig, path, root, v, notice, url)
                else:
                    release_pdf(orig, path, root_title, root, v, notice, url, tmp)
                    try:
                        check_pdf(path, v["pages"])
                    except ValueError as e:
                        sys.exit(str(e))
                size = os.path.getsize(path)
                if size > LIMIT:
                    sys.exit(f"{path} 加声明后 {size / 2**20:.1f} MiB，超过 25 MiB")
                dl[kind] = {**dl[kind], "bytes": size, "sha256": sha256(path),
                            "source": {"bytes": dl[kind]["bytes"], "sha256": dl[kind]["sha256"]}}
            set_fm(index, "downloads", dl)
            print(f"{slug} {ver}: HTML {dl['html']['bytes'] / 2**20:.1f} MiB，PDF {dl['pdf']['bytes'] / 2**20:.1f} MiB（{v['pages'] + 2} 页）")


if __name__ == "__main__":
    main()
