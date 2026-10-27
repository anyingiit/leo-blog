#!/usr/bin/env python3
"""把沉浸式翻译（Immersive Translate）保存的双语对照 HTML 拆成「原文/译文」段落对。

用法：python3 tools/bilingual-import/import.py <保存的.html> <输出的 pairs.yaml>

沉浸式翻译把每段译文包在 <font class="immersive-translate-target-wrapper"> 里，追加在该段原文末尾。
这里按文档顺序把 DOM 摊平：遇到译文包装就结束当前一段原文，与包装里的译文配成一对；
段落的种类（标题、引用、列表项、正文）取自原文所在的块元素。行内的斜体、粗体、链接、代码转成 Markdown。
没有译文的块（例如图片、代码块）原样保留为只有原文的一段。
"""
import re
import sys

import yaml
from bs4 import BeautifulSoup, NavigableString, Tag

WRAPPER = "immersive-translate-target-wrapper"
BLOCKS = {"p", "div", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "td", "th", "dd", "dt", "figcaption", "section", "article", "body"}
KINDS = {"h1": "h1", "h2": "h2", "h3": "h3", "h4": "h4", "h5": "h4", "h6": "h4", "li": "li", "blockquote": "quote", "pre": "code"}


def read(path):
    raw = open(path, "rb").read()
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:2000])
    enc = m.group(1).decode() if m else "utf-8"
    return BeautifulSoup(raw.decode(enc, errors="replace"), "html.parser")


def inline_md(node):
    """把一段 DOM 转成行内 Markdown（只保留斜体、粗体、链接、代码）。"""
    if isinstance(node, NavigableString):
        # 转义 Markdown 和本站公式的特殊字符：* _ ` [ ] $ <
        return re.sub(r"[*_`\[\]$<]", lambda m: "&lt;" if m.group(0) == "<" else "\\" + m.group(0), str(node))
    if not isinstance(node, Tag) or WRAPPER in (node.get("class") or []):
        return ""
    inner = "".join(inline_md(c) for c in node.children)
    style = (node.get("style") or "").replace(" ", "")
    if node.name in ("em", "i") or "font-style:italic" in style:
        return f"*{inner.strip()}*" if inner.strip() else inner
    if node.name in ("strong", "b") or "font-weight:bold" in style:
        return f"**{inner.strip()}**" if inner.strip() else inner
    if node.name == "code":
        return f"`{node.get_text()}`"
    if node.name == "a" and node.get("href", "").startswith(("http", "mailto")):
        return f"[{inner.strip()}]({node['href']})"
    if node.name == "br":
        return "\n"
    return inner


def clean(text):
    # 原文里 LaTeX 风格的引号 ``…" 换成弯引号
    text = re.sub(r"\\`\\`(.*?)\"", "“\\1”", text.replace("\xa0", " "))
    text = re.sub(r"[ \t\r]*\n[ \t\r]*", "\n", text)
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n{2,}", text)]
    # 段首的「1984.」「- 」「# 」「> 」不能被当成列表、标题或引用
    paras = [re.sub(r"^(\d+)\.(\s)", r"\1\\.\2", re.sub(r"^([-+#>])(\s)", r"\\\1\2", p)) for p in paras]
    return "\n\n".join(p for p in paras if p)


def kind_of(node):
    for parent in [node, *node.parents]:
        if isinstance(parent, Tag) and parent.name in KINDS:
            return KINDS[parent.name]
    return "p"


def extract(soup):
    body = soup.body or soup
    for junk in body.find_all(["script", "style", "template", "noscript"]):
        junk.decompose()
    pairs, buf, buf_kind = [], [], None

    def flush(zh=None):
        nonlocal buf, buf_kind
        en = clean("".join(buf))
        if en or zh:
            pairs.append({"kind": buf_kind or "p", "en": en, **({"zh": zh} if zh else {})})
        buf, buf_kind = [], None

    def walk(node):
        nonlocal buf_kind
        for child in node.children:
            if isinstance(child, NavigableString):
                if str(child).strip():
                    buf_kind = buf_kind or kind_of(child.parent)
                buf.append(inline_md(child))
            elif not isinstance(child, Tag):
                continue
            elif WRAPPER in (child.get("class") or []):
                inner = child.find(class_="immersive-translate-target-inner") or child
                flush(clean(inline_md(inner) if inner is not child else "".join(inline_md(c) for c in inner.children if isinstance(c, Tag) and "notranslate" not in (c.get("class") or []) or isinstance(c, NavigableString))))
            elif child.name == "img":
                flush()
                pairs.append({"kind": "img", "src": child.get("src", ""), "alt": child.get("alt", "")})
            elif (child.name in ("em", "i", "strong", "b", "a", "code") or "font-style" in (child.get("style") or "")) and not child.find(class_=WRAPPER):
                buf_kind = buf_kind or kind_of(child)
                buf.append(inline_md(child))
            elif child.name == "br":
                buf.append("\n")
            elif child.name in BLOCKS:
                if "".join(buf).strip():
                    flush()
                buf.append("\n\n")
                walk(child)
                if "".join(buf).strip():
                    flush()
                buf.append("\n\n")
            else:
                walk(child)
    walk(body)
    flush()
    return [p for p in pairs if p.get("en") or p.get("zh") or p["kind"] == "img"]


class Literal(str):
    pass


yaml.add_representer(Literal, lambda d, s: d.represent_scalar("tag:yaml.org,2002:str", s, style="|"))


def main(src, out):
    pairs = extract(read(src))
    # 开头连续的标题行（文章标题、作者、日期）单独放进 header，正文排版时不重复显示
    n = 0
    while n < len(pairs) and pairs[n]["kind"] in ("h1", "h2", "h3") and n < 3:
        n += 1
    header, pairs = pairs[:n], pairs[n:]
    for p in header + pairs:
        for k in ("en", "zh"):
            if k in p and len(p[k]) > 60:
                p[k] = Literal(p[k])
    with open(out, "w", encoding="utf-8") as f:
        f.write("# 由 tools/bilingual-import/import.py 从沉浸式翻译保存的 HTML 生成；可以直接手改译文\n")
        yaml.dump({"header": header, "pairs": pairs}, f, allow_unicode=True, sort_keys=False, width=10**9)
    untranslated = sum(1 for p in pairs if p["kind"] != "img" and "zh" not in p)
    print(f"{len(pairs)} 段，其中 {untranslated} 段没有译文", file=sys.stderr)


if __name__ == "__main__":
    main(*sys.argv[1:3])
