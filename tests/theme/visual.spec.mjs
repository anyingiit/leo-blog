// 像素级视觉回归：每个页面在每个项目（浏览器 × 设备）下整页截图，与 __snapshots__ 里的基准逐像素比对（容差 0）
import { test, expect } from "@playwright/test";
import { connect, settle, fullPage, repaint, fullPageNoScript } from "./helpers.mjs";

// [站点, 路径, 截图名, 是否也拍深色]
const pages = [
  // 本站：模板、样式、配置 + 固定测试文章
  ["site", "/", "site-home", true],
  ["site", "/posts/sample-post/", "site-post", true],
  ["site", "/notes/", "site-notes", true],
  ["site", "/notes/photo-note/", "site-note-single", true],
  ["site", "/notes/page/2/", "site-notes-page2", false], // 短文栏目翻页
  ["site", "/notes/seven-photos/", "site-note-gallery", false], // 多图原位分组（PR #16）
  ["site", "/notes/travel-photos/", "site-note-gallery12", false], // 9 张以上：第 9 张上标「+N」
  ["site", "/tags/样式/", "site-tag", false],
  ["site", "/archives/", "site-archives", false],
  ["site", "/tags/", "site-tags", false],
  ["site", "/404.html", "site-404", false],
  ["site", "/en/", "site-en-home", false],
  ["site", "/en/posts/sample-post/", "site-en-post", false],
  ["site", "/en/notes/", "site-en-notes", false],
  ["site", "/notes/film-ref/", "site-note-film", true], // 别的文章里的短片封面卡片（docs/films.md）
  ["site", "/notes/film-note/", "site-film-page", true], // 短片的文章：宽幅播放器 + 章节目录 + 文字稿
  // 双语对照译文（layouts/bilingual/）：电脑上默认原版版式、平板和手机上默认重排版；全屏阅读；英文页只放说明
  ["site", "/translations/sample-essay/", "site-bilingual", true],
  ["site", "/translations/sample-essay/?read=1", "site-bilingual-read", false],
  ["site", "/en/translations/sample-essay/", "site-en-bilingual", false],
  // PaperMod 官方示例站：主题自身的参照
  ["example", "/", "example-home", true],
  ["example", "/posts/markdown-syntax/", "example-markdown", true],
  ["example", "/page/2/", "example-home-page2", false],
  ["example", "/posts/", "example-posts", false],
  ["example", "/posts/code_syntax/", "example-code", false],
  ["example", "/posts/inner-section/cover-page/", "example-cover", false],
  ["example", "/posts/emoji-support/", "example-emoji", false],
  ["example", "/archives/", "example-archives", false],
  ["example", "/tags/", "example-tags", false],
  ["example", "/fr/", "example-fr-profile", false],
  ["example", "/fa/", "example-fa-rtl", false],
  ["example", "/fa/posts/markdown-syntax/", "example-fa-post", false],
];
const hosts = { site: "http://blog.test", example: "http://example.test" };

// 测试失败时也关掉本测试开的浏览器上下文（每个 worker 一次只跑一个测试）
test.afterEach(async ({ browser }) => { for (const c of browser.contexts()) await c.close(); });

for (const [site, path, name, dark] of pages) {
  for (const scheme of dark ? ["light", "dark"] : ["light"]) {
    test(`${name} · ${scheme}`, async ({ browser }, info) => {
      const context = await browser.newContext({ ...info.project.use, colorScheme: scheme });
      await connect(context);
      const page = await context.newPage();
      const res = await page.goto(hosts[site] + path, { waitUntil: "load" });
      expect(res.status(), `${path} 应该存在`).toBe(200);
      await settle(page);
      await fullPage(page);
      await expect(page).toHaveScreenshot(`${name}-${scheme}.png`);
      await context.close();
    });
  }
}

// 短片全窗口放映：对话框、标题栏和沙箱里的短片（深浅色经 postMessage 同步）
for (const scheme of ["light", "dark"]) {
  test(`site-film-dialog · ${scheme}`, async ({ browser }, info) => {
    const context = await browser.newContext({ ...info.project.use, colorScheme: scheme });
    await connect(context);
    const page = await context.newPage();
    await page.goto(hosts.site + "/notes/film-ref/", { waitUntil: "load" });
    await settle(page);
    await page.click(".film-open");
    const film = page.frameLocator(".film-dialog iframe");
    await film.locator("#theme").filter({ hasText: scheme }).waitFor();
    await film.locator("img").evaluate((img) => img.decode());
    await settle(page);
    await expect(page).toHaveScreenshot(`site-film-dialog-${scheme}.png`);
    await context.close();
  });
}

// 网络状态：图片还没到、CDN 不可用（KaTeX 样式和 Mermaid 加载失败）时，版面也要稳定可读
for (const network of ["images-pending", "cdn-down"]) {
  test(`site-post · ${network}`, async ({ browser, browserName }, info) => {
    const context = await browser.newContext({ ...info.project.use, colorScheme: "light" });
    await connect(context, network);
    const page = await context.newPage();
    await page.goto(hosts.site + "/posts/sample-post/", { waitUntil: network === "images-pending" ? "domcontentloaded" : "load" });
    // 图片未到时 Mermaid 图表也要画出来（settle 里会等它画完）
    await settle(page, { images: network !== "images-pending", mermaid: network !== "cdn-down" });
    // WebKit 里截图前要等 document.fonts.ready，它又要等整页 load，图片一直不回来就永远截不了，只做上面的检查
    if (network === "images-pending" && browserName === "webkit") return;
    await fullPage(page);
    await expect(page).toHaveScreenshot(`site-post-${network}.png`);
    await context.close();
  });
}

// 不执行 JavaScript 时（阅读器、禁用脚本的浏览器）首页和文章也要完整可读
for (const [path, name] of [["/", "site-home"], ["/posts/sample-post/", "site-post"]]) {
  test(`${name} · no-js`, async ({ browser }, info) => {
    const context = await browser.newContext({ ...info.project.use, colorScheme: "light", javaScriptEnabled: false });
    await connect(context);
    const page = await context.newPage();
    expect((await page.goto(hosts.site + path, { waitUntil: "load" })).status()).toBe(200);
    // 禁用脚本时页面里的 requestAnimationFrame 不运行，settle/fullPage 用不了：从测试端拉高视口、轮询到图片全部加载完
    await fullPageNoScript(page);
    await expect.poll(() => page.evaluate(() => [...document.images].every((i) => i.complete))).toBe(true);
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    await page.evaluate(() => document.fonts.ready.then(() => {}));
    await repaint(page);
    await expect(page).toHaveScreenshot(`${name}-no-js.png`);
  });
}
