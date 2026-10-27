// 把版本页的完整 HTML（Hugo 输出的 <版本>/full.html）打印成 PDF，放回版本目录，随版本一起发布。
// 版本目录只增不改，所以每个版本只需在导入后运行一次：
//
//   bash build.sh -d /tmp/s1site            # 先构建一次站点，得到 full.html
//   node tools/s1-import/pdf.cjs /tmp/s1site/translations/anthropic-s1/v1.0/full.html \
//        content/translations/anthropic-s1/v1.0/anthropic-s1-zh-unofficial-v1.0.pdf
//
// 页面：原文每页 612×792pt 原样一页，底部另加 18pt 的一条页脚（非官方标记 + PDF 页码），不压到原文内容；
// 第一页是完整的译者声明和目录。需要 Playwright（tests/ 里 npm ci 后就有）。
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

let playwright;
try { playwright = require("playwright"); } catch { playwright = require(path.join(__dirname, "../../tests/node_modules/playwright")); }

(async () => {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) { console.error("用法：node pdf.cjs <full.html 路径或网址> <输出 PDF 路径>"); process.exit(2); }
  const url = /^https?:/.test(src) ? src : pathToFileURL(path.resolve(src)).href;
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });
  // 页面大小、页边和每页底部的「非官方」标记都由 full.html 的 @page 规则决定（读者自己打印也一样）
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true, outline: true, tagged: true });
  await browser.close();
  console.log(`${out}  ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
})();
