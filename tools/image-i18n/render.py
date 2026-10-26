#!/usr/bin/env python3
"""按 *.i18n.yaml 描述，把文章里的中文配图生成英文版（见 docs/image-translation.md）。

用法：
  python3 tools/image-i18n/render.py content/notes/clever/j-space-blackmail.i18n.yaml
  python3 tools/image-i18n/render.py --all        # 重新生成 content/ 下所有描述文件

识别文字和翻译由写描述文件的人（或 Claude）完成，这个脚本只负责按描述稳定地重画：
  reflow   整段文字截图：按原图的底色、字号、行距重新排版英文，[[...]] 标出的片段画回标注框
  overlay  图表/界面截图：在原图上用底色盖住中文区域，原位写入英文
两种模式都可以先 crop 裁剪原图。依赖 Pillow 和 PyYAML。
"""
import argparse
import re
import sys
from collections import Counter
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT_DIR = Path(__file__).resolve().parent / "fonts"
FONTS = {
    "serif": "SourceSerif4-Regular.ttf",
    "serif-semibold": "SourceSerif4-Semibold.ttf",
    "sans": "SourceSans3-Regular.ttf",
    "sans-semibold": "SourceSans3-Semibold.ttf",
    "mono": "SourceCodePro-Regular.ttf",
}


def font(name, size):
    return ImageFont.truetype(str(FONT_DIR / FONTS.get(name, name)), size)


def rgb(value):
    if isinstance(value, (list, tuple)):
        return tuple(value)
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def pixels(im):
    return im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata()


def sample_colors(im):
    """从原图取底色（最常见的颜色）、文字色（最常见的深色）和标注色（最常见的高饱和色）。"""
    counts = Counter(pixels(im))
    def most_common(pred, default):
        hits = [(n, c) for c, n in counts.items() if pred(c)]
        return max(hits)[1] if hits else default
    return {
        "background": counts.most_common(1)[0][0],
        "text": most_common(lambda c: sum(c) < 150, (20, 20, 20)),
        "box": most_common(lambda c: max(c) - min(c) > 120, (235, 83, 78)),
    }


def color(spec_value, key, auto):
    return auto[key] if spec_value in (None, "auto") else rgb(spec_value)


def tokens(text):
    """把正文拆成 (词, 所属标注框编号或 None, 是否紧贴前一个词)，[[...]] 内的词属于同一个框。"""
    out, box_id, prev = [], 0, " "
    for i, part in enumerate(re.split(r"\[\[|\]\]", text)):
        inside = i % 2 == 1
        if inside:
            box_id += 1
        for j, word in enumerate(part.split()):
            # 框的边界两侧都没有空格时（如 “shape—[[“leverage””），两段贴在一起排
            glue = j == 0 and bool(out) and not prev[-1:].isspace() and not part[:1].isspace()
            out.append((word, box_id if inside else None, glue))
        prev = part or prev
    return out


def reflow(spec, src, auto):
    width = spec.get("width", src.width)
    top, right, bottom, left = spec.get("padding", [40, 40, 40, 40])
    f = font(spec.get("font", "serif"), spec["size"])
    line_height = spec.get("line_height", round(spec["size"] * 1.6))
    bg = color(spec.get("background"), "background", auto)
    fg = color(spec.get("color"), "text", auto)
    box = spec.get("box", {})
    box_color = color(box.get("color"), "box", auto)
    box_width = box.get("width", 4)
    pad_x, pad_y = box.get("pad", [6, 4])

    space = f.getlength(" ")
    lines, line, x = [], [], 0.0
    for word, bid, glue in tokens(spec["text"]):
        w = f.getlength(word)
        if line and x + space + w > width - left - right:
            lines.append(line)
            line, x = [], 0.0
        start = x + (space if line and not glue else 0)
        line.append((word, bid, start, w))
        x = start + w
    lines.append(line)

    height = top + bottom + line_height * len(lines)
    out = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(out)
    ascent, descent = f.getmetrics()
    for n, line in enumerate(lines):
        baseline = top + n * line_height + (line_height + ascent - descent) / 2
        for word, _, start, _ in line:
            draw.text((left + start, baseline), word, font=f, fill=fg, anchor="ls")
        # 同一行里连续属于同一个框的词画成一个矩形，跨行的框在每行各画一段（和原图一致）
        runs = []
        for word, bid, start, w in line:
            if bid is None:
                continue
            if runs and runs[-1][0] == bid:
                runs[-1][2] = start + w
            else:
                runs.append([bid, start, start + w])
        for _, x0, x1 in runs:
            draw.rectangle(
                (left + x0 - pad_x, baseline - ascent - pad_y,
                 left + x1 + pad_x, baseline + descent + pad_y),
                outline=box_color, width=box_width)
    return out


def patch_background(src, box, ring=3):
    """补丁的底色：取区域外一圈像素里最常见的颜色，跳过红框这类高饱和的标注色；
    一圈都是标注色时退回区域内最常见的颜色。"""
    x0, y0, x1, y1 = box
    outer = src.crop((max(x0 - ring, 0), max(y0 - ring, 0),
                      min(x1 + ring + 1, src.width), min(y1 + ring + 1, src.height)))
    ox, oy = max(x0 - ring, 0), max(y0 - ring, 0)
    counts = Counter(
        outer.getpixel((x, y)) for y in range(outer.height) for x in range(outer.width)
        if not (x0 <= x + ox <= x1 and y0 <= y + oy <= y1))
    plain = [(n, c) for c, n in counts.items() if max(c) - min(c) <= 120]
    if plain:
        return max(plain)[1]
    return Counter(pixels(src.crop((x0, y0, x1 + 1, y1 + 1)))).most_common(1)[0][0]


def overlay(spec, src, auto):
    out = src.copy()
    draw = ImageDraw.Draw(out)
    for p in spec.get("patches", []):
        x0, y0, x1, y1 = p["box"]
        fill = p.get("fill", "auto")
        if fill == "auto":
            fill = patch_background(src, (x0, y0, x1, y1))
        else:
            fill = rgb(fill)
        draw.rectangle((x0, y0, x1, y1), fill=fill)
        if not p.get("text"):
            continue
        size = p["size"]
        f = font(p.get("font", "sans"), size)
        def overflows(f):
            l, t, r, b = draw.multiline_textbbox((0, 0), p["text"], font=f)
            return r - l > x1 - x0 or b - t > y1 - y0
        while overflows(f) and size > 8:
            size -= 1  # 英文放不下（宽或高）就缩小字号，保证不越出原来的区域
            f = font(p.get("font", "sans"), size)
        anchor = {"left": "lm", "center": "mm", "right": "rm"}[p.get("align", "left")]
        ax = {"left": x0, "center": (x0 + x1) / 2, "right": x1}[p.get("align", "left")]
        draw.multiline_text((ax, (y0 + y1) / 2), p["text"], font=f, anchor=anchor,
                            fill=color(p.get("color"), "text", auto), align=p.get("align", "left"))
    return out


def load(spec_path):
    return yaml.safe_load(Path(spec_path).read_text(encoding="utf-8"))


def build(spec, base_dir):
    """按描述生成英文图并返回（不写文件），测试也直接调用它。"""
    src = Image.open(Path(base_dir) / spec["source"]).convert("RGB")
    auto = sample_colors(src)
    if "crop" in spec:
        src = src.crop(tuple(spec["crop"]))
    return {"reflow": reflow, "overlay": overlay}[spec.get("mode", "overlay")](spec, src, auto)


def render(spec_path):
    spec_path = Path(spec_path).resolve()
    spec = load(spec_path)
    out = build(spec, spec_path.parent)
    target = spec_path.parent / spec["output"]
    out.save(target, optimize=True)
    shown = target.relative_to(ROOT) if target.is_relative_to(ROOT) else target
    print(f"{shown}  {out.width}x{out.height}  ({spec.get('mode', 'overlay')})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("specs", nargs="*")
    ap.add_argument("--all", action="store_true", help="处理 content/ 下所有 *.i18n.yaml")
    args = ap.parse_args()
    specs = sorted((ROOT / "content").rglob("*.i18n.yaml")) if args.all else args.specs
    if not specs:
        ap.error("没有要处理的描述文件")
    for s in specs:
        render(s)


if __name__ == "__main__":
    sys.exit(main())
