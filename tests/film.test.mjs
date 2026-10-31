// 短片（docs/films.md）：短片文章的播放区（layouts/_partials/film_stage.html、extend_footer.html 的短片脚本）、
// 原样发布的播放器（layouts/_partials/film.html、assets/js/film-bridge.js）、可下载的 MP4、短文时间线和「短片」次级栏目。
// 用真实的短片（assets/films/anthropic-money-power）测：静态检查不开浏览器；交互用 Chromium 和 WebKit（本地没装 WebKit 时跳过）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium, webkit } from "playwright";
import { build, serve, root } from "./helpers.mjs";

const NAME = "anthropic-money-power";
const SRC = join(root, "assets/films", NAME);
const PAGE = { zh: "/notes/who-controls-anthropic/", en: "/en/notes/who-controls-anthropic/" };
const PLAY = `films/${NAME}/play/`;
const PROD = "https://douseful.eu.org/";

let site, server;
const browsers = {};
const read = (p) => readFileSync(join(site.out, p.replace(/^\//, ""), p.endsWith("/") ? "index.html" : ""), "utf8");
before(async () => {
  site = build();
  server = await serve(site.out);
  browsers.chromium = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

// ---------- 静态检查 ----------

test("短片自包含：不引用外部样式、脚本、字体，引用的本地文件都在；不碰博客页面（window.parent 只用来 postMessage）", () => {
  const html = readFileSync(join(SRC, "index.html"), "utf8");
  assert.doesNotMatch(html, /<(link|script)[^>]+(href|src)=["']?(https?:)?\/\//i, "不能引用外部样式和脚本");
  assert.doesNotMatch(html, /@import|fonts\.googleapis|url\(["']?https?:/i, "不能引用外部字体或图片");
  assert.doesNotMatch(html, /top\.location|parent\.(document|location)|window\.top/, "不直接访问博客页面");
  const audio = readdirSync(join(SRC, "narration")).filter((f) => f.endsWith(".mp3"));
  const en = readdirSync(join(SRC, "narration/en")).filter((f) => f.endsWith(".mp3"));
  const cues = JSON.parse(html.match(/const AUD=(\{.*?\})/)[1]);
  assert.equal(audio.length, cues.zh.length, "每句一个中文配音文件");
  assert.equal(en.length, cues.en.length, "每句一个英文配音文件");
});

test("播放器原样发布到 films/<名字>/play/，只在 <head> 插入 noindex、指向短片文章的 canonical、关掉 iOS 文字放大和桥接脚本", () => {
  const out = read(PLAY);
  const src = readFileSync(join(SRC, "index.html"), "utf8");
  const head = out.slice(0, out.indexOf("</script>") + 9);
  assert.match(head, /<meta name="robots" content="noindex">/);
  assert.match(head, new RegExp(`<link rel="canonical" href="${PROD}notes/who-controls-anthropic/">`));
  assert.match(head, /html\{-webkit-text-size-adjust:100%;text-size-adjust:100%\}/);
  assert.match(head, /film:embed/, "桥接脚本能按博客的要求改 data-embed（iPhone 上铺满窗口）");
  assert.equal(out.replace(/<meta name="robots"[\s\S]*?<\/script>/, ""), src, "除了插入的部分，短片一字不改");
  assert.ok(site.exists(`${PLAY}narration/000.mp3`) && site.exists(`${PLAY}narration/en/000.mp3`), "配音随播放器发布");
  assert.ok(!site.exists(`${PLAY}poster.png`), "封面原图不发布（缩成 WebP）");
});

test("可下载的 MP4：中英文各一份，H.264 + AAC，单个文件不超过 Cloudflare Pages 的 25 MiB；文章里是直链下载卡片，文件名是文章标题", () => {
  for (const [lang, file, title] of [["zh", "video.mp4", "谁在控制 Anthropic"], ["en", "video.en.mp4", "Who Controls Anthropic"]]) {
    const bytes = statSync(join(site.out, PLAY, file)).size;
    assert.ok(bytes > 5 * 2 ** 20 && bytes <= 25 * 2 ** 20, `${file} ${bytes} 字节`);
    const head = readFileSync(join(site.out, PLAY, file)).subarray(0, 64).toString("latin1");
    assert.match(head, /ftyp/, `${file} 是 MP4`);
    const html = read(PAGE[lang]);
    const card = html.match(/<div class="?s1-dl-cards film-dl"?>([\s\S]*?)<\/div>\s*<\/div>/)?.[1];
    assert.ok(card, `${lang} 页面有下载卡片`);
    assert.match(card, new RegExp(`href=/?${PLAY.replace(/\//g, "\\/")}${file.replace(".", "\\.")} download="?${title}\\.mp4"?`));
    assert.match(card, new RegExp(`<small>${Math.round(bytes / 2 ** 20)} MB</small>`), "写明大小");
  }
});

test("文章页：播放器跳出正文栏，章节目录（PaperMod 的 details.toc，默认展开）条目和文字稿的三级标题一一对应、顺序一致", () => {
  for (const lang of ["zh", "en"]) {
    const html = read(PAGE[lang]);
    assert.match(html, /<div class="?film-stage"? id="?film-stage"?>/);
    assert.match(html, new RegExp(`<iframe class="?film-frame"? src="?/${PLAY}\\?${lang === "en" ? "lang=en&amp;embed=page" : "embed=page"}`));
    assert.doesNotMatch(html.match(/<iframe class="?film-frame[^>]*>/)[0], /loading=/, "播放器不延后加载");
    const toc = html.match(/<details class="?toc film-toc"? open>([\s\S]*?)<\/details>/)?.[1];
    assert.ok(toc, `${lang} 有展开的章节目录`);
    const items = [...toc.matchAll(/<a href="?#([^" >]+)"?>/g)].map((m) => decodeURIComponent(m[1]));
    const transcript = html.split(/id="?transcript"?/)[1];
    const heads = [...transcript.matchAll(/<h3 id="?([^" >]+)"?/g)].map((m) => m[1]);
    assert.deepEqual(items, heads);
    const scenes = (readFileSync(join(SRC, "index.html"), "utf8").match(/\bdraw\s*[:(]/g) || []).length;
    assert.equal(items.length, 12, "短片有 12 章");
    assert.ok(scenes >= 12, "短片的场景数不少于章节数");
    assert.match(toc, /<button type="?button"? class="?film-seek"? data-chapter="?0"?[^>]*hidden>/, "「从这里播放」默认隐藏，有脚本才出现");
    assert.match(html, /<button type="?button"? class="?film-start"?[^>]*hidden>/, "画面上的大播放键默认隐藏，有脚本才出现");
  }
});

test("短文时间线和「短片」次级栏目：短片文章只放导语和封面（链接到文章，标着「短片 · 时长」），不放播放器；短文 RSS 收录它", () => {
  for (const [lang, prefix, badge] of [["zh", "", "▶ 短片 · 约 14 分钟"], ["en", "en/", "▶ Film · about 15 min"]]) {
    for (const list of [`${prefix}notes/`, `${prefix}notes/films/`]) {
      let html = "";
      for (let n = 1; ; n++) { const p = n === 1 ? list : `${list}page/${n}/`; if (!site.exists(`${p}index.html`)) break; html += read(p); }
      const entry = html.split(/<article class="?note-entry"?>/).find((e) => e.includes(`${PROD}${prefix}notes/who-controls-anthropic/`));
      assert.ok(entry, `${list} 里有短片文章`);
      assert.match(entry, new RegExp(`<a class="?film-cover"? href="?${PROD}${prefix}notes/who-controls-anthropic/"?`));
      assert.ok(entry.includes(`<span class="film-badge">${badge}</span>`) || entry.includes(`<span class=film-badge>${badge}</span>`), `${list} 封面上写着 ${badge}`);
      assert.ok(!entry.includes("<iframe"), "列表里不放播放器");
    }
    assert.match(read(`${prefix}notes/index.xml`), new RegExp(`<link>${PROD}${prefix}notes/who-controls-anthropic/</link>`), "短文 RSS 收录次级栏目里的文章");
  }
});

// ---------- 浏览器 ----------

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function open(t, engine, opts = {}, init) {
  const b = browsers[engine];
  if (!b) { t.skip(`${engine} 没装`); return null; }
  const ctx = await b.newContext(engine === "webkit" ? { ...opts, isMobile: undefined } : opts);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors, done: async () => { assert.deepEqual(errors, []); await ctx.close(); } };
}
const film = (page) => page.frames().find((f) => f.url().includes(`/${PLAY}`));
const filmTime = async (page) => (await film(page).locator(".ctrls .time").textContent()).split("/")[0].trim();
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 15000 });

for (const engine of ["chromium", "webkit"]) {
  test(`${engine}：播放器加载后撑开到短片报来的高度，目录写上每章开始时间；大播放键开播，并把播放器连同控制条滚进屏幕`, async (t) => {
    const s = await open(t, engine, PHONE);
    if (!s) return;
    await s.page.goto(server.url + PAGE.zh);
    await until(s.page, () => document.querySelectorAll(".film-seek .film-at")[11]?.textContent.length === 5);
    const at = await s.page.locator(".film-seek .film-at").allTextContents();
    assert.equal(at[0], "00:00");
    assert.deepEqual([...at].sort(), at, "开始时间递增");
    const frame = await s.page.locator(".film-frame").boundingBox();
    const inner = await film(s.page).evaluate(() => Math.ceil(document.documentElement.getBoundingClientRect().height));
    assert.ok(Math.abs(frame.height - inner) <= 1, `iframe 高 ${frame.height}，短片 ${inner}`);
    assert.ok(await s.page.locator(".film-start").isVisible());
    await s.page.click(".film-start");
    await until(s.page, () => !document.querySelector(".film-start"));
    if (engine === "chromium") await film(s.page).waitForFunction(() => document.querySelector("#play").textContent.includes("暂停"), null, { timeout: 15000 });
    await s.page.waitForTimeout(800);
    const box = await s.page.locator(".film-frame").boundingBox();
    assert.ok(box.y >= -1 && box.y + box.height <= 844 + 1, `播放器在屏幕内：${box.y}–${box.y + box.height}`);
    await s.done();
  });

  test(`${engine}：章节目录的「从这里播放」跳到那一章的开始`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 } });
    if (!s) return;
    await s.page.goto(server.url + PAGE.zh);
    await until(s.page, () => document.querySelectorAll(".film-seek .film-at")[4]?.textContent.length === 5);
    const want = await s.page.locator(".film-seek .film-at").nth(4).textContent();
    await s.page.click('.film-seek[data-chapter="4"]');
    await film(s.page).waitForFunction(() => /^05 /.test(document.querySelector(".chap")?.textContent || ""), null, { timeout: 15000 });
    const got = await filmTime(s.page);
    const sec = (x) => +x.slice(0, 2) * 60 + +x.slice(3);
    assert.ok(Math.abs(sec(got) - sec(want)) <= 2, `从 ${want} 开始，实际 ${got}`);
    await s.done();
  });

  test(`${engine}：浏览器不能让元素全屏时（iPhone），短片的「全屏」把播放器铺满窗口，进度不丢；「退出」、返回键、Esc 都回到原处`, async (t) => {
    const noFs = () => {
      for (const k of ["fullscreenEnabled", "webkitFullscreenEnabled"]) Object.defineProperty(Document.prototype, k, { get: () => false, configurable: true });
    };
    const s = await open(t, engine, PHONE, noFs);
    if (!s) return;
    await s.page.goto(server.url + PAGE.zh);
    await until(s.page, () => document.querySelectorAll(".film-seek .film-at")[2]?.textContent.length === 5);
    await s.page.click('.film-seek[data-chapter="2"]');
    await film(s.page).waitForFunction(() => /^03 /.test(document.querySelector(".chap")?.textContent || ""), null, { timeout: 15000 });
    await s.page.waitForTimeout(1000); // 等「从这里播放」把播放器平滑滚进屏幕
    const y = await s.page.evaluate(() => scrollY);
    for (const how of ["退出", "返回键", "Esc"]) {
      const fs = film(s.page).locator("#fs");
      assert.ok(await fs.isVisible(), "iPhone 上也有「全屏」");
      await fs.click();
      await until(s.page, () => document.body.classList.contains("film-watch"));
      await film(s.page).waitForFunction(() => document.documentElement.dataset.embed === "fit");
      const box = await s.page.locator(".film-frame").boundingBox();
      assert.ok(box.y >= 44 && box.y <= 46 && Math.abs(box.y + box.height - 844) <= 1 && box.width === 390, `铺满窗口（顶栏下面）：${JSON.stringify(box)}`);
      assert.match(await film(s.page).locator(".chap").textContent(), /^03 /, "进度不丢");
      const bar = await s.page.locator(".film-wbar-exit").boundingBox();
      assert.ok(bar.width >= 44 && bar.height >= 44, "「退出」点按区不小于 44px");
      if (how === "退出") await s.page.click(".film-wbar-exit");
      if (how === "返回键") await s.page.goBack();
      if (how === "Esc") { await s.page.locator("body").press("Escape"); }
      await until(s.page, () => !document.body.classList.contains("film-watch"));
      await film(s.page).waitForFunction(() => document.documentElement.dataset.embed === "page");
      assert.equal(new URL(s.page.url()).pathname, PAGE.zh, `${how}后还在文章页`);
      { const now = await s.page.evaluate(() => scrollY); assert.ok(Math.abs(now - y) <= 2, `${how}后回到原来的位置：${y} → ${now}`); }
      assert.match(await film(s.page).locator(".chap").textContent(), /^03 /, `${how}后进度不丢`);
    }
    await s.done();
  });

  test(`${engine}：手机上短片的控制按钮排成一行，触屏上点按区不小于 44px（中英文，375 和 390 宽）`, async (t) => {
    for (const width of [375, 390]) for (const lang of ["zh", "en"]) {
      const s = await open(t, engine, { ...PHONE, viewport: { width, height: 800 } });
      if (!s) return;
      await s.page.goto(server.url + PAGE[lang]);
      await until(s.page, () => document.querySelectorAll(".film-seek .film-at")[0]?.textContent.length === 5);
      const r = await film(s.page).evaluate(() => [...document.querySelectorAll(".ctrls button")].filter((b) => !b.hidden && b.offsetParent)
        .map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent || b.getAttribute("aria-label"), top: Math.round(r.top), w: r.width, h: r.height, coarse: matchMedia("(pointer: coarse)").matches }; }));
      assert.equal(new Set(r.map((b) => b.top)).size, 1, `${lang} ${width}：${JSON.stringify(r)}`);
      // 触屏（pointer: coarse）上不小于 44px；WebKit 的模拟不一定报触屏，那时按鼠标的 36px 查
      for (const b of r) assert.ok(b.w >= 44 && b.h >= (b.coarse ? 44 : 36), `${lang} ${width}：${b.t} ${b.w}×${b.h}`);
      await s.done();
    }
  });

  test(`${engine}：深色模式跟着博客切换；关掉脚本时播放器位置显示封面，没有点了没用的按钮`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 } });
    if (!s) return;
    await s.page.goto(server.url + PAGE.zh);
    await until(s.page, () => document.querySelectorAll(".film-seek .film-at")[0]?.textContent.length === 5);
    await s.page.evaluate(() => document.querySelector("#theme-toggle").click());
    const theme = await s.page.evaluate(() => document.documentElement.dataset.theme || (document.body.classList.contains("dark") ? "dark" : "light"));
    await film(s.page).waitForFunction((t) => document.documentElement.dataset.theme === t, theme);
    await s.done();
    const n = await open(t, engine, { viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
    await n.page.goto(server.url + PAGE.zh);
    assert.ok(await n.page.locator(".film-still").isVisible(), "没有脚本时显示封面");
    assert.equal(await n.page.locator(".film-start:visible, .film-seek:visible").count(), 0);
    assert.ok(await n.page.locator(".film-dl a[download]").isVisible(), "下载照常可用");
    await n.done();
  });
}
