"""import.py 的回归测试：译文 Markdown 转成 Hugo 正文时的处理。

    python3 -m unittest discover -s tools/s1-import -v
"""
import hashlib, os, shutil, subprocess, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib  # noqa: E402
imp = importlib.import_module("import")


class Superscript(unittest.TestCase):
    def conv(self, s):
        return imp.to_hugo_md(s, set())

    def test_footnote_markers_kept(self):
        for mark in ["(1)", "(2)(3)", "12", "*"]:
            self.assertIn('{{< s1-raw "<sup>" >}}', self.conv(f"承销折扣<sup>{mark}</sup>"), mark)

    def test_sentences_unwrapped(self):
        # 整句、带中文、点线引导符的 <sup> 去掉标签，只留文字
        for text in ["亦未判定本招股说明书是否准确或充分。", "天", "每股259.1364美元", "........................................"]:
            out = self.conv(f"前文<sup>{text}</sup>后文")
            self.assertNotIn("sup", out, text)
            self.assertIn(text.replace("$", "\\$"), out)


class Chapters(unittest.TestCase):
    MD = ("# 封面\n\n文字\n\n<!-- 原文第 1 页 / page 1 -->\n\n"
          "![](<图片中文版/divider.jpg>)\n\n<!-- 原文第 2 页 / page 2 -->\n\n"
          "# 风险因素\n\n正文\n\n<!-- 原文第 3 页 / page 3 -->\n\n"
          "![](<图片中文版/chart.jpg>)\n\n图注\n\n<!-- 原文第 4 页 / page 4 -->\n\n"
          "# 业务\n\n正文\n\n<!-- 原文第 5 页 / page 5 -->\n")

    def test_divider_page_joins_next_chapter(self):
        # 章首前一页只有图片（整页分隔图，原文目录的章节锚点在上面）：归入后一章
        cover, risk, biz = imp.chapters(self.MD)
        self.assertEqual((cover["page"], cover["last_page"]), (1, 1))
        self.assertEqual((risk["page"], risk["last_page"]), (2, 4))
        self.assertTrue(self.MD[risk["start"]:risk["end"]].lstrip().startswith("![](<图片中文版/divider.jpg>)"))
        # 图片加文字的页不是分隔图，留在原章
        self.assertEqual((biz["page"], biz["last_page"]), (5, 5))


class NewVersionImages(unittest.TestCase):
    """导入新版本时，内容变了的同名配图另存一份，旧版本仍用原图"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)

    def run_import(self, version, chart_bytes):
        d = os.path.join(self.tmp, "src-" + version)
        os.makedirs(os.path.join(d, "img"))
        for name, data in (("chart.jpg", chart_bytes), ("logo.jpg", b"logo")):
            open(os.path.join(d, "img", name), "wb").write(data)
        md = "# 封面\n\n![](<图片中文版/chart.jpg>)\n\n![](logo.jpg)\n\n<!-- 原文第 1 页 / page 1 -->\n"
        html = ('<div class="outer"><div style="--justify:justify;"><img src="x_files/chart.jpg"><img src="x_files/logo.jpg"></div>'
                '</div>\n</text>')
        open(os.path.join(d, "t.md"), "w", encoding="utf-8").write(md)
        open(os.path.join(d, "t.html"), "w", encoding="utf-8").write(html)
        root, assets = os.path.join(self.tmp, "content"), os.path.join(self.tmp, "assets")
        r = subprocess.run([sys.executable, imp.__file__, "--md", os.path.join(d, "t.md"), "--html", os.path.join(d, "t.html"),
                            "--images", os.path.join(d, "img"), "--root", root, "--assets", assets, "--version", version,
                            "--filed", "2026-10-26", "--captured", "2026-10-26T16:16:00Z", "--source", "https://example.com/s1"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        cover = os.path.join(root, version, "cover")
        return (open(os.path.join(cover, "index.md"), encoding="utf-8").read(),
                open(os.path.join(cover, "original.html"), encoding="utf-8").read(), assets)

    def test_changed_image_saved_under_new_name(self):
        md1, html1, assets = self.run_import("v1.0", b"old chart")
        md2, html2, _ = self.run_import("v1.1", b"new chart")
        new = "chart-" + hashlib.sha256(b"new chart").hexdigest()[:8] + ".jpg"
        self.assertEqual(sorted(os.listdir(assets)), sorted(["chart.jpg", "logo.jpg", new]))
        self.assertEqual(open(os.path.join(assets, "chart.jpg"), "rb").read(), b"old chart")
        self.assertEqual(open(os.path.join(assets, new), "rb").read(), b"new chart")
        # 旧版本引用原名，新版本引用新名；没变的图共用
        self.assertIn("img/chart.jpg)", md1)
        self.assertIn('s1img:chart.jpg"', html1)
        self.assertIn(f"img/{new})", md2)
        self.assertIn(f's1img:{new}"', html2)
        self.assertNotIn("chart.jpg)", md2.replace(new, ""))
        self.assertIn("img/logo.jpg)", md2)
        self.assertIn('s1img:logo.jpg"', html2)


if __name__ == "__main__":
    unittest.main()
