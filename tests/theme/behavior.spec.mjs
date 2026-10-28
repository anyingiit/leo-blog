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

// 灯箱里已有选区（Ctrl/Cmd+A，或者图片加载前在灯箱上拖出的选区）时，按住图片拖动会变成浏览器原生的「拖动选区」，
// 随后的 pointercancel 让这次换图失效。以前「电脑上用鼠标拖动换图」测试偶发显示 1 / 12 就是这个原因
test("短文图集灯箱：有选区时鼠标拖动图片照样换图", async ({ browser }, info) => {
  const { context, page, errors } = await open(browser, info, SITE + "/notes/four-photos/");
  await settle(page);
  await page.locator(".md-content img").first().click();
  const box = page.locator("dialog.img-zoom"), big = box.locator("figure img");
  await expect(box.locator(".zoom-count")).toHaveText("1 / 4");
  await big.evaluate((img) => img.complete ? img.decode() : new Promise((ok) => { img.onload = () => img.decode().then(ok); }));
  await page.keyboard.press("ControlOrMeta+A");
  expect(await big.evaluate((img) => getSelection().containsNode(img, true)), "测试前提：图片在选区里").toBe(true);
  // 从图片右侧四分之一处拖到左侧四分之一处（手机上也有 180px 以上，不会拖出视口）
  const r = await big.boundingBox(), y = r.y + r.height / 2;
  await page.mouse.move(r.x + r.width * 0.75, y);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.25, y, { steps: 5 });
  await page.mouse.up();
  await expect(box.locator(".zoom-count")).toHaveText("2 / 4");
  expect(await box.evaluate((d) => d.open), "拖动松开后的 click 不应关闭灯箱").toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

// 长短文折叠（PR #16）：超过一屏先折叠，展开后完整显示，再收起
test("长短文折叠：展开、收起", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/notes/");
  await settle(page);
  // 页尾补一屏高的空白：这条短文排在第几条、下面还剩多少内容都不影响它能否滚到贴顶。
  // 不补的话，它靠近页尾时浏览器只能滚到底，而收起时页面变短、滚动位置本来就会被夹到底，
  // 去掉 scrollIntoView 断言也照样通过
  await page.evaluate(() => document.body.append(Object.assign(document.createElement("div"), { style: `height:${innerHeight}px` })));
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

// 长短文靠近页尾、页面滚不到让它贴顶时收起：滚到最底，开头仍在屏幕里。把视口加高到这条短文贴不了顶，
// 不依赖测试短文的数量和顺序（PR #25 加了两条短文后，平板上它就落到了页尾附近）
test("长短文折叠：靠近页尾时收起，滚到最底", async ({ browser }, info) => {
  const { context, page } = await open(browser, info, SITE + "/notes/");
  await settle(page);
  const entry = page.locator(".note-entry", { has: page.locator('a[href$="/notes/long-text/"]') });
  const body = entry.locator(".note-body"), btn = entry.locator(".note-expand");
  await expect(body).toHaveClass(/is-folded/);
  const below = await entry.evaluate((e) => document.documentElement.scrollHeight - (e.getBoundingClientRect().top + scrollY));
  const { width } = page.viewportSize();
  await page.setViewportSize({ width, height: Math.ceil(below) + 200 });
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  // 从页面顶部收起（不经过鼠标，免得点击前的自动滚动替它滚到位）：不滚动的话会停在顶部；
  // 收起后页面变短，浏览器自己把滚动位置压到最底也不会发生，这一步测的确实是收起时的滚动
  await page.evaluate(() => scrollTo(0, 0));
  await btn.evaluate((b) => b.click());
  await expect(body).toHaveClass(/is-folded/);
  const where = () => entry.evaluate((e) => ({ top: e.getBoundingClientRect().top, docTop: e.getBoundingClientRect().top + scrollY,
    scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  const before = await where();
  expect(before.docTop, "测试前提：这条短文贴不了顶").toBeGreaterThan(before.max + 10);
  await expect.poll(async () => { const w = await where(); return Math.round(w.max - w.scrollY); }).toBeLessThanOrEqual(1);
  const w = await where();
  expect(w.top).toBeGreaterThanOrEqual(-1);
  expect(w.top).toBeLessThanOrEqual(200 + 1);
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

// 横滑提示阴影（偏离 PaperMod 的例外，用户 2026-10-28 批准保留，docs/papermod-deviations.md）：
// 表格、代码块、公式超出宽度能左右滑时，边缘有一道看得见的阴影；放得下时除圆角外和去掉这条样式逐像素相同
// 只比较去掉上下圆角那几行（圆角半径 + 2px：元素位置有小数时圆角会跨到下一行）之后的部分：
// 有背景图时圆角的抗锯齿会差 1–3 个色阶，肉眼看不出，和阴影无关
async function maxDiff(page, a, b, skipRows) {
  return page.evaluate(async ([a, b, skipRows]) => {
    const load = async (s) => createImageBitmap(await (await fetch("data:image/png;base64," + s)).blob());
    const [x, y] = [await load(a), await load(b)];
    if (x.width !== y.width || x.height !== y.height) return 255;
    const px = (img) => { const c = new OffscreenCanvas(img.width, img.height).getContext("2d"); c.drawImage(img, 0, 0); return c.getImageData(0, 0, img.width, img.height).data; };
    const [p, q] = [px(x), px(y)];
    let m = 0;
    for (let i = skipRows * x.width * 4; i < p.length - skipRows * x.width * 4; i++) m = Math.max(m, Math.abs(p[i] - q[i]));
    return m;
  }, [a.toString("base64"), b.toString("base64"), skipRows]);
}
test("能横滑的表格、代码块、公式有边缘阴影，放得下的没有", async ({ browser }, info) => {
  // 测试文章里的表格、代码块、公式在各设备上都放得下；超宽的情况在页面里临时插入一张宽表格和一段长代码来造（不改测试文章，不影响截图基准）
  const sel = ".md-content table, .md-content pre code, .post-content .katex-display";
  const { context, page } = await open(browser, info, SITE + "/");
  let wide = 0, fit = 0;
  for (const path of ["/posts/sample-post/", "/en/posts/sample-post/"]) {
    await page.goto(SITE + path, { waitUntil: "load" });
    await settle(page);
    await page.evaluate(() => {
      const cell = "很长的一格内容".repeat(30);
      document.querySelector(".md-content").insertAdjacentHTML("beforeend",
        `<table data-wide><thead><tr><th>项目</th><th>说明</th></tr></thead><tbody><tr><td>一</td><td>${cell}</td></tr></tbody></table>` +
        `<pre data-wide><code>${"const 很长的一行代码 = 1; ".repeat(40)}</code></pre>`);
    });
    const els = page.locator(sel);
    for (let i = 0; i < await els.count(); i++) {
      const el = els.nth(i);
      if (!await el.isVisible()) continue;
      const [sw, cw, radius] = await el.evaluate((e) => { e.scrollLeft = 0; e.scrollIntoView({ block: "center" });
        const r = (n) => parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0;
        return [e.scrollWidth, e.clientWidth, Math.ceil(Math.max(r(e), r(e.parentElement), r(e.parentElement.parentElement)))]; });
      if (cw === 0) continue;
      const withShadow = await el.screenshot();
      await el.evaluate((e) => e.style.setProperty("background-image", "none", "important"));
      const without = await el.screenshot();
      await el.evaluate((e) => e.style.removeProperty("background-image"));
      const d = await maxDiff(page, withShadow, without, radius + 2), where = `${path} 第 ${i + 1} 个（内容 ${sw}px / 可见 ${cw}px），最大色差 ${d}`;
      if (sw > cw + 1) { wide++; expect(d, `${where}：能横滑却没有看得见的阴影`).toBeGreaterThanOrEqual(20); }
      else { fit++; expect(d, `${where}：放得下却画了阴影`).toBe(0); }
    }
  }
  expect(fit, "没有找到放得下的元素，没覆盖「不画阴影」").toBeGreaterThan(0);
  expect(wide, "没有找到能横滑的元素，没覆盖「画阴影」").toBeGreaterThan(0);
  await context.close();
});
