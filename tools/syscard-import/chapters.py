"""系统卡的网页版：按章拆分的重排版（译文仓库的 Markdown）和原版版式（PDF 每页一张去掉文字的底图 + 一层按 PDF 坐标排的文字）。

重排版：译文仓库 md/ 里的 Markdown 用 <!-- p.N --> 标出原版第 N 页从哪里开始；按二级标题（## 执行摘要、## 1 引言……）拆成章，
  第 1 页（标题前的封面）单独一章。页码标记换成和 S-1 译本相同的分页线（{{< s1-page N >}}：第 N 页到此结束）。
原版版式：PDF 每页拆成两层，叠起来和 PDF 逐像素几乎相同（test_import.py 对比渲染结果）：
  - 底图：去掉流水线排入的文字（中文和沿用英文的字体，见 FONTS）后渲染成 WebP，留下原版的图、线、色块和流水线没动过的原文文字；
  - 文字层：一个 SVG，每段文字一个 <text>，每个字的横坐标取自 PDF（x 列表），字体是流水线排版用的同一套字体（西文按全部卡、中文按章用到的字取子集）。
    文字可以选中、复制、在页内搜索；字体只在打开原版版式时才下载。
  字体是译文仓库 shared-pipeline/fonts/ 里全部卡共用的那套（取全部卡用到的字，和 PDF 里的字形逐个核对过，见那里的 check_fonts.py）。
  PDF 的 ToUnicode 里没写文字的字形（连字「——」、fi、fl，按上下文换的 colon.case 等，PyMuPDF 读成 U+FFFD）：按 PDF 嵌入的
  字体自己的 cmap 和 GSUB 反查出文字，用网页字体按浏览器的排法（这一段打开连字和上下文替换）排出来的字形和 PDF 画的相同时才进文字层；
  零宽空格和 .notdef（什么也没画）去掉。仍排不出同样字形的段留在底图上（import.py 打印个数）。
"""
import base64
import html
import itertools
import math
import os
import re
import unicodedata

import pymupdf
from fontTools import subset as ftsub
from fontTools.ttLib import TTFont
import uharfbuzz as hb

# 流水线排入文字用的字体：PDF 里的字体名（去掉非字母、小写）→ 译文仓库 shared-pipeline/fonts/ 里的文件
FONTS = {
    "loraregular": "Lora-Regular.ttf", "lorabold": "Lora-Bold.ttf", "loraitalic": "Lora-Italic.ttf",
    "lorabolditalic": "Lora-BoldItalic.ttf", "lorasemibold": "Lora-Bold.ttf",
    "notoserifcjkscregular": "NotoSerifCJKSC.otf", "notoserifcjkscbold": "NotoSerifCJKSCBold.otf",
    "notosanscjkscregular": "NotoSansCJKSC.otf", "notosanscjkscbold": "NotoSansCJKSCBold.otf",
    "notosanscjkscmedium": "NotoSansCJKSCMedium.otf", "notosansmonocjkscregular": "NotoSansMonoCJKSC.otf",
    "poppinsmedium": "Poppins-Medium.ttf", "poppinssemibold": "Poppins-SemiBold.ttf", "robotomonoregular": "RobotoMono-Regular.ttf",
}
FONT_DIR = "shared-pipeline/fonts"
SCALE = 3  # 底图 3 倍（612pt 宽的页 → 1836px）：文字在 SVG 里本来就清晰，表格线和图表在 2x 屏上也不发软（2 倍时会）


def font_class(f):
    return "sc-" + re.sub(r"[^a-z0-9]", "", f.split(".")[0].lower())


PLAIN = {"kern": False, "liga": False, "clig": False, "calt": False}  # 文字层平常的排法（syscards.css 关掉连字和字距调整）
LIGA = {"kern": False, "liga": True, "clig": True, "calt": True}  # .sc-liga：含连字或上下文替换字形的段


def _outline(gs, name):
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    pen = DecomposingRecordingPen(gs)
    gs[name].draw(pen)
    return pen.value, gs[name].width


def glyph_texts(tt, cmap=None):
    """字形名 → 文字：cmap，再沿 GSUB 的单替换、多选一、连字反推（取最短的文字）"""
    out = {}
    for u, g in sorted((cmap or tt.getBestCmap()).items()):
        out.setdefault(g, chr(u))
    changed = "GSUB" in tt
    while changed:
        changed = False
        for lk in tt["GSUB"].table.LookupList.Lookup:
            for st in lk.SubTable:
                st = getattr(st, "ExtSubTable", st)
                pairs = [([a], b) for a, b in (getattr(st, "mapping", None) or {}).items() if isinstance(b, str)]
                pairs += [([a], b) for a, alts in (getattr(st, "alternates", None) or {}).items() for b in alts]
                pairs += [([a] + l.Component, l.LigGlyph) for a, ls in (getattr(st, "ligatures", None) or {}).items() for l in ls]
                for src, dst in pairs:
                    if all(x in out for x in src):
                        t = "".join(out[x] for x in src)
                        if dst not in out or len(t) < len(out[dst]):
                            out[dst] = t
                            changed = True
    return out


class PdfGlyphs:
    """PDF 里流水线排入的字体（PyMuPDF 嵌入，名字不带子集前缀；英文原版自己的字体带）：按字形号取字形和反查的文字"""

    def __init__(self, doc):
        self.doc, self.fonts, self.cmaps = doc, {}, {}

    def _font(self, xref):
        if xref not in self.fonts:
            self.fonts[xref] = None
            name, ext, typ, buf = self.doc.extract_font(xref)
            if buf and "+" not in name:
                import io
                try:
                    tt = TTFont(io.BytesIO(buf))
                    self.fonts[xref] = (tt["name"].getDebugName(6), tt, tt.getGlyphSet(), tt.getGlyphOrder())
                except Exception:
                    pass
        return self.fonts[xref]

    def lookup(self, page, ps, gid):
        """这一页上叫 ps 的流水线字体里第 gid 个字形：(文字, 轮廓)；找不到返回 None"""
        for f in page.get_fonts():
            info = self._font(f[0])
            if info and info[0] == ps and gid < len(info[3]):
                o = _outline(info[2], info[3][gid])
                if o[0]:
                    if len(info) == 4:
                        # 每次嵌入只带这一次用到的字的 cmap，连字的组成字可能不在里面：同名的各次嵌入合起来反查
                        if ps not in self.cmaps:
                            self.cmaps[ps] = {}
                            for x in sorted({g[0] for p in self.doc for g in p.get_fonts()}):
                                other = self._font(x)
                                if other and other[0] == ps:
                                    self.cmaps[ps].update(other[1].getBestCmap())
                        info += (glyph_texts(info[1], self.cmaps[ps]),)
                        self.fonts[f[0]] = info
                    return info[4].get(info[3][gid]), o
        return None


INLINE = 4096  # 只取一章用到的字后不超过这么大的字体直接写进页面（见 Fonts.write_chapter）


class Fonts:
    """文字层的字体子集。西文字体（Lora、Poppins、Roboto Mono）小，全部卡共用一份；中文字体大（全部卡用到的字取子集也有
    0.1–0.5 MB 一个），按章取子集：每章只下载这一章用到的字（网页性能预算，tests/perf.test.mjs）"""

    def __init__(self, src):
        self.dir = os.path.join(src, FONT_DIR)
        self.cmaps = {f: set(TTFont(os.path.join(self.dir, f)).getBestCmap()) for f in set(FONTS.values())}
        self.hb = {}  # 字体 → (HarfBuzz 字体, 每 em 单位数)，算浏览器排出来的字距（advance）
        self.outlines = {}  # 字体 → (字形轮廓, 字形顺序)
        self.used = {}  # 共用的字体 → 全部卡用到的字
        self.chapter = {}  # 这一章的字体 → 用到的字（begin_chapter 清空）
        self.left = []  # 留在底图上的流水线文字段：(页, PDF 字体, 文字)
        self.hidden = []  # PDF 里被盖住、看不见的流水线文字段（不进文字层）

    def file_for(self, pdf_font):
        return FONTS.get(re.sub(r"[^a-z]", "", pdf_font.lower()))

    def covers(self, f, text):
        return all(ord(c) in self.cmaps[f] for c in text)

    def use(self, f, text):
        self.chapter.setdefault(f, set()).update(text)
        if "CJK" not in f:
            self.used.setdefault(f, set()).update(text)

    def begin_chapter(self):
        self.chapter = {}

    def shaper(self, f):
        if f not in self.hb:
            face = hb.Face(hb.Blob.from_file_path(os.path.join(self.dir, f)))
            self.hb[f] = (hb.Font(face), face.upem)
        return self.hb[f]

    def glyphs(self, f, text, liga):
        """浏览器排这段文字用的字形（名字）和每个字形起点所在的字：不分语言（网页字体只留 dflt，见 _subset），
        liga 时打开连字和上下文替换（.sc-liga）"""
        font, upem = self.shaper(f)
        if f not in self.outlines:
            tt = TTFont(os.path.join(self.dir, f))
            self.outlines[f] = (tt.getGlyphSet(), tt.getGlyphOrder())
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        buf.language = "und"  # 不分语言（dflt），同 PDF 排版和网页字体
        buf.cluster_level = hb.BufferClusterLevel.MONOTONE_CHARACTERS
        hb.shape(font, buf, LIGA if liga else PLAIN)
        order = self.outlines[f][1]
        return [(order[i.codepoint], i.cluster) for i in buf.glyph_infos]

    def outline(self, f, name):
        gs = self.outlines[f][0]
        return _outline(gs, name)

    def layout(self, f, text, size, x0, xs, liga=False, idx=None):
        """浏览器只给起点时排出的逐字横坐标和 PDF 的一样吗：PDF 里每个字都按字体本身的字宽（不用字距调整、连字）排时是。
        一样时文字层只写起点，省掉逐字坐标（HTML 小很多），浏览器排出来的位置相同（syscards.css 里文字层关掉连字和字距调整）。
        用了字距调整的行仍写逐字坐标：WebKit 的 SVG 文字按字距调整排出来和 HarfBuzz 不同（差到 0.4pt）"""
        font, upem = self.shaper(f)
        for feats in (LIGA if liga else PLAIN,):
            buf = hb.Buffer()
            buf.add_str(text)
            buf.guess_segment_properties()
            buf.language = "und"
            buf.cluster_level = hb.BufferClusterLevel.MONOTONE_CHARACTERS
            hb.shape(font, buf, feats)
            starts, x = {}, 0
            for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
                starts.setdefault(info.cluster, x + pos.x_offset)
                x += pos.x_advance
            idx = range(len(text)) if idx is None else idx  # 各个 PDF 字形从第几个字开始（连字的后几个字没有自己的位置）
            if all(i in starts and abs(x0 + starts[i] / upem * size - x) < 0.01 for i, x in zip(idx, xs)):
                return True
        return False

    def _subset(self, f, chars, path):
        tt = TTFont(os.path.join(self.dir, f), recalcTimestamp=False)  # 保留原字体的时间戳，重新导入结果不变
        # 只留各文种的默认语言（dflt）：PDF 排版（PyMuPDF）不指定语言，用的是 dflt；页面是 lang="zh"，HarfBuzz（Chromium、
        # WebKit 非 Apple 平台）会取 ZHS 的 locl，把汉字旁边的「—」「——」换成居中的全角字形（PDF 里是偏下的西文破折号），
        # 字宽也不同。去掉各语言后浏览器只能用 dflt，和 PDF 一样。思源的 locl 还给 JAN/KOR/ZHT/ZHH 各带几百个字形变体，
        # 按 "*" 取子集会全部跟进来，去掉后也不再带
        for tag in ("GSUB", "GPOS"):
            if "CJK" in f and tag in tt:
                for sr in tt[tag].table.ScriptList.ScriptRecord:
                    sr.Script.LangSysRecord = []
                    sr.Script.LangSysCount = len(sr.Script.LangSysRecord)
        o = ftsub.Options()
        o.flavor = "woff2"
        o.layout_features = ["*"]
        s = ftsub.Subsetter(o)
        # 每个子集都带上空格：WebKit 遇到没有空格的子集，会去找同名的前一个 @font-face（如共用的 Lora）补空格，多下载一个整字体
        s.populate(text="".join(sorted(chars | {" "})))
        s.subset(tt)
        tt.flavor = "woff2"
        tt.save(path)

    @staticmethod
    def _face(f, url):
        fam = font_class(f)
        return f'@font-face {{ font-family: "{fam}"; src: url({url}) format("woff2"); font-display: block; }}\n.{fam} {{ font-family: "{fam}"; }}'

    def write(self, out_dir):
        """共用字体：生成 out_dir/<字体>.woff2，返回 CSS（@font-face 和对应的 class）"""
        os.makedirs(out_dir, exist_ok=True)
        css = []
        for f in sorted(self.used):
            name = f.split(".")[0] + ".woff2"
            self._subset(f, self.used[f], os.path.join(out_dir, name))
            css.append(self._face(f, f"fonts/{name}"))
        return "\n".join(css) + "\n"

    def write_chapter(self, out_dir):
        """这一章的字体，返回放在原版版式开头的 <style>（没有要写的返回空串）：
        - 只取这一章用到的字后不超过 INLINE 字节的字体（几 KB 的 Poppins、Lora 粗斜体、等宽中文等）直接写进 <style>（data: 网址），
          不再单独请求；同名的共用 @font-face 在样式表里，这里的写在后面，浏览器用这里的
        - 其余的中文字体生成 out_dir/<字体>.woff2，网址写成占位 scfont:<文件名>，模板换成发布后的地址（同底图的 scimg:）
        - 其余的西文字体用共用的一份（write）"""
        css = []
        for f in sorted(self.chapter):
            name = f.split(".")[0] + ".woff2"
            path = os.path.join(out_dir, name)
            os.makedirs(out_dir, exist_ok=True)
            self._subset(f, self.chapter[f], path)
            data = open(path, "rb").read()
            if len(data) <= INLINE:
                os.remove(path)
                css.append(self._face(f, "data:font/woff2;base64," + base64.b64encode(data).decode()))
            elif "CJK" in f:
                css.append(self._face(f, f"scfont:{name}"))
            else:
                os.remove(path)
        if os.path.isdir(out_dir) and not os.listdir(out_dir):
            os.rmdir(out_dir)
        return "<style>" + "\n".join(css) + "</style>" if css else ""


def original_pages(pdf_path, pages, fonts, out_dir, start_only=True):
    """把 PDF 的这些页（从 1 数）转成原版版式：底图写到 out_dir/pNNN.webp，返回每页的 HTML（s1-sheet）列表。
    start_only=False 时每行都写逐字坐标（reference.py 生成逐字位置的基准用）"""
    from PIL import Image
    doc = pymupdf.open(pdf_path)
    os.makedirs(out_dir, exist_ok=True)
    sheets = []
    pdfg = PdfGlyphs(doc)
    for pno in pages:
        page = doc[pno - 1]
        trace = {}  # (x, y) → 字形号（ToUnicode 里没有文字的字、ToUnicode 给了几个字的连字，要按字形号反查轮廓）
        for sp in page.get_texttrace():
            for u, gid, (ox, oy), _ in sp["chars"]:
                trace[(round(ox, 2), round(oy, 2))] = gid
        raw = page.get_text("rawdict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE | pymupdf.TEXT_PRESERVE_LIGATURES)
        bboxlog = page.get_bboxlog()
        texts = []
        for b in raw["blocks"]:
            if b["type"] != 0:
                continue
            for line in b["lines"]:
                dx, dy = line["dir"]
                for s in line["spans"]:
                    f = fonts.file_for(s["font"])
                    if not f or not s["chars"]:
                        continue  # 英文原版自己的字体：留在底图上
                    if _hidden(doc, pno, s["bbox"], bboxlog):
                        fonts.hidden.append((pno, s["font"], "".join(c["c"] for c in s["chars"])))
                        continue  # PDF 里被后画的图片等盖住、看不见的字：文字层画在最上面会露出来，不放进去（留在底图上，照样看不见）
                    items = _resolve(page, s, f, fonts, pdfg, trace)
                    if items is None:
                        fonts.left.append((pno, s["font"], "".join(c["c"] for c in s["chars"])))
                        continue  # 留在底图上
                    # 空格不画东西，但网站压缩 HTML 时会去掉首尾的空格、把连续空格并成一个，字和横坐标就对不上了：
                    # 去掉首尾空格，连续空格只留第一个（复制出来的英文单词之间仍有空格）
                    items = [c for i, c in enumerate(items) if not (c["c"].isspace() and (i == 0 or items[i - 1]["c"].isspace()))]
                    while items and items[-1]["c"].isspace():
                        items.pop()
                    txt = "".join(c["c"] for c in items)
                    if not txt:
                        page.add_redact_annot(s["bbox"])  # 只有空格（什么也没画）
                        continue
                    liga = any("want" in c for c in items)
                    x0, y = items[0]["origin"]
                    xs_pdf = [c["origin"][0] for c in items]
                    idx = list(itertools.accumulate([0] + [len(c["c"]) for c in items[:-1]]))
                    body, cls = html.escape(txt, quote=False), font_class(f) + (" sc-liga" if liga else "")
                    if (round(dx, 3), round(dy, 3)) == (1.0, 0.0):
                        if start_only and fonts.layout(f, txt, s["size"], x0, xs_pdf, liga, idx):
                            xs, tr = f"{x0:.2f}", ""  # 浏览器从起点排出来和 PDF 一样（见 Fonts.layout），只写起点
                        elif liga:
                            # 逐字坐标的行里有连字或靠上下文才换的字形：分段写（见 _chunks）
                            chunks = _chunks(items, f, s["size"], fonts)
                            if chunks is None:
                                fonts.left.append((pno, s["font"], txt))
                                continue  # 排不出和 PDF 同样的字形和位置：留在底图上
                            xs, tr = f"{x0:.2f}", ""
                            body = "".join(_tspans(chunks, f, fonts))
                        else:
                            xs, tr = " ".join(f"{x:.2f}" for x in xs_pdf), ""
                    else:
                        xs, tr = f"{x0:.2f}", f' transform="rotate({math.degrees(math.atan2(dy, dx)):.1f} {x0:.2f} {y:.2f})"'
                    page.add_redact_annot(s["bbox"])
                    fonts.use(f, txt + ("\u00a0" if "<tspan" in body else ""))
                    fill = "" if s["color"] == 0 else f' fill="#{s["color"]:06x}"'
                    texts.append(f'<text x="{xs}" y="{y:.2f}" font-size="{s["size"]:.2f}" class="{cls}"{fill}{tr}>{body}</text>')
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


def _hidden(doc, pno, bbox, bboxlog):
    """这段文字在 PDF 里被后画的东西盖住、看不见吗：画的顺序里，这段文字之后有图片、色块或渐变和它相交时，
    把这一页单独拿出来去掉这段文字再渲染这一块，和原来逐像素相同就是看不见"""
    r = pymupdf.Rect(bbox)
    last = max((i for i, (t, b) in enumerate(bboxlog) if "text" in t and pymupdf.Rect(b).intersects(r)), default=None)
    if last is None or not any(t in ("fill-image", "fill-shade", "fill-path") and pymupdf.Rect(b).intersects(r)
                               for t, b in bboxlog[last + 1:]):
        return False
    one = pymupdf.open()
    one.insert_pdf(doc, from_page=pno - 1, to_page=pno - 1)
    clip = r + (-2, -2, 2, 2)
    before = one[0].get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=clip).samples
    one[0].add_redact_annot(r)
    one[0].apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE, text=pymupdf.PDF_REDACT_TEXT_REMOVE)
    return one[0].get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=clip).samples == before


def _resolve(page, s, f, fonts, pdfg, trace):
    """一段文字（PDF 的一个 span）在文字层里写成哪些字：[{c: 文字, origin: PDF 里的起点, want?: PDF 画的字形}]，
    每项对应 PDF 画的一个字形（连字的 c 有几个字）；排不出和 PDF 同样的字形时返回 None（这段留在底图上）"""
    items = []
    rk = [(round(c["origin"][0], 2), round(c["origin"][1], 2)) for c in s["chars"]]
    lig = [k + 1 < len(rk) and rk[k] == rk[k + 1] and not c["c"].isspace() for k, c in enumerate(s["chars"])]
    for k, c in enumerate(s["chars"]):
        if c["c"] == "\u200b":
            continue  # 零宽空格：什么也没画
        key = (round(c["origin"][0], 2), round(c["origin"][1], 2))
        if c["c"] != "\ufffd" and lig[k] and items and "want" not in items[-1] and not items[-1]["c"].isspace():
            # PDF 画的一个连字字形，ToUnicode 给了几个字（fi 等）：PyMuPDF 把后面的字放在连字末尾（和下一个字同一个起点）。
            # 浏览器也要排成一个连字，字宽和 PDF 里这个字形占的宽度相同
            items[-1]["c"] += c["c"]
            items[-1]["lig_end"] = s["chars"][k + 1]["origin"][0]
            continue
        if c["c"] != "\ufffd":
            items.append(dict(c=c["c"], origin=c["origin"]))
            continue
        gid = trace.get(key)
        if gid == 0:
            continue  # .notdef：PDF 排版时字体里没有的字（emoji），什么也没画
        r = None if gid is None else pdfg.lookup(page, s["font"], gid)
        if not r or not r[0]:
            return None
        items.append(dict(c=r[0], origin=c["origin"], want=r[1]))
    txt = "".join(c["c"] for c in items)
    if not txt or not fonts.covers(f, txt):
        return None if txt else items
    for c in items:
        if "lig_end" in c:
            g = fonts.glyphs(f, c["c"], True)
            if len(g) != 1:
                return None
            c["want"] = fonts.outline(f, g[0][0])
            if abs(c["want"][1] / fonts.shaper(f)[1] * s["size"] - (c.pop("lig_end") - c["origin"][0])) > 0.05:
                return None
    if any("want" in c for c in items):
        # 浏览器排这段（打开连字和上下文替换）的字形要和 PDF 一一对应：反查出的字形轮廓相同，其余字形不变。
        # alone：这个字单独排（逐字坐标的行每个坐标各排各的，没有上下文）也是同样的字形
        glyphs = fonts.glyphs(f, txt, True)
        plain = fonts.glyphs(f, txt, False)
        if len(glyphs) != len(items):
            return None
        for c, (g, _), (p, _) in zip(items, glyphs, plain if len(plain) == len(items) else glyphs):
            if "want" in c:
                if fonts.outline(f, g) != c["want"]:
                    return None
                alone = fonts.glyphs(f, c["c"], True)
                c["alone"] = len(alone) == 1 and fonts.outline(f, alone[0][0]) == c["want"]
            elif g != p:
                return None
    return items


def _chunks(items, f, size, fonts):
    """逐字坐标的行切成几段，每段一个 <tspan>：连续的普通字一段（每个字一个坐标）；连字、靠上下文才换的字形和它的上下文
    一段，只给起点（每个坐标起一段、各排各的，连字会拆开、上下文会丢）。这一段由浏览器排出来的字形和位置要和 PDF 相同，
    找不到这样的一段时返回 None（整段留在底图上）"""
    out, k = [], 0
    while k < len(items):
        c = items[k]
        if "want" not in c or (c["alone"] and len(c["c"]) == 1):
            if out and out[-1][0] == "run":
                out[-1][1].append(c)
            else:
                out.append(("run", [c]))
            k += 1
            continue
        for a, b in ((k, k + 1), (k - 1, k + 1), (k, k + 2), (k - 1, k + 2), (k - 2, k + 1), (k, k + 3)):
            if a < 0 or b > len(items) or (a < k and (not out or out[-1][0] != "run" or not out[-1][1])):
                continue
            part = items[a:b]
            txt = "".join(x["c"] for x in part)
            glyphs, plain = fonts.glyphs(f, txt, True), fonts.glyphs(f, txt, False)
            if len(glyphs) != len(part):
                continue
            if any(("want" in x and fonts.outline(f, g) != x["want"]) or ("want" not in x and len(plain) == len(part) and g != p[0])
                   for x, (g, _), p in zip(part, glyphs, plain if len(plain) == len(part) else glyphs)):
                continue
            idx = list(itertools.accumulate([0] + [len(x["c"]) for x in part[:-1]]))
            if not fonts.layout(f, txt, size, part[0]["origin"][0], [x["origin"][0] for x in part], True, idx):
                continue
            if a < k:
                out[-1][1][-(k - a):] = []
                if not out[-1][1]:
                    out.pop()
            out.append(("group", part))
            k = b
            break
        else:
            return None
    return out


def _tspans(chunks, f, fonts):
    """分段写成 <tspan>。网站压缩 HTML 时会去掉紧挨着标签的空格（<tspan> 首尾、标签之间），所以段首段尾的空格写成
    不换行空格（U+00A0，同宽、不画东西，复制出来也是空格样的字符；浏览器页内搜索把它当空格）。
    连字段只给第一个字坐标，后面的字和它同属一段文字，浏览器才会排成连字"""
    out = []
    for kind, part in chunks:
        txt = "".join(c["c"] for c in part)
        for i in (0, len(txt) - 1):
            if txt[i] == " " and fonts.covers(f, "\u00a0"):
                txt = txt[:i] + "\u00a0" + txt[i + 1:]
        xs = part if kind == "run" else part[:1]
        out.append('<tspan x="' + " ".join(f"{c['origin'][0]:.2f}" for c in xs) + '">' + html.escape(txt, quote=False) + "</tspan>")
    return out


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


ZWSP = "&#8203;"


def _punct(c):
    return unicodedata.category(c)[0] in "PS"


def _before(t, i):
    """t[i] 之前的那个字；短代码（脚注引用）在 Hugo 渲染 Markdown 时是一串字母占位，当文字看"""
    return "x" if t.endswith(">}}", 0, i) else (t[i - 1] if i > 0 else " ")


def _after(t, i):
    return "x" if t.startswith("{{<", i) else (t[i] if i < len(t) else " ")


def _word(c):
    return not (c.isspace() or _punct(c))


def _emphasis(t, skip=()):
    """译文 Markdown 的强调星号，CommonMark 在中文里常认不出开合，原样露出星号：
    紧挨全角标点又紧挨汉字（**译注：**Claude、见**「附录」**一节）；相邻几段强调拼成一串（*甲。****乙。****丙*，
    HTML 里是 </i><b><i>）；嵌套（***[图] 标题。***y* 轴…*，HTML 里是 <b>标题</b><i>y</i> 轴…）。
    先按译文的写法配对：从左到右，每串星号要么结束栈顶的几段强调、要么开始一段、要么前一段结束后一段开始；
    一串三个星号开始的那段（粗斜体）可以只结束内层的粗体。选落单星号最少的配法；一样少时，前面是标点、后面是文字的
    先当结束，前面是文字、后面是标点的先当开始，其余整段结束 > 开始 > 只结束一部分（拼接、嵌套只出现在标点旁）。
    再写成 CommonMark 一定照这样配的样子：嵌在别的强调里的一层改用 _（* 和 _ 不会互相配对，里外层不会配错）；
    开始的前面、结束的后面紧挨文字时补零宽空格实体（& 是标点，显示不变），让它只能当开始或只能当结束；
    一串里前一段结束、后一段开始，中间也补一个。
    配不上的星号（译文里本来就当普通字符用，HTML 里也原样显示）转义成 \\*，不让 CommonMark 另配。
    前后都是空白的星号不是强调（列表符号、乘号），不动；skip 里的区间（代码）不动"""
    runs = []
    for m in re.finditer(r"(?<!\\)\*+", t):
        a, b = m.start(), m.end()
        if any(x <= a < y for x, y in skip):
            continue
        pre, post = _before(t, a), _after(t, b)
        if pre.isspace() and post.isspace():
            continue
        runs.append((a, b, pre, post))
    memo = {}

    def push(stack, n):
        """开始一段 n 个星号的强调；外层是 * 就用 _，反之亦然"""
        return stack + ((n, "_" if stack and stack[-1][1] == "*" else "*"),)

    def best(i, stack):
        """(落单数, 每串的 (结束写成的字符, 开始写成的字符))；stack 里是 (星号数, 写成的字符)"""
        if i == len(runs):
            return (0, ()) if not stack else (len(runs) + 1, ())
        key = (i, stack)
        if key in memo:
            return memo[key]
        a, b, pre, post = runs[i]
        n = b - a
        can_open, can_close = not post.isspace(), bool(stack) and not pre.isspace()
        exact, rest, opens = [], [], []
        if can_close:  # 结束栈顶的几段（整段）
            s, shut = 0, ""
            for k in range(1, len(stack) + 1):
                s += stack[-k][0]
                shut += stack[-k][1] * stack[-k][0]
                if s == n:
                    exact.append(((shut, ""), stack[:-k]))
                elif s < n and n - s <= 3 and can_open:
                    st = push(stack[:-k], n - s)
                    rest.append(((shut, st[-1][1] * (n - s)), st))
                elif s < n:  # 多出来的星号是普通字符（如 **Terminal-Bench 2.0*** 的注释星号）
                    rest.append(((shut, "", n - s), stack[:-k]))
                if s >= n:
                    break
            if stack[-1][0] == 3:  # 粗斜体只结束内层
                ch = stack[-1][1]
                for c in (2, 1):
                    if c <= n and (n == c or (can_open and n - c <= 3)):
                        st = stack[:-1] + ((3 - c, ch),)
                        if n > c:
                            st = push(st, n - c)
                        rest.append(((ch * c, st[-1][1] * (n - c) if n > c else ""), st))
        if can_open and n <= 3:
            st = push(stack, n)
            opens.append((("", st[-1][1] * n), st))
        if _punct(pre) and _word(post):
            opts = exact + rest + opens
        elif _word(pre) and _punct(post):
            opts = opens + exact + rest
        else:
            opts = exact + opens + rest
        res = None
        for p, st in opts:
            cost, more = best(i + 1, st)
            cost += p[2] if len(p) > 2 else 0
            if res is None or cost < res[0]:
                res = (cost, (p,) + more)
            if cost == 0:
                break
        cost, more = best(i + 1, stack)
        if res is None or cost + 1 < res[0]:
            res = (cost + 1, (None,) + more)
        memo[key] = res
        return res

    plan = list(best(0, ())[1])
    # 只包住标点的强调（如 **[左下*：*]**）CommonMark 认不准，又看不出差别：去掉
    for i in range(len(plan) - 1):
        p, q = plan[i], plan[i + 1]
        if p and q and p[1] and not p[0] and q[0].startswith(p[1]) and not any(map(_word, t[runs[i][1]:runs[i + 1][0]])):
            plan[i] = ("", "") + tuple(p[2:])
            plan[i + 1] = (q[0][len(p[1]):],) + tuple(q[1:])
    out, j = [], 0
    for (a, b, pre, post), p in zip(runs, plan):
        out.append(t[j:a])
        j = b
        if p is None:
            out.append("\\*" * (b - a))
            continue
        shut, start = p[:2]
        if not shut and not start:
            out.append("\\*" * p[2] if len(p) > 2 else "")
            continue
        # * 的开始前面是标点、后面是文字（或结束反过来）时 CommonMark 才认；_ 要求更严：开始前面、结束后面不能是文字
        lead = ZWSP if not shut and _word(pre) and (_punct(post) or start[0] == "_") else ""
        tail = ZWSP if not start and _word(post) and (_punct(pre) or shut[-1] == "_") else ""
        out.append(lead + shut + (ZWSP if shut and start else "") + start + tail + ("\\*" * p[2] if len(p) > 2 else ""))
    return "".join(out + [t[j:]])


def _escape_inline(text):
    """代码以外的 < 和 $：站点没开 unsafe，原样 HTML 会被丢掉；$ 不能被当成公式（docs/testing.md）。
    脚注：各卡的脚注定义都在「脚注」一章，引用在别的章，goldmark 会丢掉没有引用的定义、留下字面的 [^N]，
    所以两头都换成短代码（sc-fn 定义、sc-fnref 引用）"""
    parts, links = re.split(r"(`+[^`]*`+)", text), []
    for i in range(0, len(parts), 2):
        t = re.sub(r"(?<!\\)\$", r"\\$", parts[i].replace("<", "&lt;"))
        if i == 0:
            t = re.sub(r"^\[\^(\d+)\]:\s*", r"{{< sc-fn \1 >}} ", t)
        t = re.sub(r"\[\^(\d+)\](?!:)", r"{{< sc-fnref \1 >}}", t)
        # 链接文字里的强调自成一体（CommonMark 不和链接外的配对；译文常写成 **甲**[**乙**](…)**丙**）：
        # 先单独处理，外面配对时整个链接当成一个以 [ 开头、) 结尾的字
        parts[i] = re.sub(r"(!?)\[([^\[\]]*)\]\(([^()\s]*)\)",
                          lambda m: links.append(m.group(1) + "[" + (m.group(2) if m.group(1) else _emphasis(m.group(2))) + "](" + m.group(3) + ")")
                          or f"[\0{len(links) - 1}\0)", t)
    skip, k = [], 0
    for i, part in enumerate(parts):
        if i % 2:
            skip.append((k, k + len(part)))
        k += len(part)
    return re.sub(r"\[\0(\d+)\0\)", lambda m: links[int(m.group(1))], _emphasis("".join(parts), skip))


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
            if out[-1].startswith("{{< sc-fn "):
                out.append("")  # 每条脚注自成一段（原文是连续的 [^N]: 行）
    text = "\n".join(out).strip("\n")
    return re.sub(r"\n{3,}", "\n\n", text) + "\n"


def images_in(lines):
    return sorted(set(re.findall(r"!\[[^\]]*\]\((images/[^)\s]+)\)", "\n".join(lines))))
