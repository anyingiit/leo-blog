#!/usr/bin/env python3
"""给一篇原版阅读的双语译文（bilingualMode: original）生成全文下载文件：单文件 HTML + PDF。

    python3 tools/bilingual-import/release.py content/translations/<slug>

1. 用文章目录里的 original.html（原版版式）和 front matter 的声明信息拼成一个独立的 HTML：
   开头是完整声明，后面是原版页面，样式内联，不依赖网站。存成 files/<slug>-zh-en-<版本>.html.raw（网站上发布为 .html）
2. 用 Chromium 把它打印成同名 PDF（每页底部印「非官方译文」）
3. 把两个文件的大小和 sha256 写进 front matter 的 downloads（模板 layouts/_partials/s1/downloads.html 读取）
需要 Playwright（tests/ 里 npm ci 后就有）。
"""
import hashlib, html, os, re, subprocess, sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))


def front_matter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return yaml.safe_load(m.group(1)), text, m


def sheet_css():
    css = open(os.path.join(REPO, "assets/css/extended/bilingual.css"), encoding="utf-8").read()
    return "\n".join(l for l in css.splitlines() if l.startswith(".bl-sheet"))


def main(bundle):
    index = os.path.join(bundle, "index.md")
    fm, text, m = front_matter(index)
    slug = fm.get("slug") or os.path.basename(bundle.rstrip("/"))
    name = f"{slug}-zh-en-{fm['version']}"
    contact = yaml.safe_load(open(os.path.join(REPO, "hugo.yaml"), encoding="utf-8"))["params"].get("s1Contact", "")
    e = html.escape
    notice = f"""<section class="bl-dl-notice">
<p><strong>非官方中文译文</strong>：{e(fm.get('originalTitle', ''))}，{e(fm.get('author', ''))}，{fm.get('originalDate', '')} 发表。原文：<a href="{e(fm['source'])}">{e(fm['source'])}</a></p>
<p>翻译方式：{e(fm.get('methodDetail') or fm.get('method', ''))} 原文采集时间：{fm.get('captured', '')}。译文版本：{e(str(fm['version']))}。</p>
<p>译者与原作者没有关联，译文未经作者审阅，以原文为准；译者不对译文的准确性负责，读者据此作出的判断与行动后果自负。原文著作权归原作者所有，下架请求：{e(contact)}</p>
</section>"""
    body = open(os.path.join(bundle, "original.html"), encoding="utf-8").read()
    doc = f"""<!doctype html>
<html lang="zh-CN" data-standalone>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>{e(fm['title'])}（非官方译文 {e(str(fm['version']))}）</title>
<style>
body {{ margin: 0; background: #eee; }}
.bl-dl-notice {{ max-width: 816px; box-sizing: border-box; margin: 0 auto; padding: 16px 64px; font: 14px/1.7 system-ui, sans-serif; color: #444; background: #fffbe6; }}
.bl-dl-notice p {{ margin: 4px 0; }}
.bl-sheet {{ margin: 0 auto; max-width: 100%; }}
@media (max-width: 820px) {{ .bl-sheet {{ width: auto !important; padding: 24px 16px !important; }} .bl-dl-notice {{ padding: 12px 16px; }} }}
@page {{ size: 816px 1056px; margin: 0 0 40px; @bottom-center {{ content: "非官方译文 · {e(str(fm['version']))} · 以原文为准"; font: 10px sans-serif; color: #888; }} }}
@media print {{ body {{ background: #fff; }} }}
{sheet_css()}
</style></head>
<body>
{notice}
<div class="bl-sheet">{body}</div>
</body></html>
"""
    out = os.path.join(bundle, "files")
    os.makedirs(out, exist_ok=True)
    h = os.path.join(out, name + ".html.raw")
    open(h, "w", encoding="utf-8").write(doc)
    pdf = os.path.join(out, name + ".pdf")
    tmp = os.path.join(out, name + ".print.html")
    open(tmp, "w", encoding="utf-8").write(doc)
    subprocess.run(["node", os.path.join(REPO, "tools/s1-import/pdf.cjs"), tmp, pdf], check=True)
    os.remove(tmp)
    dl = {}
    for kind, path in (("html", h), ("pdf", pdf)):
        data = open(path, "rb").read()
        dl[kind] = {"file": os.path.relpath(path, bundle), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    fm_text = re.sub(r"\ndownloads:\n(  .*\n)+", "\n", m.group(1) + "\n").rstrip("\n")
    fm_text += "\n" + yaml.safe_dump({"downloads": dl}, sort_keys=False, allow_unicode=True).rstrip("\n")
    open(index, "w", encoding="utf-8").write("---\n" + fm_text + "\n---\n" + text[m.end():])
    print(f"{h}\n{pdf}")


if __name__ == "__main__":
    main(sys.argv[1])
