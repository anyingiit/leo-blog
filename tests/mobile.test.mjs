// 手机端的样式契约（docs/testing.md「手机端」）。主题截图测试为了基准稳定不开手机模式（DPR 1、没有 isMobile），
// 2026-10-28 的手机端全面检查找到的问题都出在那套测试看不到的地方：320 宽、横屏、iOS 独有的行为。这里补上：
//   1. 静态检查（不开浏览器）：站点生成的每个自带 <html> 的页面都关掉 iOS 文字自动放大，不禁止双指缩放。
//      内容目录里原样提供的 HTML（.html.raw，下载文件）不查：按项目规则保留原始 HTML 的一切特征，不替它修；
//      S-1 完整 HTML 的这条由 s1.test.mjs 单独检查（它是本站按模板生成的）
//   2. 真实手机参数（isMobile、DPR 2/3、触屏，Chromium 和 WebKit）逐页检查：没有横向滚动，
//      能点的东西没有被挤出屏幕或被裁掉（宽表格、代码块、原版页这些本来就横向滚动的内容除外），输入框字号不小于 16px
// S-1 全屏阅读顶栏、版本表、横版页这些译本专有的检查在 s1-behavior.test.mjs 的手机用例里
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { chromium, webkit, devices } from "playwright";
import { build, serve, root } from "./helpers.mjs";

let site, server;
const browsers = {};
before(async () => {
  site = build();
  server = await serve(site.out);
  browsers.chromium = await chromium.launch();
  // CI 里必须有 WebKit；本地没装时只跳过 WebKit 的用例
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

// ---------- 1. 静态检查 ----------

// 构建结果里站点生成的 HTML：.html.raw 会以 .html 的名字原样发布，按文件内容排除
const htmlFiles = () => {
  // 测试站点还会挂载 tests/ 下的样例内容（tests/hugo.test.yaml），所以查整个仓库里登记的 .html.raw
  const files = spawnSync("git", ["ls-files", "*.html.raw"], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const raw = new Set(files.map((f) => readFileSync(join(root, f), "utf8")));
  return readdirSync(site.out, { recursive: true }).map(String).filter((f) => f.endsWith(".html")).map((f) => join(site.out, f)).filter((f) => !raw.has(readFileSync(f, "utf8")));
};
// iOS 只认带 -webkit- 前缀的写法；Chromium 解析时会丢掉它，所以查原文
const ADJUST = /(^|[}\s,;])html\s*\{[^}]*-webkit-text-size-adjust:\s*100%/;

test("站点生成的每个自带 <html> 的页面都关掉了 iOS 的文字自动放大（-webkit-text-size-adjust: 100%）", () => {
  // 站内页面用主题样式表（PaperMod reset.css 里有这条）；本站生成的独立页面（如短片页）要自己写。
  // 缺了它，iPhone（含 X、微信里打开）会把缩小显示的小字放大，固定行距的原版页文字互相重叠（2026-10-28 S-1 完整 HTML）
  const sheets = new Map();
  const missing = [];
  let checked = 0;
  for (const f of htmlFiles()) {
    const html = readFileSync(f, "utf8");
    if (!/<html[\s>]/i.test(html) || /http-equiv=["']?refresh/i.test(html.slice(0, 2000))) continue; // 片段、Hugo 的跳转页
    checked++;
    let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    for (const [, href] of html.matchAll(/<link\b[^>]*\bhref=["']?([^"'\s>]+\.css)[^>]*>/gi)) {
      const p = join(site.out, new URL(href, "https://douseful.eu.org/").pathname);
      if (!sheets.has(p)) { try { sheets.set(p, readFileSync(p, "utf8")); } catch { sheets.set(p, ""); } }
      css += "\n" + sheets.get(p);
    }
    if (!ADJUST.test(css)) missing.push(f.replace(site.out, ""));
  }
  assert.ok(checked > 50, `只检查到 ${checked} 个页面，文件清单可能不对`);
  assert.deepEqual(missing, [], "这些页面缺少 html { -webkit-text-size-adjust: 100% }");
});

test("没有页面禁止双指缩放（viewport 里不能有 user-scalable=no 或 maximum-scale）", () => {
  const bad = [];
  for (const f of htmlFiles()) {
    const head = readFileSync(f, "utf8").slice(0, 4000);
    for (const [m] of head.matchAll(/<meta\b[^>]*name=["']?viewport[^>]*>/gi)) if (/user-scalable\s*=\s*(no|0)|maximum-scale/i.test(m)) bad.push(f.replace(site.out, ""));
  }
  assert.deepEqual(bad, []);
});

// ---------- 2. 真实手机参数逐页检查 ----------

const PAGES = [
  "/", "/en/", "/notes/", "/en/notes/", "/archives/", "/en/archives/", "/tags/", "/en/tags/", "/search/", "/en/search/", "/404.html",
  "/posts/blog-postmortem/", "/en/posts/blog-postmortem/",
  "/translations/", "/en/translations/", "/translations/anthropic-s1/", "/en/translations/anthropic-s1/",
];
// S-1 的版本页和两种视图的章节页（最新版本，见译本首页 front matter）
const LATEST = readFileSync(join(root, "content/translations/anthropic-s1/_index.md"), "utf8").match(/^latest: (\S+)$/m)[1];
const S1 = `/translations/anthropic-s1/${LATEST}/`;
PAGES.push(S1, S1 + "summary-financial-data/", S1 + "principal-stockholders/");
// 双语译文沿用 S-1 的阅读界面（含全屏阅读顶栏）
PAGES.push("/translations/bitter-lesson/", "/translations/bitter-lesson/?read=1");

// 320 宽的 iPhone SE（也相当于 iPhone 13 上 Safari 把页面放大到约 120%）、iPhone 13 竖屏和横屏；安卓只在 Chromium 上有意义
const DEVICES = {
  chromium: ["iPhone SE", "iPhone 13", "iPhone 13 landscape", "Pixel 7"],
  webkit: ["iPhone SE", "iPhone 13", "iPhone 13 landscape"],
};
// 本来就该横向滚动的内容：表格、代码块、公式、原版页，以及 PaperMod 的页头菜单（.menu 放不下时 overflow-x: auto 整行横滑，
// 这是主题原有行为；按项目规则以 PaperMod 为准，不改成折行）
const SCROLLERS = "table, pre, code, .katex-display, .s1-sheets, #menu";

const inspect = (page) => page.evaluate((SCROLLERS) => {
  const vw = document.documentElement.clientWidth;
  const out = { overflow: document.documentElement.scrollWidth - vw, clipped: [], smallInputs: [] };
  for (const el of document.querySelectorAll("a[href], button, summary, input, select, textarea")) {
    if (!el.checkVisibility({ visibilityProperty: true }) || el.closest(SCROLLERS)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const name = `${el.tagName.toLowerCase()}「${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)}」`;
    // 挤出屏幕，或被某个会裁剪的祖先（overflow 不是 visible）挡住了一部分
    if (r.left < -1 || r.right > vw + 1) { out.clipped.push(name + " 超出屏幕"); continue; }
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const q = a.getBoundingClientRect();
      if (r.left < q.left - 1 || r.right > q.right + 1) { out.clipped.push(`${name} 被 ${a.tagName.toLowerCase()}.${String(a.className).split(" ")[0]} 裁掉`); break; }
    }
    // iOS 聚焦字号小于 16px 的输入框时会把整页放大，而且不会自动缩回
    if (el.matches("input:not([type=checkbox], [type=radio], [type=button], [type=submit]), select, textarea") && parseFloat(getComputedStyle(el).fontSize) < 16) out.smallInputs.push(name);
  }
  return out;
}, SCROLLERS);

for (const engine of ["chromium", "webkit"]) {
  for (const device of DEVICES[engine]) {
    test(`${engine} · ${device}：没有横向滚动，能点的东西都在屏幕里，输入框不小于 16px`, async (t) => {
      if (!browsers[engine]) return t.skip("本地没有安装 WebKit（npx playwright install webkit）");
      const ctx = await browsers[engine].newContext({ ...devices[device], baseURL: server.url });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const problems = [];
      for (const p of PAGES) {
        await page.goto(p, { waitUntil: "load" });
        const r = await inspect(page);
        if (r.overflow > 0) problems.push(`${p} 可以左右拖动 ${r.overflow}px`);
        for (const c of r.clipped) problems.push(`${p} ${c}`);
        for (const c of r.smallInputs) problems.push(`${p} ${c} 字号小于 16px`);
      }
      await ctx.close();
      assert.deepEqual(problems, []);
      assert.deepEqual(errors, [], "页面不应有脚本错误");
    });
  }
}
