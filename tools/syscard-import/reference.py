#!/usr/bin/env python3
"""原版版式的像素基准：把译文 PDF 的几页按 96 dpi（612pt 宽的页 → 816px）渲染成 PNG，放在 tests/fixtures/syscards/。
tests/syscards.test.mjs 在浏览器里把同一页的原版版式（底图 + SVG 文字层）截图，和这些基准逐像素比对；
test_import.py 检查基准仍是现在内容目录里那份 PDF 渲染出来的（换了 PDF 就要重新生成）。
同时生成这几页文字层每个字在 PDF 里的横坐标（positions.json）：网页的文字层大多只写每行的起点、由浏览器按字体排，
tests/syscards.test.mjs 在 Chromium 和 WebKit 里逐字核对排出来的位置和 PDF 相同。这一步要用译文仓库的字体：

  python3 tools/syscard-import/reference.py ../anthropic-system-cards-zh     # 重新生成（参数是译文仓库）
"""
import json
import os
import re
import sys

import html
import tempfile

import pymupdf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
CONTENT = os.path.join(REPO, "content", "translations", "system-cards")
OUT = os.path.join(REPO, "tests", "fixtures", "syscards")
DPI = 96
# 有代表性的页：封面（大图）、表格和图注、2.2 节的金色译注（另行翻译的部分）、整页图表
PAGES = [("haiku-5.5", 1), ("haiku-5.5", 12), ("opus-5.5", 16), ("opus-5.5", 40)]


def pdf_of(slug):
    """这份卡最新版本的 PDF（卡片首页 front matter 的 latest → 版本页的 downloads.pdf.file）"""
    root = open(os.path.join(CONTENT, slug, "_index.md"), encoding="utf-8").read()
    latest = json.loads(re.search(r"^latest: (.+)$", root, re.M).group(1))
    vdir = os.path.join(CONTENT, slug, latest)
    fm = open(os.path.join(vdir, "_index.md"), encoding="utf-8").read()
    return latest, os.path.join(vdir, json.loads(re.search(r"^downloads: (.+)$", fm, re.M).group(1))["pdf"]["file"])


def render(slug, page):
    """原版第 page 页：下载用的 PDF 第一页是译者声明，所以是 PDF 的第 page + 1 页；只取原文的 612×792pt，不含底部的页脚"""
    _, pdf = pdf_of(slug)
    with pymupdf.open(pdf) as doc:
        return doc[page].get_pixmap(dpi=DPI, clip=pymupdf.Rect(0, 0, 612, 792)).tobytes("png")


def name(slug, page):
    return f"{slug}-p{page:03d}.png"


def positions(src):
    """每页：[[一行文字, [每个字的横坐标 pt]], …]，顺序同网页文字层（chapters.original_pages 不省坐标时的输出）"""
    fonts, out = chapters.Fonts(src), {}
    with tempfile.TemporaryDirectory() as tmp:
        for slug, page in PAGES:
            _, pdf = pdf_of(slug)
            sheet = chapters.original_pages(pdf, [page + 1], fonts, tmp, start_only=False)[0]  # 下载用的 PDF 第一页是译者声明
            rows = []
            for xs, y, txt in re.findall(r'<text x="([^"]+)" y="([^"]+)"[^>]*>([^<]*)</text>', sheet):
                if float(y) <= 792:  # 下载用的 PDF 底部另加的页脚不算
                    rows.append([html.unescape(txt), [float(v) for v in xs.split()]])
            out[name(slug, page)[:-4]] = rows
    return out


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    for slug, page in PAGES:
        with open(os.path.join(OUT, name(slug, page)), "wb") as f:
            f.write(render(slug, page))
        print(name(slug, page))
    with open(os.path.join(OUT, "positions.json"), "w", encoding="utf-8") as f:
        json.dump(positions(argv[0]), f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("positions.json")


if __name__ == "__main__":
    sys.exit(main())
