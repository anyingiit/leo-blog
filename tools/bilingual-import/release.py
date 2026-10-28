#!/usr/bin/env python3
"""给一篇双语对照译文生成全文下载文件（单文件 HTML + PDF），每个版本定稿时运行一次：

    python3 tools/bilingual-import/release.py content/translations/<slug>

1. 用文章目录里的 original.html（原版版式）和 front matter 的声明信息拼成一个独立的 HTML：
   首末都是译者声明，中间是原版页面，样式内联，不依赖网站。存成 files/<slug>-zh-en-<版本>.html.raw（网站上发布为 .html）
2. 用 Chromium 把它打印成同名 PDF（tools/s1-import/pdf.cjs；每页底部印「非官方译文」），
   修正文字层里的部首字符、写入元数据，并逐页检查（和 S-1 译本共用 tools/s1-import/release.py 的做法）
3. 把两个文件的大小和 sha256 写进 front matter 的 downloads（模板 layouts/_partials/s1/downloads.html 读取）
已发布的版本不再改动：files/ 里已有这个版本的文件时拒绝覆盖（还没上线、确实要重新生成时加 --force）。
需要 Playwright（tests/ 里 npm ci）和 pypdf、pikepdf、PyYAML（pip install -r tools/s1-import/requirements.txt）。
"""
import argparse, hashlib, html, importlib.util, os, re, subprocess, sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
PAGE = (612, 792)  # PDF 页面（pt）：816×1056px 的纸


def s1_release():
    spec = importlib.util.spec_from_file_location("s1_release", os.path.join(REPO, "tools/s1-import/release.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def front_matter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return yaml.safe_load(m.group(1)), text, m


def sheet_css():
    """原版纸面的样式取自网站的 bilingual.css（.bl-sheet 开头的规则），下载文件和网页上一致"""
    css = open(os.path.join(REPO, "assets/css/extended/bilingual.css"), encoding="utf-8").read()
    return "\n".join(l for l in css.splitlines() if l.startswith(".bl-sheet"))


def standalone_html(fm, body, contact):
    e = html.escape
    ver = e(str(fm["version"]))
    notice = f"""<section class="bl-dl-notice">
<p><strong>非官方中文译文</strong>：{e(fm.get('originalTitle', ''))}，{e(fm.get('author', ''))}，{fm.get('originalDate', '')} 发表。原文：<a href="{e(fm['source'])}">{e(fm['source'])}</a></p>
<p>翻译方式：{e(fm.get('methodDetail') or fm.get('method', ''))} 原文采集时间：{e(str(fm.get('captured', '')))}。译文版本：{ver}。</p>
<p>译者与原作者没有关联，译文未经作者审阅，以原文为准；译者不对译文的准确性负责，读者据此作出的判断与行动后果自负。原文著作权归原作者所有，下架请求：{e(contact)}</p>
</section>"""
    return f"""<!doctype html>
<html lang="zh-CN" data-standalone>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>{e(fm['title'])}（非官方译文 {ver}）</title>
<style>
/* 关掉 iOS 的文字自动放大（Safari 及 X、微信等应用内浏览器）：这个独立文件不用主题样式，PaperMod reset.css 里的同一条规则管不到它（见 S-1 完整 HTML，PR #33） */
html {{ -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }}
body {{ margin: 0; background: #eee; }}
.bl-dl-notice {{ max-width: 816px; box-sizing: border-box; margin: 0 auto; padding: 16px 64px; font: 14px/1.7 system-ui, sans-serif; color: #444; background: #fffbe6; }}
.bl-dl-notice p {{ margin: 4px 0; }}
.bl-sheet {{ margin: 0 auto; max-width: 100%; }}
@media (max-width: 820px) {{ .bl-sheet {{ width: auto !important; padding: 24px 16px !important; }} .bl-dl-notice {{ padding: 12px 16px; }} }}
@page {{ size: 816px 1056px; margin: 0 0 40px; @bottom-center {{ content: "非官方译文 · {ver} · 以原文为准"; font: 10px sans-serif; color: #888; }} }}
@media print {{ body {{ background: #fff; }} }}
{sheet_css()}
</style></head>
<body>
{notice}
<div class="bl-sheet">{body}</div>
{notice}
</body></html>
"""


def check_pdf(path):
    from pypdf import PdfReader

    r = PdfReader(path)
    for i, p in enumerate(r.pages, 1):
        text = p.extract_text() or ""
        if "非官方" not in text:
            raise ValueError(f"PDF 第 {i} 页找不到「非官方」标记")
        bad = [ch for ch in text if 0x2E80 <= ord(ch) <= 0x2FDF]
        if bad:
            raise ValueError(f"PDF 第 {i} 页的文字层还有部首字符 {''.join(bad[:10])}")
        if (round(float(p.mediabox.width)), round(float(p.mediabox.height))) != PAGE:
            raise ValueError(f"PDF 第 {i} 页尺寸 {p.mediabox.width}×{p.mediabox.height}，应为 {PAGE[0]}×{PAGE[1]}pt")
    if "非官方" not in (r.metadata.title or "") or "非官方" not in (r.metadata.author or ""):
        raise ValueError("PDF 元数据缺少「非官方」标题或作者")
    if "/StructTreeRoot" not in r.trailer["/Root"]:
        raise ValueError("PDF 没有标签结构（屏幕阅读器读不了）")
    return len(r.pages)


def fix_pdf(path, fm):
    """和 S-1 译本一样：文字层的部首字符改回汉字，写元数据，压缩结构对象"""
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
    import pikepdf

    fix = s1_release().fix_tounicode
    w = PdfWriter(clone_from=path)
    for obj in list(w._objects):
        if isinstance(obj, DictionaryObject) and "/ToUnicode" in obj:
            data = obj["/ToUnicode"].get_object().get_data()
            new = fix(data)
            if new != data:
                s = DecodedStreamObject()
                s.set_data(new)
                obj[NameObject("/ToUnicode")] = w._add_object(s)
    w.add_metadata({
        "/Title": f"{fm['title']}（非官方译文 {fm['version']}）",
        "/Author": "非官方译文（译者与原作者无关）",
        "/Subject": f"{fm.get('originalTitle', '')}（{fm.get('author', '')}）的非官方中文译文 {fm['version']}，以原文为准。原文：{fm['source']}",
    })
    w.write(path)
    with pikepdf.open(path, allow_overwriting_input=True) as pdf:
        pdf.save(path, object_stream_mode=pikepdf.ObjectStreamMode.generate, compress_streams=True, deterministic_id=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bundle", help="文章目录，例如 content/translations/bitter-lesson")
    ap.add_argument("--force", action="store_true", help="覆盖这个版本已有的下载文件（只在还没上线时用）")
    a = ap.parse_args(argv)

    index = os.path.join(a.bundle, "index.md")
    fm, text, m = front_matter(index)
    slug = fm.get("slug") or os.path.basename(a.bundle.rstrip("/"))
    name = f"{slug}-zh-en-{fm['version']}"
    contact = yaml.safe_load(open(os.path.join(REPO, "hugo.yaml"), encoding="utf-8"))["params"].get("s1Contact")
    if not contact:
        sys.exit("release.py: hugo.yaml 没有设置下架联系方式 params.s1Contact")
    out = os.path.join(a.bundle, "files")
    h, pdf = os.path.join(out, name + ".html.raw"), os.path.join(out, name + ".pdf")
    if not a.force and (os.path.exists(h) or os.path.exists(pdf)):
        sys.exit(f"release.py: {fm['version']} 已经发布过（{out}），已发布的版本不再改动；要发新版本先改 front matter 的 version")

    os.makedirs(out, exist_ok=True)
    doc = standalone_html(fm, open(os.path.join(a.bundle, "original.html"), encoding="utf-8").read(), contact)
    open(h, "w", encoding="utf-8").write(doc)
    tmp = os.path.join(out, name + ".print.html")
    open(tmp, "w", encoding="utf-8").write(doc)
    try:
        subprocess.run(["node", os.path.join(REPO, "tools/s1-import/pdf.cjs"), tmp, pdf], check=True)
    finally:
        os.remove(tmp)
    fix_pdf(pdf, fm)
    pages = check_pdf(pdf)

    dl = {}
    for kind, path in (("html", h), ("pdf", pdf)):
        data = open(path, "rb").read()
        dl[kind] = {"file": os.path.relpath(path, a.bundle), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    fm_text = re.sub(r"\ndownloads:\n(  .*\n)+", "\n", m.group(1) + "\n").rstrip("\n")
    fm_text += "\n" + yaml.safe_dump({"downloads": dl}, sort_keys=False, allow_unicode=True).rstrip("\n")
    open(index, "w", encoding="utf-8").write("---\n" + fm_text + "\n---\n" + text[m.end():])
    print(f"{h}\n{pdf}（{pages} 页）")


if __name__ == "__main__":
    main()
