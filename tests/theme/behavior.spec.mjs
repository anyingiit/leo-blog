// 主题交互和兼容性：在每个项目（Chromium/WebKit × 电脑/平板/手机）里实际操作页面
import { test, expect } from "@playwright/test";
import { connect, settle, fullPage } from "./helpers.mjs";

const SITE = "http://blog.test", EXAMPLE = "http://example.test";

async function open(browser, info, url, opts = {}) {
  const context = await browser.newContext({ ...info.project.use, colorScheme: "light", ...opts });
  await connect(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "load" });
  return { context, page, errors };
}

// 两个站点里所有截图页面：没有脚本错误，也没有横向滚动条（手机上最常见的版面问题）
const all = [
  [SITE, ["/", "/posts/sample-post/", "/notes/", "/notes/photo-note/", "/archives/", "/tags/", "/search/", "/404.html", "/en/", "/en/posts/sample-post/", "/en/notes/"]],
  [EXAMPLE, ["/", "/posts/markdown-syntax/", "/posts/code_syntax/", "/posts/inner-section/cover-page/", "/posts/emoji-support/", "/archives/", "/tags/", "/search/", "/fr/", "/fa/"]],
];
for (const [host, paths] of all) {
  test(`${host.split("//")[1]}：页面没有脚本错误，也没有横向滚动`, async ({ browser }, info) => {
    const context = await browser.newContext({ ...info.project.use });
    await connect(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const p of paths) {
      const res = await page.goto(host + p, { waitUntil: "load" });
      expect(res.status(), p).toBe(200);
      await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${p} 横向溢出 ${overflow}px`).toBeLessThanOrEqual(0);
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("深色模式切换：点击按钮切换，刷新后保持", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/posts/sample-post/");
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  expect(await theme()).toBe("light");
  await page.click("#theme-toggle");
  expect(await theme()).toBe("dark");
  await page.reload();
  expect(await theme()).toBe("dark");
  await page.click("#theme-toggle");
  expect(await theme()).toBe("light");
  await context.close();
});

test("系统是深色时默认深色", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/", { colorScheme: "dark" });
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await context.close();
});

for (const [host, query, expected, shot] of [[SITE, "样例", "视觉回归样例长文", "site-search"], [EXAMPLE, "markdown", "Markdown Syntax Guide", "example-search"]]) {
  test(`站内搜索（${host.split("//")[1]}）：输入后列出结果，方向键可以选中`, async ({ browser }, info) => {
    const { context, page } = await open(browser, info, host + "/search/");
    const input = page.locator("#searchInput");
    await expect(input).toBeEnabled(); // 搜索索引 index.json 加载完才可用
    await input.fill(query);
    const first = page.locator("#searchResults li").first();
    await expect(first).toContainText(expected);
    await input.press("ArrowDown");
    await expect(page.locator("#searchResults a").first()).toBeFocused();
    await settle(page);
    await fullPage(page);
    await expect(page).toHaveScreenshot(`${shot}.png`);
    await context.close();
  });
}

test("代码块的复制按钮：点击后提示已复制，2 秒后恢复", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/posts/sample-post/");
  const btn = page.locator(".copy-code").first();
  await page.locator(".highlight").first().hover().catch(() => {}); // 触屏设备没有悬停
  await expect(btn).toHaveText("复制");
  await btn.click();
  await expect(btn).toHaveText("已复制！");
  await expect(btn).toHaveText("复制", { timeout: 4000 });
  await context.close();
});

test("目录：展开后点击条目跳到对应标题", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/posts/sample-post/");
  await page.click(".toc summary");
  const link = page.locator(".toc a", { hasText: "图片" });
  await expect(link).toBeVisible();
  await link.click();
  await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash))).toBe("#图片");
  await expect(page.locator("h2#图片")).toBeInViewport();
  await context.close();
});

test("语言切换：中文文章跳到对应的英文文章，再切回来", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/posts/sample-post/");
  await page.locator(".lang-switch a, .i18n_list a").first().click();
  await expect(page).toHaveURL(SITE + "/en/posts/sample-post/");
  await page.locator(".lang-switch a, .i18n_list a").first().click();
  await expect(page).toHaveURL(SITE + "/posts/sample-post/");
  await context.close();
});

test("返回顶部：滚动后出现，点击回到顶部", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/posts/sample-post/");
  const top = page.locator("#top-link");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(top).toBeVisible();
  await top.click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await context.close();
});

test("导航菜单：每一项都能打开", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/");
  const items = await page.locator("#menu a").evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.getAttribute("href")]));
  expect(items.map((i) => i[0])).toEqual(["短文", "归档", "标签", "搜索"]);
  for (const [, href] of items) expect((await page.goto(href)).status(), href).toBe(200);
  await context.close();
});

// 慢网 + 慢 CPU 下的布局偏移（CLS）。layout-shift 指标和 CPU 降速只有 Chromium 提供
test("慢网下加载时布局不跳动（CLS）", async ({ browser, browserName }, info) => {
  test.skip(browserName !== "chromium", "layout-shift 指标只有 Chromium 支持");
  test.setTimeout(120000);
  const context = await browser.newContext({ ...info.project.use, colorScheme: "light" });
  await connect(context, "slow-3g");
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  const results = {};
  for (const p of ["/", "/notes/", "/posts/sample-post/"]) {
    await page.goto(SITE + p, { waitUntil: "load", timeout: 60000 });
    await settle(page);
    results[p] = await page.evaluate(() => window.__cls);
  }
  // 0.1 是 Google Core Web Vitals 的"良好"上限
  for (const [p, cls] of Object.entries(results)) expect(cls, `${p} 的 CLS 是 ${cls.toFixed(3)}`).toBeLessThanOrEqual(0.1);
  await context.close();
});

// 慢网下页面最终也要完整：和正常网络下的截图逐像素一致
test("慢网下最终渲染与正常网络一致", async ({ browser }, info) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ ...info.project.use, colorScheme: "light" });
  await connect(context, "slow-3g");
  const page = await context.newPage();
  await page.goto(SITE + "/posts/sample-post/", { waitUntil: "load", timeout: 60000 });
  await settle(page);
  await fullPage(page);
  await expect(page).toHaveScreenshot("site-post-light.png");
  await context.close();
});
