// 双语对照译文（layouts/bilingual/、layouts/_partials/bilingual/、assets/css/extended/bilingual.css，借用 S-1 的 s1.js/s1.css）：
// 用仓库里的每一篇双语译文（content/translations/<slug>/，type: bilingual）检查
//   - 构建结果：版本条、声明、全文下载（冻结文件原样发布、sha256 一致、直链无门槛）、导入用的源文件不发布、重排版段落齐全、英文页只放说明
//   - 读者行为（Chromium 和 WebKit）：首次默认（电脑原版、手机重排）、版式和「中文/对照/English」记住选择、全屏阅读进出、
//     缩放、无横向滚动、深色模式下原版纸面不反色、不开脚本、本机存储被禁用
// 等待一律用 waitFor/waitForFunction 轮询，不用固定延时
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium, webkit, devices } from "playwright";
import { build, serve, root } from "./helpers.mjs";

const BASE = "https://douseful.eu.org";
const DESKTOP = { viewport: { width: 1280, height: 800 } };
const PHONE = { chromium: devices["Pixel 7"], webkit: devices["iPhone 13"] };
const ENGINES = ["chromium", "webkit"];

// 仓库里的双语译文：front matter 只取测试要用的几项（YAML 简单键值）
const dir = join(root, "content/translations");
const articles = readdirSync(dir).filter((d) => existsSync(join(dir, d, "index.md"))).map((d) => {
  const fm = readFileSync(join(dir, d, "index.md"), "utf8").split("\n---\n")[0];
  const get = (k) => fm.match(new RegExp(`^${k}: (.+)$`, "m"))?.[1];
  const dl = (kind) => ({
    file: fm.match(new RegExp(`^  ${kind}:\\n    file: (.+)\\n    bytes: (\\d+)\\n    sha256: (\\w+)`, "m")),
  });
  if (get("type") !== "bilingual") return null;
  const d1 = dl("html").file, d2 = dl("pdf").file;
  return {
    dir: join(dir, d), slug: get("slug"), source: get("source"), version: get("version"),
    html: { file: d1[1], bytes: +d1[2], sha: d1[3] }, pdf: { file: d2[1], bytes: +d2[2], sha: d2[3] },
  };
}).filter(Boolean);
const A = articles[0];
const P = `/translations/${A.slug}/`;
const pairs = readFileSync(join(A.dir, "pairs.yaml"), "utf8");

let site, server;
const browsers = {};
before(async () => {
  site = build();
  server = await serve(site.out);
  browsers.chromium = await chromium.launch();
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

const read = (p) => readFileSync(join(site.out, p.endsWith("/") ? p + "index.html" : p), "utf8");

async function open(t, engine, opts = DESKTOP) {
  if (!browsers[engine]) { t.skip("本地没有安装 WebKit（npx playwright install webkit）"); return null; }
  const ctx = await browsers[engine].newContext(opts);
  await ctx.route(BASE + "/**", async (r) => r.fulfill({ response: await ctx.request.fetch(r.request().url().replace(BASE, server.url)) }));
  const errors = [];
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e));
  page.navs = 0;
  page.on("request", (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) page.navs++; });
  const go = (p) => page.goto(server.url + p, { waitUntil: "load" });
  return { ctx, page, go, errors, done: async () => { await ctx.close(); assert.deepEqual(errors.map((e) => e.message), [], "页面不应有脚本错误"); } };
}

const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 5000 });
const shown = (page) => page.evaluate(() => (document.querySelector(".s1-original").hidden ? "reflow" : "original"));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const mode = (page) => page.evaluate(() => document.querySelector(".bl-article").dataset.mode);
// 段落是否显示：看第一段的中文和原文
const visible = (page) => page.evaluate(() => {
  const p = document.querySelector(".bl-pair:not(.bl-img)");
  const vis = (e) => !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0;
  return { zh: vis(p.querySelector(".bl-zh")), en: vis(p.querySelector(".bl-en")) };
});

test("测试前提：仓库里至少有一篇双语译文，都已发布下载文件", () => {
  assert.ok(articles.length > 0);
  for (const a of articles) assert.ok(a.html.file && a.pdf.file, `${a.slug} 还没有运行 release.py`);
});

// ---------- 构建结果 ----------

for (const a of articles) {
  const p = `/translations/${a.slug}/`;

  test(`${a.slug}：全文下载是冻结文件原样发布（大小、sha256 和 front matter 一致），HTML 新窗口打开、PDF 直接下载，没有门槛`, () => {
    const h = read(p);
    for (const [kind, d] of [["html", a.html], ["pdf", a.pdf]]) {
      const url = p + d.file.replace(/\.raw$/, "");
      const buf = readFileSync(join(site.out, url));
      assert.equal(buf.length, d.bytes, url);
      assert.equal(createHash("sha256").update(buf).digest("hex"), d.sha, url);
      assert.ok(buf.equals(readFileSync(join(a.dir, d.file))), `${url} 和仓库里的冻结文件不同`);
    }
    const links = h.match(/<span class="?s1-dl-line"?>[\s\S]*?<\/span><\/span>|<span class="?s1-dl-line"?>[\s\S]*?<\/a><\/span>/g) || [];
    assert.ok(links.length >= 2, "版本条和全屏阅读顶栏都要有下载");
    for (const l of links) {
      assert.match(l, new RegExp(`href="?${p}files/${a.slug}-zh-en-${a.version}\\.html"?[^>]*target="?_blank`));
      assert.match(l, new RegExp(`href="?${p}files/${a.slug}-zh-en-${a.version}\\.pdf"?[^>]*download`));
      // 小文件按 KB 显示（不是 0.0 MB）
      assert.match(l, new RegExp(`${Math.round(a.html.bytes / 1024)} KB`));
    }
  });

  // iOS（Safari 和 X、微信等应用内浏览器）会把显示得很小的字单独放大，原版版式缩到屏宽后行与行会叠在一起（S-1 完整 HTML 遇到过，PR #33）。
  // CI 的 Chromium 和 Linux WebKit 没有这个功能，截图测不出来，所以直接检查样式：站内页靠 PaperMod 的 reset.css。
  // 下载的 HTML 不在此列：它是保存的原网页原样（流式排版，没有行重叠的问题），由 tools/bilingual-import/test_release.py 检查没有加这条
  test(`${a.slug}：站内显示原版版式的页面都关掉了 iOS 的文字自动放大（text-size-adjust: 100%）`, async () => {
    const ctx = await browsers.chromium.newContext(devices["iPhone 13"]);
    const page = await ctx.newPage();
    for (const u of [p, p + "?read=1"]) {
      await page.goto(server.url + u, { waitUntil: "load" });
      const r = await page.evaluate(() => ({ sheets: document.querySelectorAll(".bl-sheet, template.s1-original-tpl").length, adjust: getComputedStyle(document.documentElement).getPropertyValue("text-size-adjust"), css: [...document.querySelectorAll("style")].map((e) => e.textContent).join("\n"), links: [...document.querySelectorAll("link[rel~=stylesheet]")].map((l) => l.href) }));
      for (const href of r.links) r.css += "\n" + await (await ctx.request.get(href)).text();
      assert.ok(r.sheets > 0, `${u} 里没有原版版式`);
      assert.equal(r.adjust, "100%", u);
      // iOS 只认带 -webkit- 前缀的写法；Chromium 解析时会丢掉它，所以查样式表原文
      assert.match(r.css, /(^|[}\s,])html\s*\{[^}]*-webkit-text-size-adjust:\s*100%/, `${u} 缺少 html { -webkit-text-size-adjust: 100% }`);
    }
    await ctx.close();
  });

  test(`${a.slug}：导入用的源文件、段落数据、原版片段不单独发布`, () => {
    for (const f of ["source.html.raw", "source.html", "pairs.yaml", "original.html"]) assert.ok(!site.exists(p + f), `${p}${f} 不应发布`);
    const files = readdirSync(join(site.out, p, "files")).sort();
    assert.deepEqual(files, [`${a.slug}-zh-en-${a.version}.html`, `${a.slug}-zh-en-${a.version}.pdf`]);
  });

  test(`${a.slug}：版本条、非官方声明（原文链接、采集时间、下架邮箱）、版权行`, () => {
    const h = read(p);
    assert.match(h, new RegExp(`class="?s1-vtag s1-latest"?>${a.version} · 最新`));
    assert.match(h, /原文采集于 \d{4}-\d\d-\d\d \d\d:\d\d UTC/);
    const notice = h.match(/<aside class="?s1-notice s1-notice-short"?[\s\S]*?<\/details>/)[0];
    assert.match(notice, /<strong>非官方译文<\/strong>/);
    assert.ok(notice.includes(`href=${a.source}`) || notice.includes(`href="${a.source}"`), "声明里要有原文链接");
    assert.match(notice, /href="?mailto:[^"\s>]+@/);
    assert.match(notice, /北京时间/);
    assert.match(h, /class="?s1-rights"?>原文版权归/);
  });

  test(`${a.slug}：重排版有每一段的中文和原文，开头的标题、作者不重复；原版版式在 <template> 里，首屏不渲染`, () => {
    const h = read(p);
    const data = pairs; // 只用第一篇的数据核对数量
    const n = (data.split("\npairs:\n")[1].match(/^- kind:/gm) || []).length;
    const reflow = h.split(/class="?post-content s1-reflow/)[1].split(/class="?s1-original"/)[0];
    if (a === A) assert.equal((reflow.match(/class="?bl-pair/g) || []).length, n);
    assert.equal((reflow.match(/class="?bl-zh"?/g) || []).length, (reflow.match(/class="?bl-en"?/g) || []).length);
    assert.doesNotMatch(reflow, /<h[12][^>]*class="?bl-(zh|en)/, "开头的标题、作者已经在页头，不重复");
    assert.match(h, /<template class="?s1-original-tpl"?>[\s\S]*class="?s1-sheet bl-sheet"?>[\s\S]*class="?bl-tr/);
  });

  test(`${a.slug}：英文页只放说明和原文链接，不放原文全文；中英文页互相链接`, () => {
    const en = read("/en" + p), zh = read(p);
    assert.ok(en.includes(a.source), "英文页要链接原文");
    assert.match(en, new RegExp(`href="?(${BASE})?${p}"?`), "英文页要链到中文页");
    assert.match(zh, new RegExp(`hreflang="?en"? href="?${BASE}/en${p}"?|href="?${BASE}/en${p}"?[^>]*hreflang="?en`), "中文页要有英文页的 hreflang");
    // 原文全文不出现在英文页：任取原文第一段的前 60 个字符
    const first = pairs.split("\npairs:\n")[1].match(/en: (?:\|-?\n\s+)?(.{60})/)[1].replace(/\\/g, "");
    assert.ok(zh.includes(first.replace(/&lt;/g, "&lt;")), "测试前提：中文页有这段原文");
    assert.ok(!en.includes(first), "英文页不应该有原文全文");
    assert.match(en, /href="?mailto:[^"\s>]+@/);
  });
}

test("译文栏目中英文都列出双语译文", () => {
  for (const [list, entry] of [["/translations/", P], ["/en/translations/", "/en" + P]]) {
    assert.ok(read(list).includes(`${BASE}${entry}`), `${list} 没有列出 ${entry}`);
  }
});

// ---------- 读者行为 ----------

for (const engine of ENGINES) {
  test(`${engine}：电脑上首次打开是原版版式，纸面放大到 1.4 倍、不横向滚动；手机上首次打开是重排版`, async (t) => {
    let s = await open(t, engine);
    if (!s) return;
    await s.go(P);
    await until(s.page, () => !document.querySelector(".s1-original").hidden);
    assert.equal(await s.page.locator(".s1-original .s1-sheets-inner").evaluate((e) => +e.style.zoom), 1.4);
    assert.ok(await noHScroll(s.page));
    assert.equal(await s.page.getAttribute(".s1-switch [data-view=original]", "aria-pressed"), "true");
    await s.done();

    s = await open(t, engine, PHONE[engine]);
    await s.go(P);
    assert.equal(await shown(s.page), "reflow");
    assert.ok(await noHScroll(s.page));
    // 手机上切到原版：纸面缩到屏幕宽度，仍然不横向滚动
    await s.page.click(".s1-switch [data-view=original]");
    await until(s.page, () => !document.querySelector(".s1-original").hidden);
    const w = await s.page.locator(".bl-sheet").evaluate((e) => e.getBoundingClientRect().width);
    assert.ok(w <= (await s.page.evaluate(() => innerWidth)), `纸面 ${w}px 超出屏幕`);
    assert.ok(await noHScroll(s.page));
    await s.done();
  });

  test(`${engine}：版式选择刷新后记住（电脑、手机分别记）`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    await s.go(P);
    await s.page.click(".s1-switch [data-view=reflow]");
    assert.equal(await shown(s.page), "reflow");
    await s.go(P);
    assert.equal(await shown(s.page), "reflow");
    await s.page.setViewportSize({ width: 390, height: 800 });
    await s.page.click(".s1-switch [data-view=original]");
    await s.go(P);
    assert.equal(await shown(s.page), "original", "窄屏的选择单独记");
    await s.page.setViewportSize({ width: 1280, height: 800 });
    await s.go(P);
    assert.equal(await shown(s.page), "reflow", "宽屏还是之前选的重排版");
    await s.done();
  });

  test(`${engine}：重排版默认只显示中文；「对照」中英都显示，「English」只显示原文；选择刷新后记住`, async (t) => {
    const s = await open(t, engine, PHONE[engine]);
    if (!s) return;
    await s.go(P);
    assert.equal(await mode(s.page), "zh");
    assert.deepEqual(await visible(s.page), { zh: true, en: false });
    assert.equal(await s.page.getAttribute(".bl-switch [data-set=zh]", "aria-pressed"), "true");
    await s.page.click(".bl-switch [data-set=both]");
    assert.deepEqual(await visible(s.page), { zh: true, en: true });
    await s.page.click(".bl-switch [data-set=en]");
    assert.deepEqual(await visible(s.page), { zh: false, en: true });
    assert.equal(await s.page.getAttribute(".bl-switch [data-set=en]", "aria-pressed"), "true");
    await s.go(P);
    assert.equal(await mode(s.page), "en");
    await s.done();
  });

  test(`${engine}：全屏阅读：按钮进入（网址带 ?read=1、隐藏页头），Esc 退出，后退也退出；翻章、跳页快捷键不出错、不跳走`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    await s.go(P);
    await s.page.click("[data-enter]");
    await until(s.page, () => document.body.classList.contains("s1-immersive"));
    assert.match(s.page.url(), /[?&]read=1/);
    assert.equal(await s.page.locator("header.header").isVisible(), false);
    assert.equal(await s.page.locator(".s1-ibar").isVisible(), true);
    const navs = s.page.navs;
    for (const k of ["[", "]", "g"]) await s.page.keyboard.press(k);
    assert.equal(s.page.navs, navs, "单篇没有上一章/下一章，快捷键不应跳走");
    await s.page.keyboard.press("Escape");
    await until(s.page, () => !document.body.classList.contains("s1-immersive"));
    assert.doesNotMatch(s.page.url(), /read=1/);
    await s.page.click("[data-enter]");
    await until(s.page, () => document.body.classList.contains("s1-immersive"));
    await s.page.goBack();
    await until(s.page, () => !document.body.classList.contains("s1-immersive"));
    await s.done();
  });

  test(`${engine}：全屏阅读里放大、缩小改变纸面缩放，「适应」回到适应宽度；顶栏有下载和版式切换`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    await s.go(P + "?read=1");
    await until(s.page, () => document.body.classList.contains("s1-immersive"));
    const z = () => s.page.locator(".s1-original .s1-sheets-inner").evaluate((e) => +e.style.zoom || 1);
    const z0 = await z();
    await s.page.click(".s1-ibar [data-zoom=in]");
    assert.ok((await z()) > z0);
    await s.page.click(".s1-ibar [data-zoom=out]");
    await s.page.click(".s1-ibar [data-zoom=out]");
    assert.ok((await z()) < z0);
    await s.page.click(".s1-ibar [data-zoom=fit]");
    assert.equal(await z(), z0);
    assert.equal(await s.page.locator(".s1-ibar .s1-dl-line a").count(), 2);
    await s.page.click(".s1-ibar [data-toggle-view]");
    assert.equal(await shown(s.page), "reflow");
    assert.ok(await noHScroll(s.page));
    await s.done();
  });

  test(`${engine}：深色模式下原版纸面不反色（白底黑字、纸面里的文字颜色和浅色模式一样，和 S-1 一样只调暗亮度）`, async (t) => {
    const s = await open(t, engine, { ...DESKTOP, colorScheme: "dark" });
    if (!s) return;
    await s.go(P);
    await until(s.page, () => !document.querySelector(".s1-original").hidden);
    assert.equal(await s.page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(29, 30, 32)", "测试前提：页面是深色");
    const c = await s.page.locator(".bl-sheet").evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color]);
    assert.deepEqual(c, ["rgb(255, 255, 255)", "rgb(0, 0, 0)"]);
    // 纸面里每个元素的文字颜色都和浅色模式一样（只看纸面的 background 不够：标题曾继承主题的浅灰字，白纸上几乎看不见）
    const colors = (page) => page.locator(".bl-sheet").evaluate((e) => [...e.querySelectorAll("*")].map((x) => `${x.tagName} ${getComputedStyle(x).color}`));
    const dark = await colors(s.page);
    await s.done();
    const l = await open(t, engine, DESKTOP);
    await l.go(P);
    await until(l.page, () => !document.querySelector(".s1-original").hidden);
    const light = await colors(l.page);
    assert.ok(light.length > 10, "测试前提：纸面里有正文元素");
    assert.deepEqual(dark, light);
    await l.done();
  });

  test(`${engine}：本机存储被禁用时照常显示和切换`, async (t) => {
    const s = await open(t, engine);
    if (!s) return;
    await s.ctx.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } });
    });
    await s.go(P);
    await until(s.page, () => !document.querySelector(".s1-original").hidden);
    await s.page.click(".s1-switch [data-view=reflow]");
    await s.page.click(".bl-switch [data-set=both]");
    assert.deepEqual(await visible(s.page), { zh: true, en: true });
    // PaperMod 自己的深色模式脚本不防存储被禁用，会各报一次错；本站脚本的错误不放过（本页的初始化脚本跑完会加上 bl-js）
    assert.equal(await s.page.locator(".bl-article.bl-js").count(), 1);
    const theirs = s.errors.filter((e) => /localStorage|blocked|denied/i.test(e.message) && !/\/js\/s1\./.test(e.stack || ""));
    assert.ok(theirs.length <= 2, theirs.map((e) => e.stack).join("\n"));
    s.errors.splice(0, Infinity, ...s.errors.filter((e) => !theirs.includes(e)));
    await s.done();
  });
}

test("不开脚本：显示重排版的中英对照，不显示切换条；声明可展开", async (t) => {
  const s = await open(t, "chromium", { ...DESKTOP, javaScriptEnabled: false });
  await s.go(P);
  assert.deepEqual(await visible(s.page), { zh: true, en: true });
  assert.equal(await s.page.locator(".bl-switch").isVisible(), false);
  assert.equal(await s.page.locator(".s1-original").isVisible(), false);
  await s.page.click(".s1-notice-short summary .s1-more");
  await s.page.locator(".s1-notice-short a[href^='mailto:']").waitFor({ state: "visible", timeout: 3000 });
  await s.done();
});

for (const [name, opts] of [["手机", PHONE.chromium], ["电脑（默认原版、也记住了原版）", DESKTOP]]) {
  test(`段落链接：${name}带 #p3 打开时显示重排版，第 3 段在视口里；不改读者记住的版式`, async (t) => {
    const s = await open(t, "chromium", opts);
    if (opts === DESKTOP) {
      await s.go(P);
      await s.page.click(".s1-switch [data-view=original]");
      await s.go("/translations/"); // 只改 #片段 的跳转不会重新加载页面，先离开
    }
    await s.go(P + "#p3");
    assert.equal(await shown(s.page), "reflow");
    // 滚动位置按设备像素取整，段落顶边可能落在 -0.x px
    await until(s.page, () => { const t = document.getElementById("p3").getBoundingClientRect().top; return t >= -1 && t < 200; });
    if (opts === DESKTOP) {
      await s.go(P);
      assert.equal(await shown(s.page), "original", "不带段落链接时还是读者选的原版");
    }
    await s.done();
  });
}

// 样例 tests/theme/site-fixture/content/translations/sample-essay（经 tests/hugo.test.yaml 挂进测试站）：最后一段没有译文
test("没有译文的段落：「中文」档也显示原文，「English」档照常显示", async (t) => {
  const s = await open(t, "chromium", PHONE.chromium);
  await s.go("/translations/sample-essay/");
  assert.equal(await mode(s.page), "zh");
  const untr = s.page.locator(".bl-pair.bl-untr");
  assert.equal(await untr.count(), 1);
  assert.equal(await untr.locator(".bl-zh").count(), 0);
  assert.equal(await untr.locator(".bl-en").isVisible(), true);
  assert.match(await untr.textContent(), /No translation here\./);
  // 有译文的段落在「中文」档仍然只显示中文
  assert.deepEqual(await visible(s.page), { zh: true, en: false });
  await s.page.click(".bl-switch [data-set=en]");
  assert.equal(await untr.locator(".bl-en").isVisible(), true);
  await s.done();
});
