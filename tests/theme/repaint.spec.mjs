// 截图只取决于页面最终的样子，与它是怎么画出来的无关（helpers.mjs 的 repaint，docs/testing.md「截图与绘制历史」）。
// Chromium 只重画页面一部分时，点状下划线的抗锯齿和整页一起画时不同；机器忙时加载过程不同，截图就会偶尔和基准差几十个像素。
// 这里用两种必定只重画局部的操作代替"机器忙"，结果是确定的，不靠运气复现
import { test, expect } from "@playwright/test";
import { connect, settle, fullPage } from "./helpers.mjs";

const frame = (page) => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
const shot = (page) => page.screenshot({ animations: "disabled", caret: "hide", scale: "css" });

test("截图与绘制历史无关", async ({ browser, browserName }, info) => {
  const context = await browser.newContext({ ...info.project.use, colorScheme: "light" });
  await connect(context);
  const page = await context.newPage();
  const vp = page.viewportSize();
  // PaperMod 示例站的 Markdown 页：元信息行的链接和 <abbr> 都有点状下划线（CI 里两次偶发失败都在这页）
  await page.goto("http://example.test/posts/markdown-syntax/", { waitUntil: "load" });
  await settle(page);
  await fullPage(page);
  const full = page.viewportSize();
  const clean = await shot(page);

  // 回到原来的视口，制造局部重画：窗口宽度变 1px 再变回（版面恢复原样）；元信息行隐藏再显示
  await page.setViewportSize(vp);
  await page.setViewportSize({ width: vp.width - 1, height: vp.height });
  await frame(page);
  await page.setViewportSize(vp);
  await frame(page);
  await page.locator(".post-meta").evaluate((e) => { e.style.visibility = "hidden"; });
  await frame(page);
  await page.locator(".post-meta").evaluate((e) => { e.style.visibility = ""; });
  await frame(page);

  // 前提：不整页重画时，上面的操作确实让截图变了，否则这个测试证明不了什么。
  // 只在 Chromium 上要求（问题出在 Chromium）；哪天 Chromium 修好了这里会失败，届时可以去掉 repaint 和本测试
  await page.setViewportSize(full);
  await frame(page);
  const dirty = await shot(page);
  if (browserName === "chromium") expect(dirty.equals(clean), "局部重画后截图本应不同（复现条件失效）").toBe(false);

  // 重新从原来的视口拉到整页高度（和第一次截图同样的步骤，页面高度才一致），fullPage 最后整页重画
  await page.setViewportSize(vp);
  await fullPage(page);
  const again = await shot(page);
  if (!again.equals(clean)) {
    await info.attach("clean.png", { body: clean, contentType: "image/png" });
    await info.attach("after-repaint.png", { body: again, contentType: "image/png" });
  }
  expect(again.equals(clean), "整页重画后截图应与第一次完全相同（两张图见附件）").toBe(true);
  await context.close();
});
