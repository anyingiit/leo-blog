"""release.py 的回归测试，并核对仓库里每篇双语译文已发布（冻结）的全文下载文件。

    python3 -m unittest discover -s tools/bilingual-import -v     # 需要 tools/s1-import/requirements.txt（pypdf、pikepdf）

已发布的文件：存在、大小和 sha256 与 front matter 一致；HTML 是单文件、noindex、首末都有译者声明、含完整的原版正文；
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
        for b, fm in bundles():
            with self.subTest(os.path.basename(b)):
                h = open(os.path.join(b, fm["downloads"]["html"]["file"]), encoding="utf-8").read()
                self.assertIn("<html lang=\"zh-CN\" data-standalone>", h)
                self.assertIn('<meta name="robots" content="noindex">', h)
                # 单文件：没有外部样式、脚本、图片以外的资源
                self.assertNotRegex(h, r"<(link|script)\b")
                self.assertEqual(h.count('<section class="bl-dl-notice">'), 2, "首末都要有译者声明")
                self.assertRegex(h, r'^[\s\S]{0,3000}<section class="bl-dl-notice">', "声明要在开头")
                self.assertIn(fm["source"], h)
                self.assertIn("非官方", h)
                body = open(os.path.join(b, "original.html"), encoding="utf-8").read()
                self.assertIn(body, h, "冻结的 HTML 里要有完整的原版正文")

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

    def test_standalone_html(self):
        fm = {"title": "标题", "version": "v2.0", "originalTitle": "Title & <x>", "author": "A", "originalDate": "2020-01-01",
              "source": "https://example.com/a?b=1&c=2", "method": "m", "captured": "2026-01-01T00:00:00Z"}
        h = release.standalone_html(fm, "<p>BODY</p>", "x@example.com")
        self.assertIn("<title>标题（非官方译文 v2.0）</title>", h)
        self.assertIn("Title &amp; &lt;x&gt;", h)
        self.assertIn('href="https://example.com/a?b=1&amp;c=2"', h)
        self.assertIn('<div class="bl-sheet"><p>BODY</p></div>', h)
        self.assertIn('content: "非官方译文 · v2.0 · 以原文为准"', h)
        self.assertIn("x@example.com", h)
        # 原版纸面的样式和网站同源
        self.assertIn(".bl-sheet { width: 816px;", h)

    def test_shares_s1_text_layer_fix(self):
        self.assertEqual(release.s1_release().fix_tounicode(b"<0001> <2F00>"), b"<0001> <4E00>")


if __name__ == "__main__":
    unittest.main()
