// 浏览器交互：手机和电脑视口下的图集、折叠、布局
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import { build, serve } from "./helpers.mjs";

let site, server, browser;
before(async () => {
  site = build();
  server = await serve(site.out);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); site?.remove(); });

async function open(path, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(server.url + path, { waitUntil: "load" });
  return { page, ctx, errors };
}
const card = (page, slug) => page.locator(`article.note-entry:has(a[href*="/notes/${slug}/"])`);

for (const [name, opts] of [["手机", devices["iPhone 13"]], ["电脑", { viewport: { width: 1280, height: 900 } }]]) {
  test(`${name}：页面没有横向滚动，图片加载前就占好位置`, async () => {
    const { page, ctx, errors } = await open("/notes/", opts);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // 懒加载的图还没加载时，分组里的每格也要有高度
    const heights = await card(page, "travel-photos").locator(".img-group img").evaluateAll((els) => els.slice(0, 9).map((e) => e.getBoundingClientRect().height));
    assert.ok(heights.every((h) => h > 50), `格子高度 ${heights}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test(`${name}：+N 角标落在第 9 张图上，第 10 张起不显示`, async () => {
    const { page, ctx } = await open("/notes/", opts);
    const group = card(page, "travel-photos").locator(".img-group");
    const shown = await group.locator("img").evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none").length);
    assert.equal(shown, 9);
    assert.equal(await group.locator(".note-more").textContent(), "+3");
    const inside = await group.evaluate((g) => {
      const b = g.querySelector(".note-more").getBoundingClientRect(), i = g.querySelectorAll("img")[8].getBoundingClientRect();
      return b.left >= i.left && b.right <= i.right && b.top >= i.top && b.bottom <= i.bottom;
    });
    assert.ok(inside, "角标要在第 9 张图里面");
    await ctx.close();
  });
}

// 每行：可见图片按 top 分组，算出每行的高度、宽高比误差和占满的宽度
const rows = (group) => group.evaluate((g) => {
  const box = g.getBoundingClientRect();
  const items = [...g.querySelectorAll("img")].filter((e) => getComputedStyle(e).display !== "none").map((e) => {
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), left: r.left, right: r.right, h: r.height, ratio: r.width / r.height, ar: parseFloat(e.style.getPropertyValue("--ar")) };
  });
  const byTop = {};
  for (const it of items) (byTop[it.top] ||= []).push(it);
  return Object.values(byTop).map((row) => ({
    n: row.length,
    heightSpread: Math.max(...row.map((i) => i.h)) - Math.min(...row.map((i) => i.h)),
    ratioError: Math.max(...row.map((i) => Math.abs(i.ratio / i.ar - 1))),
    fill: (Math.max(...row.map((i) => i.right)) - Math.min(...row.map((i) => i.left))) / box.width,
  }));
});

test("手机：分组是方块网格，12 张三列、2 张和 4 张两列；照片裁方块、截图完整显示", async () => {
  const { page, ctx } = await open("/notes/", devices["iPhone 13"]);
  const cols = (slug) => card(page, slug).locator(".img-group").evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
  assert.equal(await cols("travel-photos"), 3);
  assert.equal(await cols("two-photos"), 2);
  assert.equal(await cols("image-test"), 2);
  const fit = (slug) => card(page, slug).locator(".img-group img").first().evaluate((e) => [getComputedStyle(e).objectFit, e.getBoundingClientRect().width / e.getBoundingClientRect().height]);
  const [shotFit] = await fit("image-test");
  const [photoFit, photoRatio] = await fit("travel-photos");
  assert.equal(shotFit, "contain");
  assert.equal(photoFit, "cover");
  assert.ok(Math.abs(photoRatio - 1) < 0.01);
  await ctx.close();
});

test("电脑：分组是等高行，按原比例不裁切，铺满正文宽度（最后一行可以不满）", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  for (const slug of ["travel-photos", "two-photos", "image-test"]) {
    const group = card(page, slug).locator(".img-group");
    await group.scrollIntoViewIfNeeded();
    const r = await rows(group);
    r.forEach((row, i) => {
      assert.ok(row.heightSpread <= 1, `${slug} 第 ${i + 1} 行高度不一致：${row.heightSpread}px`);
      assert.ok(row.ratioError < 0.02, `${slug} 第 ${i + 1} 行有图片被拉伸或裁切：${row.ratioError}`);
      if (i < r.length - 1 || slug !== "travel-photos") assert.ok(row.fill > 0.99, `${slug} 第 ${i + 1} 行没铺满：${row.fill}`);
    });
    if (slug === "two-photos") assert.deepEqual(r.map((x) => x.n), [2], "两张图要并排在一行");
    if (slug === "image-test") assert.deepEqual(r.map((x) => x.n), [2, 2], "4 张截图排成两行");
  }
  await ctx.close();
});

test("图集：点击打开，翻页、图注、计数，Esc 关闭后焦点回到原图", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  const first = card(page, "travel-photos").locator(".img-group img").nth(1);
  await first.scrollIntoViewIfNeeded();
  await first.click();
  const box = page.locator("dialog.img-zoom");
  assert.equal(await box.evaluate((d) => d.open), true);
  assert.equal(await box.locator(".zoom-count").textContent(), "2 / 12");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await box.locator(".zoom-count").textContent(), "12 / 12", "向前翻要循环到最后一张");
  await box.locator(".zoom-next").click();
  assert.equal(await box.locator(".zoom-count").textContent(), "1 / 12");
  assert.match(await box.locator("figure img").getAttribute("src"), /\.webp$/);
  await page.keyboard.press("Escape");
  assert.equal(await box.evaluate((d) => d.open), false);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("role")), "button");
  await ctx.close();
});

test("图集：键盘能选中图片并用回车打开，图注显示 alt，关闭按钮可用", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  const photo = card(page, "image-test").locator("img.photo").first();
  await photo.focus();
  await page.keyboard.press("Enter");
  const box = page.locator("dialog.img-zoom");
  assert.equal(await box.evaluate((d) => d.open), true);
  assert.equal(await box.locator("figcaption").textContent(), "一张 4032×3024 的大照片");
  assert.equal(await box.locator(".zoom-prev").getAttribute("aria-label"), "上一张");
  await box.locator(".zoom-close").click();
  assert.equal(await box.evaluate((d) => d.open), false);
  await ctx.close();
});

test("图集：手机上手指左滑翻到下一张", async () => {
  const { page, ctx } = await open("/notes/", devices["iPhone 13"]);
  const img = card(page, "travel-photos").locator(".img-group img").first();
  await img.scrollIntoViewIfNeeded();
  await img.tap();
  const box = page.locator("dialog.img-zoom");
  assert.equal(await box.locator(".zoom-count").textContent(), "1 / 12");
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y: 400 }] });
  await touch("touchStart", 300);
  for (const x of [260, 200, 140, 90]) await touch("touchMove", x);
  await touch("touchEnd");
  await page.waitForTimeout(100);
  assert.equal(await box.locator(".zoom-count").textContent(), "2 / 12");
  assert.equal(await box.evaluate((d) => d.open), true, "滑动不应关闭图集");
  await ctx.close();
});

test("包在链接里的图片不进图集，点击照常跳转", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  const linked = card(page, "edge-cases").locator("a img");
  assert.equal(await linked.getAttribute("role"), null);
  await ctx.close();
});

test("折叠：长短文折叠，可展开、收起；短的不折叠", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  const long = card(page, "long-text");
  const btn = long.locator(".note-expand");
  assert.equal(await btn.textContent(), "展开全文");
  assert.equal(await btn.getAttribute("aria-expanded"), "false");
  const folded = await long.locator(".note-body").evaluate((b) => b.getBoundingClientRect().height);
  await btn.click();
  assert.equal(await btn.textContent(), "收起");
  assert.equal(await btn.getAttribute("aria-expanded"), "true");
  assert.ok(await long.locator(".note-body").evaluate((b) => b.getBoundingClientRect().height) > folded + 100);
  await btn.click();
  assert.equal(await btn.textContent(), "展开全文");
  assert.equal(await card(page, "single-photo").locator(".note-expand").count(), 0);
  await ctx.close();
});

test("折叠：没写宽高的图片（gif、svg）加载后重新判断", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  const edge = card(page, "svg-only");
  await edge.scrollIntoViewIfNeeded();
  await edge.locator('img[alt="很高的 SVG"]').evaluate((img) => img.complete || new Promise((ok) => img.addEventListener("load", ok)));
  await page.waitForTimeout(100);
  assert.equal(await edge.locator(".note-expand").count(), 1);
  await ctx.close();
});

test("英文站：折叠和图集按钮是英文", async () => {
  const { page, ctx } = await open("/en/notes/", { viewport: { width: 1280, height: 900 } });
  const img = card(page, "travel-photos").locator(".img-group img").first();
  await img.scrollIntoViewIfNeeded();
  await img.click();
  assert.equal(await page.locator("dialog.img-zoom .zoom-next").getAttribute("aria-label"), "Next image");
  await ctx.close();
});

test("关闭 JavaScript 时内容完整，分组照常显示", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  assert.equal(await card(page, "travel-photos").locator(".img-group img").count(), 12);
  assert.equal(await page.locator(".note-expand").count(), 0);
  await ctx.close();
});
