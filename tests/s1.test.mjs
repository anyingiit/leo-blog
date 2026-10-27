// S-1 译本的全文下载（完整 HTML + PDF）：用预览样例（tests/fixtures/s1-preview，方案 D4 = s1dl: best）检查
//   - 下载入口出现在该出现的地方，都是直链、没有任何门槛（不弹窗、不要求同意、不登录）
//   - 已发布版本的冻结文件原样发布（和 front matter 的 sha256 一致），未发布版本只有模板生成的 full.html
//   - 完整 HTML 是单文件、首末都有译者声明；下载文件不进搜索引擎（_headers）
//   - 手机和电脑上都没有横向滚动，全屏阅读的目录面板里有下载链接
// 冻结文件本身（PDF 页数、每页「非官方」标记、文字层、书签）由 tools/s1-import/test_release.py 检查
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { chromium, devices } from "playwright";
import { build, serve, root } from "./helpers.mjs";

const FIX = join(root, "tests/fixtures/s1-preview/versions/v1.0");
const NAME = "anthropic-s1-zh-unofficial-v1.0";
const fm = readFileSync(join(FIX, "_index.md"), "utf8");
const downloads = JSON.parse(fm.match(/^downloads: (.+)$/m)[1]);

let site, server, browser;
before(async () => {
  site = build();
  server = await serve(site.out);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); site?.remove(); });

const read = (p) => readFileSync(join(site.out, p), "utf8");
const links = (html, re) => [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).filter((a) => re.test(a));
const files = (dir) => readdirSync(dir, { recursive: true }).map(String);

test("已发布版本的冻结文件原样发布，内容和 front matter 的 sha256 一致", () => {
  for (const [kind, d] of Object.entries(downloads)) {
    const b = readFileSync(join(site.out, "s1-d4/v1.0", d.file));
    assert.equal(b.length, d.bytes, kind);
    assert.equal(createHash("sha256").update(b).digest("hex"), d.sha256, kind);
  }
  // .html 不能被 Hugo 当成文章渲染成 <名字>/index.html（hugo.yaml 的 contentTypes）
  assert.ok(!site.exists(`s1-d4/v1.0/files/${NAME}/index.html`));
  // 已发布的版本不再从模板生成 full.html
  assert.ok(!site.exists("s1-d4/v1.0/full.html"));
});

test("章节的 original.html 只在模板里读取，不单独发布", () => {
  assert.deepEqual(files(site.out).filter((f) => f.endsWith("original.html")), []);
});

test("下载入口：译本首页和版本页是卡片，章节版本条、版本表各一行；都是直链", () => {
  const html = `/s1-d4/v1.0/files/${NAME}.html`, pdf = `/s1-d4/v1.0/files/${NAME}.pdf`;
  for (const page of ["s1-d4/index.html", "s1-d4/v1.0/index.html", "s1-d4/v1.0/cover/index.html"]) {
    const h = read(page);
    const toHtml = links(h, new RegExp(`href="?${html}`)), toPdf = links(h, new RegExp(`href="?${pdf}`));
    assert.ok(toHtml.length >= 1 && toPdf.length >= 1, page);
    // HTML 在新标签页打开（也可另存），PDF 直接下载，不在站内用查看器打开
    assert.ok(toHtml.some((a) => /target="?_blank/.test(a)), page);
    assert.ok(toPdf.every((a) => /\bdownload=/.test(a)), page);
    // 没有任何门槛：不拦截点击、不要求同意或登录
    for (const a of [...toHtml, ...toPdf]) assert.doesNotMatch(a, /onclick|data-confirm|javascript:/, page);
    assert.doesNotMatch(h, /同意后下载|登录后下载|输入邮箱/, page);
    assert.match(h, new RegExp(`${(downloads.pdf.bytes / 1048576).toFixed(1)} MB`), `${page} 显示 PDF 大小`);
  }
  // 首页卡片下面给出 sha256；版本表多一列「全文下载」
  assert.match(read("s1-d4/index.html"), new RegExp(downloads.pdf.sha256.slice(0, 12)));
  assert.match(read("s1-d4/index.html"), /class="?s1-dl-col/);
  // 版本页只有卡片，不再重复一行
  assert.doesNotMatch(read("s1-d4/v1.0/index.html"), /class="?s1-dl-line/);
});

test("未发布的版本：模板生成单文件 full.html，入口只给 HTML", () => {
  const h = read("s1-d4/v0.9/full.html");
  assert.match(h, /<html[^>]* data-standalone/);
  assert.match(h, /<meta name="?robots"? content="?noindex/);
  assert.equal(h.split("人工没有检查、也没有能力检查译文与原文的一致性").length - 1, 2, "首末各一份完整声明");
  assert.doesNotMatch(h, /<(img|script|iframe)[^>]+src="?(https?:|\/\/|\/)/);
  assert.doesNotMatch(h, /<link[^>]+rel="?stylesheet/);
  const page = read("s1-d4/v0.9/index.html");
  assert.ok(links(page, /href="?\/s1-d4\/v0\.9\/full\.html/).length >= 1);
  assert.doesNotMatch(page, /v0\.9\/files\//);
});

test("下载文件不进搜索引擎（Cloudflare Pages _headers）", () => {
  const h = read("_headers");
  for (const path of ["/:root/:version/files/*", "/:section/:root/:version/files/*"]) {
    assert.match(h, new RegExp(`^${path.replace(/[*]/g, "\\*")}\\n\\s+X-Robots-Tag: noindex`, "m"));
  }
});

for (const [name, opts] of [["手机", devices["iPhone 13"]], ["电脑", { viewport: { width: 1280, height: 900 } }]]) {
  test(`${name}：下载相关页面没有横向滚动、没有脚本错误`, async () => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const p of ["/s1-d4/", "/s1-d4/v1.0/", "/s1-d4/v1.0/cover/", `/s1-d4/v1.0/files/${NAME}.html`, "/s1-d4/v0.9/full.html"]) {
      await page.goto(server.url + p, { waitUntil: "load" });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), p);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test("全屏阅读：目录面板底部有下载链接，不另加按钮", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(server.url + "/s1-d4/v1.0/cover/?read=1", { waitUntil: "load" });
  const dl = page.locator(".s1-ibar-panel .s1-ibar-dl a");
  assert.equal(await dl.count(), 2);
  assert.equal(await dl.first().isVisible(), false);
  await page.locator(".s1-ibar summary").first().click();
  await dl.first().waitFor({ state: "visible", timeout: 2000 });
  assert.equal(await page.locator(".s1-ibar > .s1-dl-line, .s1-ibar > .s1-dl-menu").count(), 0);
  await ctx.close();
});

// 和 PaperMod 的「契约」：译本页的自定义样式只依赖主题的这些 CSS 变量和类名（tests 之外的说明见 docs/testing.md）。
// 升级主题后这里失败，说明译本页的样式要跟着改；构建本身不会因此失败，所以要靠测试发现
test("PaperMod 契约：译本样式用到的 CSS 变量和页面结构都还在", async () => {
  const vars = ["--border", "--secondary", "--primary", "--radius", "--entry", "--gap", "--theme", "--main-width", "--code-bg"];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(server.url + "/s1-d4/v1.0/cover/", { waitUntil: "load" });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    const missing = await page.evaluate((vs) => vs.filter((v) => !getComputedStyle(document.documentElement).getPropertyValue(v).trim()), vars);
    assert.deepEqual(missing, [], `${theme} 主题缺少 CSS 变量`);
  }
  for (const sel of ["header.header", "main.main", "footer.footer", ".top-link"]) assert.equal(await page.locator(sel).count(), 1, sel);
  // 宽版：原版版式比主题的正文栏宽；全屏阅读：主题的页头、页脚、返回顶部都隐藏
  const [orig, col] = await page.evaluate(() => [document.querySelector(".s1-original")?.getBoundingClientRect().width ?? 0,
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--main-width"))]);
  assert.ok(orig > col + 200, `原版版式宽 ${orig}px，主题正文栏 ${col}px`);
  await page.goto(server.url + "/s1-d4/v1.0/cover/?read=1", { waitUntil: "load" });
  await page.locator(".s1-ibar").waitFor({ state: "visible" });
  for (const sel of ["header.header", "footer.footer", ".top-link"]) assert.equal(await page.locator(sel).isVisible(), false, `全屏阅读时 ${sel} 应隐藏`);
  await ctx.close();
});
