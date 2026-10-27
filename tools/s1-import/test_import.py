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


if __name__ == "__main__":
    unittest.main()
