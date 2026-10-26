"""render.py 的回归测试：python3 -m unittest discover -s tools/image-i18n -v

前半部分用合成图片测脚本本身的行为；后半部分检查 content/ 里每份 *.i18n.yaml：
英文图存在、被英文页引用、且和按描述重新生成的结果一致（改了描述却忘了重新生成会失败）。
"""
import re
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat

import render

BG = (250, 249, 245)
INK = (20, 20, 19)
RED = (235, 83, 78)


def source_image(path, size=(800, 200)):
    """模拟一张带红框标注的文字截图：浅底、深色“文字”块、红色框线。"""
    im = Image.new("RGB", size, BG)
    d = ImageDraw.Draw(im)
    for y in range(30, size[1] - 30, 40):
        d.rectangle((40, y, size[0] - 60, y + 20), fill=INK)
    d.rectangle((300, 70, 520, 110), outline=RED, width=4)
    im.save(path)
    return im


def red_mask(im):
    return [(x, y) for y in range(im.height) for x in range(im.width)
            if im.getpixel((x, y)) == RED]


class TokensTest(unittest.TestCase):
    def test_plain_words(self):
        self.assertEqual(render.tokens("a b  c"), [("a", None, False), ("b", None, False), ("c", None, False)])

    def test_boxes_are_numbered_in_order(self):
        ids = [bid for _, bid, _ in render.tokens("x [[a b]] y [[c]]")]
        self.assertEqual(ids, [None, 1, 1, None, 2])

    def test_glue_when_box_boundary_has_no_space(self):
        toks = render.tokens("shape—[[“leverage” and]] next")
        self.assertEqual(toks[1], ("“leverage”", 1, True))
        self.assertFalse(toks[3][2])  # “next” 前有空格

    def test_glue_after_closing_bracket(self):
        toks = render.tokens("[[fictional]], indicating")
        self.assertEqual(toks[1], (",", None, True))

    def test_no_glue_when_spaced(self):
        self.assertFalse(any(g for _, _, g in render.tokens("a [[b]] c")))


class ColorTest(unittest.TestCase):
    def test_sample_colors(self):
        with tempfile.TemporaryDirectory() as d:
            im = source_image(Path(d) / "src.png")
        auto = render.sample_colors(im)
        self.assertEqual(auto, {"background": BG, "text": INK, "box": RED})

    def test_explicit_color_wins(self):
        self.assertEqual(render.color("#010203", "box", {"box": RED}), (1, 2, 3))
        self.assertEqual(render.color("auto", "box", {"box": RED}), RED)
        self.assertEqual(render.color([4, 5, 6], "box", {"box": RED}), (4, 5, 6))


class ReflowTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        source_image(self.dir / "src.png")
        self.spec = {"source": "src.png", "mode": "reflow", "size": 28, "line_height": 44,
                     "padding": [10, 50, 10, 40], "box": {"width": 3, "pad": [4, 2]}}

    def tearDown(self):
        self.tmp.cleanup()

    def build(self, text, **extra):
        return render.build({**self.spec, "text": text, **extra}, self.dir)

    def test_keeps_width_and_background(self):
        out = self.build("Short sentence.")
        self.assertEqual(out.width, 800)
        self.assertEqual(out.getpixel((0, 0)), BG)
        self.assertEqual(out.height, 10 + 10 + 44)

    def test_wraps_within_padding(self):
        out = self.build(" ".join(["wrapping"] * 60))
        self.assertGreater(out.height, 44 * 5)
        ink_x = [x for y in range(out.height) for x in range(out.width) if sum(out.getpixel((x, y))) < 150]
        self.assertGreaterEqual(min(ink_x), 40 - 2)
        self.assertLessEqual(max(ink_x), 800 - 50)

    def test_no_box_without_markers(self):
        self.assertEqual(red_mask(self.build("No annotations here at all.")), [])

    def test_box_in_source_color_around_marked_span(self):
        out = self.build("before [[marked words]] after")
        red = red_mask(out)
        self.assertTrue(red)
        xs = [x for x, _ in red]
        f = render.font("serif", 28)
        start = 40 + f.getlength("before ")
        end = start + f.getlength("marked words")
        self.assertAlmostEqual(min(xs), start - 4, delta=2)
        self.assertAlmostEqual(max(xs), end + 4, delta=2)

    def test_box_spanning_lines_is_drawn_once_per_line(self):
        out = self.build("[[" + " ".join(["boxed"] * 40) + "]]", line_height=56)
        rows = sorted({y for _, y in red_mask(out)})
        bands = 1 + sum(1 for a, b in zip(rows, rows[1:]) if b - a > 1)
        lines = (out.height - 20) // 56
        self.assertGreater(lines, 1)
        self.assertEqual(bands, lines)  # 行距大于框高时，每行各有一段独立的框

    def test_explicit_box_color(self):
        out = self.build("a [[b]] c", box={"color": "#0000ff", "width": 3})
        self.assertEqual(red_mask(out), [])
        self.assertTrue(any(out.getpixel((x, y)) == (0, 0, 255)
                            for y in range(out.height) for x in range(out.width)))


class OverlayTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.src = source_image(self.dir / "src.png")

    def tearDown(self):
        self.tmp.cleanup()

    def outside_unchanged(self, out, box):
        x0, y0, x1, y1 = box
        a, b = self.src.copy(), out.copy()
        for im in (a, b):
            ImageDraw.Draw(im).rectangle(box, fill=(0, 0, 0))
        self.assertIsNone(ImageChops.difference(a, b).getbbox())

    def test_empty_patch_erases_to_background(self):
        box = [40, 30, 300, 50]
        out = render.build({"source": "src.png", "patches": [{"box": box}]}, self.dir)
        self.assertEqual(ImageStat.Stat(out.crop((40, 30, 301, 51))).extrema, [(c, c) for c in BG])
        self.outside_unchanged(out, box)

    def test_text_shrinks_to_fit_width_and_height(self):
        box = [310, 76, 510, 104]  # 红框内侧
        patch = {"box": box, "text": "a much longer English line\nand a second one", "size": 60}
        out = render.build({"source": "src.png", "patches": [patch]}, self.dir)
        self.outside_unchanged(out, box)
        self.assertEqual(len(red_mask(out)), len(red_mask(self.src)))  # 标注框没被盖掉

    def test_crop(self):
        out = render.build({"source": "src.png", "crop": [0, 0, 800, 120]}, self.dir)
        self.assertEqual(out.size, (800, 120))
        self.assertIsNone(ImageChops.difference(out, self.src.crop((0, 0, 800, 120))).getbbox())

    def test_render_writes_output(self):
        spec = self.dir / "src.i18n.yaml"
        spec.write_text("source: src.png\noutput: src.en.png\ncrop: [0, 0, 100, 100]\n", encoding="utf-8")
        render.render(spec)
        with Image.open(self.dir / "src.en.png") as im:
            self.assertEqual(im.size, (100, 100))


SPECS = sorted((render.ROOT / "content").rglob("*.i18n.yaml"))


class ContentSpecsTest(unittest.TestCase):
    def test_specs_exist(self):
        self.assertTrue(SPECS, "content/ 下至少应有一份 *.i18n.yaml")

    def test_each_spec(self):
        for path in SPECS:
            with self.subTest(spec=str(path.relative_to(render.ROOT))):
                spec = render.load(path)
                out = path.parent / spec["output"]
                self.assertTrue(out.exists(), f"缺少生成的英文图 {out.name}，运行 render.py 生成")
                self.assertTrue(out.name.endswith(".en.png"), "英文图应命名为 <原名>.en.png")
                pages = {p.name: p.read_text(encoding="utf-8") for p in path.parent.glob("*.md")}
                ref = re.compile(r"\]\(\s*(?:\./)?" + re.escape(out.name) + r"\s*\)")
                en = [n for n, t in pages.items() if n.endswith(".en.md") and ref.search(t)]
                zh = [n for n, t in pages.items() if not n.endswith(".en.md") and ref.search(t)]
                self.assertTrue(en, f"英文页没有引用 {out.name}")
                self.assertFalse(zh, f"中文页不应引用英文图 {out.name}")

                # 提交的英文图必须是按当前描述生成的；允许字体渲染在不同 FreeType 版本间的细微差异
                fresh = render.build(spec, path.parent)
                with Image.open(out) as im:
                    saved = im.convert("RGB")
                self.assertEqual(fresh.size, saved.size, "描述改过但没重新生成英文图")
                diff = ImageStat.Stat(ImageChops.difference(fresh, saved)).mean
                self.assertLess(max(diff), 1.0, "描述改过但没重新生成英文图")


if __name__ == "__main__":
    unittest.main()
