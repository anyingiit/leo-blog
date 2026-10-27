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
  assert.equal(m[2], "https://douseful.eu.org/films/test-film/", "canonical 指向默认语言的短片页");
  assert.match(m[1], /film:ready/);
  assert.equal(html.replace(m[1], ""), source, "除了插入的部分，短片文件一字不改");
});

test("短片引用的文件按原来的相对路径发布，poster 只以 WebP 封面发布", () => {
  assert.equal(read("films/test-film/play/media/still.svg"), readFileSync(join(root, "tests/fixtures/assets/films/test-film/media/still.svg"), "utf8"));
  assert.ok(!site.exists("films/test-film/play/poster.png"), "原始 poster.png 不上线");
  const webp = readdirSync(join(site.out, "films/test-film")).filter((f) => f.endsWith(".webp"));
  assert.equal(webp.length, 1);
});

for (const [lang, prefix, title, play] of [["中文", "", "测试短片", "/films/test-film/play/"], ["英文", "/en", "Test Film", "/films/test-film/play/?lang=en"]]) {
  test(`${lang}正文里的封面卡片是指向短片页的链接，带封面、标题和时长`, async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(server.url + `${prefix}/notes/film-note/`);
    const a = page.locator(".post-content a.film-open");
    assert.equal(await a.getAttribute("href"), `${prefix}/films/test-film/`);
    assert.equal(await a.getAttribute("data-play"), play, "播放地址：英文页在语言不同时带 ?lang=en");
    assert.match(await a.locator("img").getAttribute("src"), /^\/films\/test-film\/poster_hu_[0-9a-f]+\.webp$/);
    assert.equal(await page.locator(".film-cover figcaption strong").textContent(), title, "标题取自对应语言的短片页");
    assert.match(await page.locator(".film-cover figcaption span").textContent(), lang === "中文" ? /约 2 分钟/ : /about 2 min/);
    // 没有脚本时点卡片就是打开短片页
    await a.click();
    await page.waitForURL(`**${prefix}/films/test-film/`);
    await ctx.close();
  });

  test(`${lang}短片页：博客页头页尾，沙箱播放器，下面是 Markdown 文字稿`, async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(server.url + `${prefix}/films/test-film/`);
    const frame = page.locator(".film-stage iframe.film-frame");
    assert.equal(await frame.getAttribute("src"), play.includes("?") ? `${play}&embed=page` : `${play}?embed=page`);
    const sandbox = await frame.getAttribute("sandbox");
    assert.ok(!sandbox.includes("allow-same-origin"), "短片和博客不同源，碰不到博客的页面和存储");
    assert.match(sandbox, /allow-scripts/);
    assert.equal(await page.locator("#menu").count(), 1, "有博客导航");
    assert.equal(await page.locator("footer.footer").count(), 1, "有博客页脚");
    assert.equal((await page.locator(".post-content h3").first().textContent()).replace(/#$/, ""), lang === "中文" ? "01 第一段" : "01 Part one", "文字稿是正文里的标题和段落");
    assert.doesNotMatch(await page.locator(".post-meta").textContent(), /字|words/, "不显示字数（容易和片长混淆）");
    await ctx.close();
  });
}

test("短片页不进全站 RSS（订阅里已有引用它的文章），站点地图照常收录", () => {
  for (const [rss, map] of [["index.xml", "zh/sitemap.xml"], ["en/index.xml", "en/sitemap.xml"]]) {
    assert.doesNotMatch(read(rss), /<link>[^<]*\/films\/test-film\/<\/link>/, `${rss} 里不应有短片页`);
    assert.match(read(rss), /<link>[^<]*\/notes\/film-note\/<\/link>/, `${rss} 里有引用短片的文章`);
    assert.match(read(map), /<loc>[^<]*\/films\/test-film\/<\/loc>/, `${map} 收录短片页`);
  }
});

// ---------- 交互 ----------

test("点封面在全窗口对话框里放映：沙箱 iframe、embed=fit、深浅色跟随博客", async () => {
  const { page, ctx, errors } = await open("/notes/film-note/");
  await page.click(".film-open");
  assert.equal(await dialogOpen(page), true);
  const frame = page.locator(".film-dialog iframe");
  assert.match(await frame.getAttribute("src"), /\/films\/test-film\/play\/\?embed=fit$/);
  assert.ok(!(await frame.getAttribute("sandbox")).includes("allow-same-origin"));
  await film(page).locator("#theme").filter({ hasText: "light" }).waitFor();
  assert.equal(await film(page).locator("html").getAttribute("data-embed"), "fit");
  assert.equal(await film(page).locator("header").isVisible(), false, "嵌入时短片可以只显示播放器");
  // 切换博客的深浅色，短片跟着变
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await film(page).locator("#theme").filter({ hasText: "dark" }).waitFor();
  assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden", "放映时正文不滚动");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("返回键先关掉短片，留在原文原处", async () => {
  const { page, ctx } = await open("/notes/film-note/", { viewport: { width: 1280, height: 500 } });
  await page.evaluate(() => scrollTo(0, 200));
  const url = page.url();
  await page.click(".film-open");
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector(".film-dialog").open);
  assert.equal(page.url(), url);
  assert.equal(await page.evaluate(() => scrollY), 200);
  assert.equal(await page.locator(".film-dialog iframe").getAttribute("src"), "about:blank", "关闭时卸载短片，声音随之停止");
  await ctx.close();
});

test("关闭按钮、短片里按 Esc 都能关闭，焦点回到封面，历史记录不多出一条", async () => {
  const { page, ctx } = await open("/notes/film-note/");
  const depth = await page.evaluate(() => history.length);
  await page.click(".film-open");
  await page.click(".film-close");
  assert.equal(await dialogOpen(page), false);
  await page.waitForFunction((n) => history.length === n + 1 && history.state === null, depth);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains("film-open")), true);

  await page.click(".film-open");
  await film(page).locator("#play").click(); // 焦点进入短片
  await film(page).locator("#play").press("Escape");
  await page.waitForFunction(() => !document.querySelector(".film-dialog").open);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains("film-open")), true);
  await ctx.close();
});

test("Ctrl/⌘/Shift 点击、中键不拦截，照常在新标签打开短片页", async () => {
  const { page, ctx } = await open("/notes/film-note/");
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
  test(`${name}：短片页的播放器按短片报来的高度撑开，比正文宽，没有横向滚动`, async () => {
    const { page, ctx, errors } = await open("/films/test-film/", { viewport });
    const frame = page.frameLocator("iframe.film-frame");
    await frame.locator("html[data-embed=page]").waitFor({ state: "attached" });
    // 测试短片嵌入时只剩播放器：16:9 的画面加 56px 的控制条
    const want = await frame.locator(".player").evaluate((e) => Math.ceil(e.getBoundingClientRect().height));
    assert.equal(want, Math.ceil(await page.locator("iframe.film-frame").evaluate((f) => f.clientWidth * 9 / 16 + 56)));
    await page.waitForFunction((h) => document.querySelector("iframe.film-frame").getBoundingClientRect().height === h, want);
    const [stage, text] = await page.evaluate(() => [".film-stage", ".post-content"].map((s) => document.querySelector(s).getBoundingClientRect().width));
    if (viewport.width > 1000) assert.ok(stage > text + 200, `播放器 ${stage}px 应明显宽于正文 ${text}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test("真实短片在手机横屏全窗口放映时，画面占屏幕一半以上，控制条在屏幕内", async () => {
  for (const [slug] of filmNotes()) {
    const { page, ctx } = await open(`/notes/${slug}/`, { viewport: { width: 844, height: 390 } });
    await page.click(".film-open");
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
  const name = md.match(/\{\{<\s*film\s+name="([^"]+)"/)?.[1];
  return name ? [[md.match(/^slug:\s*(\S+)/m)?.[1] ?? d, name]] : [];
});

test("真实短片在英文页里放英文版：地址带 lang=en，画面、字幕、按钮都没有中文，配音按英文文件加载", async () => {
  for (const [slug, name] of filmNotes()) {
    const filmLang = readFileSync(join(root, "content/films", name, "index.en.md"), "utf8").match(/^filmLang:\s*(\S+)/m)?.[1];
    if (filmLang === "en") continue;
    const { page, ctx, errors } = await open(`/en/notes/${slug}/`, { viewport: { width: 1280, height: 800 } });
    const audio = [];
    page.on("response", (r) => { if (/\.(mp3|m4a|mp4|ogg|opus|wav)$/.test(new URL(r.url()).pathname)) audio.push([new URL(r.url()).pathname, r.status()]); });
    await page.click(".film-open");
    assert.match(await page.locator(".film-dialog iframe").getAttribute("src"), /[?&]lang=en\b/);
    const frame = film(page);
    await frame.locator("svg").first().waitFor();
    await page.locator(".film-dialog iframe").focus();
    await frame.locator("body").press("Space");
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
test("每部短片都有 index.html、poster 和中英文短片页", () => {
  assert.ok(films.length > 0);
  for (const f of films) {
    const dir = join(root, "assets/films", f);
    assert.ok(existsSync(join(dir, "index.html")), `${f} 缺 index.html`);
    assert.ok(["png", "jpg"].some((e) => existsSync(join(dir, `poster.${e}`))), `${f} 缺 poster.png/jpg`);
    for (const p of ["index.md", "index.en.md"]) assert.ok(existsSync(join(root, "content/films", f, p)), `${f} 缺 content/films/${f}/${p}`);
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
