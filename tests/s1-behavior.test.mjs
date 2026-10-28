// S-1 译本的用户行为（layouts/s1/、layouts/_partials/s1/、assets/js/s1.js、assets/css/extended/s1.css）：
// 每个测试对应行为清单里的一条或几条「做什么 → 应该看到什么」，优先用真实译本 /translations/anthropic-s1/，
// 只有真实译本没有的情形（历史版本、版本菜单）用测试样例 /s1-test/（tests/fixtures/s1-preview）。
//   - 栏目与导航：菜单「译文/Translations」、栏目页、英文说明页、页头语言切换在译本页上的去向
//   - 译本首页、版本页、章节页：声明、版本条、版本菜单、版本表、下载、目录、上一章/下一章、页码编号
//   - 重排/原版：首次默认（宽屏原版、窄屏重排）、宽屏窄屏分别记住、切换时停在同一原文页、缩放适应与窗口变化、跨章链接
//   - 沉浸阅读 ?read=1：进入/退出（按钮、Esc、浏览器后退）、页码与跳页、[ ] 翻章、目录面板、版式切换、缩放与记忆
// 关键交互在 Chromium 和 WebKit（Safari 的引擎）上都跑；等待一律用 waitFor/waitForFunction 轮询，不用固定延时
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, webkit, devices } from "playwright";
import { build, serve, root } from "./helpers.mjs";

const BASE = "https://douseful.eu.org";
const R = "/translations/anthropic-s1/";
const LATEST = readFileSync(join(root, "content/translations/anthropic-s1/_index.md"), "utf8").match(/^latest: (\S+)$/m)[1]; // 译本首页 front matter 指定的最新版本
const VERSIONS = readdirSync(join(root, "content/translations/anthropic-s1")).filter((d) => /^v\d/.test(d));
const V = R + LATEST + "/";
const FIX = "/s1-test/";
const DESKTOP = { viewport: { width: 1280, height: 800 } };
const PHONE = { chromium: devices["Pixel 7"], webkit: devices["iPhone 13"] };
const ENGINES = ["chromium", "webkit"];
// 版本 front matter 里的章节表（含页码）是目录、翻章、跳页的依据
const vfm = readFileSync(join(root, "content/translations/anthropic-s1", LATEST, "_index.md"), "utf8");
const chapters = JSON.parse(vfm.match(/^chapters: (.+)$/m)[1]).filter((c) => c.included);
// 已发布（release.py 冻结）的版本有 downloads：完整 HTML 和 PDF 在 files/ 下；还没发布时只有模板生成的 full.html、没有 PDF。两种状态都要能测
const downloads = JSON.parse(vfm.match(/^downloads: (.+)$/m)?.[1] ?? "null");
const HTML_URL = downloads ? V + downloads.html.file.replace(/\.raw$/, "") : V + "full.html";
const PDF_URL = downloads ? V + downloads.pdf.file : null;
const TOTAL = chapters.at(-1).pages[1];

let site, server;
const browsers = {};
before(async () => {
  site = build();
  server = await serve(site.out);
  browsers.chromium = await chromium.launch();
  // CI 里必须有 WebKit；本地没装时只跳过 WebKit 的用例
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

const read = (p) => readFileSync(join(site.out, p.endsWith("/") ? p + "index.html" : p), "utf8");

// 开一个浏览器上下文：正式域名的绝对地址（菜单、语言切换）转到本地服务器；收集脚本错误，关闭时断言没有
async function open(t, engine, opts = DESKTOP) {
  if (!browsers[engine]) { t.skip("本地没有安装 WebKit（npx playwright install webkit）"); return null; }
  const ctx = await browsers[engine].newContext(opts);
  await ctx.route(BASE + "/**", async (r) => r.fulfill({ response: await ctx.request.fetch(r.request().url().replace(BASE, server.url)) }));
  const errors = [];
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e));
  // prompt（点页码跳页）的回答：测试里先设 page.answer，null 表示取消
  page.answer = null;
  page.dialogs = 0;
  page.on("dialog", (d) => { page.dialogs++; return page.answer === null ? d.dismiss() : d.accept(String(page.answer)); });
  // 主框架发起的跳转次数：断言「没有跳走」时用
  page.navs = 0;
  page.on("request", (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) page.navs++; });
  const go = (p) => page.goto(server.url + p, { waitUntil: "load" });
  return { ctx, page, go, errors, done: async () => { await ctx.close(); assert.deepEqual(errors.map((e) => e.message), [], "页面不应有脚本错误"); } };
}

const path = (page) => { const u = new URL(page.url()); return u.pathname + u.search + u.hash; };
const waitPath = (page, p) => page.waitForURL((u) => u.pathname + u.search + u.hash === p, { timeout: 10000 });
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 5000 });
const immersive = (page) => page.evaluate(() => document.body.classList.contains("s1-immersive"));
const shown = (page) => page.evaluate(() => (document.querySelector(".s1-original").hidden ? "reflow" : "original"));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

// 当前在读的原文页：页面顶部（顶栏/页头下沿）所在的那一页。原版看 .s1-sheet，重排版看「原文第 N 页」分隔（分隔线在第 N 页末尾）
const pageAt = (page) => page.evaluate(() => {
  const y = document.body.classList.contains("s1-immersive") ? 61 : 81; // s1.js 的 TOP（沉浸 60、普通 80）下面一像素
  const o = document.querySelector(".s1-original");
  if (!o.hidden) {
    let p = null;
    for (const s of o.querySelectorAll(".s1-sheet")) if (s.getBoundingClientRect().top <= y) p = +s.dataset.page;
    return p;
  }
  let p = +document.querySelector(".s1-chapter").dataset.firstPage;
  for (const m of document.querySelectorAll(".s1-reflow .s1-pg")) if (m.getBoundingClientRect().top <= y) p = +m.dataset.page + 1;
  return p;
});
// 滚到原文第 n 页（frac 是在这一页里的比例），等滚动停下
const scrollToPage = async (page, n, frac = 0.3) => {
  await page.evaluate(([n, frac]) => {
    const imm = document.body.classList.contains("s1-immersive"), top = imm ? 60 : 80;
    const o = document.querySelector(".s1-original");
    let el, next;
    if (!o.hidden) { el = o.querySelector(`.s1-sheet[data-page="${n}"]`); next = el.nextElementSibling; }
    else {
      const first = +document.querySelector(".s1-chapter").dataset.firstPage;
      el = n === first ? document.querySelector(".s1-reflow") : document.getElementById(`p-${n - 1}`);
      next = document.getElementById(`p-${n}`);
    }
    const t = el.getBoundingClientRect().top, h = (next ? next.getBoundingClientRect().top : el.getBoundingClientRect().bottom) - t;
    scrollTo({ top: scrollY + t + frac * h - top, behavior: "instant" });
  }, [n, frac]);
  await until(page, (n) => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(true)))), n);
};
// 不先把元素滚进视口的点击：版式按钮和「全屏阅读」在章首，Playwright 的 click 会先滚回章首，测不到「停在同一页」
const clickInPlace = (loc) => loc.evaluate((e) => e.click());
// 等两帧再看有没有发起跳转（location.href 赋值会立刻发出导航请求）
const settle = (page) => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 50)))));
const stays = async (page, fn, msg) => { const n = page.navs; await fn(); await settle(page); assert.equal(page.navs, n, msg); };
const barPage = (page) => page.locator(".s1-ibar-page");
const waitBar = (page, n) => until(page, (s) => document.querySelector(".s1-ibar-page").textContent === s, `${n} / ${TOTAL}`);

// ---------- 栏目、菜单、英文说明页、语言切换 ----------

for (const [lang, home, label, list, entry] of [["中文", "/", "译文", "/translations/", R], ["英文", "/en/", "Translations", "/en/translations/", "/en" + R]]) {
  test(`${lang}：点页头菜单「${label}」到译文栏目，栏目里点译本条目进入${lang === "中文" ? "译本首页" : "英文说明页"}`, async (t) => {
    const s = await open(t, "chromium");
    await s.go(home);
    await s.page.locator("#menu a", { hasText: label }).click();
    await waitPath(s.page, list);
    // 菜单当前项高亮
    assert.equal(await s.page.locator("#menu .active").textContent(), label);
    await s.page.locator(`.post-entry .entry-link[href$="${entry}"]`).click();
    await waitPath(s.page, entry);
    assert.equal(await s.page.locator("html").getAttribute("lang"), lang === "中文" ? "zh" : "en");
    await s.done();
  });
}

test("译本的所有页面（首页、版本页、32 个章节页）页头菜单里都有「译文」", () => {
  for (const p of [R, V, ...chapters.map((c) => V + c.slug + "/")]) {
    const menu = read(p).match(/<ul id="?menu"?[^>]*>([\s\S]*?)<\/ul>/)[1];
    assert.match(menu, new RegExp(`href="?${BASE}/translations/"?[^>]*><span>译文</span>`), p);
  }
});

test("英文说明页：中文译本链接到译本首页（可打开、语言是中文），SEC 原文和下架邮箱链接正确", async (t) => {
  const s = await open(t, "chromium");
  await s.go("/en" + R);
  const body = s.page.locator(".post-content");
  assert.equal(await body.locator("a[href^='https://www.sec.gov/']").getAttribute("href"), JSON.parse(`"${vfm.match(/^source: "(.+)"$/m)[1]}"`));
  assert.match(await body.locator("a[href^='mailto:']").getAttribute("href"), /^mailto:.+@.+/);
  await body.locator(`a[href="${R}"]`).click();
  await waitPath(s.page, R);
  assert.equal(await s.page.locator("html").getAttribute("lang"), "zh");
  await s.done();
});

// 语言切换：栏目页、译本首页互相对应；版本页和章节页没有英文版，去英文说明页（不回首页，也不只回栏目）
const switches = [
  ["/translations/", "/en/translations/"], ["/en/translations/", "/translations/"],
  [R, "/en" + R], ["/en" + R, R],
  [V, "/en" + R], ...chapters.map((c) => [V + c.slug + "/", "/en" + R]),
];
test("页头语言切换在译文栏目和译本各页上的去向（栏目↔栏目、首页↔英文说明页、版本页和每个章节页 → 英文说明页）", () => {
  for (const [from, to] of switches) {
    const a = read(from).match(/class="?lang-menu"?><li><a href="?([^" >]+)/)[1];
    assert.equal(a, BASE + to, from);
  }
});

for (const engine of ENGINES) {
  test(`${engine}：在章节页点页头 En 到英文说明页，再点 Zh 回到译本首页`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    await s.go(V + "risk-factors/");
    await s.page.locator(".header .lang-menu a").click();
    await waitPath(s.page, "/en" + R);
    await s.page.locator(".header .lang-menu a").click();
    await waitPath(s.page, R);
    await s.done();
  });
}

// ---------- 译本首页、版本页 ----------

test("译本首页：完整声明、开始阅读按钮到第一章、英文原文链接、目录 32 章、版本表、下载卡片（真实文件；已发布时显示大小和 sha256）", () => {
  const h = read(R);
  assert.match(h, /译者声明（请先阅读）/);
  assert.match(h, /人工没有检查、也没有能力检查译文与原文的一致性/);
  assert.match(h, new RegExp(`<a class="?s1-btn"? href="?${V}${chapters[0].slug}/"?>开始阅读最新版 ${LATEST}</a>`));
  assert.match(h, /<a href="?https:\/\/www\.sec\.gov\/[^>]+>英文原文（SEC）<\/a>/);
  // 目录：每章一条，链接存在，页码范围和 front matter 一致
  const toc = h.split(`<h2>目录（${LATEST}）</h2>`)[1].split("</ol>")[0];
  const items = [...toc.matchAll(/<li data-from="?(\d+)"? data-to="?(\d+)"?><a href="?([^" >]+)"?>/g)];
  assert.deepEqual(items.map((m) => [m[3], +m[1], +m[2]]), chapters.map((c) => [V + c.slug + "/", ...c.pages]));
  for (const m of items) assert.ok(site.exists(m[3] + "index.html"), m[3]);
  // 版本表：每个版本一行，最新版带「最新」，链接到版本页，有下载列
  const row = h.split('<table class="s1-versions">')[1] ?? h.split("<table class=s1-versions>")[1];
  assert.match(row, new RegExp(`<a href="?${V}"?>${LATEST}</a> <span class="?s1-vtag s1-latest"?>最新</span>`));
  assert.match(row, /2026-10-26 16:16 UTC/);
  assert.match(row, /class="?s1-dl-col"?><span class="?s1-dl-line/);
  // 下载卡片：文件都在；已发布的版本显示大小和 sha256 前 12 位，没发布的只有 HTML、没有 PDF
  assert.ok(site.exists(HTML_URL), HTML_URL);
  assert.match(h, new RegExp(`<a href="?${HTML_URL}"? target="?_blank`));
  if (!downloads) assert.doesNotMatch(h, /\.pdf"? download=/);
  for (const [kind, d] of Object.entries(downloads ?? {})) {
    const url = V + d.file.replace(/\.raw$/, "");
    assert.ok(site.exists(url), url);
    assert.match(h, new RegExp(`${(d.bytes / 1048576).toFixed(1)} MB`), kind);
    assert.match(h, new RegExp(d.sha256.slice(0, 12)), kind);
  }
  assert.match(h, /class="?s1-rights"?>[^<]*下架请求：<a href="?mailto:/);
});

test("最新版本页：面包屑回译本首页、版本条「最新」、有多个版本时版本菜单列出全部版本、下载卡片、目录 32 章", () => {
  const h = read(V);
  assert.match(h, new RegExp(`class="?s1-crumb"?><a href="?${R}"?>`));
  assert.match(h, new RegExp(`<span class="?s1-vtag s1-latest"?>${LATEST} · 最新</span>`));
  if (VERSIONS.length > 1) for (const v of VERSIONS) assert.match(h.match(/class="?s1-vmenu[\s\S]*?<\/details>/)[0], new RegExp(`href="?${R}${v}/"?`), v);
  else assert.doesNotMatch(h, /s1-vmenu/);
  assert.doesNotMatch(h, /class="?s1-old/);
  assert.match(h, /class="?s1-dl-cards/);
  assert.equal([...h.matchAll(/<li data-from=/g)].length, chapters.length);
});

test("32 个章节页：面包屑、「原文第 a–b 页」、上一章/下一章（页脚和沉浸顶栏）、章节目录标出当前章、顶栏总页数、原版页数和页码分隔", () => {
  chapters.forEach((c, i) => {
    const p = V + c.slug + "/", h = read(p);
    assert.match(h, new RegExp(`class="?s1-crumb"?><a href="?${R}"?>[^<]+</a> › <a href="?${V}"?>${LATEST} 目录</a>`), p);
    assert.match(h, new RegExp(`<div class="?post-meta"?>原文第 ${c.pages[0]}–${c.pages[1]} 页</div>`), p);
    const nav = h.match(/<nav class="?paginav s1-paginav"?>([\s\S]*?)<\/nav>/)[1];
    const prev = chapters[i - 1], next = chapters[i + 1];
    assert.equal(/class="?prev/.test(nav), !!prev, `${p} 上一章`);
    assert.equal(/class="?next/.test(nav), !!next, `${p} 下一章`);
    if (prev) assert.match(nav, new RegExp(`class="?prev"? href="?\\.\\./${prev.slug}/"?>.*<span>${prev.title}</span>`), p);
    if (next) assert.match(nav, new RegExp(`class="?next"? href="?\\.\\./${next.slug}/"?>.*<span>${next.title}</span>`), p);
    if (prev) assert.match(h, new RegExp(`href="?\\.\\./${prev.slug}/\\?read=1"? data-dir="?prev`), p);
    if (next) assert.match(h, new RegExp(`href="?\\.\\./${next.slug}/\\?read=1"? data-dir="?next`), p);
    assert.equal(/data-dir="?prev/.test(h), !!prev, p);
    assert.equal(/data-dir="?next/.test(h), !!next, p);
    assert.match(h, new RegExp(`aria-current="?page"?><a href="?${V}${c.slug}/"?>`), p);
    assert.match(h, new RegExp(`class="?s1-ibar-page"? data-total="?${TOTAL}"?`), p);
    // 版本条里一行全文下载（HTML 新标签页打开、PDF 直接下载）
    const vbar = h.match(/<div class="?s1-vbar"?>([\s\S]*?)<\/div>/)[1];
    assert.match(vbar, new RegExp(`<a href="?${HTML_URL}"? target="?_blank`), p);
    if (PDF_URL) assert.match(vbar, new RegExp(`<a href="?${PDF_URL}"? download=`), p);
    else assert.doesNotMatch(vbar, /\.pdf/, p);
    assert.match(h, new RegExp(`s1-chapter[^>]+data-first-page="?${c.pages[0]}"?`), p);
    // 原版：每页一张 .s1-sheet，页数等于页码范围；重排：每页末尾一条「原文第 N 页」，N 在本章范围内递增
    const tpl = h.split(/<template class="?s1-original-tpl"?>/)[1].split("</template>")[0];
    assert.equal((tpl.match(/class="?s1-sheet"? style=/g) || []).length, c.pages[1] - c.pages[0] + 1, `${p} 原版页数`);
    const marks = [...h.matchAll(/class="?s1-pg"? id="?p-(\d+)"? data-page="?(\d+)/g)].map((m) => +m[2]);
    assert.deepEqual(marks, [...marks].sort((a, b) => a - b), `${p} 页码分隔递增`);
    assert.ok(marks.every((n) => n >= c.pages[0] && n <= c.pages[1]), `${p} 页码分隔超出本章 ${marks}`);
    // 原版图片懒加载，原版放在 <template> 里，没选原版时不插入页面（图片也不下载）
    for (const img of tpl.match(/<img\b[^>]*>/g) || []) assert.match(img, /loading="?lazy[\s\S]*decoding="?async|decoding="?async[\s\S]*loading="?lazy/, p);
    assert.match(h, /<div class="?s1-original"? data-view="?original"? hidden><\/div>/, p);
    assert.match(h, /class="?s1-rights"?>[^<]*下架请求：<a href="?mailto:/, p);
  });
});

// ---------- 版本菜单、历史版本（测试样例有 v1.0 和 v0.9 两个版本） ----------

test("历史版本的章节页：红色提醒指向最新版的同一章；版本菜单列出两个版本，当前版本标出", () => {
  const h = read(FIX + "v0.9/cover/");
  assert.match(h, /class="?s1-old"? role="?alert"?>[\s\S]*历史版本 v0.9[\s\S]*<a href="?\/s1-test\/v1.0\/cover\/"?>查看最新版本 v1.0 →<\/a>/);
  const menu = h.match(/<details class="?s1-vmenu"?>([\s\S]*?)<\/details>/)[1];
  assert.match(menu, /<li><a href="?\/s1-test\/v1.0\/cover\/"?>v1.0<\/a>/);
  assert.match(menu, /<li aria-current="?true"?><a href="?\/s1-test\/v0.9\/cover\/"?>v0.9<\/a>/);
  assert.match(menu, /<a href="?\/s1-test\/#versions"?>全部版本与更新记录<\/a>/);
  // 版本页的菜单去另一个版本的目录；最新版不显示提醒
  assert.match(read(FIX + "v1.0/").match(/<details class="?s1-vmenu"?>([\s\S]*?)<\/details>/)[1], /<a href="?\/s1-test\/v0.9\/"?>v0.9<\/a>/);
  assert.doesNotMatch(read(FIX + "v1.0/cover/"), /class="?s1-old/);
});

for (const engine of ENGINES) {
  test(`${engine}：版本菜单点开后列出版本，点菜单里不收起、点别处收起，点版本到那个版本的同一章，「全部版本」到首页版本表`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(FIX + "v1.0/cover/");
    const menu = page.locator(".s1-vmenu"), list = menu.locator("ul");
    assert.equal(await list.isVisible(), false);
    await menu.locator("summary").click();
    await list.waitFor({ state: "visible" });
    await menu.locator("li small").first().click(); // 菜单里的说明文字
    assert.equal(await menu.evaluate((d) => d.open), true, "点菜单里面不应收起");
    await page.locator("h1.post-title").click();
    await list.waitFor({ state: "hidden" });
    await menu.locator("summary").click();
    await menu.locator("a", { hasText: "v0.9" }).click();
    await waitPath(page, FIX + "v0.9/cover/");
    assert.equal(await page.locator(".s1-old").isVisible(), true);
    await page.locator(".s1-old a").click();
    await waitPath(page, FIX + "v1.0/cover/");
    await menu.locator("summary").click();
    await menu.locator("a", { hasText: "全部版本与更新记录" }).click();
    await waitPath(page, FIX + "#versions");
    await until(page, () => { const r = document.getElementById("versions").getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; });
    await s.done();
  });
}

// ---------- 章节页：声明、章节目录、上一章/下一章 ----------

test("章节页：简短声明点开后显示完整声明；「章节目录」展开后当前章加粗，点别的章跳过去；页脚上一章/下一章能走通", async (t) => {
  const s = await open(t, "chromium");
  const { page } = s;
  await s.go(V + "selected-definitions/");
  const full = page.locator(".s1-notice-short .s1-notice-title");
  assert.equal(await full.isVisible(), false);
  await page.locator(".s1-notice-short summary .s1-more").click();
  await full.waitFor({ state: "visible" });
  assert.equal(await page.locator(".s1-notice-short .s1-more").isVisible(), false, "展开后「完整声明」字样隐藏");
  const toc = page.locator(".s1-chtoc");
  await toc.locator("summary").click();
  const cur = toc.locator("li[aria-current] > a");
  await cur.waitFor({ state: "visible" });
  assert.equal(await cur.textContent(), chapters[1].title);
  assert.equal(await cur.evaluate((a) => +getComputedStyle(a).fontWeight >= 700), true);
  await toc.locator("a", { hasText: chapters[4].title }).click();
  await waitPath(page, V + chapters[4].slug + "/");
  await page.locator(".s1-paginav .next").click();
  await waitPath(page, V + chapters[5].slug + "/");
  await page.locator(".s1-paginav .prev").click();
  await waitPath(page, V + chapters[4].slug + "/");
  await s.done();
});

for (const engine of ENGINES) {
  test(`${engine}：译本首页的下载卡片：「在浏览器打开」在新标签页打开完整 HTML，「下载 .pdf」直接下载 PDF（文件名带版本号）`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page, ctx } = s;
    await s.go(R);
    const [tab] = await Promise.all([ctx.waitForEvent("page"), page.locator(".s1-dl-card a", { hasText: "在浏览器打开" }).click()]);
    await tab.waitForURL((u) => u.pathname === HTML_URL, { waitUntil: "commit" });
    await tab.close();
    assert.equal(new URL(page.url()).pathname, R, "原页面不动");
    if (PDF_URL) {
      const [dl] = await Promise.all([page.waitForEvent("download"), page.locator(".s1-dl-card a", { hasText: "下载 .pdf" }).click()]);
      assert.equal(new URL(dl.url()).pathname, PDF_URL);
      assert.equal(dl.suggestedFilename(), `anthropic-s1-zh-unofficial-${LATEST}.pdf`);
      await dl.cancel();
    } else assert.equal(await page.locator(".s1-dl-card a", { hasText: "下载 .pdf" }).count(), 0, "没发布的版本不应有 PDF");
    await s.done();
  });
}

test("深色模式下原版页面仍是白纸黑字（只调暗，不反色）", async (t) => {
  const s = await open(t, "chromium", { ...DESKTOP, colorScheme: "dark" });
  await s.go(V + "cover/");
  assert.equal(await s.page.evaluate(() => document.documentElement.dataset.theme), "dark");
  const [filter, bg] = await s.page.locator(".s1-original .s1-sheet").first().evaluate((e) => [getComputedStyle(e).filter, getComputedStyle(e).backgroundColor]);
  assert.equal(filter, "brightness(0.75)");
  assert.equal(bg, "rgb(255, 255, 255)");
  await s.done();
});

test("带 ?read=1 打开时首屏就是沉浸样式（不等 s1.js，避免先显示普通页面再跳变）", async (t) => {
  const s = await open(t, "chromium");
  await s.ctx.route(/\/s1\.[^/]*\.js$|\/s1\.js$/, (r) => r.abort());
  await s.go(V + "cover/?read=1");
  assert.equal(await immersive(s.page), true);
  assert.equal(await s.page.locator("header.header").isVisible(), false);
  await s.done();
});

// ---------- 重排/原版切换 ----------

for (const engine of ENGINES) {
  test(`${engine}：没选过版式时宽屏默认原版、手机默认重排；重排时原版不插入、原版图片不下载`, async (t) => {
    let s = await open(t, engine);
    if (!s) return;
    await s.go(V + "cover/");
    assert.equal(await shown(s.page), "original");
    assert.equal(await s.page.locator('.s1-switch [data-view="original"]').getAttribute("aria-pressed"), "true");
    assert.equal(await s.page.locator('.s1-switch [data-view="reflow"]').getAttribute("aria-pressed"), "false");
    await s.done();
    s = await open(t, engine, PHONE[engine]);
    const imgs = [];
    s.page.on("request", (r) => { if (/\/translations\/anthropic-s1\/img\//.test(r.url())) imgs.push(r.url()); });
    await s.go(V + "cover/");
    assert.equal(await shown(s.page), "reflow");
    assert.equal(await s.page.locator('.s1-switch [data-view="reflow"]').getAttribute("aria-pressed"), "true");
    assert.equal(await s.page.locator(".s1-original").evaluate((o) => o.childElementCount), 0, "重排时原版不插入");
    // 原版的图片（重排版没有用到的那些）在切到原版之前一张都不下载；切过去后首屏的图片才开始下载
    const [origOnly] = await s.page.evaluate(() => {
      const abs = (u) => new URL(u, location.href).href;
      const used = new Set([...document.querySelectorAll(".s1-reflow img")].flatMap((i) => [i.src, ...(i.getAttribute("srcset") || "").split(",").map((x) => x.trim().split(" ")[0]).filter(Boolean).map(abs)]));
      return [[...document.querySelector(".s1-original-tpl").content.querySelectorAll("img")].map((i) => abs(i.getAttribute("src"))).filter((u) => !used.has(u))];
    });
    assert.ok(origOnly.length > 0, "测试前提：封面的原版有重排版没有的图片");
    assert.deepEqual(imgs.filter((u) => origOnly.includes(u)), [], "重排时下载了原版的图片");
    await s.page.locator('.s1-switch [data-view="original"]').click();
    assert.equal(await shown(s.page), "original");
    assert.equal(await s.page.locator(".s1-original .s1-sheet").count(), 11);
    await until(s.page, () => [...document.querySelectorAll(".s1-original img")].some((i) => i.complete && i.naturalWidth > 0));
    await s.done();
  });
}

for (const engine of ENGINES) {
  test(`${engine}：版式选择宽屏、窄屏分别记住（刷新后保持，互不影响）`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "the-offering/");
    await page.locator('.s1-switch [data-view="reflow"]').click();
    assert.equal(await shown(page), "reflow");
    assert.equal(await page.locator('.s1-switch [data-view="reflow"]').getAttribute("aria-pressed"), "true");
    await page.reload({ waitUntil: "load" });
    assert.equal(await shown(page), "reflow", "宽屏选了重排，刷新后仍是重排");
    // 换到窄屏：还没选过，按窄屏默认（重排）；选原版后记在窄屏这边
    await page.setViewportSize({ width: 700, height: 900 });
    await page.reload({ waitUntil: "load" });
    assert.equal(await shown(page), "reflow");
    await page.locator('.s1-switch [data-view="original"]').click();
    await page.reload({ waitUntil: "load" });
    assert.equal(await shown(page), "original", "窄屏选了原版，刷新后仍是原版");
    // 回到宽屏：仍是宽屏自己的选择（重排），而且换章节也生效
    await page.setViewportSize({ width: 1280, height: 800 });
    await s.go(V + "dilution/");
    assert.equal(await shown(page), "reflow", "宽屏的选择被窄屏覆盖了");
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem("s1-view"), localStorage.getItem("s1-view-narrow")]), ["reflow", "original"]);
    await s.done();
  });

  test(`${engine}：切换重排/原版时停在同一原文页（来回切换都对）`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "prospectus-summary/"); // 原文第 15–28 页
    assert.equal(await shown(page), "original");
    for (const n of [21, 26]) {
      await scrollToPage(page, n);
      assert.equal(await pageAt(page), n, "测试前提：滚到了第 " + n + " 页");
      await clickInPlace(page.locator('.s1-switch [data-view="reflow"]'));
      assert.equal(await pageAt(page), n, `原版第 ${n} 页切到重排后不在第 ${n} 页`);
      await clickInPlace(page.locator('.s1-switch [data-view="original"]'));
      assert.equal(await pageAt(page), n, `重排切回原版后不在第 ${n} 页`);
    }
    await s.done();
  });

  test(`${engine}：原版页面按宽度缩放（宽屏最多 1.4 倍、手机缩小），窗口大小变化时重新适配，原版页码 data-page 连续`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "cover/");
    const scale = () => page.evaluate(() => { const b = document.querySelector(".s1-original .s1-sheets"); return [+(b.firstElementChild.style.zoom || 1), Math.min(1.4, b.clientWidth / 836)]; });
    let [z, want] = await scale();
    assert.ok(Math.abs(z - want) < 0.001 && z > 1, `宽屏缩放 ${z}，应为 ${want}`);
    assert.ok(await noHScroll(page));
    await page.setViewportSize({ width: 600, height: 800 });
    await until(page, () => +(document.querySelector(".s1-original .s1-sheets-inner").style.zoom || 1) < 1);
    [z, want] = await scale();
    assert.ok(Math.abs(z - want) < 0.001, `窗口变窄后缩放 ${z}，应为 ${want}`);
    assert.ok(await noHScroll(page), "窗口变窄后出现横向滚动");
    await page.setViewportSize({ width: 1600, height: 900 });
    await until(page, () => +(document.querySelector(".s1-original .s1-sheets-inner").style.zoom || 1) > 1.3);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".s1-original .s1-sheet")].map((e) => +e.dataset.page)), Array.from({ length: 11 }, (_, i) => i + 1));
    await s.done();
  });

  test(`${engine}：原版里的跨章链接（../cover/#id）打开目标章时自动切到原版并滚到目标，手机上也是`, async (t) => {
    const s = await open(t, engine, PHONE[engine]);
    if (!s) return;
    const { page } = s;
    await s.go(V + "selected-definitions/");
    await page.locator('.s1-switch [data-view="original"]').click();
    const link = page.locator('.s1-original a[href^="../cover/#"]').first();
    const id = decodeURIComponent((await link.getAttribute("href")).split("#")[1]);
    await link.click();
    await page.waitForURL((u) => u.pathname === V + "cover/");
    await until(page, (id) => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight; }, id);
    assert.equal(await shown(page), "original");
    // 读者在手机上原本选的是…原版（上一步点过原版），换一个干净的上下文再直接打开同一网址：没选过（默认重排）也要切到原版
    await s.done();
    const s2 = await open(t, engine, PHONE[engine]);
    await s2.go(V + "cover/#" + id);
    assert.equal(await shown(s2.page), "original");
    await until(s2.page, (id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight; }, id);
    await s2.done();
  });

  test(`${engine}：手机上译文栏目、译本首页、版本页、章节页（两种版式）、英文说明页都没有横向滚动`, async (t) => {
    const s = await open(t, engine, PHONE[engine]);
    if (!s) return;
    const { page } = s;
    for (const p of ["/translations/", "/en/translations/", R, "/en" + R, V, V + "cover/", V + "financial-statements-2/"]) {
      await s.go(p);
      assert.ok(await noHScroll(page), p);
      if (p.startsWith(V) && p !== V) {
        await page.locator('.s1-switch [data-view="original"]').click();
        assert.ok(await noHScroll(page), p + "（原版）");
        await page.locator('.s1-switch [data-view="reflow"]').click();
      }
    }
    // 版本表在手机上隐藏「全文下载」列（放不下；上面有下载卡片）
    await s.go(R);
    assert.equal(await page.locator(".s1-versions th.s1-dl-col").isVisible(), false);
    assert.equal(await page.locator(".s1-dl-cards").isVisible(), true);
    await s.done();
  });
}

test("浏览器禁用本地存储（隐私模式等）时照常可用：按屏宽给默认版式，可以切换、进出沉浸和缩放，没有脚本错误", async (t) => {
  const s = await open(t, "chromium");
  await s.ctx.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }));
  const { page } = s;
  await s.go(V + "cover/");
  assert.equal(await shown(page), "original");
  await page.locator('.s1-switch [data-view="reflow"]').click();
  assert.equal(await shown(page), "reflow");
  await page.locator('.s1-switch [data-view="original"]').click();
  await page.locator("[data-enter]").click();
  await waitPath(page, V + "cover/?read=1");
  await page.locator('.s1-ibar [data-zoom="in"]').click();
  assert.equal(await page.locator('.s1-ibar [data-zoom="fit"]').textContent(), "150%");
  await page.keyboard.press("Escape");
  await waitPath(page, V + "cover/");
  // PaperMod 自己的深色模式脚本（<head> 和页脚里的内联脚本）不防存储被禁用，会各报一次错；这里只管 s1.js（错误栈里有 /js/s1. 的才算）
  const theirs = s.errors.filter((e) => !/\/js\/s1\./.test(e.stack || ""));
  assert.ok(theirs.length <= 2, theirs.map((e) => e.stack).join("\n"));
  s.errors.splice(0, Infinity, ...s.errors.filter((e) => !theirs.includes(e)));
  await s.done();
});

// ---------- 沉浸阅读 ----------

for (const engine of ENGINES) {
  test(`${engine}：点「全屏阅读」进入沉浸（网址加 ?read=1、页头页脚隐藏、焦点到顶栏），浏览器后退退出，前进再进入，位置不变`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "cover/");
    await scrollToPage(page, 5);
    await clickInPlace(page.locator("[data-enter]"));
    await waitPath(page, V + "cover/?read=1");
    assert.equal(await immersive(page), true);
    for (const sel of ["header.header", "footer.footer", ".s1-switchbar", ".s1-vbar"]) assert.equal(await page.locator(sel).isVisible(), false, sel);
    assert.equal(await page.locator(".s1-ibar").isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("s1-ibar")), true, "焦点应在顶栏");
    await waitBar(page, 5);
    assert.equal(await pageAt(page), 5, "进入后不在原来那一页");
    await page.goBack();
    await waitPath(page, V + "cover/");
    await until(page, () => !document.body.classList.contains("s1-immersive"));
    assert.equal(await page.locator(".s1-ibar").isVisible(), false);
    assert.equal(await page.locator("header.header").isVisible(), true);
    assert.equal(await pageAt(page), 5, "退出后不在原来那一页");
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-enter")), true, "退出后焦点回到「全屏阅读」");
    await page.goForward();
    await waitPath(page, V + "cover/?read=1");
    await until(page, () => document.body.classList.contains("s1-immersive"));
    assert.equal(await pageAt(page), 5);
    // 从按钮进入的，「✕ 退出」等于后退一步，历史里不留 ?read=1
    await page.locator(".s1-ibar [data-exit]").click();
    await waitPath(page, V + "cover/");
    await until(page, () => !document.body.classList.contains("s1-immersive"));
    await s.done();
  });

  test(`${engine}：直接打开 ?read=1 就是沉浸阅读（从顶部开始）；Esc 退出，网址去掉 read 参数；「✕ 退出」同样`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "the-offering/?read=1");
    assert.equal(await immersive(page), true);
    await waitBar(page, chapters[3].pages[0]);
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.keyboard.press("Escape");
    await waitPath(page, V + "the-offering/");
    assert.equal(await immersive(page), false);
    assert.equal(await page.locator("header.header").isVisible(), true);
    await s.go(V + "the-offering/?read=1");
    await page.locator(".s1-ibar [data-exit]").click();
    await waitPath(page, V + "the-offering/");
    assert.equal(await immersive(page), false);
    await s.done();
  });

  test(`${engine}：沉浸顶栏的页码随滚动更新；点页码或按 g 输入页码，本章内滚到那一页，别的章打开那一章并定位，无效页码和取消不动`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "cover/?read=1");
    await waitBar(page, 1);
    await scrollToPage(page, 7);
    await waitBar(page, 7);
    page.answer = 9;
    await barPage(page).click();
    await waitBar(page, 9);
    assert.equal(await pageAt(page), 9);
    page.answer = 3;
    await page.keyboard.press("g");
    await waitBar(page, 3);
    assert.equal(await pageAt(page), 3);
    page.answer = null; // 取消
    await stays(page, () => page.keyboard.press("g"), "取消跳页不应跳走");
    page.answer = 999; // 超出范围：不动
    await stays(page, () => barPage(page).click(), "无效页码不应跳走");
    assert.equal(path(page), V + "cover/?read=1");
    assert.equal(page.dialogs, 4);
    await waitBar(page, 3);
    // 别的章：打开那一章的沉浸阅读，定位到那一页，网址里的 #page-N 用过就去掉
    page.answer = 40;
    await barPage(page).click();
    await waitPath(page, V + "risk-factors/?read=1");
    assert.equal(await immersive(page), true);
    await waitBar(page, 40);
    assert.equal(await pageAt(page), 40);
    await s.done();
  });

  test(`${engine}：沉浸里按 ] 到下一章、[ 到上一章（都保持沉浸），第一章按 [ 不动；顶栏 ‹ › 同样`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "cover/?read=1");
    assert.equal(await page.locator('.s1-ibar [data-dir="prev"]').count(), 0);
    await stays(page, () => page.keyboard.press("["), "第一章按 [ 不应跳走");
    await stays(page, () => page.keyboard.press("Control+]"), "按住 Ctrl 时 ] 不翻章（留给浏览器快捷键）");
    await page.keyboard.press("]");
    await waitPath(page, V + "selected-definitions/?read=1");
    assert.equal(await immersive(page), true);
    await page.keyboard.press("]");
    await waitPath(page, V + "prospectus-summary/?read=1");
    await page.keyboard.press("[");
    await waitPath(page, V + "selected-definitions/?read=1");
    await page.locator('.s1-ibar [data-dir="next"]').click();
    await waitPath(page, V + "prospectus-summary/?read=1");
    await page.locator('.s1-ibar [data-dir="prev"]').click();
    await waitPath(page, V + "selected-definitions/?read=1");
    // 最后一章没有「下一章」
    await s.go(V + chapters.at(-1).slug + "/?read=1");
    assert.equal(await page.locator('.s1-ibar [data-dir="next"]').count(), 0);
    await s.done();
  });

  test(`${engine}：沉浸目录面板：点标题展开、当前章标出；面板开着时 ] 和 g 不起作用，Esc 先关面板再退出；点面板外收起；面板开着点退出也收起；点别的章仍在沉浸里`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "selected-definitions/?read=1");
    const toc = page.locator(".s1-ibar-toc"), panel = toc.locator(".s1-ibar-panel");
    await toc.locator("summary").click();
    await panel.waitFor({ state: "visible" });
    assert.equal(await panel.locator("li").count(), chapters.length);
    assert.equal(await panel.locator("li[aria-current] a").textContent(), chapters[1].title);
    page.answer = 30;
    await stays(page, async () => { await page.keyboard.press("]"); await page.keyboard.press("g"); }, "面板开着时不应翻章或跳页");
    assert.equal(page.dialogs, 0, "面板开着时 g 不应弹出跳页");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    assert.equal(await immersive(page), true, "第一次 Esc 只关面板");
    await toc.locator("summary").click();
    await panel.waitFor({ state: "visible" });
    await page.mouse.click(640, 500); // 面板外（正文）
    await panel.waitFor({ state: "hidden" });
    // 面板开着时点「✕ 退出」：面板收起并退出；再进入时面板仍是收起的
    await toc.locator("summary").click();
    await panel.waitFor({ state: "visible" });
    await page.locator(".s1-ibar [data-exit]").click();
    await waitPath(page, V + "selected-definitions/");
    assert.equal(await toc.evaluate((d) => d.open), false);
    await clickInPlace(page.locator("[data-enter]"));
    await waitPath(page, V + "selected-definitions/?read=1");
    assert.equal(await panel.isVisible(), false);
    await toc.locator("summary").click();
    await panel.locator("a", { hasText: chapters[6].title }).click();
    await waitPath(page, V + chapters[6].slug + "/?read=1");
    assert.equal(await immersive(page), true);
    await page.keyboard.press("Escape");
    await waitPath(page, V + chapters[6].slug + "/");
    await s.done();
  });

  test(`${engine}：沉浸里点原版的跨章链接仍留在沉浸，按住 Ctrl 点目录则照常在新标签页打开普通页；顶栏「非官方 AI 译本」回译本首页`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "selected-definitions/?read=1");
    assert.equal(await shown(page), "original");
    const link = page.locator('.s1-original a[href^="../cover/#"]').first();
    const hash = (await link.getAttribute("href")).split("#")[1];
    await link.click();
    await waitPath(page, V + "cover/?read=1#" + hash);
    assert.equal(await immersive(page), true);
    assert.equal(await shown(page), "original");
    // 按住 Ctrl 点（新标签页打开）不拦截：当前页不动，新标签页是普通网址
    await page.locator(".s1-ibar-toc summary").click();
    const [tab] = await Promise.all([s.ctx.waitForEvent("page"), page.locator(".s1-ibar-panel a", { hasText: chapters[3].title }).click({ modifiers: ["Control"] })]);
    await tab.waitForURL((u) => u.pathname === V + chapters[3].slug + "/", { waitUntil: "commit" });
    assert.equal(new URL(tab.url()).search, "");
    await tab.close();
    // WebKit 里新标签页抢走焦点后 Control 可能仍算按着（之后的 Esc 被当成 Ctrl+Esc 忽略、点链接又开新标签页），回到本页并松开
    await page.bringToFront();
    await page.keyboard.up("Control");
    assert.equal(new URL(page.url()).pathname, V + "cover/");
    await page.keyboard.press("Escape"); // 关面板
    await until(page, () => !document.querySelector(".s1-ibar-toc[open]"));
    await page.locator(".s1-ibar-tag").click();
    await waitPath(page, R);
    await s.done();
  });

  test(`${engine}：沉浸里切换版式（按钮文字跟着变、停在同一页、重排时没有缩放按钮），退出后回到进入前的版式`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "prospectus-summary/");
    await scrollToPage(page, 20);
    await clickInPlace(page.locator("[data-enter]"));
    await waitBar(page, 20);
    const toggle = page.locator(".s1-ibar [data-toggle-view]"), zoom = page.locator(".s1-ibar-zoom");
    assert.equal(await toggle.textContent(), "重排版");
    assert.equal(await zoom.isVisible(), true);
    await toggle.click();
    assert.equal(await shown(page), "reflow");
    assert.equal(await toggle.textContent(), "原版");
    assert.equal(await zoom.isVisible(), false);
    await waitBar(page, 20);
    assert.equal(await pageAt(page), 20);
    await scrollToPage(page, 24);
    await waitBar(page, 24);
    await page.keyboard.press("Escape");
    await waitPath(page, V + "prospectus-summary/");
    assert.equal(await shown(page), "original", "退出后应回到进入前的原版");
    assert.equal(await pageAt(page), 24, "退出后应停在沉浸里读到的那一页");
    await s.done();
  });

  test(`${engine}：沉浸缩放：+/− 按档位放大缩小、「适应」显示百分比并恢复；缩放记在本机，再次进入沉浸仍生效，不影响普通页面`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    const { page } = s;
    await s.go(V + "cover/?read=1");
    const fit = page.locator('.s1-ibar [data-zoom="fit"]');
    const z = () => page.evaluate(() => +(document.querySelector(".s1-original .s1-sheets-inner").style.zoom || 1));
    const fitPct = Math.round(Math.min(1.4, 1280 / 836) * 100);
    assert.equal(await fit.textContent(), fitPct + "%");
    assert.equal(await fit.getAttribute("title"), "当前：适应宽度");
    await scrollToPage(page, 4);
    await page.locator('.s1-ibar [data-zoom="in"]').click();
    assert.equal(await z(), 1.5);
    assert.equal(await fit.textContent(), "150%");
    await page.locator('.s1-ibar [data-zoom="in"]').click();
    assert.equal(await z(), 1.6);
    assert.equal(await fit.getAttribute("title"), "恢复适应宽度");
    assert.equal(await pageAt(page), 4, "缩放后应停在同一页");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), "放大后整页可以横向滚动");
    for (let i = 0; i < 4; i++) await page.locator('.s1-ibar [data-zoom="out"]').click();
    assert.equal(await z(), 1.2);
    assert.equal(await page.evaluate(() => localStorage.getItem("s1-zoom")), "1.2");
    // 再次打开：沿用 1.2；普通页面（非沉浸）仍按宽度适应
    await s.go(V + "selected-definitions/?read=1");
    assert.equal(await z(), 1.2);
    await page.keyboard.press("Escape");
    await waitPath(page, V + "selected-definitions/");
    assert.ok(Math.abs((await z()) - Math.min(1.4, (await page.evaluate(() => document.querySelector(".s1-original .s1-sheets").clientWidth)) / 836)) < 0.001);
    await s.go(V + "selected-definitions/?read=1");
    await fit.click();
    assert.equal(await fit.textContent(), fitPct + "%");
    assert.equal(await page.evaluate(() => localStorage.getItem("s1-zoom")), "fit");
    // 缩到最小一档后再按 − 不变
    for (let i = 0; i < 12; i++) await page.locator('.s1-ibar [data-zoom="out"]').click();
    assert.equal(await z(), 0.5);
    await s.done();
  });

  test(`${engine}：手机上进入沉浸保持重排版、顶栏放得下、没有横向滚动；窗口变化时原版重新适配`, async (t) => {
    const s = await open(t, engine, PHONE[engine]);
    if (!s) return;
    const { page } = s;
    await s.go(V + "prospectus-summary/");
    await page.locator("[data-enter]").click();
    await waitPath(page, V + "prospectus-summary/?read=1");
    assert.equal(await shown(page), "reflow");
    assert.ok(await noHScroll(page));
    assert.ok(await page.locator(".s1-ibar").evaluate((b) => b.scrollWidth <= b.clientWidth), "顶栏溢出");
    await page.locator(".s1-ibar [data-toggle-view]").click();
    assert.equal(await shown(page), "original");
    assert.ok(await noHScroll(page), "适应宽度时原版不应横向滚动");
    const w = await page.evaluate(() => innerWidth);
    await page.setViewportSize({ width: w + 200, height: 900 });
    await until(page, (w) => Math.abs(+document.querySelector(".s1-original .s1-sheets-inner").style.zoom - Math.min(1.4, (w + 200) / 836)) < 0.001, w);
    await s.done();
  });
}

// 重排版里「原文第 N 页」分隔线标在第 N 页末尾；本章最后一条分隔线之后不算本章（曾被当成下一章第一页，跳页时只滚到本章末尾）
test("沉浸重排版里跳到下一章的第一页，应打开下一章", async (t) => {
  const s = await open(t, "chromium");
  const { page } = s;
  await s.go(V + "selected-definitions/");
  await page.locator('.s1-switch [data-view="reflow"]').click();
  await page.locator("[data-enter]").click();
  await waitBar(page, chapters[1].pages[0]);
  page.answer = chapters[2].pages[0];
  await barPage(page).click();
  await waitPath(page, V + "prospectus-summary/?read=1");
  await waitBar(page, chapters[2].pages[0]);
  await s.done();
});
