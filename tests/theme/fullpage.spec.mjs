// 整页截图要截到完整的页面：高度等于读者在原视口里从头滚到尾的页面高度，页脚在最底下（helpers.mjs 的 fullPage）。
// 曾经的问题：PaperMod 的 .main 用 min-height: calc(100vh - …)，拉高视口时页面跟着变高，手机上永远追不上，
// 截出来末尾一大段空白、页脚被截掉（docs/testing.md「整页截图与 vh」）。这里在每个浏览器×设备上检查几类页面
import { test, expect } from "@playwright/test";
import { connect, settle, fullPage, fullPageNoScript, pageHeight } from "./helpers.mjs";

const pages = [
  "http://example.test/posts/markdown-syntax/", // 长文（发现问题的页面）
  "http://example.test/archives/",
  "http://example.test/fr/", // 个人主页模式：.profile 也用 100vh
  "http://example.test/tags/", // 内容不满一屏：页面高度由 min-height 决定
  "http://blog.test/",
  "http://blog.test/posts/sample-post/",
  "http://blog.test/404.html",
];

// 原视口下读者看到的页面：总高度（向上取整，和 fullPage 一致）和页脚底边在文档里的位置
const measure = async (page) => ({ height: await pageHeight(page),
  footer: await page.evaluate(() => document.querySelector("footer.footer").getBoundingClientRect().bottom + scrollY) });

async function check(page, before) {
  const vp = page.viewportSize().height;
  const after = await measure(page);
  expect(vp, "截图高度应等于原视口下的页面高度").toBe(before.height);
  expect(after.height, "拉高视口后页面不应变高").toBe(before.height);
  expect(after.footer, "页脚位置应和原视口下一样（下面不多出空白）").toBe(before.footer);
  expect(after.footer, "页脚应在截图范围内").toBeLessThanOrEqual(vp);
}

test.afterEach(async ({ browser }) => { for (const c of browser.contexts()) await c.close(); });

for (const url of pages) {
  test(`整页截图包含页脚：${url.replace("http://", "")}`, async ({ browser }, info) => {
    const context = await browser.newContext({ ...info.project.use, colorScheme: "light" });
    await connect(context);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    await settle(page);
    const before = await measure(page);
    await fullPage(page);
    await check(page, before);
  });
}

test("整页截图包含页脚：禁用脚本", async ({ browser }, info) => {
  const context = await browser.newContext({ ...info.project.use, colorScheme: "light", javaScriptEnabled: false });
  await connect(context);
  const page = await context.newPage();
  await page.goto("http://blog.test/", { waitUntil: "load" });
  const before = await measure(page);
  await fullPageNoScript(page);
  await check(page, before);
});
