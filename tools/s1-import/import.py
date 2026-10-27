#!/usr/bin/env python3
"""把 S-1 中文译文（Typora 导出的 .md + 按原版排版翻译的 .html + 中文配图）拆成博客里的一个译本版本。

只用 Python 标准库，在 Mac 上直接运行：

    python3 tools/s1-import/import.py \
        --md  "~/Downloads/Anthropic S-1 中文译文/Anthropic S-1 中文译文.md" \
        --html "~/Downloads/Anthropic S-1 中文译文/Anthropic S-1 中文译文.html" \
        --images "~/Downloads/Anthropic S-1 中文译文/图片中文版" \
        --images "~/Downloads/Anthropic, PBC - S-1 (Q2)_files" \
        --root content/translations/anthropic-s1 --version v1.0 \
        --filed 2026-10-26 --captured 2026-10-26T16:16:00Z \
        --source https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/anthropicpbc-sx1.htm

每个版本写成 <root>/<version>/，每章一个文件夹：
  index.md       重排版正文（Hugo Markdown；原文页码、上标、换行改成短代码，美元符号转义）
  original.html  原版版式（译文 HTML 里属于这一章的整页，图片换成 s1img: 占位，由模板转成 WebP）
配图复制到 assets/translations/anthropic-s1/img/，同名图片内容不同时报错，不会悄悄覆盖旧版本用的图。
已存在的版本目录不会被覆盖（历史版本只增不改），除非加 --force。
"""
import argparse, datetime, hashlib, json, os, re, shutil, sys, tempfile, urllib.parse

# 章节标题 → 网址里的英文名（S-1 的标准章节）；没收录的用序号
SLUGS = {
    "部分术语释义": "selected-definitions", "招股说明书概要": "prospectus-summary", "本次发行": "the-offering",
    "合并财务及其他数据概要": "summary-financial-data", "风险因素": "risk-factors",
    "关于前瞻性陈述的特别说明": "forward-looking-statements", "行业、市场及其他数据": "industry-data",
    "所得款项用途": "use-of-proceeds", "股息政策": "dividend-policy", "资本总额": "capitalization", "摊薄": "dilution",
    "管理层对财务状况及经营业绩的讨论与分析": "mdna", "业务": "business",
    "我们的治理结构及其目标": "governance", "管理层": "management", "高管薪酬": "executive-compensation",
    "若干关系及关联人交易": "related-party-transactions", "主要股东及出售股东": "principal-stockholders",
    "股本说明": "description-of-capital-stock", "未来可供出售的股份": "shares-eligible-for-future-sale",
    "对我们A类普通股非美国持有人的重大美国联邦所得税后果": "tax-considerations", "承销": "underwriting",
    "法律事项": "legal-matters", "在何处可以找到更多信息": "additional-information",
    "独立注册会计师事务所报告": "financial-statements", "第二部分": "part-ii", "附件索引": "exhibit-index",
    "签名": "signatures", "授权书": "power-of-attorney",
}
PAGE_MARK = re.compile(r"<!-- 原文第 (\d+) 页[^>]*-->")
PAGE_START = '<div style="--justify:justify;'
IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")


def chapters(md):
    """按一级标题切章；同一页开始的几个标题合成一章（原版页面不能从中间切开）。"""
    marks = [(int(m.group(1)), m.start()) for m in PAGE_MARK.finditer(md)]
    heads = []
    for m in re.finditer(r"^# (.+)$", md, re.M):
        page = sum(1 for _, pos in marks if pos < m.start()) + 1
        heads.append({"title": m.group(1).strip(), "start": m.start(), "page": page})
    merged = []
    for h in heads:
        if merged and merged[-1]["page"] == h["page"]:
            merged[-1]["titles"].append(h["title"])
        else:
            merged.append({"titles": [h["title"]], "start": h["start"], "page": h["page"]})
    merged[0]["start"] = 0  # 第一个标题之前的内容（封面）归第一章
    # 章首前一页只有图片的，是这一章的整页分隔图（原文目录的章节锚点就在分隔图上），归入这一章
    ends = {int(m.group(1)): m.end() for m in PAGE_MARK.finditer(md)}  # 第 n 页的内容在第 n-1 页标记和第 n 页标记之间
    for c in merged[1:]:
        p = c["page"] - 1
        if p - 1 not in ends or p not in ends:
            continue
        page = md[ends[p - 1]:ends[p]]
        if "![" in page and not IMAGE.sub("", PAGE_MARK.sub("", page)).strip():
            c["page"], c["start"] = p, ends[p - 1]
    last_page = marks[-1][0] if marks else 1
    for i, c in enumerate(merged):
        nxt = merged[i + 1] if i + 1 < len(merged) else None
        c["end"] = nxt["start"] if nxt else len(md)
        c["last_page"] = nxt["page"] - 1 if nxt else last_page
    return merged


def slug_for(i, c, used):
    s = next((SLUGS[t] for t in c["titles"] if t in SLUGS), None)
    if i == 0:
        s = "cover"
    elif c["titles"] == ["Anthropic, PBC"]:  # 财务报表部分的扉页
        s = "financial-statements-cover"
    s = s or f"part-{i + 1:02d}"
    base, n = s, 2
    while s in used:  # 例如两份会计师报告
        s, n = f"{base}-{n}", n + 1
    used.add(s)
    return s


def to_hugo_md(text, img_names):
    """Typora Markdown → Hugo Markdown（站点没开 unsafe，原样 HTML 会被丢掉）。"""
    def img(m):
        name = os.path.basename(urllib.parse.unquote(m.group(1) or m.group(2)))
        img_names.add(name)
        return f"![原文配图](translations/anthropic-s1/img/{name})"
    # Typora 对含空格、括号的路径写成 ![](<路径>)
    text = re.sub(r"!\[[^\]]*\]\((?:<([^>]+)>|([^)\s]+))\)", img, text)
    text = PAGE_MARK.sub(lambda m: "{{< s1-page %s >}}" % m.group(1), text)
    # 译文 HTML 里有些整句被包在 <sup> 里（原文的 15th、脚注标记翻译后范围错位），只保留像脚注标记的短上标
    text = re.sub(r"<sup>([^<]*)</sup>", lambda m: m.group(0) if re.fullmatch(r"[\d()*†‡§,，a-z ]{1,12}", m.group(1)) else m.group(1), text)
    text = re.sub(r"<(/?sup|br\s*/?)>", lambda m: '{{< s1-raw "<%s>" >}}' % m.group(1).replace(" ", ""), text)
    text = re.sub(r"(?<!\\)\$", r"\\$", text)  # 美元金额不能被当成公式（docs/testing.md）
    text = text.replace("\\(", "(").replace("\\[", "&#91;")  # \( \[ 也是站点的公式定界符
    return text


def split_pages(html):
    starts = [m.start() for m in re.finditer(re.escape(PAGE_START), html)]
    end = html.rfind("</div>", 0, html.find("\n</text>"))  # 最外层灰底容器的结束标签
    return [html[s:(starts[i + 1] if i + 1 < len(starts) else end)] for i, s in enumerate(starts)]


def to_fragment(pages, img_names):
    def src(m):
        name = os.path.basename(urllib.parse.unquote(m.group(1)))
        img_names.add(name)
        return f'src="s1img:{name}"'
    out = re.sub(r'src="(?!data:)([^"]+)"', src, "".join(pages))
    return out


def front(d):
    return "---\n" + "".join(f"{k}: {json.dumps(v, ensure_ascii=False)}\n" for k, v in d.items()) + "---\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--md", required=True)
    ap.add_argument("--html", required=True)
    ap.add_argument("--images", action="append", default=[], help="配图目录，可给多个，前面的优先（中文版放前面）")
    ap.add_argument("--root", required=True, help="译文在 content/ 下的目录")
    ap.add_argument("--assets", default="assets/translations/anthropic-s1/img")
    ap.add_argument("--version", required=True)
    ap.add_argument("--filed", required=True, help="原文提交日期")
    ap.add_argument("--captured", required=True, help="原文采集时间（ISO 8601）")
    ap.add_argument("--source", required=True, help="原文网址")
    ap.add_argument("--form", default="S-1", help="原文文件类型，例如 S-1、S-1/A")
    ap.add_argument("--date", default=datetime.date.today().isoformat(), help="本版译文定稿日期，默认今天")
    ap.add_argument("--notes", default="", help="本版说明（更新了什么）")
    ap.add_argument("--pages", help="只导入这些原文页，例如 1-15（预览用节选）")
    ap.add_argument("--weight", type=int, default=1, help="版本排序，越新越小")
    ap.add_argument("--extra", action="append", default=[], help="额外写进版本 front matter 的 key=value")
    ap.add_argument("--title", action="append", default=[], metavar="SLUG=标题",
                    help="改某章在目录里的标题，例如两份同名的会计师报告要区分开")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    a.titles = dict(t.split("=", 1) for t in a.title)

    md = open(os.path.expanduser(a.md), encoding="utf-8").read()
    pages = split_pages(open(os.path.expanduser(a.html), encoding="utf-8").read())
    n_marks = len(PAGE_MARK.findall(md))
    if n_marks != len(pages):
        sys.exit(f"页数对不上：Markdown 有 {n_marks} 个页码标记，HTML 有 {len(pages)} 页")
    lo, hi = 1, len(pages)
    if a.pages:
        lo, hi = map(int, a.pages.split("-"))

    final = os.path.join(a.root, a.version)
    if os.path.exists(final) and not a.force:
        sys.exit(f"{final} 已存在：历史版本只增不改，新版本请换一个 --version（或加 --force 重写）")
    # 先写到临时目录，全部成功（包括配图检查）后再换上去，中途失败不会留下半个版本
    vdir = tempfile.mkdtemp(prefix=f"s1-import-{a.version}-")  # 不放在 content 里，失败时不会被当成一个版本发布

    used, img_names, toc = set(), set(), []
    all_ch = chapters(md)
    for i, c in enumerate(all_ch):
        slug = slug_for(i, c, used)
        title = a.titles.get(slug) or ("封面与目录" if i == 0 else "合并财务报表索引" if slug == "financial-statements-cover"
                                       else " · ".join(c["titles"]))
        included = c["page"] >= lo and c["last_page"] <= hi
        toc.append({"slug": slug, "title": title, "pages": [c["page"], c["last_page"]], "included": included})
        if not included:
            continue
        body = md[c["start"]:c["end"]]
        if i > 0:
            body = re.sub(r"^# .+\n", "", body, count=1)
        cdir = os.path.join(vdir, slug)
        os.makedirs(cdir)
        with open(os.path.join(cdir, "index.md"), "w", encoding="utf-8") as f:
            f.write(front({"title": title, "weight": i + 1, "pages": [c["page"], c["last_page"]],
                           "description": f"Anthropic, PBC {a.form} 非官方中文译本（AI 翻译，译文一致性未经人工核对）{a.version} · {title}"}))
            f.write(to_hugo_md(body, img_names))
        with open(os.path.join(cdir, "original.html"), "w", encoding="utf-8") as f:
            f.write(to_fragment(pages[c["page"] - 1:c["last_page"]], img_names))

    # 原版里的目录链接（#id）跨章后要指到对应章节
    id_to_slug = {}
    for t in toc:
        p = os.path.join(vdir, t["slug"], "original.html")
        if os.path.exists(p):
            for m in re.finditer(r'\bid="([^"]+)"', open(p, encoding="utf-8").read()):
                id_to_slug[m.group(1)] = t["slug"]
    for t in toc:
        p = os.path.join(vdir, t["slug"], "original.html")
        if not os.path.exists(p):
            continue
        s = open(p, encoding="utf-8").read()
        s = re.sub(r'href="#([^"]+)"', lambda m: f'href="../{id_to_slug[m.group(1)]}/#{m.group(1)}"'
                   if id_to_slug.get(m.group(1), t["slug"]) != t["slug"] else m.group(0), s)
        open(p, "w", encoding="utf-8").write(s)

    meta = {"title": f"{a.form} 非官方中文译本 {a.version}",
            "description": f"Anthropic, PBC {a.form}（{a.filed} 提交）的非官方中文译本 {a.version}，AI 翻译，译文一致性未经人工核对", "version": a.version, "form": a.form, "filed": a.filed,
            "captured": a.captured, "source": a.source, "date": a.date, "notes": a.notes,
            "weight": a.weight, "excerpt": bool(a.pages), "chapters": toc}
    # 版本页和章节不进首页 RSS、站内搜索（site.RegularPages），仍在本版本的 .Pages 里
    # 版本页另外输出单文件的完整 HTML（full.html，供下载；PDF 由 pdf.cjs 从它打印）
    meta["outputs"] = ["html", "s1full"]
    meta["build"] = {"list": "local", "publishResources": False}  # 下载文件由模板按需发布（.html.raw 发布成 .html）
    meta["cascade"] = {"build": {"list": "local", "publishResources": False}}  # 章节的 original.html 只在模板里读取，不单独发布
    for kv in a.extra:
        k, v = kv.split("=", 1)
        meta[k] = v
    with open(os.path.join(vdir, "_index.md"), "w", encoding="utf-8") as f:
        f.write(front(meta))

    dirs = [os.path.expanduser(d) for d in a.images]
    copies = []
    for name in sorted(img_names):
        src = next((os.path.join(d, name) for d in dirs if os.path.exists(os.path.join(d, name))), None)
        if not src:
            sys.exit(f"找不到配图 {name}（{vdir} 留着方便排查，正式目录没有改动）")
        dst = os.path.join(a.assets, name)
        if os.path.exists(dst):
            same = hashlib.sha256(open(dst, "rb").read()).digest() == hashlib.sha256(open(src, "rb").read()).digest()
            if not same:
                sys.exit(f"{dst} 已存在且内容不同：旧版本还在用它，请给新图换个文件名")
            continue
        copies.append((src, dst))
    os.makedirs(a.assets, exist_ok=True)
    for src, dst in copies:
        shutil.copyfile(src, dst)
    if os.path.exists(final):
        shutil.rmtree(final)
    shutil.move(vdir, final)
    vdir = final
    print(f"写入 {vdir}：{sum(t['included'] for t in toc)}/{len(toc)} 章，{len(img_names)} 张配图")


if __name__ == "__main__":
    main()
