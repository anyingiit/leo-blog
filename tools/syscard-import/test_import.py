"""系统卡导入工具 import.py 的回归测试，并核对仓库里导入的每份系统卡的下载文件（docs/system-cards.md）。

    python3 -m unittest discover -s tools/syscard-import -v

另外，本机有译文仓库的克隆时设 SYSCARDS_SRC=<克隆路径>，会把瘦身过的 PDF 与原文件逐页对比（渲染像素、文字层、书签、链接）。
CI 里没有原文件，这一项跳过；无损的做法本身由合成 PDF 的测试覆盖。
"""
import glob, hashlib, importlib.util, json, os, re, subprocess, sys, tempfile, unittest

import pikepdf, pypdf, pypdfium2

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DIR = os.path.join(REPO, "content/translations/system-cards")
LIMIT = 25 * 1024 * 1024

spec = importlib.util.spec_from_file_location("syscard_import", os.path.join(HERE, "import.py"))
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)
sys.path.insert(0, HERE)
import chapters, reference  # noqa: E402


def front_matter(name):
    text = open(os.path.join(DIR, name), encoding="utf-8").read().split("\n---\n")[0]
    return {l.split(": ", 1)[0]: json.loads(l.split(": ", 1)[1]) for l in text.split("\n")[1:]}


def cards():
    """每份卡一个目录：卡片首页 <卡>/_index.md + 每个版本 <卡>/<版本>/_index.md，按 weight（官网列表的顺序）。
    返回卡片首页的 front matter，加上 slug 和 versions（版本目录名 → 版本页 front matter）"""
    out = []
    for d in os.listdir(DIR):
        if not os.path.isfile(os.path.join(DIR, d, "_index.md")):
            continue
        vs = {os.path.basename(os.path.dirname(f)): front_matter(os.path.relpath(f, DIR)) for f in glob.glob(os.path.join(DIR, d, "v*", "_index.md"))}
        out.append(dict(front_matter(f"{d}/_index.md"), slug=d, versions=vs))
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


class BoldAndFootnotes(unittest.TestCase):
    """chapters._escape_inline：全角标点旁的加粗、跨章的脚注"""
    md = staticmethod(chapters._escape_inline)

    def test_bold_next_to_fullwidth_punctuation(self):
        z = chapters.ZWSP
        self.assertEqual(self.md("> **译注：**Claude 的安全机制"), f"> **译注：**{z}Claude 的安全机制")
        self.assertEqual(self.md("见**「附录」**一节"), f"见{z}**「附录」**{z}一节")
        # 本来就成立的加粗不动
        for t in ("**VCT：** 一项评估", "这是**重点**。", "**A** 和 **B**", "a **b** c"):
            self.assertEqual(self.md(t), t)
        # 后面紧跟脚注引用（Hugo 渲染 Markdown 时短代码是一串字母占位）：结尾本来就成立，不补
        self.assertEqual(self.md("SWE-Bench **Pro**[^12] 由"), "SWE-Bench **Pro**{{< sc-fnref 12 >}} 由")
        # 星号紧挨括号：括号前的星号是开始；嵌在加粗里的斜体改用 _，不会和外层配错
        self.assertEqual(self.md("| **Claude Opus 5.5*（仅有用）*** |"), f"| **Claude Opus 5.5{z}_（仅有用）_** |")
        # 相邻两段强调拼成的四个星号
        self.assertEqual(self.md("*甲。****乙。****丙*"), f"*甲。*{z}***乙。***{z}*丙*")
        self.assertEqual(self.md("**恶意（%）****（拒绝率）**"), f"**恶意（%）**{z}**（拒绝率）**")
        # 图注：整段斜体里套加粗标题，标题后面紧跟一段斜体（***[图] 标题。***y* 轴…*）
        self.assertEqual(self.md("***[图 1] 标题。***y* 轴。*"), f"***[图 1] 标题。**{z}_y_ 轴。*")
        self.assertEqual(self.md("***[表 1] 标题。**正文以**粗体**标出。*"), f"***[表 1] 标题。**{z}正文以{z}__粗体__{z}标出。*")
        # 只包住标点的强调（HTML 里是 <b>。</b>）去掉：CommonMark 认不准，又看不出差别
        self.assertEqual(self.md("***[表 1] 标题。**正文破坏**。***"), f"***[表 1] 标题。**{z}正文破坏。*")
        self.assertEqual(self.md("**[左下*：*]**在诱导"), f"**[左下：]**{z}在诱导")
        # 加粗后面多出的注释星号是普通字符
        self.assertEqual(self.md("| **Terminal-Bench 2.0*** | **82%** |"), "| **Terminal-Bench 2.0**\\* | **82%** |")
        # 译文里本来就当普通字符用的星号（HTML 里也原样显示）：转义，别和别处配对
        self.assertEqual(self.md("混合在我的二**元决策树里"), "混合在我的二\\*\\*元决策树里")
        # 代码里的星号不动
        self.assertEqual(self.md("`**kwargs**：`x"), "`**kwargs**：`x")

    def test_footnotes(self):
        self.assertEqual(self.md("BBQ[^7]评估了"), "BBQ{{< sc-fnref 7 >}}评估了")
        self.assertEqual(self.md("[^7]: Parrish, A., et al."), "{{< sc-fn 7 >}} Parrish, A., et al.")
        self.assertEqual(self.md("`a[^1]`"), "`a[^1]`")

    def test_to_hugo_footnote_paragraphs(self):
        ch = dict(pages=[10, 10], lines=["[^1]: a", "[^2]: b"])
        self.assertEqual(chapters.to_hugo(ch), "{{< sc-fn 1 >}} a\n\n{{< sc-fn 2 >}} b\n")


class PublishedFiles(unittest.TestCase):
    """仓库里导入的每份系统卡"""
    zh = front_matter("_index.md")
    cards = cards()

    def test_pages(self):
        self.assertGreaterEqual(len(self.cards), 10)
        self.assertEqual([c["weight"] for c in self.cards], list(range(1, len(self.cards) + 1)))
        for c in self.cards:
            en = front_matter(f"{c['slug']}/_index.en.md")
            for k in ("facts", "official", "released", "pages", "weight", "latest", "sourceCommit"):
                self.assertEqual(en[k], c[k], f"{c['slug']} {k}")
            self.assertEqual(c["sourceCommit"], self.zh["sourceCommit"])
            self.assertIn(c["latest"], c["versions"], f"{c['slug']} 最新版本")
            for name, v in c["versions"].items():
                # 版本号与译文仓库同步：语义化版本 X.Y.Z、tag <卡>/vX.Y.Z；网页上按 S-1 的写法（补丁号为 0 时省略）
                self.assertRegex(v["repoVersion"], r"^\d+\.\d+\.\d+$")
                self.assertEqual(v["tag"], f"{c['slug']}/v{v['repoVersion']}")
                self.assertEqual(name, v["version"])
                self.assertEqual(v["version"], "v" + re.sub(r"\.0$", "", v["repoVersion"]))
            for path in glob.glob(os.path.join(DIR, c["slug"], "**", "*.md"), recursive=True):
                text = open(path, encoding="utf-8").read()
                self.assertNotIn("anthropic-system-cards-zh", text, f"{path}：译文仓库不公开")

    def test_files(self):
        for c in self.cards:
            for name, v in c["versions"].items():
                vdir = os.path.join(DIR, c["slug"], name)
                for kind in ("html", "pdf"):
                    path = os.path.join(vdir, v["downloads"][kind]["file"])
                    data = open(path, "rb").read()
                    self.assertEqual(len(data), v["downloads"][kind]["bytes"], path)
                    self.assertEqual(hashlib.sha256(data).hexdigest(), v["downloads"][kind]["sha256"], path)
                    self.assertLessEqual(len(data), LIMIT, f"{path} 超过 Cloudflare Pages 单文件上限")
                pdf = v["downloads"]["pdf"]
                self.assertEqual(pdf.get("slimmed", False), pdf.get("sourceBytes", 0) > LIMIT, c["slug"])
                self.assertEqual(sorted(os.listdir(os.path.join(vdir, "files"))),
                                 sorted(os.path.basename(v["downloads"][k]["file"]) for k in ("html", "pdf")), "files/ 下只有这两个文件")

    def test_chapters(self):
        """章节连续覆盖全部页；每章有重排版和原版版式（每页一张底图、一个文字层），重排版里没有漏掉的 Markdown"""
        for c in self.cards:
            for name, v in c["versions"].items():
                chs = v["chapters"]
                self.assertEqual(chs[0]["pages"][0], 1)
                self.assertEqual(chs[-1]["pages"][1], c["pages"])
                for a, b in zip(chs, chs[1:]):
                    self.assertIn(b["pages"][0], (a["pages"][1], a["pages"][1] + 1), f"{c['slug']} {b['slug']} 与上一章不连续")
                for ch in chs:
                    d = os.path.join(DIR, c["slug"], name, ch["slug"])
                    md = open(os.path.join(d, "index.md"), encoding="utf-8").read().split("\n---\n", 1)[1]
                    prose = re.sub(r"```[\s\S]*?```|`[^`\n]*`", "", md)
                    self.assertNotRegex(prose, r"\[\^\d+\]", f"{c['slug']} {ch['slug']} 有没换掉的脚注")
                    orig = open(os.path.join(d, "original.html"), encoding="utf-8").read()
                    pages = range(ch["pages"][0], ch["pages"][1] + 1)
                    self.assertEqual(re.findall(r'aria-label="原文第 (\d+) 页"', orig), [str(p) for p in pages], f"{c['slug']} {ch['slug']}")
                    self.assertEqual(sorted(os.listdir(os.path.join(d, "bg"))), [f"p{p:03d}.webp" for p in pages])
                fns = os.path.join(DIR, c["slug"], name, "footnotes", "index.md")
                if os.path.exists(fns):
                    defs = set(re.findall(r"\{\{< sc-fn (\d+) >\}\}", open(fns, encoding="utf-8").read()))
                    refs = set()
                    for f in glob.glob(os.path.join(DIR, c["slug"], name, "*", "index.md")):
                        refs |= set(re.findall(r"\{\{< sc-fnref (\d+) >\}\}", open(f, encoding="utf-8").read()))
                    self.assertTrue(defs, f"{c['slug']} 脚注一章没有脚注")
                    # 原文有极少数脚注只有引用没有定义（编号跳号），只要求有定义的都被引用或引用都能找到大多数定义
                    self.assertGreaterEqual(len(refs & defs), 0.9 * len(refs), f"{c['slug']} 脚注引用找不到定义")

    def test_reference_images_are_current(self):
        """tests/fixtures/syscards/ 的像素基准就是现在这份 PDF 渲染出来的（换了 PDF 要重新跑 reference.py）"""
        for slug, page in reference.PAGES:
            want = open(os.path.join(reference.OUT, reference.name(slug, page)), "rb").read()
            self.assertEqual(reference.render(slug, page), want, f"{slug} 第 {page} 页：重新运行 tools/syscard-import/reference.py")

    def test_pdfs_readable_and_slimmed_ones_have_no_duplicate_images(self):
        for c in self.cards:
            for name, v in c["versions"].items():
                path = os.path.join(DIR, c["slug"], name, v["downloads"]["pdf"]["file"])
                r = pypdf.PdfReader(path)
                self.assertEqual(len(r.pages), c["pages"], f"{c['slug']} 页数与原版不同")
                self.assertEqual(len(r.outline) > 0, v["downloads"]["pdf"]["bookmarks"], f"{c['slug']} 书签")
                if v["downloads"]["pdf"].get("slimmed"):
                    keys = [imp._stream_key(o) for o in images(path)]
                    self.assertEqual(len(keys), len(set(keys)), f"{c['slug']} 还有重复的图片")

    @unittest.skipUnless(os.environ.get("SYSCARDS_SRC"), "设 SYSCARDS_SRC=<译文仓库克隆> 时逐页对比原文件")
    def test_slimmed_pdfs_match_source(self):
        src = os.environ["SYSCARDS_SRC"]
        commit = subprocess.run(["git", "-C", src, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        self.assertEqual(commit, self.zh["sourceCommit"], "译文仓库要切到导入时的提交")
        for c in self.cards:
            v = c["versions"][c["latest"]]
            vdir = os.path.join(DIR, c["slug"], c["latest"])
            h = v["downloads"]["html"]
            self.assertEqual(open(os.path.join(src, c["slug"], h["name"]), "rb").read(), open(os.path.join(vdir, h["file"]), "rb").read(),
                             f"{c['slug']} HTML 逐字节原样")
            pdf = v["downloads"]["pdf"]
            orig = os.path.join(src, c["slug"], pdf["name"])
            if not pdf.get("slimmed"):
                self.assertEqual(hashlib.sha256(open(orig, "rb").read()).hexdigest(), pdf["sha256"], f"{c['slug']} 原样复制")
                continue
            self.assertEqual(hashlib.sha256(open(orig, "rb").read()).hexdigest(), pdf["sourceSha256"])
            mine = os.path.join(vdir, pdf["file"])
            a, b = pypdfium2.PdfDocument(orig), pypdfium2.PdfDocument(mine)
            for i in range(len(a)):
                self.assertEqual(a[i].render(scale=100 / 72).to_pil().tobytes(), b[i].render(scale=100 / 72).to_pil().tobytes(), f"{c['slug']} 第 {i + 1} 页像素")
                self.assertEqual(a[i].get_textpage().get_text_range(), b[i].get_textpage().get_text_range(), f"{c['slug']} 第 {i + 1} 页文字")
            ra, rb = pypdf.PdfReader(orig), pypdf.PdfReader(mine)
            self.assertEqual(outline(ra), outline(rb), f"{c['slug']} 书签")
            self.assertEqual([len(p.get("/Annots") or []) for p in ra.pages], [len(p.get("/Annots") or []) for p in rb.pages])

if __name__ == "__main__":
    unittest.main()
