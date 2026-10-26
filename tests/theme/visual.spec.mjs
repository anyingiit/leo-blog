// 像素级视觉回归：每个页面在每个项目（浏览器 × 设备）下整页截图，与 __screenshots__ 里的基准逐像素比对（容差 0）
import { test, expect } from "@playwright/test";
import { connect, settle, fullPage } from "./helpers.mjs";

// [站点, 路径, 截图名, 是否也拍深色]
const pages = [
  // 本站：模板、样式、配置 + 固定测试文章
  ["site", "/", "site-home", true],
  ["site", "/posts/sample-post/", "site-post", true],
  ["site", "/notes/", "site-notes", true],
  ["site", "/notes/photo-note/", "site-note-single", false],
  ["site", "/archives/", "site-archives", false],
  ["site", "/tags/", "site-tags", false],
  ["site", "/404.html", "site-404", false],
  ["site", "/en/", "site-en-home", false],
  ["site", "/en/posts/sample-post/", "site-en-post", false],
  // PaperMod 官方示例站：主题自身的参照
  ["example", "/", "example-home", true],
  ["example", "/posts/markdown-syntax/", "example-markdown", true],
  ["example", "/posts/code_syntax/", "example-code", false],
  ["example", "/posts/inner-section/cover-page/", "example-cover", false],
  ["example", "/posts/emoji-support/", "example-emoji", false],
  ["example", "/archives/", "example-archives", false],
  ["example", "/tags/", "example-tags", false],
  ["example", "/fr/", "example-fr-profile", false],
  ["example", "/fa/", "example-fa-rtl", false],
];
const hosts = { site: "http://blog.test", example: "http://example.test" };

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

// 网络状态：图片还没到、CDN 不可用（KaTeX 样式和 Mermaid 加载失败）时，版面也要稳定可读
for (const network of ["images-pending", "cdn-down"]) {
  test(`site-post · ${network}`, async ({ browser }, info) => {
    const context = await browser.newContext({ ...info.project.use, colorScheme: "light" });
    await connect(context, network);
    const page = await context.newPage();
    await page.goto(hosts.site + "/posts/sample-post/", { waitUntil: network === "images-pending" ? "domcontentloaded" : "load" });
    await settle(page, { images: network !== "images-pending", mermaid: network !== "cdn-down" });
    await fullPage(page);
    await expect(page).toHaveScreenshot(`site-post-${network}.png`);
    await context.close();
  });
}
