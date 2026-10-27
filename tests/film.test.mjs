// 短片（docs/films.md）：发布结果、封面卡片、全窗口放映、短片页，以及 assets/films/ 里每部真实短片的约定
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { build, serve, root } from "./helpers.mjs";

let site, server, browser;
before(async () => {
  site = build();
  server = await serve(site.out);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); site?.remove(); });

const read = (p) => readFileSync(join(site.out, p), "utf8");
const source = readFileSync(join(root, "tests/fixtures/assets/films/test-film/index.html"), "utf8");

async function open(path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(server.url + path, { waitUntil: "load" });
  return { page, ctx, errors };
}
const film = (page) => page.frameLocator(".film-dialog iframe");
const dialogOpen = (page) => page.evaluate(() => !!document.querySelector(".film-dialog")?.open);

// ---------- 构建结果 ----------

test("播放器原样发布到 /films/<名字>/play/，只在 <head> 开头插入 noindex、canonical 和桥接脚本", () => {
  const html = read("films/test-film/play/index.html");
  const m = html.match(/^<!doctype html>\s*<html lang="zh">\s*<head>(<meta name="robots" content="noindex"><link rel="canonical" href="([^"]+)"><script>.+?<\/script>)/s);
  assert.ok(m, "head 开头应该依次是 noindex、canonical、桥接脚本");
  assert.equal(m[2], "https://douseful.eu.org/notes/film-note/", "canonical 指向默认语言的短片文章");
  assert.match(m[1], /film:ready/);
  assert.equal(html.replace(m[1], ""), source, "除了插入的部分，短片文件一字不改");
});

test("短片引用的文件按原来的相对路径发布，poster 只以 WebP 封面发布", () => {
  assert.equal(read("films/test-film/play/media/still.svg"), readFileSync(join(root, "tests/fixtures/assets/films/test-film/media/still.svg"), "utf8"));
  assert.ok(!site.exists("films/test-film/play/poster.png"), "原始 poster.png 不上线");
  const webp = readdirSync(join(site.out, "films/test-film")).filter((f) => f.endsWith(".webp"));
  assert.equal(webp.length, 1);
});

for (const [lang, prefix, title, play] of [["中文", "", "【测试】短片", "/films/test-film/play/"], ["英文", "/en", "[Test] Film", "/films/test-film/play/?lang=en"]]) {
  test(`${lang}别的文章里引用短片：封面卡片是指向短片文章的链接，带封面、标题和时长`, async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(server.url + `${prefix}/notes/film-ref/`);
    const a = page.locator(".post-content a.film-open");
    assert.equal(await a.getAttribute("href"), `${prefix}/notes/film-note/`);
    assert.equal(await a.getAttribute("data-play"), play, "播放地址：英文页在语言不同时带 ?lang=en");
    assert.match(await a.locator("img").getAttribute("src"), /^\/films\/test-film\/poster_hu_[0-9a-f]+\.webp$/);
    assert.equal(await page.locator(".film-cover figcaption strong").textContent(), title, "标题取自对应语言的短片文章");
    assert.match(await page.locator(".film-cover figcaption span").textContent(), lang === "中文" ? /^约 2 分钟$/ : /^about 2 min/);
    assert.equal(await a.getAttribute("tabindex"), "-1", "封面和「播放短片」做同一件事，封面不进 Tab 顺序");
    // 封面下面一排按钮：播放短片（和封面同一个链接）、阅读文字稿（短片文章的 #transcript）
    const btns = page.locator(".film-acts a");
    assert.deepEqual(await btns.allTextContents(), lang === "中文" ? ["播放短片", "阅读文字稿"] : ["Play the film", "Read the transcript"]);
    assert.equal(await btns.nth(0).getAttribute("href"), `${prefix}/notes/film-note/`);
    assert.equal(await btns.nth(0).getAttribute("data-play"), play);
    assert.equal(await btns.nth(1).getAttribute("href"), `${prefix}/notes/film-note/#transcript`);
    // 没有脚本时点「阅读文字稿」打开短片文章并停在文字稿；点封面就是打开短片文章
    await btns.nth(1).click();
    await page.waitForURL(`**${prefix}/notes/film-note/#transcript`);
    assert.equal((await page.locator("#transcript").textContent()).replace(/#$/, "").trim(), lang === "中文" ? "文字稿" : "Transcript");
    await page.goBack();
    await a.click();
    await page.waitForURL(`**${prefix}/notes/film-note/`);
    await ctx.close();
  });

  test(`${lang}短片文章：导语、原地的沙箱播放器、章节目录、文字稿都在一页；没有脚本时显示封面`, async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(server.url + `${prefix}/notes/film-note/`);
    const frame = page.locator(".post-content .film-stage iframe.film-frame");
    assert.equal(await frame.getAttribute("src"), play.includes("?") ? `${play}&embed=page` : `${play}?embed=page`);
    const sandbox = await frame.getAttribute("sandbox");
    assert.ok(!sandbox.includes("allow-same-origin"), "短片和博客不同源，碰不到博客的页面和存储");
    assert.match(sandbox, /allow-scripts/);
    assert.equal(await frame.isVisible(), false, "没有脚本时短片放不了，不显示空的播放器");
    assert.equal(await page.locator(".film-still").isVisible(), true, "没有脚本时显示封面");
    assert.equal(await page.locator(".post-content .film-cover").count(), 0, "短片自己的文章里不放封面卡片");
    // 顺序：导语 → 播放器 → 章节目录 → 文字稿
    const order = await page.evaluate(() => [".post-content > p", ".film-stage", ".film-chapters", "#transcript"].map((s) => document.querySelector(s).getBoundingClientRect().top));
    assert.deepEqual([...order].sort((x, y) => x - y), order);
    assert.equal(await page.locator(".film-chapters").getAttribute("open"), null, "章节目录默认折叠");
    assert.deepEqual(await page.locator(".film-chapters li a").allTextContents(), lang === "中文" ? ["01 第一段", "02 第二段"] : ["01 Part one", "02 Part two"]);
    assert.equal(decodeURIComponent(await page.locator(".film-chapters li a").first().getAttribute("href")), "#" + (await page.locator(".post-content h3").first().getAttribute("id")));
    assert.equal(await page.locator(".film-seek").first().isHidden(), true, "「从这里播放」要靠脚本，没有脚本时不显示");
    await ctx.close();
  });

  test(`${lang}以前的短片页地址跳到短片文章`, async () => {
    assert.match(read(`${prefix.slice(1)}${prefix ? "/" : ""}films/test-film/index.html`), new RegExp(`url=https://douseful\\.eu\\.org${prefix}/notes/film-note/`));
  });
}

test("短片的文章在短文列表里只显示导语和封面卡片，播放器和文字稿在文章页", async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(server.url + "/notes/");
  const entry = page.locator(".note-entry", { has: page.locator('a[href$="/notes/film-note/"]') }).first();
  assert.match(await entry.locator(".note-body").textContent(), /短片文章的导语/);
  assert.equal(await entry.locator(".film-cover").count(), 1);
  assert.equal(await entry.locator("iframe, #transcript, .film-chapters").count(), 0);
  assert.equal(await entry.locator(".film-cover figcaption strong").count(), 0, "标题就在条目上面，卡片里不重复");
  assert.equal(await entry.locator(".film-acts a").nth(1).getAttribute("href"), "/notes/film-note/#transcript");
  await ctx.close();
});

// ---------- 交互 ----------

test("点封面在全窗口对话框里放映：沙箱 iframe、embed=fit、深浅色跟随博客", async () => {
  const { page, ctx, errors } = await open("/notes/film-ref/");
  await page.click(".film-open");
  assert.equal(await dialogOpen(page), true);
  const frame = page.locator(".film-dialog iframe");
  assert.match(await frame.getAttribute("src"), /\/films\/test-film\/play\/\?embed=fit&autoplay=1$/, "读者已经点过播放，短片直接开播");
  assert.ok(!(await frame.getAttribute("sandbox")).includes("allow-same-origin"));
  await film(page).locator("#theme").filter({ hasText: "light" }).waitFor();
  assert.equal(await film(page).locator("html").getAttribute("data-embed"), "fit");
  assert.equal(await film(page).locator("header").isVisible(), false, "嵌入时短片可以只显示播放器");
  // 切换博客的深浅色，短片跟着变
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await film(page).locator("#theme").filter({ hasText: "dark" }).waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), "hidden", "放映时正文不滚动");
  await film(page).locator("#play").filter({ hasText: "暂停" }).waitFor();
  await page.waitForFunction(() => document.activeElement?.matches(".film-dialog iframe"), null, { timeout: 2000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("返回键先关掉短片，留在原文原处", async () => {
  const { page, ctx } = await open("/notes/film-ref/", { viewport: { width: 1280, height: 500 } });
  await page.evaluate(() => scrollTo(0, 200));
  const url = page.url();
  await page.click(".film-open");
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector(".film-dialog").open);
  assert.equal(page.url(), url);
  assert.equal(await page.evaluate(() => scrollY), 200);
  assert.equal(await page.locator(".film-dialog iframe").count(), 0, "关闭时移除短片，声音随之停止");
  await ctx.close();
});

test("关掉再打开，返回键按一下就关（每次放映换新的 iframe，不多记历史）", async () => {
  const { page, ctx } = await open("/notes/film-ref/");
  const url = page.url();
  for (let i = 0; i < 2; i++) {
    await page.click(".film-play-btn");
    await film(page).locator("#play").filter({ hasText: "暂停" }).waitFor();
    if (i === 0) { await page.click(".film-close"); await page.waitForFunction(() => history.state === null); }
  }
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector(".film-dialog").open);
  assert.equal(page.url(), url);
  await ctx.close();
});

test("记住看到第几句，再打开接着放；放完显示「重看」「文字稿」，重看从头开始", async () => {
  const { page, ctx } = await open("/notes/film-ref/");
  await page.click(".film-play-btn");
  await film(page).locator("#next").click();
  await film(page).locator("#next").click();
  await page.click(".film-close");
  await page.click(".film-play-btn");
  assert.match(await page.locator(".film-dialog iframe").getAttribute("src"), /&at=2$/);
  await film(page).locator("#at").filter({ hasText: "第 2 句" }).waitFor();
  assert.equal(await page.locator(".film-end").isVisible(), false);
  await film(page).locator("#end").click();
  await page.locator(".film-end").waitFor();
  await page.waitForFunction(() => document.activeElement?.matches(".film-again"));
  assert.equal(await page.locator(".film-end .film-tab").getAttribute("href"), "/notes/film-note/#transcript");
  await page.click(".film-again");
  await film(page).locator("#at").filter({ hasText: "第 0 句" }).waitFor();
  assert.doesNotMatch(await page.locator(".film-dialog iframe").getAttribute("src"), /at=/);
  assert.equal(await page.locator(".film-end").isVisible(), false);
  await ctx.close();
});

test("关闭按钮、短片里按 Esc 都能关闭，焦点回到「播放短片」按钮，历史记录不多出一条", async () => {
  const { page, ctx } = await open("/notes/film-ref/");
  const depth = await page.evaluate(() => history.length);
  const onPlayButton = () => page.waitForFunction(() => document.activeElement.classList.contains("film-play-btn"), null, { timeout: 2000 });
  await page.click(".film-play-btn");
  assert.equal(await dialogOpen(page), true, "「播放短片」按钮和封面一样在对话框里放映");
  await page.click(".film-close");
  assert.equal(await dialogOpen(page), false);
  await page.waitForFunction((n) => history.length === n + 1 && history.state === null, depth);
  await onPlayButton();

  await page.click(".film-open"); // 从封面打开，焦点也回到按钮（封面不进 Tab 顺序）
  await film(page).locator("#play").click(); // 焦点进入短片
  await film(page).locator("#play").press("Escape");
  await page.waitForFunction(() => !document.querySelector(".film-dialog").open);
  await onPlayButton(); // dialog 的 close 事件在 close() 之后才派发，焦点稍后才回来
  await ctx.close();
});

test("键盘：Tab 在卡片上只停「播放短片」和「阅读文字稿」两处，回车放映", async () => {
  const { page, ctx } = await open("/notes/film-ref/");
  await page.evaluate(() => document.querySelector(".film-cover").insertAdjacentHTML("beforebegin", '<a id="before" href="#">x</a>'));
  await page.focus("#before");
  const stops = [];
  for (let i = 0; i < 2; i++) { await page.keyboard.press("Tab"); stops.push(await page.evaluate(() => document.activeElement.textContent)); }
  assert.deepEqual(stops, ["播放短片", "阅读文字稿"]);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  assert.equal(await dialogOpen(page), true);
  await ctx.close();
});

test("从对话框去短片页后按返回，直接回到原文（不多出一条历史记录）", async () => {
  const { page, ctx } = await open("/notes/film-ref/");
  const note = page.url();
  await page.click(".film-play-btn");
  await page.click(".film-bar .film-tab");
  await page.waitForURL("**/notes/film-note/#transcript");
  await page.goBack();
  await page.waitForURL(note);
  assert.equal(await page.evaluate(() => !!document.querySelector(".film-dialog")?.open), false);
  await ctx.close();
});

test("Ctrl/⌘/Shift 点击、中键不拦截，照常在新标签打开短片页", async () => {
  const { page, ctx } = await open("/notes/film-ref/");
  const prevented = await page.evaluate(() => {
    const a = document.querySelector(".film-open"), out = [];
    document.addEventListener("click", (e) => { out.push(e.defaultPrevented); e.preventDefault(); });
    for (const k of ["ctrlKey", "metaKey", "shiftKey"]) a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, [k]: true }));
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }));
    return out;
  });
  assert.deepEqual(prevented, [false, false, false, false]);
  assert.equal(await dialogOpen(page), false);
  await ctx.close();
});

for (const [name, viewport] of [["电脑", { width: 1280, height: 800 }], ["手机", { width: 390, height: 844 }]]) {
  test(`${name}：短片文章里的播放器按短片报来的高度撑开，比正文宽，整个放得进一屏，没有横向滚动`, async () => {
    const { page, ctx, errors } = await open("/notes/film-note/", { viewport });
    const frame = page.frameLocator("iframe.film-frame");
    await frame.locator("html[data-embed=page]").waitFor({ state: "attached" });
    // 测试短片嵌入时只剩播放器：16:9 的画面加 56px 的控制条
    const want = await frame.locator(".player").evaluate((e) => Math.ceil(e.getBoundingClientRect().height));
    assert.equal(want, Math.ceil(await page.locator("iframe.film-frame").evaluate((f) => f.clientWidth * 9 / 16 + 56)));
    await page.waitForFunction((h) => document.querySelector("iframe.film-frame").getBoundingClientRect().height === h, want);
    const [stage, text] = await page.evaluate(() => [".film-stage", ".post-content"].map((s) => document.querySelector(s).getBoundingClientRect().width));
    if (viewport.width > 1000) assert.ok(stage > text + 200, `播放器 ${stage}px 应明显宽于正文 ${text}px`);
    assert.ok(want <= viewport.height, `播放器高 ${want}px，超过窗口 ${viewport.height}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test("短片文章里，章节目录的「从这里播放」让播放器从那一章开播", async () => {
  const { page, ctx, errors } = await open("/notes/film-note/", { viewport: { width: 1280, height: 600 } });
  const frame = page.frameLocator(".film-stage iframe");
  await frame.locator("html[data-embed=page]").waitFor({ state: "attached" });
  await page.locator(".film-chapters summary").click();
  const seek = page.locator(".film-seek").nth(1);
  assert.equal(await seek.getAttribute("aria-label"), "从这里播放：02 第二段");
  await seek.click();
  await frame.locator("#at").filter({ hasText: "第 1 章" }).waitFor();
  await frame.locator("#play").filter({ hasText: "暂停" }).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("真实短片：文章里的「从这里播放」跳到对应章节", async () => {
  for (const [slug] of filmNotes()) {
    const { page, ctx, errors } = await open(`/notes/${slug}/`);
    const frame = page.frameLocator(".film-stage iframe");
    await frame.locator("svg").first().waitFor();
    await page.locator(".film-chapters summary").click();
    const n = await page.locator(".film-seek").count();
    await page.locator(".film-seek").nth(n - 1).click();
    await frame.locator("#chap").filter({ hasText: new RegExp("^" + String(n).padStart(2, "0")) }).waitFor();
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test("真实短片在手机横屏全窗口放映时，画面占屏幕一半以上，控制条在屏幕内", async () => {
  for (const [slug] of filmNotes()) {
    const { page, ctx } = await open("/notes/", { viewport: { width: 844, height: 390 } });
    await card(page, slug).locator(".film-open").click();
    const frame = page.frameLocator(".film-dialog iframe");
    await frame.locator("svg").first().waitFor();
    const r = await frame.locator("body").evaluate(() => {
      const svg = document.querySelector("svg").getBoundingClientRect();
      const last = [...document.querySelectorAll("button")].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().bottom);
      return { svg: svg.height, vh: innerHeight, bottom: Math.max(...last) };
    });
    assert.ok(r.svg >= r.vh / 2, `${slug}：画面高 ${r.svg}，窗口高 ${r.vh}`);
    assert.ok(r.bottom <= r.vh, `${slug}：控制条底边 ${r.bottom} 超出窗口 ${r.vh}`);
    await ctx.close();
  }
});

// 引用了短片的真实文章（中文 index.md 里有 film 短代码），返回 [slug, 短片名]
const filmNotes = () => readdirSync(join(root, "content/notes")).flatMap((d) => {
  const f = join(root, "content/notes", d, "index.md");
  const md = existsSync(f) ? readFileSync(f, "utf8") : "";
  const name = md.match(/^film:\s*(\S+)/m)?.[1];
  return name ? [[md.match(/^slug:\s*(\S+)/m)?.[1] ?? d, name, d]] : [];
});
// 短文列表里这部短片的封面卡片（短片自己的文章里是原地播放器，卡片在列表里）
const card = (page, slug) => page.locator(".note-entry", { has: page.locator(`a[href$="/notes/${slug}/"]`) }).first();

test("真实短片：播放器滚出视线、标签页在后台（没有动画帧）时，配音和画面照样往下走", async () => {
  for (const [slug] of filmNotes()) {
    const { page, ctx, errors } = await open("/notes/");
    // 浏览器不给看不见的 iframe 动画帧：在短片里把 requestAnimationFrame 换成什么都不做
    await ctx.addInitScript(() => { if (window !== top) window.requestAnimationFrame = () => 0; });
    await card(page, slug).locator(".film-play-btn").click();
    const frame = film(page);
    const cap = await frame.locator("#cap").textContent();
    await frame.locator("#cap").filter({ hasNotText: cap }).waitFor({ timeout: 30000 });
    assert.notEqual(await frame.locator("#time").textContent(), "00:00 / " + (await frame.locator("#time").textContent()).split(" / ")[1]);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test("真实短片在英文页里放英文版：地址带 lang=en，画面、字幕、按钮都没有中文，配音按英文文件加载", async () => {
  for (const [slug, name, dir] of filmNotes()) {
    const filmLang = readFileSync(join(root, "content/notes", dir, "index.en.md"), "utf8").match(/^filmLang:\s*(\S+)/m)?.[1];
    if (filmLang === "en") continue;
    const { page, ctx, errors } = await open("/en/notes/", { viewport: { width: 1280, height: 800 } });
    const audio = [];
    page.on("response", (r) => { if (/\.(mp3|m4a|mp4|ogg|opus|wav)$/.test(new URL(r.url()).pathname)) audio.push([new URL(r.url()).pathname, r.status()]); });
    await card(page, slug).locator(".film-open").click();
    assert.match(await page.locator(".film-dialog iframe").getAttribute("src"), /[?&]lang=en\b/);
    const frame = film(page);
    await frame.locator("svg").first().waitFor();
    // 点过「播放」就直接开播（?autoplay=1），不用再按一次
    await frame.locator("body").evaluate(() => new Promise((r) => setTimeout(r, 1500)));
    const cjk = await frame.locator("body").evaluate(() => {
      const re = /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/;
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (!el.getClientRects().length || getComputedStyle(el).visibility === "hidden") continue;
        for (const n of el.childNodes) if (n.nodeType === 3 && re.test(n.textContent)) out.push(n.textContent.trim().slice(0, 40));
        for (const a of ["aria-label", "title"]) if (re.test(el.getAttribute(a) || "")) out.push(`${a}: ${el.getAttribute(a)}`);
      }
      return out.concat(re.test(document.title) ? [`title: ${document.title}`] : []);
    });
    assert.deepEqual(cjk, [], `${name} 英文版里还有中文`);
    assert.ok(audio.length > 0, `${name} 播放后没有加载配音`);
    for (const [p, status] of audio) {
      assert.match(p, /\/en\//, `英文版加载了中文配音 ${p}`);
      assert.ok(status < 400, `${p} 返回 ${status}`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test("短片有 poster.en.png/jpg 时，英文页的封面卡片用英文封面，中文页用原封面", () => {
  for (const [slug, name] of filmNotes()) {
    if (!["png", "jpg"].some((e) => existsSync(join(root, "assets/films", name, `poster.en.${e}`)))) continue;
    const poster = (p) => read(p).match(new RegExp(`/films/${name}/(poster[^"'\\s]*\\.webp)`))?.[1];
    assert.match(poster(`en/notes/${slug}/index.html`) ?? "", /^poster\.en_/);
    assert.match(poster(`notes/${slug}/index.html`) ?? "", /^poster_/);
  }
});

// ---------- assets/films/ 里每部真实短片的约定 ----------

const films = readdirSync(join(root, "assets/films"));
test("每部短片都有 index.html、poster 和中英文的短片文章，文字稿标题的锚点是 #transcript", () => {
  assert.ok(films.length > 0);
  for (const f of films) {
    const home = filmNotes().find(([, name]) => name === f);
    assert.ok(home, `${f} 没有短片文章（front matter 写 film: ${f} 的短文）`);
    const dir = join(root, "assets/films", f);
    assert.ok(existsSync(join(dir, "index.html")), `${f} 缺 index.html`);
    assert.ok(["png", "jpg"].some((e) => existsSync(join(dir, `poster.${e}`))), `${f} 缺 poster.png/jpg`);
    for (const p of ["index.md", "index.en.md"]) {
      const md = join(root, "content/notes", home[2], p);
      assert.ok(existsSync(md), `${f} 缺 content/notes/${home[2]}/${p}`);
      const text = readFileSync(md, "utf8");
      assert.match(text, /^## .+ \{#transcript\}$/m, `${home[2]}/${p} 的文字稿标题要写成「## 文字稿 {#transcript}」，「阅读文字稿」按钮链到这里`);
      assert.match(text, new RegExp(`^film: ${f}$`, "m"), `${home[2]}/${p} 的 front matter 要写 film: ${f}`);
      assert.match(text, /^<!--more-->$/m, `${home[2]}/${p} 要用 <!--more--> 隔开导语（短文列表里只显示导语和卡片）`);
    }
  }
});

test("短片不依赖外部样式和脚本（字体、CDN 不可用时不能白屏），也不直接访问博客页面", () => {
  for (const f of films) {
    const html = readFileSync(join(root, "assets/films", f, "index.html"), "utf8");
    const ext = [...html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)=["']?(https?:)?\/\/[^"'\s>]+/gi)].map((m) => m[0]);
    assert.deepEqual(ext, [], `${f} 引用了外部资源`);
    assert.ok(!/@import\s+url\(\s*["']?https?:/i.test(html), `${f} 的样式 @import 了外部地址`);
    assert.ok(!/window\.parent|top\.location|parent\.document/.test(html), `${f} 不应直接访问博客页面`);
  }
});

test("短片里引用的本地文件都存在", () => {
  for (const f of films) {
    const html = readFileSync(join(root, "assets/films", f, "index.html"), "utf8");
    for (const [, ref] of html.matchAll(/(?:src|href)=["'](?!https?:|data:|#|\$\{|javascript:)([^"']+)["']/g)) {
      assert.ok(existsSync(join(root, "assets/films", f, ref.split(/[?#]/)[0])), `${f} 引用的 ${ref} 不存在`);
    }
  }
});
