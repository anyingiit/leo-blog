// 页头语言切换（layouts/_partials/header.html、lang_switch_url.html，见 docs/language-switch.md）：
// 有对应语言版本就跳过去，没有就去最近的有该语言版本的上级页面，只有首页和 404 才回首页
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium, webkit, devices } from "playwright";
import { build, serve, root } from "./helpers.mjs";

const BASE = "https://douseful.eu.org";
let site, server, browsers = {}, dom;
before(async () => {
  site = build();
  server = await serve(site.out);
  browsers.chromium = await chromium.launch();
  // CI 里必须有 WebKit；本地没装时只跳过 WebKit 的点击测试
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
  // 只读 HTML 结构，不加载页面引用的任何资源
  const ctx = await browsers.chromium.newContext({ javaScriptEnabled: false });
  await ctx.route("**", (r) => r.abort());
  dom = await ctx.newPage();
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

// 读出一页的语言、页头切换链接、<head> 里的 hreflang 互链；跳转页（别名）返回 null
async function inspect(html) {
  if (/<meta http-equiv="?refresh/.test(html)) return null; // 别名页一加载就会跳走，不读
  await dom.setContent(html, { waitUntil: "domcontentloaded" });
  return dom.evaluate(() => {
    return {
      lang: document.documentElement.lang,
      toggle: [...document.querySelectorAll(".header .lang-menu a")].map((a) => a.getAttribute("href")),
      alternates: Object.fromEntries([...document.querySelectorAll("link[rel=alternate][hreflang]")].map((l) => [l.hreflang, l.getAttribute("href")])),
    };
  });
}
const pathOf = (f) => "/" + relative(site.out, f).replace(/index\.html$/, "");
const htmlFiles = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? htmlFiles(p) : n.endsWith(".html") ? [p] : [];
});
const toggleOf = async (path) => (await inspect(readFileSync(join(site.out, path.endsWith(".html") ? path : path + "index.html"), "utf8"))).toggle;

test("header.html 是 PaperMod 原版加上一处改动（升级主题后要重新拷贝，否则这里失败）", () => {
  const upstream = readFileSync(join(root, "themes/PaperMod/layouts/_partials/header.html"), "utf8");
  const ours = readFileSync(join(root, "layouts/_partials/header.html"), "utf8");
  const from = '<a href="{{- .Permalink -}}" title=';
  const to = '<a href="{{- partial "lang_switch_url.html" (dict "page" $ "lang" .Lang "fallback" .Permalink) -}}" title=';
  assert.equal(upstream.split(from).length, 2, "PaperMod 的语言切换写法变了，按 docs/language-switch.md 重做");
  assert.equal(ours.slice(ours.indexOf("\n") + 1), upstream.replace(from, to));
});

// 各类页面的期望去向（中 → 英、英 → 中）
const cases = [
  ["首页", "/", "/en/"],
  ["长文", "/posts/hello-world/", "/en/posts/hello-world/"],
  ["长文（英 → 中）", "/en/posts/blog-postmortem/", "/posts/blog-postmortem/"],
  ["短文", "/notes/translating-claudes-thoughts/", "/en/notes/translating-claudes-thoughts/"],
  ["带图短文（文件夹）", "/en/notes/clever/", "/notes/clever/"],
  ["没有英文版的短文 → 英文短文栏目", "/notes/edge-cases/", "/en/notes/"],
  ["短文栏目", "/notes/", "/en/notes/"],
  ["长文栏目", "/en/posts/", "/posts/"],
  ["归档", "/archives/", "/en/archives/"],
  ["搜索", "/en/search/", "/search/"],
  ["标签总览", "/tags/", "/en/tags/"],
  ["两种语言同名的标签", "/tags/ai/", "/en/tags/ai/"],
  ["译名不同的标签 → 标签总览", "/tags/随笔/", "/en/tags/"],
  ["译名不同的标签（英 → 中）", "/en/tags/notes/", "/tags/"],
  ["404 → 首页", "/404.html", "/en/"],
  ["404（英 → 中）→ 首页", "/en/404.html", "/"],
];
for (const [name, from, to] of cases) {
  test(`${name}：${from} → ${to}`, async () => assert.deepEqual(await toggleOf(from), [BASE + encodeURI(to)]));
}

test("所有页面：有对应语言版本时切换到它；没有时去一个存在的同语言上级页，只有首页和 404 才回首页", async () => {
  let checked = 0, translated = 0;
  for (const f of htmlFiles(site.out)) {
    if (/\/films\/[^/]+\/play\//.test(pathOf(f))) continue; // 短片播放器是原样发布的短片页面，不是博客页面（docs/films.md）
    const info = await inspect(readFileSync(f, "utf8"));
    if (!info) continue;
    const path = pathOf(f), other = info.lang === "en" ? "zh" : "en", home = BASE + (other === "en" ? "/en/" : "/");
    assert.equal(info.toggle.length, 1, `${path} 的语言切换链接数`);
    const [href] = info.toggle;
    const target = decodeURI(href.replace(BASE, ""));
    assert.ok(site.exists(target.endsWith("/") ? target + "index.html" : target), `${path} → ${href} 不存在`);
    assert.equal(target.startsWith("/en/"), other === "en", `${path} → ${href} 语言不对`);
    if (/^\/(en\/)?(404\.html)?$/.test(path)) { assert.equal(href, home, `${path} 应切到首页`); checked++; continue; }
    if (info.alternates[other]) { assert.equal(href, info.alternates[other], `${path} 有对应版本，应切到它`); translated++; }
    else {
      // 去掉 /en 前缀后比较路径：目标必须是当前页的上级，且不能一路退回首页
      const bare = (p) => p.replace(/^\/en\//, "/");
      assert.ok(decodeURI(bare(path)).startsWith(bare(target)), `${path} → ${href} 不是它的上级`);
      assert.notEqual(href, home, `${path} 没有对应版本时退回了首页，应退到栏目或标签总览`);
    }
    checked++;
  }
  assert.ok(checked > 60 && translated > 40, `检查了 ${checked} 页，其中 ${translated} 页有译文`);
});

// 真实点击：Chromium（Chrome）和 WebKit（Safari 引擎），电脑和手机视口
for (const [engine, devs] of [["chromium", [["电脑", { viewport: { width: 1280, height: 800 } }], ["手机", devices["Pixel 7"]]]],
                              ["webkit", [["电脑", { viewport: { width: 1280, height: 800 } }], ["手机", devices["iPhone 13"]]]]]) {
  for (const [name, opts] of devs) {
    test(`${engine} ${name}：在文章里点页头的 En 到英文文章，再点「中」回来`, async (t) => {
      if (!browsers[engine]) return t.skip("本地没有安装 WebKit（npx playwright install webkit）");
      const ctx = await browsers[engine].newContext(opts);
      // 页面里的链接是正式域名的绝对地址，转到本地服务器
      await ctx.route(BASE + "/**", async (r) => r.fulfill({ response: await ctx.request.fetch(r.request().url().replace(BASE, server.url)) }));
      const page = await ctx.newPage();
      await page.goto(BASE + "/posts/hello-world/");
      await page.locator(".header .lang-menu a").click();
      await page.waitForURL(BASE + "/en/posts/hello-world/");
      assert.equal(await page.locator("html").getAttribute("lang"), "en");
      await page.locator(".header .lang-menu a").click();
      await page.waitForURL(BASE + "/posts/hello-world/");
      await ctx.close();
    });
  }
}
