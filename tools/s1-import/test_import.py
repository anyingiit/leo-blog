"""import.py 的回归测试：译文 Markdown 转成 Hugo 正文时的处理。

    python3 -m unittest discover -s tools/s1-import -v
"""
import os, sys, unittest

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


if __name__ == "__main__":
    unittest.main()
