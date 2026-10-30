#!/usr/bin/env python3
"""导入 Anthropic 系统卡中文译本（GitHub 仓库 anyingiit/anthropic-system-cards-zh）。

用法：python3 tools/syscard-import/import.py <译文仓库的本地克隆> [--date 2026-10-30]

译文仓库每份系统卡一个目录，里面有单文件 HTML、PDF、Markdown 和 README（翻译说明）。本站只做发布，不改译文：
  content/translations/system-cards/files/<目录名>.html.raw   HTML 逐字节原样（网站上发布为 .html，在线阅读就是它）
  content/translations/system-cards/files/<目录名>.pdf        PDF：不超过 Cloudflare Pages 单文件上限的原样复制；
                                                                超过的做无损瘦身（见 slim_pdf），页面渲染逐像素不变
  content/translations/system-cards/_index.md / _index.en.md  front matter 的 cards 列表（模板 layouts/syscards/list.html 读取）
每份卡的标题、原版日期、页数、2.2 节说明取自该卡 README 和 HTML 的 <title>；英文原版地址按 Anthropic 官网的命名规则
（https://www.anthropic.com/claude-<目录名，点换成横线>-system-card）拼出，导入时加 --check-links 联网逐个确认能打开。
重新导入（译文仓库更新后）会整体覆盖上面这些文件，_index 的正文不保留：要改说明文字就改这个脚本。
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, urllib.parse, urllib.request

import pikepdf

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(REPO, "content/translations/system-cards")
GITHUB = "https://github.com/anyingiit/anthropic-system-cards-zh"
LIMIT = 25 * 1024 * 1024  # Cloudflare Pages 单个文件上限 25 MiB


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _val(v, top=False):
    """字典里的值：间接引用按对象编号比较（不能按内容：内容相同、引用不同的字典指向的可能是不同的对象）。top：比较的就是这个对象本身"""
    if isinstance(v, pikepdf.Object) and v.is_indirect and not top:
        return ("ref", v.objgen)
    if isinstance(v, pikepdf.Dictionary):
        return tuple(sorted((k, _val(x)) for k, x in v.items()))
    if isinstance(v, pikepdf.Array):
        return tuple(_val(x) for x in v)
    return repr(v)


def _stream_key(o):
    """流的比较键：Flate 流比较解压后的数据（同一张图被压缩成不同字节的也算相同），其他压缩方式比较原始字节"""
    if o.get("/Filter") == "/FlateDecode" and "/DecodeParms" not in o:
        skip, data = ("/Length", "/Filter"), o.read_bytes()
    else:
        skip, data = ("/Length",), o.read_raw_bytes()
    # 值为 null 的键等于没有这个键（PDF 规范；保存时也会被去掉），比较时忽略
    return (data, tuple(sorted((k, _val(v)) for k, v in o.stream_dict.items() if k not in skip and v is not None)))


def slim_pdf(src, dst):
    """无损瘦身：这些 PDF 里大部分图片都存了两份完全相同的副本（约占文件的四成）。
    1. 图片（/Subtype /Image）里数据和字典都相同的只留一份，引用都指过去。只合并图片：字体、表单、页面内容流哪怕字节相同，
       引用的资源也可能不同，合并会改变文字层（实测有隐藏文字被换掉，复制、搜索出来的字不同）；
       图片引用到的调色板、色彩空间数组、蒙版等间接对象（只被图片用到的）也一样合并，合并后指向同一对象的图片再比较，反复到不再变化
    2. Flate 流按最高压缩级别重新压缩（解压后的字节不变）；3. 用对象流保存。
    不重采样、不转 JPEG，页面渲染和文字层都和原文件逐一相同（test_import.py 核对）。返回合并掉的流数"""
    pikepdf.settings.set_flate_compression_level(9)
    p = pikepdf.open(src)
    gone = set()  # 已合并掉的对象：保存前还留在 p.objects 里，不再参与比较
    while True:
        canon, remap, used = {}, {}, referenced_by_images(p, gone)
        for o in p.objects:
            if o.objgen in gone:
                continue
            if isinstance(o, pikepdf.Stream) and (o.get("/Subtype") == "/Image" or o.objgen in used):
                k = _stream_key(o)
            elif isinstance(o, (pikepdf.Dictionary, pikepdf.Array)) and o.objgen in used:
                k = ("obj", _val(o, top=True))
            else:
                continue
            if k in canon:
                remap[o.objgen] = canon[k]
            else:
                canon[k] = o
        if not remap:
            break
        gone |= set(remap)
        _redirect(p, remap)
    p.save(dst, object_stream_mode=pikepdf.ObjectStreamMode.generate, recompress_flate=True,
           deterministic_id=True)
    return len(gone)


def referenced_by_images(p, gone):
    """图片字典（递归）引用到的间接对象（调色板、色彩空间、SMask 等），每轮重新算"""
    refs = set()

    def walk(v):
        if isinstance(v, pikepdf.Object) and v.is_indirect:
            if v.objgen in refs:
                return
            refs.add(v.objgen)
            if isinstance(v, pikepdf.Stream):
                v = v.stream_dict
            elif not isinstance(v, (pikepdf.Dictionary, pikepdf.Array)):
                return
        if isinstance(v, pikepdf.Dictionary):
            for x in v.values():
                walk(x)
        elif isinstance(v, pikepdf.Array):
            for x in v:
                walk(x)

    for o in p.objects:
        if isinstance(o, pikepdf.Stream) and o.get("/Subtype") == "/Image" and o.objgen not in gone:
            for x in o.stream_dict.values():
                walk(x)
    return refs


def _redirect(p, remap):
    def fix(c):
        items = c.items() if isinstance(c, pikepdf.Dictionary) else enumerate(c)
        for k, v in list(items):
            if isinstance(v, (pikepdf.Stream, pikepdf.Dictionary, pikepdf.Array)):
                if v.is_indirect and v.objgen in remap:
                    c[k] = remap[v.objgen]
                elif not v.is_indirect:
                    fix(v)

    for o in p.objects:
        if isinstance(o, pikepdf.Stream):
            fix(o.stream_dict)
        elif isinstance(o, (pikepdf.Dictionary, pikepdf.Array)):
            fix(o)
    fix(p.trailer)


RE_HEAD = re.compile(r"《(.+?)》（(\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日，(\d+) 页）")
RE_22 = re.compile(r"2\.2 节\**（[^）]*?原文第 (\d+)–(\d+) 页")
RE_SCATTER = re.compile(r"(\d+) 个零散段落")
RE_MODEL = re.compile(r"由项目发起人使用 \*\*(.+?)\*\* 翻译")


def card_info(src, d):
    readme = open(os.path.join(src, d, "README.md"), encoding="utf-8").read()
    m = RE_HEAD.search(readme)
    if not m:
        sys.exit(f"{d}/README.md 第一段里找不到《原名》（日期，页数）")
    title_en, y, mo, da, pages = m.groups()
    htmls = [f for f in os.listdir(os.path.join(src, d)) if f.endswith(".html")]
    pdfs = [f for f in os.listdir(os.path.join(src, d)) if f.endswith(".pdf")]
    if len(htmls) != 1 or len(pdfs) != 1:
        sys.exit(f"{d}: 应该正好有一个 .html 和一个 .pdf，实际 {htmls} {pdfs}")
    head = open(os.path.join(src, d, htmls[0]), encoding="utf-8").read(4000)
    title = re.search(r"<title>(.*?)</title>", head).group(1)
    s22 = RE_22.search(readme)
    if not s22:
        sys.exit(f"{d}/README.md 里找不到 2.2 节的原文页码")
    sc = RE_SCATTER.search(readme)
    model = RE_MODEL.search(readme)
    p1, p2 = s22.groups()
    zh = f"2.2 节（原文第 {p1}–{p2} 页）"
    en = f"Section 2.2 (pp. {p1}–{p2})"
    if sc:
        zh += f"和 {sc.group(1)} 个零散段落"
        en += f" and {sc.group(1)} scattered paragraphs"
    zh += f"由译者{'使用 ' + model.group(1) + ' ' if model else '另行'}翻译，未经 Claude 审校。"
    en += f" {'were' if sc else 'was'} translated separately by the translator{' with ' + model.group(1) if model else ''} and not reviewed by Claude."
    official = f"https://www.anthropic.com/claude-{d.replace('.', '-')}-system-card"  # 官网按目录名同样的规则命名
    return dict(slug=d, title=title, titleEn=title_en, released=f"{y}-{int(mo):02d}-{int(da):02d}", pages=int(pages),
                note=zh, noteEn=en, official=official, html=htmls[0], pdf=pdfs[0])


def write_index(path, fm, body=""):
    lines = ["---"]
    for k, v in fm.items():
        lines.append(f"{k}: {json.dumps(v, ensure_ascii=False)}")
    lines.append("---")
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n" + body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--date", required=True, help="本次导入（发布）日期 YYYY-MM-DD")
    ap.add_argument("--check-links", action="store_true", help="联网确认每份卡的英文原版地址能打开")
    a = ap.parse_args()
    git = lambda *args: subprocess.run(["git", "-C", a.src, *args], capture_output=True, text=True, check=True).stdout.strip()
    if git("status", "--porcelain"):
        sys.exit("译文仓库有未提交的改动：只从已提交的版本导入，网站上的文件才能和 GitHub 上的对应")
    commit = git("rev-parse", "HEAD")
    commit_date = git("show", "-s", "--format=%cs", "HEAD")
    dirs = sorted(d for d in os.listdir(a.src) if os.path.isfile(os.path.join(a.src, d, "README.md")) and d != "shared-pipeline")
    cards = [card_info(a.src, d) for d in dirs]
    cards.sort(key=lambda c: c["released"], reverse=True)

    files = os.path.join(OUT, "files")
    shutil.rmtree(files, ignore_errors=True)
    os.makedirs(files)
    out = []
    for c in cards:
        d = c["slug"]
        h_src, p_src = os.path.join(a.src, d, c["html"]), os.path.join(a.src, d, c["pdf"])
        h_dst, p_dst = os.path.join(files, d + ".html.raw"), os.path.join(files, d + ".pdf")
        shutil.copyfile(h_src, h_dst)
        pdf = dict(file=f"files/{d}.pdf", name=c["pdf"])
        if os.path.getsize(p_src) > LIMIT:
            n = slim_pdf(p_src, p_dst)
            pdf.update(slimmed=True, sourceBytes=os.path.getsize(p_src), sourceSha256=sha256(p_src))
            print(f"{d}: PDF {os.path.getsize(p_src) / 2**20:.1f} MiB → {os.path.getsize(p_dst) / 2**20:.1f} MiB（合并 {n} 个重复的流）")
            if os.path.getsize(p_dst) > LIMIT:
                sys.exit(f"{d}: 无损瘦身后仍超过 25 MiB，需要另想办法")
        else:
            shutil.copyfile(p_src, p_dst)
        pdf.update(bytes=os.path.getsize(p_dst), sha256=sha256(p_dst))
        html = dict(file=f"files/{d}.html.raw", name=c["html"], bytes=os.path.getsize(h_dst), sha256=sha256(h_dst))
        if a.check_links:
            req = urllib.request.Request(c["official"], headers={"User-Agent": "Mozilla/5.0"})
            if urllib.request.urlopen(req).status != 200:
                sys.exit(f"英文原版打不开：{c['official']}")
        out.append(dict(slug=d, title=c["title"], titleEn=c["titleEn"], released=c["released"], pages=c["pages"],
                        note=c["note"], noteEn=c["noteEn"], official=c["official"],
                        readme=f"{GITHUB}/tree/{commit}/{urllib.parse.quote(d)}", html=html, pdf=pdf))

    common = dict(type="syscards", date=a.date, sourceRepo=GITHUB, sourceCommit=commit, sourceDate=commit_date,
                  ShowReadingTime=False, ShowWordCount=False, hideAuthor=True)
    write_index(os.path.join(OUT, "_index.md"), dict(
        title="Anthropic 系统卡中文译本",
        description=f"Anthropic 发布的 {len(out)} 份 Claude 模型系统卡（System Card）的非官方中文译本，AI 翻译，可在线阅读，也可下载 HTML 和 PDF。",
        **common, cards=out))
    write_index(os.path.join(OUT, "_index.en.md"), dict(
        title="Anthropic System Cards — Unofficial Chinese Translations",
        description=f"Unofficial, AI-produced Chinese translations of {len(out)} Claude model system cards published by Anthropic.",
        **common, cards=out))
    print(f"导入 {len(out)} 份系统卡，译文仓库提交 {commit[:7]}（{commit_date}）")


if __name__ == "__main__":
    main()
