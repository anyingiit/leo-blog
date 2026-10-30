"""系统卡的网页版：按章拆分的重排版（译文仓库的 Markdown）和原版版式（PDF 每页一张去掉文字的底图 + 一层按 PDF 坐标排的文字）。

重排版：译文仓库 md/ 里的 Markdown 用 <!-- p.N --> 标出原版第 N 页从哪里开始；按二级标题（## 执行摘要、## 1 引言……）拆成章，
  第 1 页（标题前的封面）单独一章。页码标记换成和 S-1 译本相同的分页线（{{< s1-page N >}}：第 N 页到此结束）。
原版版式：PDF 每页拆成两层，叠起来和 PDF 逐像素几乎相同（test_import.py 对比渲染结果）：
  - 底图：去掉流水线排入的文字（中文和沿用英文的字体，见 FONTS）后渲染成 WebP，留下原版的图、线、色块和流水线没动过的原文文字；
  - 文字层：一个 SVG，每段文字一个 <text>，每个字的横坐标取自 PDF（x 列表），字体是流水线排版用的同一套字体（按全部卡用到的字取子集）。
    文字可以选中、复制、在页内搜索；字体只在打开原版版式时才下载。
  字体里没有的字（PDF 的 ToUnicode 偶尔把一个字形映射到不相干的码位，比如两字线「——」映射成 U+054C）这一段留在底图上，不进文字层。
"""
import html
import math
import os
import re

import pymupdf
from fontTools import subset as ftsub
from fontTools.ttLib import TTFont

# 流水线排入文字用的字体：PDF 里的字体名（去掉非字母、小写）→ 译文仓库 opus-5.5/pipeline/fonts/ 里的文件
FONTS = {
    "loraregular": "Lora-Regular.ttf", "lorabold": "Lora-Bold.ttf", "loraitalic": "Lora-Italic.ttf",
    "lorabolditalic": "Lora-BoldItalic.ttf", "lorasemibold": "Lora-Bold.ttf",
    "notoserifcjkscregular": "NotoSerifCJKSC.otf", "notoserifcjkscbold": "NotoSerifCJKSCBold.otf",
    "notosanscjkscregular": "NotoSansCJKSC.otf", "notosanscjkscbold": "NotoSansCJKSCBold.otf",
    "notosanscjkscmedium": "NotoSansCJKSCMedium.otf", "notosansmonocjkscregular": "NotoSansMonoCJKSC.otf",
    "poppinsmedium": "Poppins-Medium.ttf", "poppinssemibold": "Poppins-SemiBold.ttf", "robotomonoregular": "RobotoMono-Regular.ttf",
}
FONT_DIR = "opus-5.5/pipeline/fonts"
SCALE = 2  # 底图 2 倍（612pt 宽的页 → 1224px），和 S-1 原版里的图片同一清晰度


def font_class(f):
    return "sc-" + re.sub(r"[^a-z0-9]", "", f.split(".")[0].lower())


class Fonts:
    """全部卡共用的字体子集：记下每种字体用到的字，最后一次性生成 woff2 和 @font-face"""

    def __init__(self, src):
        self.dir = os.path.join(src, FONT_DIR)
        self.cmaps = {f: set(TTFont(os.path.join(self.dir, f)).getBestCmap()) for f in set(FONTS.values())}
        self.used = {}

    def file_for(self, pdf_font):
        return FONTS.get(re.sub(r"[^a-z]", "", pdf_font.lower()))

    def covers(self, f, text):
        return all(ord(c) in self.cmaps[f] for c in text)

    def use(self, f, text):
        self.used.setdefault(f, set()).update(text)

    def write(self, out_dir):
        """生成 out_dir/<字体>.woff2，返回 CSS（@font-face 和对应的 class）"""
        os.makedirs(out_dir, exist_ok=True)
        css = []
        for f in sorted(self.used):
            tt = TTFont(os.path.join(self.dir, f))
            o = ftsub.Options()
            o.flavor = "woff2"
            o.layout_features = ["*"]
            s = ftsub.Subsetter(o)
            s.populate(text="".join(sorted(self.used[f])))
            s.subset(tt)
            name = f.split(".")[0] + ".woff2"
            tt.flavor = "woff2"
            tt.save(os.path.join(out_dir, name))
            fam = font_class(f)
            css.append(f'@font-face {{ font-family: "{fam}"; src: url(fonts/{name}) format("woff2"); font-display: block; }}')
            css.append(f'.{fam} {{ font-family: "{fam}"; }}')
        return "\n".join(css) + "\n"


def original_pages(pdf_path, pages, fonts, out_dir):
    """把 PDF 的这些页（从 1 数）转成原版版式：底图写到 out_dir/pNNN.webp，返回每页的 HTML（s1-sheet）列表"""
    from PIL import Image
    doc = pymupdf.open(pdf_path)
    os.makedirs(out_dir, exist_ok=True)
    sheets = []
    for pno in pages:
        page = doc[pno - 1]
        raw = page.get_text("rawdict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE | pymupdf.TEXT_PRESERVE_LIGATURES)
        texts = []
        for b in raw["blocks"]:
            if b["type"] != 0:
                continue
            for line in b["lines"]:
                dx, dy = line["dir"]
                for s in line["spans"]:
                    f = fonts.file_for(s["font"])
                    chars = s["chars"]
                    txt = "".join(c["c"] for c in chars)
                    if not f or not chars or not fonts.covers(f, txt):
                        continue  # 留在底图上
                    page.add_redact_annot(s["bbox"])
                    # 空格不画东西，但网站压缩 HTML 时会去掉首尾的空格、把连续空格并成一个，字和横坐标就对不上了：
                    # 去掉首尾空格，连续空格只留第一个（复制出来的英文单词之间仍有空格）
                    chars = [c for i, c in enumerate(chars) if not (c["c"].isspace() and (i == 0 or chars[i - 1]["c"].isspace()))]
                    while chars and chars[-1]["c"].isspace():
                        chars.pop()
                    txt = "".join(c["c"] for c in chars)
                    if not txt:
                        continue
                    fonts.use(f, txt)
                    x0, y = chars[0]["origin"]
                    if (round(dx, 3), round(dy, 3)) == (1.0, 0.0):
                        xs, tr = " ".join(f"{c['origin'][0]:.2f}" for c in chars), ""
                    else:
                        xs, tr = f"{x0:.2f}", f' transform="rotate({math.degrees(math.atan2(dy, dx)):.1f} {x0:.2f} {y:.2f})"'
                    fill = "" if s["color"] == 0 else f' fill="#{s["color"]:06x}"'
                    texts.append(f'<text x="{xs}" y="{y:.2f}" font-size="{s["size"]:.2f}" class="{font_class(f)}"{fill}{tr}>{html.escape(txt, quote=False)}</text>')
        # 原版里的外部链接：在文字层上按 PDF 的链接区域放透明的可点区域（内部跳转在 PDF 里已经丢失，见译文仓库各卡 README）
        for ln in page.get_links():
            if ln.get("kind") == pymupdf.LINK_URI and ln.get("uri", "").startswith(("http://", "https://")):
                r = ln["from"]
                texts.append(f'<a href="{html.escape(ln["uri"])}" rel="noopener"><rect x="{r.x0:.2f}" y="{r.y0:.2f}" width="{r.width:.2f}" height="{r.height:.2f}" fill="transparent"/></a>')
        page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
                              text=pymupdf.PDF_REDACT_TEXT_REMOVE)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE))
        name = f"p{pno:03d}.webp"
        Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(os.path.join(out_dir, name), quality=80, method=6)
        w, h = page.rect.width, page.rect.height
        sheets.append(
            f'<div class="s1-sheet sc-sheet" style="width:{w:g}pt;height:{h:g}pt">'
            f'<img class="sc-bg" src="scimg:{name}" alt="" width="{pix.width}" height="{pix.height}">'
            f'<svg viewBox="0 0 {w:g} {h:g}" xmlns="http://www.w3.org/2000/svg" aria-label="原文第 {pno} 页">{"".join(texts)}</svg></div>')
    return sheets


RE_PAGE = re.compile(r"^<!-- p\.(\d+) -->$")
NAMED = {"更新日志": "changelog", "执行摘要": "summary", "脚注": "footnotes", "参考文献": "references", "附录": "appendix"}


def chapter_slug(title, used):
    m = re.match(r"(\d+)\s", title)
    s = f"section-{m.group(1)}" if m else NAMED.get(title, "")
    if not s or s in used:
        s = f"part-{len(used) + 1}"
    used.add(s)
    return s


def split_md(md, total_pages):
    """拆章：返回 [{slug, title, pages: [起, 止], lines}]；lines 是这一章的 Markdown 行（不含章标题，含页码标记）"""
    lines = md.split("\n")
    first = next(i for i, l in enumerate(lines) if RE_PAGE.match(l))  # 标题、日期和「关于本译本」在第 1 页标记之前，不要（声明在网站上统一写）
    lines = lines[first:]
    heads = [i for i, l in enumerate(lines) if l.startswith("## ")]
    chapters, used = [], set()
    bounds = [(0, "封面")] + [(i, lines[i][3:].strip()) for i in heads]
    for k, (start, title) in enumerate(bounds):
        end = bounds[k + 1][0] if k + 1 < len(bounds) else len(lines)
        body = lines[start + (1 if k else 0):end]
        # 下一章开头那页的页码标记写在下一章标题前面，归下一章
        while body and (not body[-1].strip() or RE_PAGE.match(body[-1])):
            body.pop()
        before = [int(RE_PAGE.match(l).group(1)) for l in lines[:start + 1] if RE_PAGE.match(l)]
        p0 = before[-1] if before else 1
        inner = [int(RE_PAGE.match(l).group(1)) for l in body if RE_PAGE.match(l)]
        p1 = max([p0] + inner)
        chapters.append(dict(slug="cover" if k == 0 else chapter_slug(title, used), title=title, pages=[p0, p1], lines=body))
    # 页码连续：Markdown 里没有的页（原版的目录页、空白页）归前一章，原版版式里照样显示；
    # 下一章从新的一页开始时这一章到它前一页为止，否则两章共用那一页。最后一章到全书最后一页
    for k, ch in enumerate(chapters):
        if k + 1 < len(chapters):
            nxt = chapters[k + 1]
            prev = [l for l in lines[:bounds[k + 1][0]] if l.strip()]
            fresh = bool(prev) and RE_PAGE.match(prev[-1])
            ch["pages"][1] = max(ch["pages"][1], nxt["pages"][0] - (1 if fresh else 0))
        else:
            ch["pages"][1] = total_pages
    return chapters


def _escape_inline(text):
    """代码以外的 < 和 $：站点没开 unsafe，原样 HTML 会被丢掉；$ 不能被当成公式（docs/testing.md）"""
    parts = re.split(r"(`+[^`]*`+)", text)
    for i in range(0, len(parts), 2):
        parts[i] = re.sub(r"(?<!\\)\$", r"\\$", parts[i].replace("<", "&lt;"))
    return "".join(parts)


def to_hugo(ch):
    """一章的 Markdown → Hugo：页码标记换成分页线（这一页到此结束），图片指向章目录里的 images/"""
    out, fence = [], False
    p0 = ch["pages"][0]
    for l in ch["lines"]:
        m = RE_PAGE.match(l)
        if l.startswith("```"):
            fence = not fence
            out.append(l)
        elif fence:
            out.append(l)
        elif m:
            n = int(m.group(1))
            if n > p0:
                out.append("{{< s1-page %d >}}" % (n - 1))
        else:
            out.append(_escape_inline(l))
    text = "\n".join(out).strip("\n")
    return re.sub(r"\n{3,}", "\n\n", text) + "\n"


def images_in(lines):
    return sorted(set(re.findall(r"!\[[^\]]*\]\((images/[^)\s]+)\)", "\n".join(lines))))
