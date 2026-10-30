// 界面上的短标签不从中间断行（docs/testing.md「短标签断行」）：
// 版本号和「最新」、文件大小、「HTML ↗」「PDF ↓」、页码「第 345 页」、日期这类几个字的标签，在表格或窄栏里被挤窄时
// 曾拆成两行（S-1 版本表的「HTML ↗ / 18.3 MB」「v1.1 / 最新」「2026- / 10-26」，目录的「第 345 / 页」）。
// 扫全站页面（每个译本版本只取版本页和第一章），手机到宽屏 6 种宽度，Chromium 和 WebKit 都跑。
// 只查界面，不查正文：正文和列表里的摘要（.post-content、.entry-content、重排译文、原版版式）里的长句在行尾折行是正常排版，原版页面保持原样。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium, webkit } from "playwright";
import { build, serve } from "./helpers.mjs";

const WIDTHS = [320, 390, 768, 1024, 1280, 1920];
const ENGINES = ["chromium", "webkit"];
const S1 = "/translations/anthropic-s1/";

let site, server, pages;
const browsers = {};
before(async () => {
  site = build();
  server = await serve(site.out);
  pages = sitePages(site.out);
  console.log(`扫描 ${pages.length} 个页面`);
  browsers.chromium = await chromium.launch();
  // CI 里必须有 WebKit；本地没装时只跳过 WebKit 的用例
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

// 站点里每个带 PaperMod 页头的页面（不含跳转页和原样提供的下载文件）；译本的章节页结构相同，每个版本只取第一章
function sitePages(dir) {
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "index.html") {
        const h = readFileSync(p, "utf8");
        if (/class="?header["\s>]/.test(h) && !/http-equiv="?refresh/.test(h)) out.push("/" + relative(dir, d).split("\\").join("/") + (d === dir ? "" : "/"));
      }
    }
  })(dir);
  const firstChapter = new Map();
  return out.map((p) => p.replace(/^\/\/$/, "/")).sort().filter((p) => {
    const m = p.match(/^(.*\/v[\d.]+\/)[^/]+\/$/);
    if (!m) return true;
    if (!firstChapter.has(m[1])) firstChapter.set(m[1], p);
    return firstChapter.get(m[1]) === p;
  });
}

// 在页面里找被拆开的短标签，返回 ["文字 @ 位置"]。两类：
// 1. 短标签元素：文字 ≤ 16 字、里面没有块级元素和 <br>、所在的块也只有这几个字（不是正文里的一个链接），却占了不止一行；
// 2. 不可拆的片段：文件大小、版本号、页码、「HTML ↗」「PDF ↓」、日期，片段本身跨了行。
// 同一行里字号不同（<small>、<sup>）的片段顶边不同，按上下是否交叠判断换没换行。
const findBroken = () => {
  const SKIP = "svg,script,style,pre,math,.katex,.post-content,.entry-content,.s1-reflow,.s1-original,.s1-sheets,.bl-reader,.toc,.paginav,h1,h2,h3,h4,h5,h6";
  const inline = (el) => /^inline|^contents$/.test(getComputedStyle(el).display);
  const len = (s) => [...s.replace(/\s+/g, " ").trim()].length;
  const lineCount = (rects) => {
    const bands = [];
    for (const c of rects) if (c.width >= 1 && c.height >= 1 && !bands.some(([t, b]) => c.top < b - 1 && c.bottom > t + 1)) bands.push([c.top, c.bottom]);
    return bands.length;
  };
  const textRects = (el) => {
    const rects = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) if (n.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(n); rects.push(...r.getClientRects()); }
    return rects;
  };
  const where = (el) => { const a = []; for (let e = el; e && e !== document.body && a.length < 3; e = e.parentElement) a.unshift(e.tagName.toLowerCase() + (e.classList.length ? "." + [...e.classList].join(".") : "")); return a.join(">"); };
  const out = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(SKIP) || !el.checkVisibility()) continue;
    const n = len(el.textContent);
    if (n < 1 || n > 16 || el.querySelector("br")) continue;
    if ([...el.querySelectorAll("*")].some((d) => !inline(d) && d.getClientRects().length)) continue;
    let b = el; while (b && inline(b)) b = b.parentElement;
    if (inline(el) && len(b.textContent) > 16) continue;
    if (lineCount(textRects(el)) > 1) out.add(`${el.textContent.replace(/\s+/g, " ").trim()} @ ${where(el)}`);
  }
  const TOKEN = /\d[\d.,]*\s?(?:[KMG]B|kB)\b|v\d+(?:\.\d+)+|(?:HTML|PDF)\s?[↗↓]|第\s?\d+(?:[–-]\d+)?\s?页|\d+\s?页|\d{4}-\d{2}-\d{2}|\d{4}年\d{1,2}月\d{1,2}日/g;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = tw.nextNode());) {
    const p = t.parentElement;
    if (!p || p.closest(SKIP) || !p.checkVisibility()) continue;
    for (const m of t.textContent.matchAll(TOKEN)) {
      const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length);
      if (lineCount([...r.getClientRects()]) > 1) out.add(`${m[0]} @ ${where(p)}`);
    }
  }
  return [...out];
};

async function open(t, engine, width) {
  if (!browsers[engine]) { t.skip("本地没有安装 WebKit（npx playwright install webkit）"); return null; }
  const ctx = await browsers[engine].newContext({ viewport: { width, height: 900 } });
  // 只用本地文件；正式域名和外部 CDN 一律不访问
  await ctx.route((u) => !u.href.startsWith(server.url), (r) => r.abort());
  const page = await ctx.newPage();
  const go = async (p) => { await page.goto(server.url + p, { waitUntil: "load" }); await page.evaluate(() => document.fonts.ready); };
  return { page, go, close: () => ctx.close() };
}

test("扫描的页面包括 S-1 译本首页、每个版本页和章节页、双语译文、短文和文章", () => {
  for (const p of ["/", "/notes/", "/en/", S1, "/en" + S1, "/translations/bitter-lesson/", "/tags/", "/archives/"]) assert.ok(pages.includes(p), p);
  const versions = readdirSync(join(site.out, S1.slice(1))).filter((d) => /^v\d/.test(d) && existsSync(join(site.out, S1.slice(1), d, "index.html")));
  assert.ok(versions.length >= 2);
  for (const v of versions) {
    assert.ok(pages.includes(`${S1}${v}/`), v);
    assert.ok(pages.some((p) => p.startsWith(`${S1}${v}/`) && p !== `${S1}${v}/`), `${v} 的章节页`);
  }
});

for (const engine of ENGINES) {
  for (const width of WIDTHS) {
    test(`${engine} ${width}px：全站界面上的短标签不从中间断行`, async (t) => {
      const s = await open(t, engine, width);
      if (!s) return;
      const found = [];
      for (const p of pages) {
        await s.go(p);
        for (const f of await s.page.evaluate(findBroken)) found.push(`${p}  ${f}`);
      }
      await s.close();
      assert.deepEqual(found, []);
    });
  }

  test(`${engine}：S-1 版本表的说明再长、字体再宽（Mac 上字略宽），版本号、日期、下载链接也不断行`, async (t) => {
    for (const width of [768, 1024, 1280]) {
      const s = await open(t, engine, width);
      if (!s) return;
      await s.go(S1);
      await s.page.evaluate(() => {
        document.querySelectorAll(".s1-versions tbody td:nth-child(4)").forEach((td) => { td.textContent = (td.textContent || "很长的说明").repeat(6); });
        document.body.style.letterSpacing = "0.03em";
      });
      assert.deepEqual(await s.page.evaluate(findBroken), [], `@${width}`);
      await s.close();
    }
  });

  test(`${engine}：检查本身能发现断行（去掉不换行的样式后，版本表和目录的标签被找出来）`, async (t) => {
    const s = await open(t, engine, 768);
    if (!s) return;
    await s.go(S1);
    await s.page.evaluate(() => {
      document.querySelectorAll(".s1-versions tbody td:nth-child(4)").forEach((td) => { td.textContent = (td.textContent || "很长的说明").repeat(6); });
      const st = document.createElement("style");
      st.textContent = "* { white-space: normal !important; } .s1-toc { width: 150px; }";
      document.head.append(st);
    });
    const found = (await s.page.evaluate(findBroken)).join("\n");
    await s.close();
    assert.match(found, /最新 @ /);
    assert.match(found, /HTML ↗|MB @ /);
    assert.match(found, /页 @ .*s1-toc/);
  });
}
