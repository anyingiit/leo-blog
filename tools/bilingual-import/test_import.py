"""import.py 的回归测试：沉浸式翻译保存的网页 → pairs.yaml（重排版）和 original.html（原版版式）。

    python3 -m unittest discover -s tools/bilingual-import -v     # 需要 requirements.txt

testdata/sample.html 是按沉浸式翻译真实输出的结构手写的小样例（行内译文、段后译文、插件注入的脚本/样式/弹窗）；
另外核对仓库里每篇双语译文：用文章目录里的 source.html.raw 重新导入，pairs.yaml 和 original.html 逐字节不变。
"""
import glob, importlib, os, shutil, sys, tempfile, unittest

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
imp = importlib.import_module("import")
SAMPLE = os.path.join(HERE, "testdata", "sample.html")


def run(src):
    out = tempfile.mkdtemp()
    imp.main(src, out)
    pairs = yaml.safe_load(open(os.path.join(out, "pairs.yaml"), encoding="utf-8"))
    original = open(os.path.join(out, "original.html"), encoding="utf-8").read()
    return out, pairs, original


class Sample(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out, cls.data, cls.original = run(SAMPLE)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.out)

    def test_header_split(self):
        # 开头的标题、作者单独放进 header，正文不重复
        self.assertEqual([(h["kind"], h["en"], h["zh"]) for h in self.data["header"]],
                         [("h1", "A Sample Essay", "一篇样例短文"), ("h2", "Jane Doe", "简·多伊")])

    def test_pairs(self):
        kinds = [p["kind"] for p in self.data["pairs"]]
        self.assertEqual(kinds, ["p", "p", "img", "p"])
        self.assertEqual(self.data["pairs"][1], {"kind": "p", "en": "1984\\. was a year.", "zh": "1984 年是一年。"})
        self.assertEqual(self.data["pairs"][2], {"kind": "img", "src": "https://example.com/fig.png", "alt": "figure"})
        self.assertEqual(self.data["pairs"][3], {"kind": "p", "en": "No translation here."})

    def test_inline_markdown_and_escaping(self):
        en = self.data["pairs"][0]["en"]
        self.assertIn("*italics*", en)
        self.assertIn("[link](https://example.com/x)", en)
        # Markdown 和公式的特殊字符转义，< 转成实体
        self.assertIn("a star \\* and \\$5 &lt;tag>", en)
        # LaTeX 风格的 ``…" 换成弯引号
        self.assertIn("“like this”", en)
        # 译文里的 * 也要转义，不被当成斜体
        self.assertEqual(self.data["pairs"][0]["zh"], "纯文本，带\\*斜体\\*、链接、星号和 5 美元。")

    def test_plugin_junk_removed(self):
        text = yaml.safe_dump(self.data, allow_unicode=True) + self.original
        for junk in ("popup", "window.imt", "imt-x", "immersive", "data-imt", "notranslate", "<script", "<template"):
            self.assertNotIn(junk, text, junk)

    def test_original_fragment(self):
        o = self.original
        # 作者自己的样式保留，只作用在原版纸面里
        self.assertTrue(o.startswith("<style>.bl-sheet .style1 { font-family: Palatino; } .bl-sheet h1, .bl-sheet h2 { color: #222; }</style>\n"), o[:120])
        # 行内译文（标题后）和段后译文（另起一行）
        self.assertIn('<h1>A Sample Essay<span class="bl-tr" lang="zh-CN">一篇样例短文</span></h1>', o)
        self.assertIn('<span class="bl-tr bl-tr-block" lang="zh-CN">1984 年是一年。</span></p>', o)
        # 原文原样保留，不做 Markdown 转义
        self.assertIn('<p class="style1">Plain text with <i>italics</i>, a <a href="https://example.com/x">link</a>, a star * and $5 &lt;tag&gt;.', o)
        self.assertIn('<img alt="figure" src="https://example.com/fig.png"/>', o)

    def test_source_kept(self):
        self.assertEqual(open(os.path.join(self.out, "source.html.raw"), "rb").read(), open(SAMPLE, "rb").read())

    def test_reimport_in_place(self):
        # 从文章目录里的 source.html.raw 重新导入：结果一样，source 不被改
        before = {n: open(os.path.join(self.out, n), "rb").read() for n in ("source.html.raw", "pairs.yaml", "original.html")}
        imp.main(os.path.join(self.out, "source.html.raw"), self.out)
        for n, data in before.items():
            self.assertEqual(open(os.path.join(self.out, n), "rb").read(), data, n)


class Repository(unittest.TestCase):
    def test_bundles_reproducible(self):
        bundles = sorted(os.path.dirname(p) for p in glob.glob(os.path.join(REPO, "content", "translations", "*", "source.html.raw")))
        self.assertTrue(bundles, "content/translations 里没有双语译文，测试前提不成立")
        for b in bundles:
            with self.subTest(os.path.basename(b)):
                out, _, _ = run(os.path.join(b, "source.html.raw"))
                for n in ("pairs.yaml", "original.html"):
                    self.assertEqual(open(os.path.join(out, n), "rb").read(), open(os.path.join(b, n), "rb").read(),
                                     f"{b}/{n} 和重新导入的结果不同（手改过，或导入脚本改了没有重新导入）")
                shutil.rmtree(out)


if __name__ == "__main__":
    unittest.main()
