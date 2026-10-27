#!/usr/bin/env python3
"""预览专用：把 x-posts.json 里的推文生成四套站点内容，用来对比四种同步方案的整站效果。

用法：python3 x-preview/gen.py <输出目录>
输出 <输出目录>/v1 ~ v4/{notes,posts}/x-<id>/index.md，图片复制进各自的文件夹。
  v1 官方嵌入：每条推文（含转发、引用）一篇，正文是 X 官方嵌入代码
  v2 全部卡片：同 v1 的范围，正文是自建推文卡片（融合方案 F）
  v3 评审推荐：原创和线程直接写成短文；评论满 20 字的引用转发 = 评论 + 被引用原推框；纯转发、短评引用不同步
  v4 推荐 + 转发：v3 再加上纯转发和短评引用，显示为“转发了 @xx” + 原推框
回复他人的推文在四套里都不同步；rec=post 的长推文进长文栏目。
"""
import json
import re
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SRC = Path(__file__).resolve().parent / "src"
CST = timezone(timedelta(hours=8))
ME = {"name": "HMI", "handle": "Name11216161228"}
LANGS = {"zh", "en", "ja", "ko", "fr", "pl", "no", "tl"}
URL_RE = re.compile(r"https?://[^\s　-〿＀-￯“”‘’]+")
MD_SPECIAL = re.compile(r"([\\`*_<>#|~$!{}])")


def esc(s):
    """转义 Markdown 字符；方括号写成实体，因为 \\[ \\] 在本站是公式定界符。"""
    return MD_SPECIAL.sub(r"\\\1", s).replace("[", "&#91;").replace("]", "&#93;")


def when(tid):
    """推文 id 里带着发推时间（毫秒），换成北京时间。"""
    ms = (int(tid) >> 22) + 1288834974657
    return datetime.fromtimestamp(ms / 1000, CST)


def handle_of(url):
    m = re.match(r"https://x\.com/([^/]+)/status/(\d+)", url or "")
    return (m.group(1), m.group(2)) if m else (None, None)


def clean(text):
    """去掉文末指向图片/视频的 t.co 链接（X 页面上也不显示它们）。"""
    return re.sub(r"\s*https://t\.co/\w+\s*$", "", text or "").strip()


def md(text):
    """推文纯文本 → Markdown：转义特殊字符，链接写成 [显示](地址)，单个换行保留为硬换行。"""
    out = []
    for para in re.split(r"\n\s*\n", text.strip()):
        lines = []
        for line in para.split("\n"):
            parts, pos = [], 0
            for m in URL_RE.finditer(line):
                parts.append(esc(line[pos:m.start()]))
                url = m.group(0)
                show = re.sub(r"^https?://", "", url)
                show = show if len(show) <= 40 else show[:38] + "…"
                parts.append("[" + esc(show) + f"]({url})")
                pos = m.end()
            parts.append(esc(line[pos:]))
            s = "".join(parts)
            s = re.sub(r"^(\s*)([-+=])", r"\1\\\2", s)
            s = re.sub(r"^(\s*\d+)([.)])", r"\1\\\2", s)
            lines.append(s)
        out.append("\\\n".join(lines))
    return "\n\n".join(out)


def title_of(text, n=28):
    t = URL_RE.sub("", text).strip()
    t = re.sub(r"\s+", " ", t.split("\n")[0]).strip() or "（无文字）"
    return t if len(t) <= n else t[:n].rstrip() + "…"


def lang_of(t):
    return t["lang"] if t["lang"] in LANGS else ""


def main(outdir):
    posts = json.load(open(SRC / "x-posts.json"))
    by_id = {t["id"]: t for t in posts}
    outdir = Path(outdir)
    shutil.rmtree(outdir, ignore_errors=True)

    counts = {}
    recs = []
    for t in posts:
        if t["kind"] not in ("original", "quote", "retweet"):
            continue
        tid = t["id"]
        date = when(tid)
        parts = [t] + [by_id[i] for i in t.get("thread") or [] if i in by_id]
        ok = lambda m: m.get("local") and m["local"].endswith((".jpg", ".png", ".webp")) and (SRC / "media" / m["local"]).exists()
        media = [m["local"] for p in parts for m in p["media"] if ok(m)]
        # 视频、GIF 和只在 pbs.twimg.com 上的图片：页面上提示“在 X 上查看”
        missing = sum(1 for p in parts for m in p["media"] if not ok(m))

        x = {"id": tid, "url": t["url"], "kind": t["kind"], "lang": lang_of(t),
             "author": ME, "media": media, "missing": missing,
             "parts": [{"url": p["url"], "text": clean(p["text"]), "date": when(p["id"]).isoformat()} for p in parts]}
        other = t.get("rt_of") or t.get("quote")
        if other and not other.get("url"):
            other = None
        if not other and t["kind"] == "retweet":
            # 少数转发没有原推信息，只能从 "RT @xx: 正文" 里拆出作者和（可能被截断的）正文，链接用自己的转发
            m = re.match(r"RT @(\w+):\s*(.*)", t["text"], re.S)
            other = {"url": t["url"], "author": m.group(1), "text": m.group(2)}
        if other:
            h, oid = handle_of(other["url"])
            if h == ME["handle"] and other.get("author"):
                h, oid = other["author"], tid
            x["other"] = {"url": other["url"], "handle": h or other.get("author"),
                          "text": clean(other.get("text", "")), "date": when(oid).isoformat() if oid else ""}
        if other and t["kind"] == "quote":
            # 存档里的引用推文把被引用推文的地址写在正文末尾，页面上已经有原推框，去掉
            for p in x["parts"][:1]:
                p["text"] = p["text"].replace(other["url"], "").strip()
        own = x["parts"][0]["text"] if t["kind"] != "retweet" else ""
        short_quote = t["kind"] == "quote" and len(URL_RE.sub("", own).strip()) < 20

        if t["kind"] == "retweet":
            title = f"转发 @{x['other']['handle']}：{title_of(x['other']['text'], 20)}"
        else:
            title = title_of(own)
        section = "posts" if t["rec"] == "post" else "notes"
        recs.append({"x": x, "date": date, "title": title, "section": section, "short_quote": short_quote,
                     "chars": len(URL_RE.sub("", " ".join(p["text"] for p in x["parts"])).strip())})

        for v in ("v1", "v2", "v3", "v4"):
            if v == "v3" and (t["kind"] == "retweet" or short_quote):
                continue
            if v in ("v1", "v2"):
                body = "{{< x-embed >}}" if v == "v1" else "{{< x-card >}}"
            elif t["kind"] == "retweet":
                body = "{{< x-quoted rt=\"true\" >}}\n\n{{< x-src >}}"
            else:
                chunks = [md(p["text"]) for p in x["parts"] if p["text"]]
                body = "\n\n".join(chunks)
                if media:
                    body += "\n\n" + "\n".join(f"![]({f})" for f in media)
                if missing:
                    body += "\n\n{{< x-missing >}}"
                if other:
                    body += "\n\n{{< x-quoted >}}"
                body += "\n\n{{< x-src >}}"
            fm = {"title": title, "slug": f"x-{tid}", "date": date.isoformat(), "tags": ["来自X"], "x": x}
            if section == "posts":
                fm["ShowToc"] = False
            d = outdir / v / section / f"x-{tid}"
            d.mkdir(parents=True, exist_ok=True)
            front = "\n".join(f"{k}: {json.dumps(val, ensure_ascii=False)}" for k, val in fm.items())
            (d / "index.md").write_text(f"---\n{front}\n---\n\n{body}\n")
            for f in media:
                shutil.copy(SRC / "media" / f, d / f)
            counts[(v, section)] = counts.get((v, section), 0) + 1
    counts.update(more(recs, outdir))
    for k in sorted(counts):
        print(*k, counts[k])


def write_bundle(d, fm, body, media):
    d.mkdir(parents=True, exist_ok=True)
    front = "\n".join(f"{k}: {json.dumps(val, ensure_ascii=False)}" for k, val in fm.items())
    (d / "index.md").write_text(f"---\n{front}\n---\n\n{body}\n")
    for f in media:
        shutil.copy(SRC / "media" / f, d / f)


def own_body(x, sid=""):
    """自己的推文写成 Markdown 正文：文字、图片、缺失媒体提示、被引用原推框。"""
    arg = f' id="{x["id"]}"' if sid else ""
    body = "\n\n".join(md(p["text"]) for p in x["parts"] if p["text"])
    if x["media"]:
        body += "\n\n" + "\n".join(f"![]({f})" for f in x["media"])
    if x["missing"]:
        body += f"\n\n{{{{< x-missing{arg} >}}}}"
    if x.get("other"):
        body += f"\n\n{{{{< x-quoted{arg} >}}}}"
    return body.strip()


def more(recs, outdir):
    """第二轮方案（博客的文章流不变，推文另放）。第 1 轮评审后：长推文不再进长文，/x/ 按月分页，转发收进每月末尾。
      v5 推文单独成栏：菜单多“推文”，/x/ 每月一页
      v6 按月合集：每月一篇“X 月记”短文，最新的在前，转发列在末尾；没有 /x/
      v7 精选进短文：150 字以上的原创进短文，全部推文在 /x/
      v8 单独成栏 + 首页一行：v5 再在首页简介下面加一行“最近在 X”
      v9 摘录：v5 再加每月一篇“X 摘录”短文，只放 3～5 条（正式版由博主挑选并加一句评注，预览里按长度代挑）
    """
    counts = {}
    recs = sorted(recs, key=lambda r: r["date"], reverse=True)
    months = {}
    for r in recs:
        months.setdefault(r["date"].strftime("%Y-%m"), []).append(r)
    promoted = {r["x"]["id"] for r in recs if r["x"]["kind"] != "retweet" and r["chars"] >= 150}
    for v in ("v5", "v6", "v7", "v8", "v9"):
        if v != "v6":
            tl = []
            for r in recs:
                e = dict(r["x"], date=r["date"].isoformat(), chars=r["chars"])
                if v == "v7" and e["id"] in promoted:
                    e["blog"] = f"notes/x-{e['id']}/"
                tl.append(e)
            (outdir / v / "data").mkdir(parents=True, exist_ok=True)
            (outdir / v / "data" / "xtl.json").write_text(json.dumps(tl, ensure_ascii=False))
            (outdir / v / "x").mkdir(parents=True, exist_ok=True)
            (outdir / v / "x" / "_index.md").write_text(
                "---\ntitle: 推文\ndescription: 我在 X（[@Name11216161228](https://x.com/Name11216161228)）上的碎碎念，最新的在前。\n---\n")
            for ym in months:
                y, m = ym.split("-")
                (outdir / v / "x" / f"{ym}.md").write_text(f'---\ntitle: "推文 · {y}年{int(m)}月"\nmonth: "{ym}"\nslug: "{ym}"\nsitemap: {{disable: true}}\n---\n')
            counts[(v, "timeline")] = len(tl)
        if v == "v7":
            for r in recs:
                x = r["x"]
                if x["id"] in promoted:
                    fm = {"title": r["title"], "slug": f"x-{x['id']}", "date": r["date"].isoformat(), "tags": ["来自X"], "x": x}
                    write_bundle(outdir / v / "notes" / f"x-{x['id']}", fm, own_body(x) + "\n\n{{< x-src >}}", x["media"])
                    counts[(v, "notes")] = counts.get((v, "notes"), 0) + 1
        if v in ("v6", "v9"):
            for ym, rs in months.items():
                y, m = ym.split("-")
                own = [r for r in rs if r["x"]["kind"] != "retweet"]
                rts = [r for r in rs if r["x"]["kind"] == "retweet"]
                if v == "v9":
                    pick = sorted([r for r in own if r["chars"] >= 40], key=lambda r: -r["chars"])[:5]
                    if not pick:
                        continue
                    own, rts = sorted(pick, key=lambda r: r["date"], reverse=True), []
                chunks = [f'{{{{< x-day id="{r["x"]["id"]}" >}}}}\n\n' + own_body(r["x"], sid=True) for r in own]
                body = "\n\n".join(chunks)
                if rts:
                    body += "\n\n{{< x-rts >}}"
                if v == "v9":
                    body += f'\n\n{{{{< x-more month="{ym}" n="{len(rs)}" >}}}}'
                media = [f for r in own for f in r["x"]["media"]]
                if v == "v6":
                    title, desc = f"X 月记 · {y}.{int(m)}", f"这个月在 X 上发了 {len(own)} 条，转发 {len(rts)} 条。"
                else:
                    title, desc = f"X 摘录 · {y}.{int(m)}", f"从这个月的 {len(rs)} 条推文里挑了 {len(own)} 条。"
                fm = {"title": title, "slug": f"x-{ym}", "date": rs[0]["date"].isoformat(), "tags": ["来自X"],
                      "description": desc, "xs": {r["x"]["id"]: r["x"] for r in own + rts}, "xrts": [r["x"]["id"] for r in rts]}
                write_bundle(outdir / v / "notes" / f"x-{ym}", fm, body, media)
                counts[(v, "notes")] = counts.get((v, "notes"), 0) + 1
    return counts

if __name__ == "__main__":
    main(sys.argv[1])
