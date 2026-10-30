// Anthropic 系统卡中文译本（tools/syscard-import/、layouts/syscards/、layouts/_partials/syscards/、assets/css/extended/syscards.css）：
// 用仓库里导入的全部系统卡（content/translations/system-cards/_index.md 的 cards）检查
//   - 构建结果：每份卡的 HTML、PDF 都发布在 /translations/system-cards/files/，大小和 sha256 与 front matter 一致、
//     HTML 与内容目录里的 .html.raw 逐字节相同（原样提供：不加统计脚本、图标、声明）、每个文件不超过 Cloudflare Pages 的 25 MiB、
//     文件只发布一份（英文页不另发 /en/ 副本）、.raw 本身不发布；
//     中英文页列出每份卡，链接齐全（在线阅读新标签打开、下载用原文件名、英文原版和翻译说明的地址格式、译文仓库链接固定到导入的提交）；
//     译者声明（非官方、2.2 节另行翻译、译文一致性未经人工核对、下架邮箱）；译文栏目列表收录本页；中英文页互链
//   - 浏览器（Chromium 和 WebKit）：电脑和手机都没有横向滚动、每张卡片在屏幕里；深色模式卡片跟着变色；
//     点「在线阅读」在新标签打开的就是那份 HTML、没有脚本错误；Cloudflare 邮件地址混淆下没有脚本错误、下架邮箱照常解开
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, webkit, devices } from "playwright";
import { build, serve, root, cfEmailObfuscation } from "./helpers.mjs";

const BASE = "https://douseful.eu.org";
const DIR = join(root, "content/translations/system-cards");
const P = "/translations/system-cards/";
const LIMIT = 25 * 1024 * 1024;
const ENGINES = ["chromium", "webkit"];
const PHONE = { chromium: devices["Pixel 7"], webkit: devices["iPhone 13"] };

// import.py 把 front matter 每项写成一行 JSON
const frontMatter = (f) => Object.fromEntries(readFileSync(join(DIR, f), "utf8").split("\n---\n")[0].split("\n").slice(1)
  .map((l) => { const i = l.indexOf(": "); return [l.slice(0, i), JSON.parse(l.slice(i + 2))]; }));
const zh = frontMatter("_index.md");
const en = frontMatter("_index.en.md");
const cards = zh.cards;

let site, server;
const browsers = {};
before(async () => {
  site = build();
  server = await serve(site.out);
  browsers.chromium = await chromium.launch();
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

const read = (p) => readFileSync(join(site.out, p.endsWith("/") ? p + "index.html" : p), "utf8");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const url = (c, kind) => `${P}files/${c.slug}.${kind}`;

test("测试前提：导入了系统卡，中英文页的卡片列表相同", () => {
  assert.ok(cards.length >= 10, `只有 ${cards.length} 份`);
  assert.deepEqual(en.cards, zh.cards);
  assert.equal(zh.type, "syscards");
  assert.match(zh.sourceCommit, /^[0-9a-f]{40}$/);
});

// ---------- 构建结果 ----------
test("下载文件：发布在 files/ 下，大小和 sha256 与 front matter 一致，HTML 与 .html.raw 逐字节相同，不超过 25 MiB", () => {
  for (const c of cards) {
    for (const kind of ["html", "pdf"]) {
      const buf = readFileSync(join(site.out, url(c, kind)));
      assert.equal(buf.length, c[kind].bytes, `${c.slug}.${kind} 大小`);
      assert.equal(sha(buf), c[kind].sha256, `${c.slug}.${kind} sha256`);
      assert.ok(buf.length <= LIMIT, `${c.slug}.${kind} 超过 Cloudflare Pages 单文件上限`);
      assert.ok(readFileSync(join(DIR, c[kind].file)).equals(buf), `${c.slug}.${kind} 与内容目录里的文件不同`);
    }
    assert.ok(!site.exists(`${P}files/${c.slug}.html.raw`), ".raw 本身不发布");
    assert.ok(!site.exists(`/en${url(c, "html")}`) && !site.exists(`/en${url(c, "pdf")}`), "文件只发布一份");
    // 超限才瘦身；没超限的 PDF 原样复制（sourceBytes 只出现在瘦身过的）
    if (c.pdf.slimmed) assert.ok(c.pdf.sourceBytes > LIMIT && c.pdf.bytes < c.pdf.sourceBytes);
    else assert.equal(c.pdf.sourceBytes, undefined);
  }
});

test("在线阅读的 HTML 原样提供：没有加统计脚本、网站图标、声明或 noindex", () => {
  for (const c of cards) {
    const html = read(url(c, "html"));
    assert.ok(!html.includes("cloudflareinsights") && !/rel="?icon/.test(html) && !/noindex/.test(html), c.slug);
    assert.match(html, new RegExp(`<title>${c.title}</title>`));
  }
});

for (const [lang, path, fm] of [["zh", P, zh], ["en", "/en" + P, en]]) {
  test(`${lang} 页：每份卡一张卡片，链接齐全`, () => {
    const html = read(path);
    assert.equal(html.match(/class="?sc-card/g)?.length, cards.length);
    for (const c of cards) {
      const card = html.slice(html.indexOf(`id=${c.slug}>`), html.indexOf("</section>", html.indexOf(`id=${c.slug}>`)));
      assert.ok(card, c.slug);
      const h = url(c, "html"), p = url(c, "pdf");
      assert.match(card, new RegExp(`href=${h} target=_blank rel=noopener`), `${c.slug} 在线阅读在新标签打开`);
      assert.ok(card.includes(`href=${h} download="${c.html.name}"`) || card.includes(`href=${h} download=${c.html.name}`), `${c.slug} HTML 下载用原文件名`);
      assert.ok(card.includes(`href=${p} download="${c.pdf.name}"`) || card.includes(`href=${p} download=${c.pdf.name}`), `${c.slug} PDF 下载用原文件名`);
      assert.match(c.official, /^https:\/\/www\.anthropic\.com\/claude-[a-z0-9-]+-system-card$/);
      assert.equal(c.official, `https://www.anthropic.com/claude-${c.slug.replaceAll(".", "-")}-system-card`);
      assert.ok(card.includes(`href=${c.official}`), `${c.slug} 英文原版`);
      if (lang === "zh") assert.ok(card.includes(`href=${c.readme}`), `${c.slug} 翻译说明`);
      assert.equal(c.readme, `${fm.sourceRepo}/tree/${fm.sourceCommit}/${c.slug}`);
      assert.match(card, new RegExp(`${c.pages} ${lang === "zh" ? "页" : "pages"}`));
      assert.ok(card.includes(lang === "zh" ? c.note : c.noteEn));
    }
    // 卡片按原版发布日期从新到旧
    const order = [...html.matchAll(/class="?sc-card"? id="?([^\s">]+)/g)].map((m) => m[1]);
    assert.deepEqual(order, [...cards].sort((a, b) => b.released.localeCompare(a.released)).map((c) => c.slug));
  });

  test(`${lang} 页：译者声明、权利行、下架邮箱、译文仓库链接`, () => {
    const html = read(path);
    const notice = html.slice(html.indexOf("s1-notice"), html.indexOf("</aside>"));
    for (const s of lang === "zh" ? ["非官方中文译本", "2.2 节", "译文一致性未经人工核对", "以 Anthropic 官网的英文原版为准"]
      : ["unofficial Chinese translations", "Section 2.2", "No person has checked", "English originals on Anthropic"]) assert.ok(notice.includes(s), s);
    assert.ok(notice.includes(`${fm.sourceRepo}/tree/${fm.sourceCommit}`));
    assert.equal(html.match(/mailto:leoycwan@gmail\.com/g)?.length, 2, "声明和权利行各一次");
    assert.match(html, /class="?s1-rights/);
  });
}

test("中英文页互链；译文栏目列表收录本页", () => {
  assert.match(read(P), new RegExp(`hreflang=en href=${BASE}/en${P}`));
  assert.match(read("/en" + P), new RegExp(`hreflang=zh href=${BASE}${P}`));
  assert.ok(read("/translations/").includes(`${BASE}${P}`) || read("/translations/").includes(`href=${P}`));
  assert.ok(read("/en/translations/").includes(`${BASE}/en${P}`) || read("/en/translations/").includes(`href=/en${P}`));
});

// ---------- 浏览器 ----------
async function open(t, engine, opts) {
  if (!browsers[engine]) { t.skip("本地没有安装 WebKit（npx playwright install webkit）"); return null; }
  const ctx = await browsers[engine].newContext(opts);
  const errors = [];
  ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e)));
  const page = await ctx.newPage();
  return { ctx, page, go: (p) => page.goto(server.url + p, { waitUntil: "load" }),
    done: async () => { await ctx.close(); assert.deepEqual(errors.map((e) => e.message), [], "页面不应有脚本错误"); } };
}

for (const engine of ENGINES) {
  for (const [name, opts] of [["电脑", { viewport: { width: 1280, height: 800 } }], ["手机", PHONE[engine]], ["320 宽", { ...PHONE[engine], viewport: { width: 320, height: 640 } }]]) {
    test(`${engine} ${name}：中英文页没有横向滚动，每张卡片和每个链接都在屏幕里`, async (t) => {
      const s = await open(t, engine, opts);
      if (!s) return;
      for (const p of [P, "/en" + P]) {
        await s.go(p);
        const r = await s.page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth <= innerWidth,
          out: [...document.querySelectorAll(".sc-card, .sc-acts a")].filter((e) => { const b = e.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth + 0.5 || b.width === 0; }).length,
        }));
        assert.ok(r.scroll, `${p} 有横向滚动`);
        assert.equal(r.out, 0, `${p} 有元素超出屏幕或被压扁`);
      }
      await s.done();
    });
  }

  test(`${engine}：深色模式下卡片用主题的深色背景`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
    if (!s) return;
    await s.go(P);
    const card = await s.page.evaluate(() => getComputedStyle(document.querySelector(".sc-card")).backgroundColor);
    const lum = card.match(/\d+/g).slice(0, 3).reduce((a, b) => a + +b, 0);
    assert.ok(lum < 3 * 80, `深色模式卡片背景 ${card}`);
    await s.done();
  });

  test(`${engine}：点「在线阅读」在新标签打开那份 HTML，没有脚本错误`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 } });
    if (!s) return;
    await s.go(P);
    const c = cards[cards.length - 1];
    const [tab] = await Promise.all([s.ctx.waitForEvent("page"), s.page.locator(`[id="${c.slug}"] .sc-acts a`).first().click()]);
    await tab.waitForLoadState("load");
    assert.equal(new URL(tab.url()).pathname, url(c, "html"));
    assert.equal(await tab.title(), c.title);
    await s.done();
  });

  test(`${engine}：Cloudflare 邮件地址混淆下没有脚本错误，下架邮箱照常解开`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 } });
    if (!s) return;
    await cfEmailObfuscation(s.ctx, server.url);
    for (const p of [P, "/en" + P]) {
      await s.go(p);
      await s.page.waitForLoadState("networkidle");
      assert.equal(await s.page.locator(".__cf_email__").count(), 0);
      assert.equal(await s.page.locator(".s1-rights a").textContent(), "leoycwan@gmail.com");
      assert.equal(await s.page.locator(".s1-rights a").getAttribute("href"), "mailto:leoycwan@gmail.com");
    }
    await s.done();
  });
}
