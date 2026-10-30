// 网页性能（docs/performance.md）：用正式构建打开全站每个页面（手机 390 宽、电脑 1280 宽，Chromium），只查确定的量，不量会抖的耗时：
//   - 首屏加载（到 load 事件为止）下载的字节数（文本按 gzip 计，和 Cloudflare 实际传输接近）和请求数，按类型分预算
//   - 没有请求第三方网站（允许的只有公式/图表的 CDN 和正式站的访问统计），没有 404 的资源
//   - <head> 里阻塞渲染的只有站点样式表（以及有公式的页面的 KaTeX 样式表），外部脚本都不阻塞
//   - 加载过程中的累计布局偏移（CLS）不超过 Web Vitals 的「良好」线 0.1
// 预算都在下面的 BUDGET 里，超出时报出页面、项目、实际值和预算。内容变多（比如译文章节更长）确实需要更多字节时，改这里的一行即可。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { root } from "./helpers.mjs";

const KB = 1024;
// 2026-10-30 的实测最大值写在每项后面；预算约留一倍余量，只拦住明显的退步（多引入一个库、原图没压缩、样式表翻倍）。
// html、total 按路径前缀取第一个匹配的值（顺序有关），"" 是其余所有页面
export const BUDGET = {
  requests: 15, //                                     实测最多 7（S-1 章节页，电脑）
  css: 20 * KB, // 所有样式表合计（gzip）               实测 9 KB（PaperMod 样式表加本站样式；S-1 另加 s1.css 也在内）
  js: 20 * KB, //  外部脚本合计（gzip，内联的算在 HTML 里）实测最多 3 KB（S-1 的 s1.js）
  image: 300 * KB, // 单张图片                          实测最大 55 KB（短文配图，电脑）
  html: [["translations/", 600 * KB], ["en/translations/", 600 * KB], ["", 60 * KB]], // S-1「风险因素」章 404 KB；其余最多 15 KB
  total: [["translations/", 900 * KB], ["en/translations/", 900 * KB], ["", 400 * KB]], // S-1 章节最多 434 KB；其余最多 111 KB（短文栏目第 2 页，电脑）
  cls: 0.1, // Web Vitals「良好」线；实测最多 0.035（S-1 短章节在电脑上插入原版版式时页脚翻页条下移，时有时无）
};
// 加载时允许请求的第三方网站：有公式的页面用 KaTeX、有图表的页面用 Mermaid（extend_head.html），正式站有 Cloudflare 访问统计（extend_footer.html）
export const THIRD_PARTY = ["cdn.jsdelivr.net", "static.cloudflareinsights.com"];
const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

const BASE = readFileSync(join(root, "hugo.yaml"), "utf8").match(/^baseURL: (\S+)$/m)[1];
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2" };
export const kind = (type) => (type.startsWith("image/") ? "image" : type === "text/css" ? "css" : type === "text/javascript" ? "js" : type === "text/html" ? "html" : "other");
export const budgetFor = (list, page) => list.find(([prefix]) => page.startsWith(prefix))[1];
const fmt = (b) => `${(b / KB).toFixed(1)} KB`;

let out;
const results = []; // { page, vp, requests: [{ path, type, bytes, status }], hosts: [], cls }
before(async () => {
  out = mkdtempSync(join(tmpdir(), "leo-blog-perf-"));
  const env = { ...process.env };
  delete env.CF_PAGES_URL; // 正式构建（不带测试短文、链接指向正式域名）
  const r = spawnSync("bash", ["build.sh", "-d", out], { cwd: root, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`build failed\n${r.stdout}\n${r.stderr}`);

  // 不起服务器：正式域名的请求直接用构建结果回应，记下字节数；第三方请求只记下网站后中止，不依赖网络
  const browser = await chromium.launch();
  const local = new URL(BASE).host;
  async function measure(page, vp) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[vp] });
    const tab = await ctx.newPage();
    const requests = [], hosts = new Set();
    await tab.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.host !== local) { hosts.add(u.host); return route.abort(); }
      let f = join(out, decodeURIComponent(u.pathname));
      if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
      if (!existsSync(f)) { requests.push({ path: u.pathname, type: "", bytes: 0, status: 404 }); return route.fulfill({ status: 404, body: "" }); }
      const body = readFileSync(f), type = TYPES[extname(f)] || "application/octet-stream";
      const bytes = /^text\/|json|svg/.test(type) ? gzipSync(body).length : body.length;
      requests.push({ path: u.pathname, type, bytes, status: 200 });
      return route.fulfill({ status: 200, contentType: type, body });
    });
    await tab.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await tab.goto(BASE + page.replace(/index\.html$/, ""), { waitUntil: "load" });
    // load 之后的下一帧：页面脚本在 load 时做的排版变化（如 S-1 插入原版版式）也算进来
    const cls = await tab.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(window.__cls)))));
    await ctx.close();
    results.push({ page, vp, requests, hosts: [...hosts], cls });
    results.sort((a, b) => a.page.localeCompare(b.page) || a.vp.localeCompare(b.vp));
  }
  const jobs = pages().flatMap((p) => Object.keys(VIEWPORTS).map((vp) => [p, vp]));
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await measure(...queue.shift()); }));
  await browser.close();
});
after(() => out && rmSync(out, { recursive: true, force: true }));

// 构建出的每个 HTML 页面（跳过 alias 跳转页、下载文件、单文件完整 HTML）
function pages() {
  return readdirSync(out, { recursive: true }).map(String)
    .filter((f) => f.endsWith(".html") && !f.includes("/files/") && !f.endsWith("full.html"))
    .filter((f) => !/http-equiv="?refresh/.test(readFileSync(join(out, f), "utf8").slice(0, 600)))
    .sort();
}

const sum = (rs, k) => rs.filter((r) => kind(r.type) === k).reduce((s, r) => s + r.bytes, 0);
const where = (r) => `${r.page}（${r.vp === "phone" ? "手机" : "电脑"}）`;
function report(rows) { return rows.length ? `\n  ${rows.slice(0, 30).join("\n  ")}${rows.length > 30 ? `\n  …共 ${rows.length} 处` : ""}\n` : ""; }

test("测量范围：全站页面都打开过（中英文首页、文章、短文、栏目、S-1 每个章节、双语译文），每个页面手机和电脑各一次", () => {
  const ps = new Set(results.map((r) => r.page));
  for (const p of ["index.html", "en/index.html", "notes/index.html", "posts/hello-world/index.html", "translations/anthropic-s1/index.html", "translations/bitter-lesson/index.html"])
    assert.ok(ps.has(p), `没有测到 ${p}`);
  assert.ok([...ps].filter((p) => /^translations\/anthropic-s1\/v[^/]+\/[^/]+\/index\.html$/.test(p)).length >= 32, "S-1 章节页没测全");
  assert.equal(results.length, ps.size * Object.keys(VIEWPORTS).length);
  assert.ok(results.every((r) => r.requests[0]?.type === "text/html" && r.requests[0].status === 200), "有页面没有正常打开");
});

test("首屏下载的字节数和请求数在预算内（HTML、样式、脚本、单张图片、合计）", () => {
  const bad = [];
  for (const r of results) {
    const checks = [["请求数", r.requests.length, BUDGET.requests, String],
      ["HTML", sum(r.requests, "html"), budgetFor(BUDGET.html, r.page), fmt],
      ["样式表", sum(r.requests, "css"), BUDGET.css, fmt],
      ["脚本", sum(r.requests, "js"), BUDGET.js, fmt],
      ["合计", r.requests.reduce((s, x) => s + x.bytes, 0), budgetFor(BUDGET.total, r.page), fmt]];
    for (const x of r.requests.filter((x) => kind(x.type) === "image")) checks.push([`图片 ${x.path}`, x.bytes, BUDGET.image, fmt]);
    for (const [what, v, max, f] of checks) if (v > max) bad.push(`${where(r)} ${what} ${f(v)}，预算 ${f(max)}`);
  }
  const maxOf = (fn) => results.reduce((m, r) => { const v = fn(r); return v > m.v ? { v, r } : m; }, { v: -1 });
  const img = maxOf((r) => Math.max(0, ...r.requests.filter((x) => kind(x.type) === "image").map((x) => x.bytes)));
  const tot = maxOf((r) => r.requests.reduce((s, x) => s + x.bytes, 0));
  console.log(`实测最大：合计 ${fmt(tot.v)}（${where(tot.r)}），单张图片 ${fmt(img.v)}（${where(img.r)}），请求数 ${maxOf((r) => r.requests.length).v}`);
  assert.ok(!bad.length, `超出预算（预算在 tests/perf.test.mjs 的 BUDGET 里）：${report(bad)}`);
});

test("加载时不请求预算外的第三方网站，没有 404 的资源", () => {
  const bad = [];
  for (const r of results) {
    for (const h of r.hosts) if (!THIRD_PARTY.includes(h)) bad.push(`${where(r)} 请求了第三方网站 ${h}`);
    for (const x of r.requests) if (x.status === 404) bad.push(`${where(r)} ${x.path} 不存在（404）`);
  }
  assert.ok(!bad.length, report(bad));
});

test("加载过程中的累计布局偏移（CLS）不超过 0.1", () => {
  const bad = results.filter((r) => r.cls > BUDGET.cls).map((r) => `${where(r)} CLS ${r.cls.toFixed(3)}`);
  assert.ok(!bad.length, report(bad));
});

// 阻塞渲染的资源决定首屏多快出来：浏览器要等 <head> 里的样式表和同步外部脚本下载完才开始画
export function blocking(html) {
  const head = html.split("</head>")[0];
  const css = [...head.matchAll(/<link\b[^>]*\brel=(?:"[^"]*\bstylesheet\b[^"]*"|stylesheet)[^>]*>/g)].map((m) => m[0])
    .filter((t) => !/\bmedia=(?:"?print"?)/.test(t)).map((t) => t.match(/\bhref=(?:"([^"]+)"|([^\s>]+))/)?.slice(1).find(Boolean));
  const js = [...head.matchAll(/<script\b[^>]*\bsrc=[^>]*>/g)].map((m) => m[0])
    .filter((t) => !/\b(async|defer)\b|\btype=(?:"module"|module)/.test(t)).map((t) => t.match(/\bsrc=(?:"([^"]+)"|([^\s>]+))/)?.slice(1).find(Boolean));
  return { css, js };
}
const ALLOWED_CSS = [/^\/assets\/css\/stylesheet\.[0-9a-f]+\.css$/, /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex@[\d.]+\/dist\/katex\.min\.css$/];

test("<head> 里阻塞渲染的只有站点样式表（有公式的页面加 KaTeX 样式表），没有同步加载的外部脚本", () => {
  const bad = [];
  for (const p of pages()) {
    const { css, js } = blocking(readFileSync(join(out, p), "utf8"));
    for (const c of css) if (!ALLOWED_CSS.some((re) => re.test(c))) bad.push(`${p} 阻塞渲染的样式表 ${c}`);
    if (css.filter((c) => ALLOWED_CSS[0].test(c)).length !== 1) bad.push(`${p} 站点样式表不是正好一个：${css.join(" ")}`);
    for (const s of js) bad.push(`${p} 同步加载的外部脚本 ${s}`);
  }
  assert.ok(!bad.length, report(bad));
});

test("检查本身有效：阻塞资源的识别、按路径取预算", () => {
  const h = `<head><link rel="preload stylesheet" href=/assets/css/stylesheet.ab12.css as=style><link rel=stylesheet href="/x.css">
    <link rel=stylesheet media=print href=/p.css><script src=/a.js></script><script defer src=/b.js></script><script type=module src=/c.mjs></script></head>
    <body><script src=/late.js></script>`;
  assert.deepEqual(blocking(h), { css: ["/assets/css/stylesheet.ab12.css", "/x.css"], js: ["/a.js"] });
  assert.equal(budgetFor(BUDGET.html, "translations/anthropic-s1/v1.1/risk-factors/index.html"), 600 * KB);
  assert.equal(budgetFor(BUDGET.html, "posts/hello-world/index.html"), 60 * KB);
  assert.deepEqual(["text/css", "text/javascript", "image/webp", "text/html", "application/json"].map(kind), ["css", "js", "image", "html", "other"]);
});
