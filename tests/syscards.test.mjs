// Anthropic 系统卡中文译本（tools/syscard-import/、layouts/syscards/、layouts/_partials/syscards/、assets/css/extended/syscards.css）：
// 用仓库里导入的全部系统卡（content/translations/system-cards/<目录名>/index.md）检查
//   - 构建结果：每份卡的 HTML、PDF 发布在该卡页面的 files/ 下，大小和 sha256 与 front matter 一致、
//     HTML 与内容目录里的 .html.raw 逐字节相同（原样提供：不加统计脚本、图标、声明）、每个文件不超过 Cloudflare Pages 的 25 MiB、
//     文件只发布一份（英文页不另发 /en/ 副本）、.raw 本身不发布；
//     栏目页（中英文）：简短声明（展开是完整声明）；每份卡一条 PaperMod 文章条目，按 weight（导入时取自 Anthropic 官网系统卡列表的顺序），
//     卡名链到卡片页，写这份卡另行翻译的范围，在线阅读和 PDF 直链（读屏能听出是哪份卡）；
//     卡片页（中英文）：面包屑回栏目、简短声明写这份卡的范围、在线阅读新标签打开、下载用原文件名、英文原版地址；
//     译者声明：统一的条目，这份卡的范围和数字（2.2 节页码、零散段落、另用的模型、未核实的数字）来自 facts；
//     译文仓库不公开：页面上没有 GitHub 链接；中英文页互链；译文栏目列表收录本栏目
//   - 浏览器（Chromium 和 WebKit）：电脑和手机都没有横向滚动、条目和链接都在屏幕里，范围说明整句显示（不被截成两行），手机上直链至少 44px 高；
//     卡片页和 S-1 版本页一样用灰底；
//     深色模式下载卡片跟着变色；点「在线阅读」在新标签打开的就是那份 HTML；Cloudflare 邮件地址混淆下没有脚本错误、下架邮箱照常解开
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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
const cards = readdirSync(DIR).filter((d) => existsSync(join(DIR, d, "index.md")))
  .map((slug) => ({ slug, zh: frontMatter(`${slug}/index.md`), en: frontMatter(`${slug}/index.en.md`) }))
  .sort((a, b) => a.zh.weight - b.zh.weight);

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
const page = (c, lang) => `${lang === "en" ? "/en" : ""}${P}${c.slug}/`;
const url = (c, kind) => `${P}${c.slug}/${c.zh.downloads[kind].file.replace(/\.raw$/, "")}`;
const attr = (html, name, value) => html.includes(`${name}=${value}`) || html.includes(`${name}="${value}"`);
const notice = (html) => html.match(/<aside class="?s1-notice[\s\S]*?<\/aside>/)[0];
const main = (html) => html.match(/<main[\s\S]*<\/main>/)[0];
// 比对文字：去掉标签（不换行的 span），不换行空格当普通空格
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/\u00a0|&nbsp;/g, " ");

test("测试前提：导入了系统卡，weight 从 1 连续编号，中英文页 front matter 相同（标题和简介除外）", () => {
  assert.ok(cards.length >= 10, `只有 ${cards.length} 份`);
  assert.deepEqual(cards.map((c) => c.zh.weight), cards.map((_, i) => i + 1));
  for (const c of cards) {
    const strip = ({ title, description, ...rest }) => rest;
    assert.deepEqual(strip(c.en), strip(c.zh), c.slug);
    assert.equal(c.zh.sourceCommit, zh.sourceCommit);
    assert.equal(c.zh.official, `https://www.anthropic.com/claude-${c.slug.replaceAll(".", "-")}-system-card`);
    assert.match(c.zh.downloads.html.file, /^files\/claude-[a-z0-9-]+-system-card-zh\.html\.raw$/);
  }
  assert.equal(zh.type, "syscards");
  assert.match(zh.sourceCommit, /^[0-9a-f]{40}$/);
});

// ---------- 构建结果 ----------
test("下载文件：发布在卡片页的 files/ 下，大小和 sha256 与 front matter 一致，HTML 与 .html.raw 逐字节相同，不超过 25 MiB", () => {
  for (const c of cards) {
    for (const kind of ["html", "pdf"]) {
      const f = c.zh.downloads[kind];
      const buf = readFileSync(join(site.out, url(c, kind)));
      assert.equal(buf.length, f.bytes, `${c.slug}.${kind} 大小`);
      assert.equal(sha(buf), f.sha256, `${c.slug}.${kind} sha256`);
      assert.ok(buf.length <= LIMIT, `${c.slug}.${kind} 超过 Cloudflare Pages 单文件上限`);
      assert.ok(readFileSync(join(DIR, c.slug, f.file)).equals(buf), `${c.slug}.${kind} 与内容目录里的文件不同`);
      assert.ok(!site.exists(`/en${url(c, kind)}`), `${c.slug}.${kind} 只发布一份`);
    }
    assert.ok(!site.exists(`${url(c, "html")}.raw`), ".raw 本身不发布");
    // 超限才瘦身；没超限的 PDF 原样复制（sourceBytes 只出现在瘦身过的）
    const pdf = c.zh.downloads.pdf;
    if (pdf.slimmed) assert.ok(pdf.sourceBytes > LIMIT && pdf.bytes < pdf.sourceBytes);
    else assert.equal(pdf.sourceBytes, undefined);
  }
});

test("在线阅读的 HTML 原样提供：没有加统计脚本、网站图标、声明或 noindex", () => {
  for (const c of cards) {
    const html = read(url(c, "html"));
    assert.ok(!html.includes("cloudflareinsights") && !/rel="?icon/.test(html) && !/noindex/.test(html), c.slug);
    assert.ok(html.includes(`<title>${c.zh.title.replace(/中文译本$/, "")}</title>`), `${c.slug} 标题`);
  }
});

test("译文仓库不公开：栏目页和卡片页都没有 GitHub 链接或仓库名", () => {
  for (const p of [P, "/en" + P, ...cards.flatMap((c) => [page(c, "zh"), page(c, "en")])]) {
    const m = main(read(p));
    assert.ok(!/github\.com/i.test(m) && !m.includes("anthropic-system-cards-zh"), p);
  }
});

for (const lang of ["zh", "en"]) {
  const list = lang === "en" ? "/en" + P : P;

  test(`${lang} 栏目页：每份卡一条，按官网顺序（weight），链到卡片页，写范围，在线阅读和 PDF 直链`, () => {
    const html = read(list);
    const rows = [...html.matchAll(/<article class="post-entry sc-entry" id=([^\s>]+)>([\s\S]*?)<\/article>/g)];
    assert.deepEqual(rows.map((m) => m[1]), cards.map((c) => c.slug), "顺序");
    for (const [i, c] of cards.entries()) {
      const row = rows[i][2];
      const name = lang === "zh" ? c.zh.title.replace(/中文译本$/, "") : c.zh.titleEn;
      assert.ok(attr(row, "href", page(c, lang)) && row.includes(`>${name}</a>`), `${c.slug} 链到卡片页`);
      assert.ok(text(row).includes(lang === "zh" ? `原版 ${c.zh.released} 发布 · ${c.zh.pages} 页` : `Published ${c.zh.released} · ${c.zh.pages} pages`), `${c.slug} 日期和页数`);
      assert.ok(text(row).includes(lang === "zh" ? `原文第 ${c.zh.facts.s22[0]}–${c.zh.facts.s22[1]} 页` : `pp. ${c.zh.facts.s22[0]}–${c.zh.facts.s22[1]}`), `${c.slug} 范围`);
      if (c.zh.facts.unverifiedNumbers) assert.ok(text(row).includes(lang === "zh" ? `${c.zh.facts.unverifiedNumbers} 处原文数字` : `${c.zh.facts.unverifiedNumbers} numbers`), `${c.slug} 未核实项`);
      assert.ok(attr(row, "href", url(c, "html")) && attr(row, "download", c.zh.downloads.pdf.name), `${c.slug} 下载`);
      assert.ok(row.includes(lang === "zh" ? `aria-label="在线阅读：${name}"` : `aria-label="Read the translation: ${name}"`), `${c.slug} 读屏链接名`);
    }
    for (const s of lang === "zh" ? ["非官方中文译本", "2.2 节", "人工没有检查译文与原文的一致性", "以 Anthropic 官网的英文原版为准", `${zh.sourceDate} 定稿`]
      : ["unofficial Chinese translations", "Section 2.2", "No person has checked", "English originals on Anthropic", `finalized ${zh.sourceDate}`]) assert.ok(notice(html).includes(s), s);
    assert.equal(html.match(/mailto:leoycwan@gmail\.com/g)?.length, 2, "声明和权利行各一次");
  });

  test(`${lang} 卡片页：面包屑、在线阅读、英文原版、下载卡片、权利行`, () => {
    for (const c of cards) {
      const html = read(page(c, lang));
      const m = main(html);
      assert.ok(m.includes(`class=s1-crumb><a href=${list}>`), `${c.slug} 面包屑`);
      assert.match(m, new RegExp(`class=s1-btn href=${url(c, "html")} target=_blank rel=noopener>`), `${c.slug} 在线阅读在新标签打开`);
      assert.ok(attr(m, "href", c.zh.official), `${c.slug} 英文原版`);
      assert.ok(attr(m, "download", c.zh.downloads.html.name) && attr(m, "download", c.zh.downloads.pdf.name), `${c.slug} 下载用原文件名`);
      assert.ok(m.includes(c.zh.downloads.pdf.sha256), `${c.slug} SHA-256`);
      assert.equal(/带章节书签|with bookmarks/.test(m), c.zh.downloads.pdf.bookmarks, `${c.slug} 书签说明与 PDF 一致`);
      assert.equal(html.match(/mailto:leoycwan@gmail\.com/g)?.length, 2, `${c.slug} 声明和权利行各一次`);
      assert.match(html, /class="?s1-rights/);
    }
  });

  test(`${lang} 卡片页：译者声明条目统一，范围和数字来自这份卡的 facts`, () => {
    const lis = (c) => notice(read(page(c, lang))).match(/<li>/g).length;
    for (const c of cards) {
      const n = notice(read(page(c, lang)));
      const f = c.zh.facts;
      assert.equal(lis(c), lis(cards[0]), `${c.slug} 条目数`);
      const want = lang === "zh"
        ? [`《${c.zh.titleEn}》（${c.zh.pages} 页）`, "非官方中文译本", `${f.images} 张图片`, `原文第 ${f.s22[0]}–${f.s22[1]} 页`,
          `正文 ${f.s22Units} 个单元、图片 ${f.s22Images} 张`, "人工没有检查译文与原文的一致性", `${c.zh.sourceDate} 定稿`]
        : [`${c.zh.titleEn} (${c.zh.pages} pages)`, "unofficial Chinese translation", `${f.images} figures`, `pp. ${f.s22[0]}–${f.s22[1]}`,
          `${f.s22Units} text units, ${f.s22Images} figures`, "No person has checked", `finalized ${c.zh.sourceDate}`];
      if (f.units) want.push(lang === "zh" ? `${f.units} 个文本单元` : `${f.units} text units)`);
      if (f.scattered) want.push(lang === "zh" ? `${f.scattered} 个零散段落（原文第 ${f.scatteredPages} 页）` : `${f.scattered} scattered paragraphs`);
      if (f.s22Model) want.push(lang === "zh" ? `使用 ${f.s22Model} ` : `using ${f.s22Model}`);
      if (f.unverifiedNumbers) want.push(lang === "zh" ? `${f.unverifiedNumbers} 处原文数字` : `${f.unverifiedNumbers} numbers`);
      if (f.layoutFixes) want.push(lang === "zh" ? `发现 ${f.layoutFixes} 处问题` : `found ${f.layoutFixes} problems`);
      for (const s of want) assert.ok(text(n).includes(s), `${c.slug}：${s}`);
      if (!f.scattered) assert.ok(!/零散段落|scattered/.test(n), `${c.slug} 没有零散段落就不提`);
      assert.equal(/内部链接|Cross-references/.test(n), f.linksLost, `${c.slug} 内部链接`);
      assert.ok(attr(n, "href", c.zh.official), `${c.slug} 声明里的原文链接`);
      // 折叠时那一行要点里就有这份卡的范围（和未核实项），不用展开
      const sum = read(page(c, lang)).match(/<summary>([\s\S]*?)<\/summary>/)[1];
      assert.ok(text(sum).includes(lang === "zh" ? `原文第 ${f.s22[0]}–${f.s22[1]} 页` : `pp. ${f.s22[0]}–${f.s22[1]}`), `${c.slug} 要点里的范围`);
      if (f.unverifiedNumbers) assert.ok(sum.includes(lang === "zh" ? "未经核实" : "not been verified"), `${c.slug} 要点里的未核实项`);
      assert.ok(!/<a\s/.test(sum), `${c.slug} 要点里不放链接`);
    }
  });
}

test("中英文页互链；译文栏目列表收录本栏目", () => {
  const c = cards[0];
  assert.match(read(P), new RegExp(`hreflang=en href=${BASE}/en${P}`));
  assert.match(read("/en" + P), new RegExp(`hreflang=zh href=${BASE}${P}`));
  assert.match(read(page(c, "zh")), new RegExp(`hreflang=en href=${BASE}${page(c, "en")}`));
  assert.ok(read("/translations/").includes(`${BASE}${P}`) || read("/translations/").includes(`href=${P}`));
  assert.ok(read("/en/translations/").includes(`${BASE}/en${P}`) || read("/en/translations/").includes(`href=/en${P}`));
});

// ---------- 浏览器 ----------
async function open(t, engine, opts) {
  if (!browsers[engine]) { t.skip("本地没有安装 WebKit（npx playwright install webkit）"); return null; }
  const ctx = await browsers[engine].newContext(opts);
  const errors = [];
  ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e)));
  const pg = await ctx.newPage();
  return { ctx, page: pg, go: (p) => pg.goto(server.url + p, { waitUntil: "load" }),
    done: async () => { await ctx.close(); assert.deepEqual(errors.map((e) => e.message), [], "页面不应有脚本错误"); } };
}

const longest = cards.reduce((a, c) => (c.zh.titleEn.length > a.zh.titleEn.length ? c : a));
for (const engine of ENGINES) {
  for (const [name, opts] of [["电脑", { viewport: { width: 1280, height: 800 } }], ["手机", PHONE[engine]], ["320 宽", { ...PHONE[engine], viewport: { width: 320, height: 640 } }]]) {
    test(`${engine} ${name}：栏目页和卡片页没有横向滚动，表格行、按钮和链接都在屏幕里`, async (t) => {
      const s = await open(t, engine, opts);
      if (!s) return;
      for (const p of [P, "/en" + P, page(longest, "zh"), page(longest, "en")]) {
        await s.go(p);
        const r = await s.page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth <= innerWidth,
          out: [...document.querySelectorAll(".sc-entry, .sc-entry a, .s1-btn, .s1-cta a, .s1-dl-card, .s1-dl-card a, .s1-notice")]
            .filter((e) => { const b = e.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth + 0.5 || b.width === 0; }).length,
        }));
        assert.ok(r.scroll, `${p} 有横向滚动`);
        assert.equal(r.out, 0, `${p} 有元素超出屏幕或被压扁`);
      }
      // 范围说明整句显示（PaperMod 的条目摘要默认两行截断，会截掉「未经核实」）；手机上直链够点
      for (const p of [P, "/en" + P]) {
        await s.go(p);
        const r = await s.page.evaluate(() => ({
          clipped: [...document.querySelectorAll(".sc-entry .entry-content")].filter((e) => e.scrollHeight > e.clientHeight + 1).length,
          minLink: Math.min(...[...document.querySelectorAll(".sc-links a")].map((a) => a.getBoundingClientRect().height)),
        }));
        assert.equal(r.clipped, 0, `${p} 有范围说明被截断`);
        assert.ok(r.minLink >= (name === "电脑" ? 32 : 44), `${p} 直链高 ${r.minLink}px`);
      }
      await s.done();
    });
  }

  test(`${engine}：卡片页和 S-1 版本页一样用列表页的灰底`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 } });
    if (!s) return;
    const bg = async (p) => { await s.go(p); return s.page.evaluate(() => getComputedStyle(document.body).backgroundColor); };
    assert.equal(await bg(page(cards[0], "zh")), await bg("/translations/anthropic-s1/v1.1/"));
    await s.done();
  });

  test(`${engine}：深色模式下载卡片用主题的深色背景`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
    if (!s) return;
    await s.go(page(cards[0], "zh"));
    const bg = await s.page.evaluate(() => getComputedStyle(document.querySelector(".s1-dl-card")).backgroundColor);
    assert.ok(bg.match(/\d+/g).slice(0, 3).reduce((a, b) => a + +b, 0) < 3 * 80, `深色模式卡片背景 ${bg}`);
    await s.done();
  });

  test(`${engine}：点「在线阅读」在新标签打开那份 HTML，没有脚本错误`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 } });
    if (!s) return;
    const c = cards[cards.length - 1];
    await s.go(page(c, "zh"));
    const [tab] = await Promise.all([s.ctx.waitForEvent("page"), s.page.locator(".s1-btn").click()]);
    await tab.waitForLoadState("load");
    assert.equal(new URL(tab.url()).pathname, url(c, "html"));
    assert.equal(await tab.title(), c.zh.title.replace(/中文译本$/, ""));
    await s.done();
  });

  test(`${engine}：Cloudflare 邮件地址混淆下没有脚本错误，下架邮箱照常解开`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 } });
    if (!s) return;
    await cfEmailObfuscation(s.ctx, server.url);
    for (const p of [P, "/en" + P, page(cards[0], "zh"), page(cards[0], "en")]) {
      await s.go(p);
      await s.page.waitForLoadState("networkidle");
      assert.equal(await s.page.locator(".__cf_email__").count(), 0);
      assert.equal(await s.page.locator(".s1-rights a").textContent(), "leoycwan@gmail.com");
      assert.equal(await s.page.locator(".s1-rights a").getAttribute("href"), "mailto:leoycwan@gmail.com");
    }
    await s.done();
  });
}
