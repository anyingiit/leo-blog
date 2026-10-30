"""系统卡导入工具 import.py 的回归测试，并核对仓库里导入的每份系统卡的下载文件（docs/system-cards.md）。

    python3 -m unittest discover -s tools/syscard-import -v

另外，本机有译文仓库的克隆时设 SYSCARDS_SRC=<克隆路径>，会把瘦身过的 PDF 与原文件逐页对比（渲染像素、文字层、书签、链接）。
CI 里没有原文件，这一项跳过；无损的做法本身由合成 PDF 的测试覆盖。
"""
import hashlib, importlib.util, json, os, subprocess, tempfile, unittest

import pikepdf, pypdf, pypdfium2

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DIR = os.path.join(REPO, "content/translations/system-cards")
LIMIT = 25 * 1024 * 1024

spec = importlib.util.spec_from_file_location("syscard_import", os.path.join(HERE, "import.py"))
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)


def front_matter(name):
    text = open(os.path.join(DIR, name), encoding="utf-8").read().split("\n---\n")[0]
    return {l.split(": ", 1)[0]: json.loads(l.split(": ", 1)[1]) for l in text.split("\n")[1:]}


def render(path):
    doc = pypdfium2.PdfDocument(path)
    out = [(doc[i].render(scale=1).to_pil().tobytes(), doc[i].get_textpage().get_text_range()) for i in range(len(doc))]
    doc.close()
    return out


_open = []  # 打开的 PDF 要一直留着，否则取出的对象随之失效


def images(path):
    _open.append(pikepdf.open(path))
    return [o for o in _open[-1].objects if isinstance(o, pikepdf.Stream) and o.get("/Subtype") == "/Image"]


def synthetic(path):
    """两页，每页一张图：两张图的数据和调色板都相同但各存一份（和译文 PDF 一样）；
    两页还各有一个字节相同、但引用不同字体的表单（不能合并，否则第二页的字会变）"""
    pdf = pikepdf.new()
    pal = lambda: pdf.make_stream(bytes(range(256)) * 3)
    data = bytes((x * 7 + y) % 4 for y in range(32) for x in range(32))
    font = lambda base: pdf.make_indirect(pikepdf.Dictionary(Type=pikepdf.Name.Font, Subtype=pikepdf.Name.Type1, BaseFont=pikepdf.Name(base)))
    for base in ("/Helvetica", "/Courier"):
        img = pdf.make_stream(data, Type=pikepdf.Name.XObject, Subtype=pikepdf.Name.Image, Width=32, Height=32, BitsPerComponent=8,
                              ColorSpace=pikepdf.Array([pikepdf.Name.Indexed, pikepdf.Name.DeviceRGB, 255, pal()]))
        form = pdf.make_stream(b"BT /F1 12 Tf 10 10 Td (Hello iiii) Tj ET", Type=pikepdf.Name.XObject, Subtype=pikepdf.Name.Form,
                               BBox=[0, 0, 200, 40], Resources=pikepdf.Dictionary(Font=pikepdf.Dictionary(F1=font(base))))
        page = pikepdf.Dictionary(Type=pikepdf.Name.Page, MediaBox=[0, 0, 200, 200],
                                  Resources=pikepdf.Dictionary(XObject=pikepdf.Dictionary(Im0=img, Fm0=form)),
                                  Contents=pdf.make_stream(b"q 100 0 0 100 50 80 cm /Im0 Do Q /Fm0 Do"))
        pdf.pages.append(pikepdf.Page(page))
    pdf.save(path)


def outline(reader):
    """书签：标题、层级、指向的页"""
    out = []

    def walk(items, depth):
        for o in items:
            if isinstance(o, list):
                walk(o, depth + 1)
            else:
                out.append((depth, o.title, reader.get_destination_page_number(o)))

    walk(reader.outline, 0)
    return out


class SlimPdf(unittest.TestCase):
    def test_merges_duplicate_images_only_and_renders_identically(self):
        with tempfile.TemporaryDirectory() as d:
            src, dst = os.path.join(d, "a.pdf"), os.path.join(d, "b.pdf")
            synthetic(src)
            self.assertEqual(len(images(src)), 2)
            n = imp.slim_pdf(src, dst)
            self.assertEqual(n, 2, "一张图 + 它的调色板")
            self.assertEqual(len(images(dst)), 1)
            _open.append(pikepdf.open(dst))
            forms = [o for o in _open[-1].objects if isinstance(o, pikepdf.Stream) and o.get("/Subtype") == "/Form"]
            self.assertEqual(len(forms), 2, "字节相同但字体不同的表单不能合并")
            self.assertEqual(render(src), render(dst), "渲染像素和文字层都不变")

    def test_deterministic(self):
        with tempfile.TemporaryDirectory() as d:
            synthetic(os.path.join(d, "a.pdf"))
            imp.slim_pdf(os.path.join(d, "a.pdf"), os.path.join(d, "b.pdf"))
            imp.slim_pdf(os.path.join(d, "a.pdf"), os.path.join(d, "c.pdf"))
            self.assertEqual(open(os.path.join(d, "b.pdf"), "rb").read(), open(os.path.join(d, "c.pdf"), "rb").read())


class ReadmeParsing(unittest.TestCase):
    def test_card_info(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, "opus-4.8"))
            open(os.path.join(d, "opus-4.8", "README.md"), "w", encoding="utf-8").write(
                "# 翻译说明\n\n本目录收录 Anthropic《Claude Opus 4.8 System Card》（2026 年 5 月 28 日，246 页）的简体中文译本。\n\n"
                "1. **为什么 Claude 不翻译**：2.2 节（化学与生物风险评估，原文第 16–30 页）以及摘要等处的 12 个零散段落（原文第 2、3 页）……\n")
            open(os.path.join(d, "opus-4.8", "x.html"), "w", encoding="utf-8").write("<title>Claude Opus 4.8 系统卡</title>")
            open(os.path.join(d, "opus-4.8", "x.pdf"), "wb").write(b"%PDF")
            c = imp.card_info(d, "opus-4.8")
            self.assertEqual((c["titleEn"], c["released"], c["pages"], c["title"]), ("Claude Opus 4.8 System Card", "2026-05-28", 246, "Claude Opus 4.8 系统卡"))
            self.assertEqual(c["official"], "https://www.anthropic.com/claude-opus-4-8-system-card")
            self.assertEqual(c["note"], "2.2 节（原文第 16–30 页）和 12 个零散段落由译者另行翻译，未经 Claude 审校。")
            self.assertEqual(c["noteEn"], "Section 2.2 (pp. 16–30) and 12 scattered paragraphs were translated separately by the translator and not reviewed by Claude.")


class PublishedFiles(unittest.TestCase):
    """仓库里导入的每份系统卡"""
    zh = front_matter("_index.md")

    def test_files(self):
        self.assertEqual(front_matter("_index.en.md")["cards"], self.zh["cards"])
        for c in self.zh["cards"]:
            for kind in ("html", "pdf"):
                path = os.path.join(DIR, c[kind]["file"])
                data = open(path, "rb").read()
                self.assertEqual(len(data), c[kind]["bytes"], path)
                self.assertEqual(hashlib.sha256(data).hexdigest(), c[kind]["sha256"], path)
                self.assertLessEqual(len(data), LIMIT, f"{path} 超过 Cloudflare Pages 单文件上限")
            self.assertEqual(c["pdf"].get("slimmed", False), c["pdf"].get("sourceBytes", 0) > LIMIT, c["slug"])

    def test_pdfs_readable_and_slimmed_ones_have_no_duplicate_images(self):
        for c in self.zh["cards"]:
            path = os.path.join(DIR, c["pdf"]["file"])
            r = pypdf.PdfReader(path)
            self.assertEqual(len(r.pages), c["pages"], f"{c['slug']} 页数与原版不同")
            if c["pdf"].get("slimmed"):
                keys = [imp._stream_key(o) for o in images(path)]
                self.assertEqual(len(keys), len(set(keys)), f"{c['slug']} 还有重复的图片")

    @unittest.skipUnless(os.environ.get("SYSCARDS_SRC"), "设 SYSCARDS_SRC=<译文仓库克隆> 时逐页对比原文件")
    def test_slimmed_pdfs_match_source(self):
        src = os.environ["SYSCARDS_SRC"]
        commit = subprocess.run(["git", "-C", src, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        self.assertEqual(commit, self.zh["sourceCommit"], "译文仓库要切到导入时的提交")
        for c in self.zh["cards"]:
            orig = os.path.join(src, c["slug"], c["pdf"]["name"])
            if not c["pdf"].get("slimmed"):
                continue
            self.assertEqual(hashlib.sha256(open(orig, "rb").read()).hexdigest(), c["pdf"]["sourceSha256"])
            mine = os.path.join(DIR, c["pdf"]["file"])
            a, b = pypdfium2.PdfDocument(orig), pypdfium2.PdfDocument(mine)
            for i in range(len(a)):
                self.assertEqual(a[i].render(scale=100 / 72).to_pil().tobytes(), b[i].render(scale=100 / 72).to_pil().tobytes(), f"{c['slug']} 第 {i + 1} 页像素")
                self.assertEqual(a[i].get_textpage().get_text_range(), b[i].get_textpage().get_text_range(), f"{c['slug']} 第 {i + 1} 页文字")
            ra, rb = pypdf.PdfReader(orig), pypdf.PdfReader(mine)
            self.assertEqual(outline(ra), outline(rb), f"{c['slug']} 书签")
            self.assertEqual([len(p.get("/Annots") or []) for p in ra.pages], [len(p.get("/Annots") or []) for p in rb.pages])


if __name__ == "__main__":
    unittest.main()
