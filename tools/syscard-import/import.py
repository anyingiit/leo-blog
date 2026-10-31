#!/usr/bin/env python3
"""导入 Anthropic 系统卡中文译本（译文仓库 anyingiit/anthropic-system-cards-zh，不公开）。

用法：python3 tools/syscard-import/import.py <译文仓库的本地克隆> --date 2026-10-30 [--check-links]

译文仓库每份系统卡一个目录，里面有单文件 HTML、PDF、Markdown 和 README（翻译说明）。本站只做发布，不改译文。
每份卡生成一个页面（叶子包），顺序和 Anthropic 官网系统卡列表（INDEX_URL）相同，写进 weight：
  content/translations/system-cards/<目录名>/index.md / index.en.md        front matter：原名、发布日期、页数、英文原版地址、
                                                                           facts（译者声明用到的数字）、downloads（文件、大小、SHA-256）
  content/translations/system-cards/<目录名>/files/claude-<名>-system-card-zh.html.raw   HTML（网站上发布为 .html）
  content/translations/system-cards/<目录名>/files/claude-<名>-system-card-zh.pdf        PDF：超过 Cloudflare Pages 单文件上限的
                                                                           先做无损瘦身（见 slim_pdf），渲染逐像素不变
  两个文件最后由 release.py 加上和 S-1 下载文件同样的译者声明（首末各一份、PDF 每页「非官方」页脚），原文部分不动
  content/translations/system-cards/_index.md / _index.en.md               栏目页（layouts/syscards/list.html）
facts 取自该卡 README，标题取自 HTML 的 <title>；声明的措辞统一在 layouts/_partials/syscards/notice.html。
译文仓库不公开，页面上不放仓库链接。英文原版地址按官网命名规则（https://www.anthropic.com/claude-<目录名，点换成横线>-system-card）拼出，
--check-links 联网逐个确认能打开。重新导入会整体覆盖上面这些文件：要改说明文字就改模板或这个脚本。
"""
import argparse, hashlib, importlib.util, json, os, re, shutil, subprocess, sys, urllib.parse, urllib.request

import pikepdf
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(REPO, "content/translations/system-cards")
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
    """从该卡 README（翻译说明）和 HTML 的 <title> 取页面要用的事实；措辞统一由模板（layouts/_partials/syscards/notice.html）决定"""
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
    num = lambda pat: (lambda m: int(m.group(1)) if m else None)(re.search(pat, readme))
    sc = re.search(r"(\d+) 个零散段落（原文第 ([^）]+) 页）", readme)
    model = RE_MODEL.search(readme)
    m22 = re.search(r"正文 (\d+) 个(?:单元|条目)[，和]\s*(?:图片 )?(\d+) 张", readme)
    facts = dict(
        units=num(r"全部正文（(\d+) 个文本单元）"), images=num(r"个文本单元）和 (\d+) 张图片") or num(r"(\d+) 张图的重绘规格"),
        s22=[int(s22.group(1)), int(s22.group(2))],
        scattered=int(sc.group(1)) if sc else 0, scatteredPages=sc.group(2) if sc else "",
        s22Units=int(m22.group(1)) if m22 else None, s22Images=int(m22.group(2)) if m22 else None,
        s22Model=model.group(1) if model else "",
        layoutFixes=num(r"共发现 (\d+) 处问题"), unverifiedNumbers=num(r"有 (\d+) 处原文数字"),
        linksLost="内部链接" in readme, emoji="emoji" in readme)
    official = f"https://www.anthropic.com/claude-{d.replace('.', '-')}-system-card"  # 官网按目录名同样的规则命名
    return dict(slug=d, title=title, titleEn=title_en, released=f"{y}-{int(mo):02d}-{int(da):02d}", pages=int(pages),
                official=official, html=htmls[0], pdf=pdfs[0], facts=facts)


def write_page(path, fm, body=""):
    """front matter 每项一行 JSON（YAML 的子集，测试按行解析）"""
    lines = ["---"] + [f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in fm.items()] + ["---"]
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n" + body)


INDEX_URL = "https://www.anthropic.com/system-cards"


def official_order(html):
    """Anthropic 官网系统卡列表（INDEX_URL）里各卡出现的顺序：地址里的 claude-<名>-system-card"""
    order = []
    for m in re.finditer(r'href="https?://(?:www\.)?anthropic\.com/claude-([a-z0-9-]+)-system-card"', html):
        if m.group(1) not in order:
            order.append(m.group(1))
    return order


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--date", required=True, help="本次导入（发布）日期 YYYY-MM-DD")
    ap.add_argument("--check-links", action="store_true", help="联网确认每份卡的英文原版地址能打开")
    ap.add_argument("--only", help="只导入这些卡（逗号分隔的目录名；预览用）")
    a = ap.parse_args()
    git = lambda *args: subprocess.run(["git", "-C", a.src, *args], capture_output=True, text=True, check=True).stdout.strip()
    if git("status", "--porcelain"):
        sys.exit("译文仓库有未提交的改动：只从已提交的版本导入，网站上的文件才能和译文仓库的版本对应")
    commit = git("rev-parse", "HEAD")
    commit_date = git("show", "-s", "--format=%cs", "HEAD")
    versions = json.load(open(os.path.join(a.src, "versions.json"), encoding="utf-8"))["cards"]
    dirs = sorted(d for d in os.listdir(a.src) if os.path.isfile(os.path.join(a.src, d, "README.md")) and d != "shared-pipeline")
    if a.only:
        dirs = [d for d in dirs if d in a.only.split(",")]
    cards = [card_info(a.src, d) for d in dirs]

    # 顺序和 Anthropic 官网的系统卡列表相同（用户 2026-10-30）
    req = urllib.request.Request(INDEX_URL, headers={"User-Agent": "Mozilla/5.0"})
    order = official_order(urllib.request.urlopen(req).read().decode("utf-8"))
    names = {c["slug"]: c["slug"].replace(".", "-") for c in cards}
    missing = [d for d, n in names.items() if n not in order]
    if missing:
        sys.exit(f"官网系统卡列表里找不到：{missing}")
    cards.sort(key=lambda c: order.index(names[c["slug"]]))

    for d in os.listdir(OUT) if os.path.isdir(OUT) else []:
        if os.path.isdir(os.path.join(OUT, d)):
            shutil.rmtree(os.path.join(OUT, d))
    os.makedirs(OUT, exist_ok=True)
    fonts = chapters.Fonts(a.src)
    for weight, c in enumerate(cards, 1):
        d = c["slug"]
        v = versions[d]
        ver = "v" + re.sub(r"\.0$", "", v["version"])  # 网站上的版本号同 S-1：1.0.0 → v1.0，1.1.1 → v1.1.1
        for kind in ("pdf", "html"):
            if sha256(os.path.join(a.src, v["files"][kind]["path"])) != v["files"][kind]["sha256"]:
                sys.exit(f"{d}: {kind} 和 versions.json 里 {v['version']} 的校验和不同：译文改了却没有发新版本")
        base = f"claude-{names[d]}-system-card-zh"  # 网址里的文件名；下载时用译文仓库的原文件名
        root, vdir = os.path.join(OUT, d), os.path.join(OUT, d, ver)
        os.makedirs(os.path.join(vdir, "files"))
        h_src, p_src = os.path.join(a.src, d, c["html"]), os.path.join(a.src, d, c["pdf"])
        h_dst, p_dst = os.path.join(vdir, "files", base + ".html.raw"), os.path.join(vdir, "files", base + ".pdf")
        shutil.copyfile(h_src, h_dst)
        pdf = dict(file=f"files/{base}.pdf", name=c["pdf"])
        if os.path.getsize(p_src) > LIMIT:
            n = slim_pdf(p_src, p_dst)
            pdf.update(slimmed=True, sourceBytes=os.path.getsize(p_src), sourceSha256=sha256(p_src))
            print(f"{d}: PDF {os.path.getsize(p_src) / 2**20:.1f} MiB → {os.path.getsize(p_dst) / 2**20:.1f} MiB（合并 {n} 个重复的流）")
            if os.path.getsize(p_dst) > LIMIT:
                sys.exit(f"{d}: 无损瘦身后仍超过 25 MiB，需要另想办法")
        else:
            shutil.copyfile(p_src, p_dst)
        pdf.update(bytes=os.path.getsize(p_dst), sha256=sha256(p_dst), bookmarks=len(pikepdf.open(p_dst).open_outline().root) > 0)
        html = dict(file=f"files/{base}.html.raw", name=c["html"], bytes=os.path.getsize(h_dst), sha256=sha256(h_dst))
        if a.check_links:
            r = urllib.request.Request(c["official"], headers={"User-Agent": "Mozilla/5.0"})
            if urllib.request.urlopen(r).status != 200:
                sys.exit(f"英文原版打不开：{c['official']}")

        # 网页版：按章拆分的重排版和原版版式（chapters.py）
        md_path = next(os.path.join(a.src, d, "md", f) for f in os.listdir(os.path.join(a.src, d, "md")) if f.endswith(".md"))
        chs = chapters.split_md(open(md_path, encoding="utf-8").read(), c["pages"])
        f22 = c["facts"]
        fonts.begin_card()
        for k, ch in enumerate(chs, 1):
            cdir = os.path.join(vdir, ch["slug"])
            os.makedirs(cdir)
            for img in chapters.images_in(ch["lines"]):
                # 重排版的配图存成 WebP（q90，比 PNG 小得多）
                os.makedirs(os.path.join(cdir, "images"), exist_ok=True)
                webp = re.sub(r"\.\w+$", ".webp", img)
                im = Image.open(os.path.join(a.src, d, "md", img))
                im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")  # 透明的部分保持透明（WebP 支持），不变成黑底
                if im.width > 1600:  # 最宽 1600px（同站内其他文章配图的最大一档）；网页上原样用，不再由 Hugo 处理（上千张图每次构建都处理太慢）
                    im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
                im.save(os.path.join(cdir, webp), quality=90, method=6)
                ch["lines"] = [l.replace(f"]({img})", f"]({webp})") for l in ch["lines"]]
            fonts.begin_chapter()
            sheets = chapters.original_pages(p_src, range(ch["pages"][0], ch["pages"][1] + 1), fonts, os.path.join(cdir, "bg"))
            style = fonts.write_chapter(os.path.join(cdir, "fonts"))  # 这一章的中文字体子集和字体的占位
            open(os.path.join(cdir, "original.html"), "w", encoding="utf-8").write(style + "\n".join(sheets) + "\n")
            # 这一章里有没有译者另行翻译的部分（2.2 节、零散段落）：目录里标出来
            sep = ch["pages"][0] <= f22["s22"][1] and f22["s22"][0] <= ch["pages"][1]
            sep = sep or any(ch["pages"][0] <= int(p) <= ch["pages"][1] for p in re.findall(r"\d+", f22["scatteredPages"]))
            ch.update(separate=sep)
            write_page(os.path.join(cdir, "index.md"), dict(
                title=ch["title"], weight=k, pages=ch["pages"],
                description=f"{c['title']}中文译本 {ver} · {ch['title']}（非官方，AI 翻译）"), chapters.to_hugo(ch))
        fonts.write_card(os.path.join(vdir, "fonts"))  # 这份卡的中文字体，各章共用
        toc = [dict(slug=ch["slug"], title=ch["title"], pages=ch["pages"], included=True, separate=ch["separate"]) for ch in chs]
        cascade = dict(build=dict(list="local", publishResources=False))
        write_page(os.path.join(vdir, "_index.md"), dict(
            title=f"{c['title']}中文译本 {ver}", description=f"{c['title']}中文译本 {ver} 的目录和全文下载（非官方，AI 翻译）", version=ver, repoVersion=v["version"], tag=v["tag"], versionDate=v["date"],
            sourceCommit=commit, date=a.date, weight=1, titleEn=c["titleEn"], released=c["released"], pages=c["pages"], official=c["official"],
            facts=c["facts"], chapters=toc, downloads=dict(html=html, pdf=pdf), build=cascade["build"], cascade=cascade))
        fm = dict(titleEn=c["titleEn"], released=c["released"], pages=c["pages"], official=c["official"], date=a.date, weight=weight,
                  latest=ver, sourceCommit=commit, sourceDate=commit_date, facts=c["facts"])
        write_page(os.path.join(root, "_index.md"), dict(
            title=c["title"] + "中文译本",
            description=f"Anthropic《{c['titleEn']}》（{c['pages']}\u00a0页）的非官方中文译本，AI 翻译，可在线阅读，也可下载 HTML 和 PDF。",
            **fm))
        write_page(os.path.join(root, "_index.en.md"), dict(
            title=f"{c['titleEn']} — Unofficial Chinese Translation",
            description=f"An unofficial, AI-produced Chinese translation of Anthropic's {c['titleEn']} ({c['pages']} pages).",
            **fm))
        print(f"{d}: {ver}，{len(chs)} 章，{c['pages']} 页")

    fdir = os.path.join(REPO, "static/translations/system-cards/fonts")
    shutil.rmtree(fdir, ignore_errors=True)
    css = fonts.write(fdir).replace("url(fonts/", "url(/translations/system-cards/fonts/")
    open(os.path.join(REPO, "assets/css/extended/syscards-fonts.css"), "w", encoding="utf-8").write(
        "/* 系统卡原版版式文字层用的西文字体（tools/syscard-import 按全部卡用到的字取子集生成，不要手改）；只在打开原版版式时下载。\n   中文字体每份卡一份（版本目录 fonts/），@font-face 在各章 original.html 开头 */\n" + css)

    common = dict(type="syscards", date=a.date, sourceCommit=commit, sourceDate=commit_date,
                  cascade=dict(type="syscards"), ShowReadingTime=False, ShowWordCount=False, hideAuthor=True)
    write_page(os.path.join(OUT, "_index.md"), dict(
        title="Anthropic 系统卡中文译本",
        description=f"Anthropic 发布的 {len(cards)} 份 Claude 模型系统卡（System Card）的非官方中文译本，AI 翻译，可在线阅读，也可下载 HTML 和 PDF。",
        # 「译文」栏目列表（PaperMod）显示 summary，同其他译文条目有一行灰色摘要；栏目页没有正文，所以写在这里
        summary=f"Anthropic 发布的 {len(cards)} 份 Claude 模型系统卡（System Card）的非官方中文译本，AI 翻译，可在线阅读，也可下载 HTML 和 PDF。",
        **common))
    write_page(os.path.join(OUT, "_index.en.md"), dict(
        title="Anthropic System Cards — Unofficial Chinese Translations",
        description=f"Unofficial, AI-produced Chinese translations of {len(cards)} Claude model system cards published by Anthropic.",
        summary=f"Unofficial, AI-produced Chinese translations of {len(cards)} Claude model system cards published by Anthropic.",
        **common))
    print(f"导入 {len(cards)} 份系统卡，译文仓库提交 {commit[:7]}（{commit_date}）")
    # 下载文件加译者声明：声明的文字取自网站卡片首页，所以要在上面的页面都写好之后
    spec = importlib.util.spec_from_file_location("syscard_release", os.path.join(HERE, "release.py"))
    release = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(release)
    release.main(["--only", ",".join(c["slug"] for c in cards)])


if __name__ == "__main__":
    main()
