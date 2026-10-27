// 主题交互和兼容性：在每个项目（Chromium/WebKit × 电脑/平板/手机）里实际操作页面
import { test, expect } from "@playwright/test";
import { connect, settle, fullPage, repaint } from "./helpers.mjs";

const SITE = "http://blog.test", EXAMPLE = "http://example.test";

// 测试失败时也关掉本测试开的浏览器上下文（每个 worker 一次只跑一个测试）
test.afterEach(async ({ browser }) => { for (const c of browser.contexts()) await c.close(); });

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
  [SITE, ["/", "/posts/sample-post/", "/notes/", "/notes/photo-note/", "/notes/seven-photos/", "/notes/travel-photos/", "/notes/page/2/", "/tags/样式/", "/archives/", "/tags/", "/search/", "/404.html", "/en/", "/en/posts/sample-post/", "/en/notes/"]],
  [EXAMPLE, ["/", "/posts/markdown-syntax/", "/posts/code_syntax/", "/posts/inner-section/cover-page/", "/posts/emoji-support/", "/archives/", "/tags/", "/search/", "/fr/", "/fa/", "/fa/posts/markdown-syntax/", "/posts/", "/page/2/"]],
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

// 页头的语言切换（PR #22，docs/language-switch.md）：跳到当前页的译文，没有译文的页面才回首页
for (const [from, to] of [["/posts/sample-post/", "/en/posts/sample-post/"], ["/notes/", "/en/notes/"], ["/en/notes/sample-note/", "/notes/sample-note/"]]) {
  test(`页头语言切换：${from} → ${to}`, async ({ browser }, info) => {
    const { context, page } = await open(browser, info, SITE + from);
    await page.locator(".header .lang-menu a").first().click();
    await expect(page).toHaveURL(SITE + to);
    await context.close();
  });
}

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
  expect(items.map((i) => i[0])).toEqual(["短文", "译文", "归档", "标签", "搜索"]);
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

// 慢网下页面最终也要完整：和正常网络下的截图逐像素一致（在内存里比，不共用基准图，重新生成基准时不会互相覆盖）
test("慢网下最终渲染与正常网络一致", async ({ browser }, info) => {
  test.setTimeout(120000);
  const shot = async (network) => {
    const context = await browser.newContext({ ...info.project.use, colorScheme: "light" });
    await connect(context, network);
    const page = await context.newPage();
    await page.goto(SITE + "/posts/sample-post/", { waitUntil: "load", timeout: 60000 });
    await settle(page);
    await fullPage(page);
    const png = await page.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
    await context.close();
    return png;
  };
  const [normal, slow] = [await shot("online"), await shot("slow-3g")];
  if (!normal.equals(slow)) {
    await info.attach("online.png", { body: normal, contentType: "image/png" });
    await info.attach("slow-3g.png", { body: slow, contentType: "image/png" });
  }
  expect(normal.equals(slow), "慢网下的最终截图和正常网络不同（两张图见附件）").toBe(true);
});

// 短文图集灯箱（PR #16）：点图片打开，截取打开后的整个视口；方向键切换，Esc 关闭后焦点回到原图
test("短文图集灯箱：打开、切换、关闭", async ({ browser }, info) => {
  const { context, page, errors } = await open(browser, info, SITE + "/notes/four-photos/");
  await settle(page);
  const first = page.locator(".md-content img").first();
  await first.click();
  const box = page.locator("dialog.img-zoom");
  await expect(box).toBeVisible();
  await expect(box.locator(".zoom-count")).toHaveText("1 / 4");
  await box.locator("img").evaluate((img) => img.complete ? img.decode() : new Promise((ok) => { img.onload = () => img.decode().then(ok); }));
  await settle(page);
  await repaint(page);
  await expect(page).toHaveScreenshot("site-lightbox.png");
  await page.keyboard.press("ArrowRight");
  await expect(box.locator(".zoom-count")).toHaveText("2 / 4");
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();
  expect(await first.evaluate((img) => img === document.activeElement)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

// 长短文折叠（PR #16）：超过一屏先折叠，展开后完整显示，再收起
test("长短文折叠：展开、收起", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/notes/");
  await settle(page);
  const entry = page.locator(".note-entry", { has: page.locator('a[href$="/notes/long-text/"]') });
  const body = entry.locator(".note-body"), btn = entry.locator(".note-expand");
  await expect(body).toHaveClass(/is-folded/);
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  const folded = await body.evaluate((b) => b.getBoundingClientRect().height);
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  expect(await body.evaluate((b) => b.getBoundingClientRect().height)).toBeGreaterThan(folded + 100);
  // 滚到展开后的正文底部再收起：页面要滚回这条短文的开头，不能让读者停在下面不相干的位置
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await expect(body).toHaveClass(/is-folded/);
  await expect.poll(() => entry.evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBeLessThanOrEqual(10);
  expect(await entry.evaluate((e) => e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(-1);
  await context.close();
});

// 短文多图分组的版面在 768px 切换（custom.css）：767 宽时逐张排列，768 起按行等高排列
test("短文图组的断点正好在 768px", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/notes/");
  const display = async (width) => {
    await page.setViewportSize({ width, height: 900 });
    return page.locator(".img-row").first().evaluate((el) => getComputedStyle(el).display);
  };
  expect(await display(767)).toBe("contents");
  expect(await display(768)).toBe("flex");
  await context.close();
});

// 键盘焦点样式：Tab 到导航菜单第一项时的焦点框（逐像素）
test("键盘焦点：导航菜单的焦点框", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/posts/sample-post/");
  await settle(page);
  const link = page.locator("#menu a").first();
  await link.focus();
  expect(await link.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
  // 截图范围在链接四周各留 8px。浏览器默认的焦点框会被 PaperMod 菜单的 overflow-x: auto 裁掉一部分（主题本身如此），基准图记录的就是这个现状
  const box = await link.boundingBox();
  await repaint(page);
  await expect(page).toHaveScreenshot("site-focus-menu.png", { clip: { x: box.x - 8, y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16 } });
  await context.close();
});

// 本站给可点开的正文图片加的焦点框（assets/css/extended/custom.css）
test("键盘焦点：短文图片的焦点框", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/notes/four-photos/");
  await settle(page);
  const img = page.locator(".md-content img").first();
  await img.focus();
  expect(await img.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
  const box = await img.boundingBox();
  await repaint(page);
  await expect(page).toHaveScreenshot("site-focus-image.png", { clip: { x: Math.max(0, box.x - 8), y: box.y - 8, width: Math.min(box.width + 16, page.viewportSize().width), height: 40 } });
  await context.close();
});
