#!/usr/bin/env python3
"""给一篇双语对照译文生成全文下载文件（单文件 HTML + PDF），每个版本定稿时运行一次：

    python3 tools/bilingual-import/release.py content/translations/<slug>

1. 下载用的 HTML 就是导入时保存的网页 source.html.raw 原样（读者要的是接近原网页的阅读体验，不另做排版），
   只在 <body> 首末加译者声明（浏览器默认样式）、<head> 里加 noindex。
   存成 files/<slug>-zh-en-<版本>.html.raw（网站上发布为 .html）
2. 用 Chromium 把它打印成同名 PDF（打印用的临时副本另加纸张大小和页脚）（tools/s1-import/pdf.cjs；每页底部印「非官方译文」），
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


NOTICE_MARK = "<!-- bl-dl-notice -->"


def notice_html(fm, contact):
    """译者声明：只用浏览器默认样式（<hr>、<small>），不给原网页加任何排版"""
    e = html.escape
    return f"""{NOTICE_MARK}<small><b>非官方中文译文</b>：{e(fm.get('originalTitle', ''))}，{e(fm.get('author', ''))}，{fm.get('originalDate', '')} 发表。原文：<a href="{e(fm['source'])}">{e(fm['source'])}</a><br>
翻译方式：{e(fm.get('methodDetail') or fm.get('method', ''))} 原文采集时间：{e(str(fm.get('captured', '')))}。译文版本：{e(str(fm['version']))}。<br>
译者与原作者没有关联，译文未经作者审阅，以原文为准；译者不对译文的准确性负责，读者据此作出的判断与行动后果自负。原文著作权归原作者所有，下架请求：{e(contact)}</small>"""


def asis_html(raw, fm, contact):
    """下载用的 HTML 就是导入时保存的网页（source.html.raw）原样：作者的排版、沉浸式翻译的段后译文都不动。
    只加不改排版的两样：<head> 里的 noindex，<body> 首末的译者声明。原网页的好坏特征都保留（用户 2026-10-28：HTML 原样提供）：
    例如这篇没有 viewport，手机上按 980px 排版再缩小，iOS 的文字自动放大也照常起作用，所以不加 text-size-adjust
    （S-1 完整 HTML 要关掉它，是因为那是固定位置排版，放大会让行重叠；流式排版的原网页没有这个问题）。
    原网页可能声明了别的编码（这篇是 windows-1252），而 Cloudflare Pages 发 .html 时响应头写 charset=utf-8、会盖过 <meta>，
    所以统一转成 UTF-8 并改掉 <meta> 里的 charset：字节变了，显示的字一个不变"""
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:2000])
    enc = m.group(1).decode() if m else "utf-8"
    if enc.lower().replace("_", "-") not in ("utf-8", "utf8"):
        raw = raw.decode(enc).encode("utf-8")
        raw = raw[:m.start(1)] + b"utf-8" + raw[m.end(1):]
    note = notice_html(fm, contact)
    head = b'<meta name="robots" content="noindex">'
    top = (note + "<hr>\n").encode()
    bottom = ("\n<hr>" + note + "\n").encode()
    m_head, m_body, m_end = re.search(rb"<head[^>]*>", raw, re.I), re.search(rb"<body[^>]*>", raw, re.I), raw.lower().rfind(b"</body>")
    if not (m_head and m_body and m_end > m_body.end()):
        raise ValueError("保存的网页缺少 <head>、<body> 或 </body>")
    return raw[:m_head.end()] + head + raw[m_head.end():m_body.end()] + top + raw[m_body.end():m_end] + bottom + raw[m_end:]


def print_css(fm):
    """只用于打印 PDF 的那份临时副本：纸张和每页底部的「非官方」标记。下载的 HTML 里没有这段"""
    ver = html.escape(str(fm["version"]))
    return f'<style>@page {{ size: 816px 1056px; margin: 48px 56px 64px; @bottom-center {{ content: "非官方译文 · {ver} · 以原文为准"; font: 10px sans-serif; color: #888; }} }}</style>'


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
    doc = asis_html(open(os.path.join(a.bundle, "source.html.raw"), "rb").read(), fm, contact)
    open(h, "wb").write(doc)
    tmp = os.path.join(out, name + ".print.html")
    hd = re.search(rb"<head[^>]*>", doc, re.I).end()
    open(tmp, "wb").write(doc[:hd] + print_css(fm).encode() + doc[hd:])
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
