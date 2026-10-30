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


def cards():
    """每份卡一个目录（叶子包），按 weight（官网列表的顺序）"""
    out = [dict(front_matter(f"{d}/index.md"), slug=d) for d in os.listdir(DIR) if os.path.isfile(os.path.join(DIR, d, "index.md"))]
    return sorted(out, key=lambda c: c["weight"])


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
    README = ("# 翻译说明\n\n本目录收录 Anthropic《Claude Opus 4.8 System Card》（2026 年 5 月 28 日，246 页）的简体中文译本。\n\n"
              "- 除下文说明的保留英文部分外，全部正文（1599 个文本单元）和 112 张图片由 Claude Opus 5.5 翻译。\n"
              "1. **为什么 Claude 不翻译**：2.2 节（化学与生物风险评估，原文第 16–30 页）以及摘要等处的 12 个零散段落（原文第 2、3 页）……\n"
              "2. **译文来源**：……再由脚本合入：正文 115 个单元，图片 5 张（按标签表重绘）。\n"
              "- 全卡逐页对照原版做了视觉检查，共发现 71 处问题并逐一修复后复查。\n"
              "- 文中指向本文档其他章节的内部链接（如「第 4.1 节」）在擦除英文时丢失。\n- 原文中个别 emoji……\n")

    def card(self, readme, d="opus-4.8"):
        with tempfile.TemporaryDirectory() as t:
            os.makedirs(os.path.join(t, d))
            open(os.path.join(t, d, "README.md"), "w", encoding="utf-8").write(readme)
            open(os.path.join(t, d, "x.html"), "w", encoding="utf-8").write("<title>Claude Opus 4.8 系统卡</title>")
            open(os.path.join(t, d, "x.pdf"), "wb").write(b"%PDF")
            return imp.card_info(t, d)

    def test_card_info(self):
        c = self.card(self.README)
        self.assertEqual((c["titleEn"], c["released"], c["pages"], c["title"]), ("Claude Opus 4.8 System Card", "2026-05-28", 246, "Claude Opus 4.8 系统卡"))
        self.assertEqual(c["official"], "https://www.anthropic.com/claude-opus-4-8-system-card")
        self.assertEqual(c["facts"], dict(units=1599, images=112, s22=[16, 30], scattered=12, scatteredPages="2、3", s22Units=115, s22Images=5,
                                          s22Model="", layoutFixes=71, unverifiedNumbers=None, linksLost=True, emoji=True))

    def test_card_info_opus_5_5_wording(self):
        """Opus 5.5 那份的翻译说明写法不同：2.2 节由发起人用另一个模型翻译、有未核实的数字、没有文本单元数"""
        c = self.card("本仓库收录 Anthropic《Claude Opus 5.5 System Card》（2026 年 9 月 22 日，230 页）的简体中文译本。\n"
                      "- **2.2 节**（CB evaluations，原文第 16–33 页，正文 103 个条目和 5 张图）由项目发起人使用 **GPT-6 Astra** 翻译。\n"
                      "自动校验提示有 3 处原文数字（u00310）未在译文中找到。\n| `pipeline/images/` | 104 张图的重绘规格（spec）与专用重绘工具 |\n", "opus-5.5")
        f = c["facts"]
        self.assertEqual((f["units"], f["images"], f["s22"], f["s22Units"], f["s22Images"], f["s22Model"], f["unverifiedNumbers"], f["scattered"]),
                         (None, 104, [16, 33], 103, 5, "GPT-6 Astra", 3, 0))

    def test_official_order(self):
        html = ('<a href="https://www.anthropic.com/claude-opus-5-5-system-card">x</a><a href="https://anthropic.com/claude-haiku-5-5-system-card">'
                '<a href="https://www.anthropic.com/claude-opus-5-5-system-card">dup</a><a href="https://www.anthropic.com/news">')
        self.assertEqual(imp.official_order(html), ["opus-5-5", "haiku-5-5"])


class PublishedFiles(unittest.TestCase):
    """仓库里导入的每份系统卡"""
    zh = front_matter("_index.md")
    cards = cards()

    def test_pages(self):
        self.assertGreaterEqual(len(self.cards), 10)
        self.assertEqual([c["weight"] for c in self.cards], list(range(1, len(self.cards) + 1)))
        for c in self.cards:
            en = front_matter(f"{c['slug']}/index.en.md")
            for k in ("facts", "downloads", "official", "released", "pages", "weight", "sourceCommit"):
                self.assertEqual(en[k], c[k], f"{c['slug']} {k}")
            self.assertEqual(c["sourceCommit"], self.zh["sourceCommit"])
            for path in (f"{c['slug']}/index.md", f"{c['slug']}/index.en.md", "_index.md", "_index.en.md"):
                text = open(os.path.join(DIR, path), encoding="utf-8").read()
                self.assertNotIn("github.com", text, f"{path}：译文仓库不公开")

    def test_files(self):
        for c in self.cards:
            for kind in ("html", "pdf"):
                path = os.path.join(DIR, c["slug"], c["downloads"][kind]["file"])
                data = open(path, "rb").read()
                self.assertEqual(len(data), c["downloads"][kind]["bytes"], path)
                self.assertEqual(hashlib.sha256(data).hexdigest(), c["downloads"][kind]["sha256"], path)
                self.assertLessEqual(len(data), LIMIT, f"{path} 超过 Cloudflare Pages 单文件上限")
            pdf = c["downloads"]["pdf"]
            self.assertEqual(pdf.get("slimmed", False), pdf.get("sourceBytes", 0) > LIMIT, c["slug"])
            self.assertEqual(sorted(os.listdir(os.path.join(DIR, c["slug"], "files"))),
                             sorted(os.path.basename(c["downloads"][k]["file"]) for k in ("html", "pdf")), "files/ 下只有这两个文件")

    def test_pdfs_readable_and_slimmed_ones_have_no_duplicate_images(self):
        for c in self.cards:
            path = os.path.join(DIR, c["slug"], c["downloads"]["pdf"]["file"])
            r = pypdf.PdfReader(path)
            self.assertEqual(len(r.pages), c["pages"], f"{c['slug']} 页数与原版不同")
            self.assertEqual(len(r.outline) > 0, c["downloads"]["pdf"]["bookmarks"], f"{c['slug']} 书签")
            if c["downloads"]["pdf"].get("slimmed"):
                keys = [imp._stream_key(o) for o in images(path)]
                self.assertEqual(len(keys), len(set(keys)), f"{c['slug']} 还有重复的图片")

    @unittest.skipUnless(os.environ.get("SYSCARDS_SRC"), "设 SYSCARDS_SRC=<译文仓库克隆> 时逐页对比原文件")
    def test_slimmed_pdfs_match_source(self):
        src = os.environ["SYSCARDS_SRC"]
        commit = subprocess.run(["git", "-C", src, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        self.assertEqual(commit, self.zh["sourceCommit"], "译文仓库要切到导入时的提交")
        for c in self.cards:
            h = c["downloads"]["html"]
            self.assertEqual(open(os.path.join(src, c["slug"], h["name"]), "rb").read(), open(os.path.join(DIR, c["slug"], h["file"]), "rb").read(),
                             f"{c['slug']} HTML 逐字节原样")
            pdf = c["downloads"]["pdf"]
            orig = os.path.join(src, c["slug"], pdf["name"])
            if not pdf.get("slimmed"):
                self.assertEqual(hashlib.sha256(open(orig, "rb").read()).hexdigest(), pdf["sha256"], f"{c['slug']} 原样复制")
                continue
            self.assertEqual(hashlib.sha256(open(orig, "rb").read()).hexdigest(), pdf["sourceSha256"])
            mine = os.path.join(DIR, c["slug"], pdf["file"])
            a, b = pypdfium2.PdfDocument(orig), pypdfium2.PdfDocument(mine)
            for i in range(len(a)):
                self.assertEqual(a[i].render(scale=100 / 72).to_pil().tobytes(), b[i].render(scale=100 / 72).to_pil().tobytes(), f"{c['slug']} 第 {i + 1} 页像素")
                self.assertEqual(a[i].get_textpage().get_text_range(), b[i].get_textpage().get_text_range(), f"{c['slug']} 第 {i + 1} 页文字")
            ra, rb = pypdf.PdfReader(orig), pypdf.PdfReader(mine)
            self.assertEqual(outline(ra), outline(rb), f"{c['slug']} 书签")
            self.assertEqual([len(p.get("/Annots") or []) for p in ra.pages], [len(p.get("/Annots") or []) for p in rb.pages])


if __name__ == "__main__":
    unittest.main()
