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
  // 手指横扫不产生 click：以前滑完留下的「吞掉下一次点击」标记会让第一次点 × 没反应。
  // （CDP 模拟横扫之后，Chromium 自己会把紧接着的一次 tap 当成停止惯性而不发 click，所以这里用 click() 代替真实点按）
  assert.equal(await box.evaluate((d) => d.dataset.swiped), undefined, "手指横扫后不应留下吞掉点击的标记");
  await box.locator(".zoom-next").evaluate((b) => b.click());
  assert.equal(await box.locator(".zoom-count").textContent(), "3 / 12", "滑动后第一次点 › 应该翻页");
  await box.locator(".zoom-close").evaluate((b) => b.click());
  assert.equal(await box.evaluate((d) => d.open), false, "滑动后点 × 应该一次关闭");
  // 灯箱里能双指放大（宽的文字截图在手机上要放大才看得清）；平时单指拖动留给横扫换图
  assert.equal(await box.evaluate((d) => getComputedStyle(d).touchAction), "pinch-zoom");
  await ctx.close();
});

test("图集：电脑上用鼠标拖动换图，松开时不会顺带关掉灯箱", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  await card(page, "travel-photos").locator(".img-group img").first().click();
  const box = page.locator("dialog.img-zoom");
  await page.mouse.move(800, 450);
  await page.mouse.down();
  await page.mouse.move(600, 450, { steps: 5 });
  await page.mouse.up();
  assert.equal(await box.locator(".zoom-count").textContent(), "2 / 12");
  assert.equal(await box.evaluate((d) => d.open), true, "拖动松开后的 click 不应关闭灯箱");
  // 按着鼠标时按 Esc 关掉灯箱，松开发生在灯箱外；再打开时拖动仍能换图（以前按下计数卡住，之后都当成多指）
  await page.mouse.down();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await card(page, "travel-photos").locator(".img-group img").first().click();
  await page.mouse.move(800, 450);
  await page.mouse.down();
  await page.mouse.move(600, 450, { steps: 5 });
  await page.mouse.up();
  assert.equal(await box.locator(".zoom-count").textContent(), "2 / 12", "关闭时没松开的按下不应影响下一次拖动");
  assert.equal(await box.evaluate((d) => d.open), true);
  await ctx.close();
});

// 从图片外的黑底开始拖，会在灯箱里拉出一段包住大图的选区；之后按在图片上拖，浏览器把它当成拖走选区
// （dragstart + pointercancel），换图就没反应了。上面那个测试偶发失败就是这个原因：第一次拖动时大图还没加载出来，按下点落在黑底上
test("图集：电脑上先从黑底拖一次，再按在图片上拖，仍能换图", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  await card(page, "travel-photos").locator(".img-group img").first().click();
  const box = page.locator("dialog.img-zoom"), img = box.locator("figure img");
  const loaded = () => img.evaluate((im) => im.complete || new Promise((ok) => { im.onload = im.onerror = ok; }));
  await loaded();
  let r = await img.boundingBox();
  assert.ok(r.x + r.width + 40 < 1280, `测试前提：大图右边有黑底（${JSON.stringify(r)}）`);
  await page.mouse.move(r.x + r.width + 40, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 6 });
  await page.mouse.up();
  assert.equal(await box.locator(".zoom-count").textContent(), "2 / 12");
  assert.equal(await page.evaluate(() => getSelection().type), "Range", "测试前提：第一次拖动留下了选区");
  await loaded();
  r = await img.boundingBox();
  await page.mouse.move(r.x + r.width / 2 + 100, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 - 100, r.y + r.height / 2, { steps: 5 });
  await page.mouse.up();
  assert.equal(await box.locator(".zoom-count").textContent(), "3 / 12", "按在图片上拖动应该换图，不能变成拖走选区");
  assert.equal(await box.evaluate((d) => d.open), true);
  await ctx.close();
});

// 逐张检查（有没有图注、横图竖图、长图都不一样），边界用实际视口高度
for (const device of ["iPhone 13 landscape", "iPhone 13", "iPhone SE"]) {
  test(`图集：${device} 上每张图的计数、图注、关闭按钮和图片互不遮挡，都在屏幕里`, async () => {
    const { page, ctx } = await open("/notes/", { ...devices[device] });
    const n = await page.locator(".md-content img[role=button]").count();
    assert.ok(n >= 10, `测试前提：短文页有多张可放大的图片（${n}）`);
    const bad = [];
    for (let i = 0; i < n; i++) {
      await page.locator(".md-content img[role=button]").nth(i).evaluate((img) => img.click());
      const box = page.locator("dialog.img-zoom");
      await box.locator("figure img").evaluate((im) => im.complete || new Promise((ok) => { im.onload = im.onerror = ok; }));
      bad.push(...(await box.evaluate((d, i) => {
        const r = Object.fromEntries(["figure img", "figcaption", ".zoom-count", ".zoom-close"]
          .map((s) => [s, d.querySelector(s)]).filter(([, e]) => e.checkVisibility() && e.getBoundingClientRect().width).map(([s, e]) => [s, e.getBoundingClientRect()]));
        const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        const k = Object.keys(r), out = [];
        for (let x = 0; x < k.length; x++) for (let y = x + 1; y < k.length; y++) if (hit(r[k[x]], r[k[y]])) out.push(`第 ${i + 1} 张：${k[x]} 和 ${k[y]} 重叠`);
        for (const s of k) if (r[s].top < -0.5 || r[s].bottom > innerHeight + 0.5) out.push(`第 ${i + 1} 张：${s} 超出屏幕`);
        return out;
      }, i)));
      await page.keyboard.press("Escape");
    }
    assert.deepEqual(bad, []);
    await ctx.close();
  });
}

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

test("电脑：分组按构建时分好的行排，每行铺满、等高、不裁切，整组不超过一屏；sizes 和显示宽度一致", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  const plans = { "two-photos": [2], "three-photos": [3], "four-photos": [2, 2], "seven-photos": [4, 3], "image-test": [2, 2], "travel-photos": [3, 3, 3] };
  for (const [slug, plan] of Object.entries(plans)) {
    const group = card(page, slug).locator(".img-group");
    await group.scrollIntoViewIfNeeded();
    const r = await rows(group);
    assert.deepEqual(r.map((x) => x.n), plan, slug);
    r.forEach((row, i) => {
      assert.ok(row.heightSpread <= 1, `${slug} 第 ${i + 1} 行高度不一致：${row.heightSpread}px`);
      assert.ok(row.ratioError < 0.02, `${slug} 第 ${i + 1} 行有图片被拉伸或裁切：${row.ratioError}`);
      assert.ok(row.fill > 0.99, `${slug} 第 ${i + 1} 行没铺满：${row.fill}`);
    });
    const h = await group.evaluate((g) => g.getBoundingClientRect().height);
    assert.ok(h < 700, `${slug} 整组高 ${h}px`);
    const off = await group.evaluate((g) => [...g.querySelectorAll("img")].filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => +e.sizes.match(/\) (\d+)px/)[1] / e.getBoundingClientRect().width).filter((k) => k < 0.99 || k > 1.1));
    assert.deepEqual(off, [], `${slug} sizes 和显示宽度不符`);
  }
  // 引导语和下面的图组靠近：间距 8px
  const gap = await card(page, "image-test").locator(".img-group").evaluate((g) => g.getBoundingClientRect().top - g.previousElementSibling.getBoundingClientRect().bottom);
  assert.ok(Math.abs(gap - 8) <= 1, `引导语到图组 ${gap}px`);
  await ctx.close();
});

test("图集：点第 9 张上的「+3」从第 10 张看起", async () => {
  const { page, ctx } = await open("/notes/", { viewport: { width: 1280, height: 900 } });
  const ninth = card(page, "travel-photos").locator(".img-more img");
  await ninth.scrollIntoViewIfNeeded();
  await ninth.click();
  assert.equal(await page.locator("dialog.img-zoom .zoom-count").textContent(), "10 / 12");
  await ctx.close();
});

test("读屏：没写说明的图片念「查看图片 3 / 12」，第 9 张加上「还有 3 张」，写了说明的念说明", async () => {
  for (const [path, third, ninth] of [["/notes/", "查看图片 3 / 12", "查看图片 9 / 12，还有 3 张"], ["/en/notes/", "View image 3 of 12", "View image 9 of 12, 3 more"]]) {
    const { page, ctx } = await open(path, { viewport: { width: 1280, height: 900 } });
    const imgs = card(page, "travel-photos").locator(".img-group img");
    assert.equal(await imgs.nth(2).getAttribute("aria-label"), third);
    assert.equal(await imgs.nth(8).getAttribute("aria-label"), ninth);
    assert.equal(await card(page, "travel-photos").locator(".note-more").getAttribute("aria-hidden"), "true");
    assert.equal(await card(page, "image-test").locator("img.photo").first().getAttribute("aria-label"), null, "有 alt 就不另加名字");
    await ctx.close();
  }
});
