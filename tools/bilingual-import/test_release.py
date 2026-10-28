"""release.py 的回归测试，并核对仓库里每篇双语译文已发布（冻结）的全文下载文件。

    python3 -m unittest discover -s tools/bilingual-import -v     # 需要 tools/s1-import/requirements.txt（pypdf、pikepdf）

已发布的文件：存在、大小和 sha256 与 front matter 一致；HTML 就是保存的网页原样（只加首末译者声明和 noindex）；
PDF 每页有「非官方」标记、文字层没有部首字符、页面尺寸、元数据和标签结构（release.check_pdf）。
"""
import glob, hashlib, os, re, shutil, sys, tempfile, unittest

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import release  # noqa: E402


def bundles():
    for index in sorted(glob.glob(os.path.join(REPO, "content", "translations", "*", "index.md"))):
        fm = yaml.safe_load(open(index, encoding="utf-8").read().split("\n---\n", 1)[0].lstrip("-\n"))
        if fm.get("type") == "bilingual":
            yield os.path.dirname(index), fm


class Released(unittest.TestCase):
    def test_every_bilingual_translation_is_released(self):
        found = list(bundles())
        self.assertTrue(found, "content/translations 里没有双语译文，测试前提不成立")
        for b, fm in found:
            with self.subTest(os.path.basename(b)):
                self.assertIn("downloads", fm, f"{b} 还没有运行 release.py")
                for kind in ("html", "pdf"):
                    d = fm["downloads"][kind]
                    path = os.path.join(b, d["file"])
                    data = open(path, "rb").read()
                    self.assertEqual(len(data), d["bytes"], path)
                    self.assertEqual(hashlib.sha256(data).hexdigest(), d["sha256"], path)
                    self.assertTrue(os.path.basename(path).startswith(f"{fm['slug']}-zh-en-{fm['version']}."), path)

    def test_frozen_html(self):
        contact = yaml.safe_load(open(os.path.join(REPO, "hugo.yaml"), encoding="utf-8"))["params"]["s1Contact"]
        for b, fm in bundles():
            with self.subTest(os.path.basename(b)):
                raw = open(os.path.join(b, fm["downloads"]["html"]["file"]), "rb").read()
                h = raw.decode("utf-8")
                self.assertIn('<meta name="robots" content="noindex">', h)
                self.assertNotIn("text-size-adjust", h, "原网页没有的样式不加")
                # 单文件：没有外部样式、脚本
                self.assertNotRegex(h, r"<(link|script)\b")
                self.assertEqual(h.count(release.NOTICE_MARK), 2, "首末都要有译者声明")
                self.assertRegex(h, r"<body[^>]*>" + re.escape(release.NOTICE_MARK), "声明要在正文最前面")
                self.assertIn(fm["source"], h)
                self.assertIn("非官方", h)
                # 就是保存的网页原样（加上声明等），和当前的 source.html.raw、front matter 对得上
                src = open(os.path.join(b, "source.html.raw"), "rb").read()
                self.assertEqual(raw, release.asis_html(src, fm, contact), "冻结的 HTML 和 source.html.raw 对不上（改了源文件要发新版本）")

    def test_frozen_pdf(self):
        for b, fm in bundles():
            with self.subTest(os.path.basename(b)):
                self.assertGreaterEqual(release.check_pdf(os.path.join(b, fm["downloads"]["pdf"]["file"])), 1)


class Script(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)

    def test_refuses_to_overwrite_released_version(self):
        b, fm = next(bundles())
        dst = os.path.join(self.tmp, "x")
        shutil.copytree(b, dst)
        before = open(os.path.join(dst, "index.md"), "rb").read()
        with self.assertRaises(SystemExit) as e:
            release.main([dst])
        self.assertIn("已经发布过", str(e.exception.code))
        self.assertEqual(open(os.path.join(dst, "index.md"), "rb").read(), before)

    def test_asis_html_only_adds_notice_and_head_lines(self):
        """下载的 HTML 是保存的网页原样：去掉加的几样东西后，和原网页（转成 UTF-8）逐字节相同"""
        fm = {"title": "标题", "version": "v2.0", "originalTitle": "Title & <x>", "author": "A", "originalDate": "2020-01-01",
              "source": "https://example.com/a?b=1&c=2", "method": "m", "captured": "2026-01-01T00:00:00Z"}
        page = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252"><style>.s{font-family:Palatino}</style></head>\n<body class="b">\n<h1>T\u00b7x</h1><p>p</p>\n</body><div id="mount"></div></html>'
        out = release.asis_html(page.encode("cp1252"), fm, "x@example.com").decode("utf-8")
        note = release.notice_html(fm, "x@example.com")
        self.assertIn("Title &amp; &lt;x&gt;", note)
        self.assertIn('href="https://example.com/a?b=1&amp;c=2"', note)
        self.assertIn("x@example.com", note)
        back = (out.replace('<meta name="robots" content="noindex">', "", 1)
                .replace(note + "<hr>\n", "", 1).replace("\n<hr>" + note + "\n", "", 1))
        self.assertEqual(back, page.replace("windows-1252", "utf-8"))
        self.assertIn("<h1>T\u00b7x</h1>", out, "非 UTF-8 的原网页转成 UTF-8 后字不变")
        self.assertNotIn("@page", out, "打印用的纸张、页脚只加在打印副本里")
        self.assertIn('content: "非官方译文 · v2.0 · 以原文为准"', release.print_css(fm))

    def test_shares_s1_text_layer_fix(self):
        self.assertEqual(release.s1_release().fix_tounicode(b"<0001> <2F00>"), b"<0001> <4E00>")


if __name__ == "__main__":
    unittest.main()
