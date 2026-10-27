"""release.py 的回归测试，并核对仓库里已发布（冻结）的全文下载文件。

    python3 -m unittest discover -s tools/s1-import -v     # 需要 pypdf（requirements.txt）

检查已发布的每个版本（content/ 和 tests/fixtures/ 里 front matter 带 downloads 的 _index.md）：
文件存在、大小和 sha256 与 front matter 一致、不超过上限；PDF 页数/尺寸/每页「非官方」标记/文字层/书签/元数据；
HTML 是单文件（没有外部资源）、首末都有译者声明、noindex。
"""
import glob, hashlib, json, os, re, sys, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import release  # noqa: E402


def released_versions():
    for index in sorted(glob.glob(os.path.join(REPO, "content", "**", "_index.md"), recursive=True)
                        + glob.glob(os.path.join(REPO, "tests", "fixtures", "s1-preview", "versions", "*", "_index.md"))):
        fm = open(index, encoding="utf-8").read().split("\n---\n", 1)[0]
        m = re.search(r"^downloads: (.+)$", fm, re.M)
        if m:
            yield index, fm, json.loads(m.group(1))


class TextLayer(unittest.TestCase):
    def test_supplement_table(self):
        self.assertGreaterEqual(len(release.SUPPLEMENT), 90)
        for k, v in release.SUPPLEMENT.items():
            self.assertTrue(0x2E80 <= ord(k) <= 0x2EFF, k)
            self.assertEqual(len(v), 1, k)
            self.assertFalse(0x2E80 <= ord(v) <= 0x2FDF, f"{k} → {v} 还是部首")
            self.assertTrue(0x3400 <= ord(v) <= 0x9FFF, f"{k} → {v} 不是 CJK 统一汉字")
        # 实际在 Chrome 生成的 PDF 里出现过的
        for k, v in zip("⻚⻓⻛⻅⺠⻔⻬⻋⻆", "页长风见民门齐车角"):
            self.assertEqual(release.SUPPLEMENT[k], v)

    def test_fix_tounicode(self):
        cmap = b"<0001> <2EDA>\n<0002> <2F00>\n<0003> <4E00>\n<0004> <2E80>\n<0005> <2FD5>\n"
        self.assertEqual(release.fix_tounicode(cmap),
                         b"<0001> <9875>\n<0002> <4E00>\n<0003> <4E00>\n<0004> <2E80>\n<0005> <9FA0>\n")
        # 没有对应汉字的（⺀）保持原样；bfrange 起止、字形编号这类不在部首区的值不动
        self.assertEqual(release.fix_tounicode(b"<0010> <0020> <4E00>"), b"<0010> <0020> <4E00>")

    def test_refuses_to_overwrite_released_version(self):
        index, _, _ = next(released_versions())
        sys.argv = ["release.py", "--vdir", os.path.dirname(index), "--full", "/nonexistent", "--preview"]
        with self.assertRaises(SystemExit) as e:
            release.main()
        self.assertIn("已经发布过", str(e.exception.code))


class ReleasedFiles(unittest.TestCase):
    def test_released_versions_exist(self):
        self.assertTrue(list(released_versions()), "至少应有一个已发布的版本（预览样例 v1.0）")

    def test_files(self):
        for index, fm, dl in released_versions():
            vdir = os.path.dirname(index)
            version = json.loads(re.search(r"^version: (.+)$", fm, re.M).group(1))
            chapters = json.loads(re.search(r"^chapters: (.+)$", fm, re.M).group(1))
            pages = sum(c["pages"][1] - c["pages"][0] + 1 for c in chapters if c["included"]) + 2
            with self.subTest(version=index):
                self.assertNotRegex(fm, r"(?m)^outputs:.*s1full", "发布后不应再从模板生成 full.html")
                self.assertEqual(set(dl), {"html", "pdf"})
                for kind, d in dl.items():
                    self.assertEqual(d["file"], f"files/anthropic-s1-zh-unofficial-{version}." + {"html": "html.raw", "pdf": "pdf"}[kind])
                    b = open(os.path.join(vdir, d["file"]), "rb").read()
                    self.assertEqual(len(b), d["bytes"], f"{d['file']} 大小和 front matter 不一致（发布后被改过？）")
                    self.assertEqual(hashlib.sha256(b).hexdigest(), d["sha256"], f"{d['file']} sha256 不一致")
                    self.assertLessEqual(len(b), release.MAX_BYTES)
                release.check_pdf(os.path.join(vdir, dl["pdf"]["file"]), pages)

                html = open(os.path.join(vdir, dl["html"]["file"]), encoding="utf-8").read()
                self.assertRegex(html, r"<html[^>]* data-standalone")
                self.assertRegex(html, r'<meta name="?robots"? content="?noindex')
                self.assertEqual(html.count("人工没有检查、也没有能力检查译文与原文的一致性"), 2, "开头和结尾各一份完整的译者声明")
                self.assertIn("全部权利归 Anthropic, PBC", html)
                self.assertIn(version, html)
                # 单文件：图片、样式、脚本都内嵌，不引用外部资源（链接可以）
                self.assertNotRegex(html, r'<(img|script|iframe)[^>]+src="?(https?:|//|/)')
                self.assertNotRegex(html, r'<link[^>]+rel="?stylesheet')
                self.assertNotRegex(html, r"url\((?!['\"]?(data:|#))")


if __name__ == "__main__":
    unittest.main()
