// Anthropic 系统卡中文译本（tools/syscard-import/、layouts/syscards/、layouts/_partials/syscards/、layouts/_shortcodes/sc-*.html、
// assets/css/extended/syscards.css）：用仓库里导入的全部系统卡（content/translations/system-cards/<卡>/<版本>/）检查
//   - 构建结果：
//     下载文件发布在版本目录的 files/ 下，大小和 sha256 与 front matter 一致、HTML 与 .html.raw 逐字节相同（原样提供）、
//     不超过 Cloudflare Pages 的 25 MiB、只发布一份、.raw 本身不发布；译文仓库不公开（页面上没有仓库链接）；
//     栏目页：每份卡一条 PaperMod 条目（官网顺序、版本号、在线阅读/HTML/PDF 直链）；
//     卡片首页（同 S-1 译本首页，首屏是版本条、简短声明、开始阅读和目录）：目录列出每章和页码、标出含另行翻译的章、
//     完整声明（页内锚点 #notice）、下载卡片、全部版本；英文页和 S-1 英文页一样不列中文目录；
//     译者声明：所有卡的条目和措辞相同，只换卡名、日期、页数、版本，和「本卡另行翻译的部分」那一条（facts）；
//     版本页：目录链到每一章；章节页：每章都有、重排版里没有漏掉的 Markdown（星号、脚注记号）、
//     原文页码分隔和原版版式的页数与本章页码一致、底图都发布了、脚注引用链到「脚注」一章里存在的条目、上下章链接
//   - 浏览器（Chromium 和 WebKit）：电脑、手机、320 宽都没有横向滚动；手机章节页首屏能看到正文；
//     原版版式（底图 + SVG 文字层）与 PDF 同一页逐像素比对（基准 tests/fixtures/syscards/，由 tools/syscard-import/reference.py 生成）；
//     深色模式下载卡片跟着变色；Cloudflare 邮件地址混淆下没有脚本错误
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium, webkit, devices } from "playwright";
import { build, serve, root, cfEmailObfuscation } from "./helpers.mjs";

const DIR = join(root, "content/translations/system-cards");
const FIX = join(root, "tests/fixtures/syscards");
const P = "/translations/system-cards/";
const LIMIT = 25 * 1024 * 1024;
const ENGINES = ["chromium", "webkit"];
const PHONE = { chromium: devices["Pixel 7"], webkit: devices["iPhone 13"] };

// import.py 把 front matter 每项写成一行 JSON
const frontMatter = (f) => Object.fromEntries(readFileSync(join(DIR, f), "utf8").split("\n---\n")[0].split("\n").slice(1)
  .map((l) => { const i = l.indexOf(": "); return [l.slice(0, i), JSON.parse(l.slice(i + 2))]; }));
const cards = readdirSync(DIR).filter((d) => existsSync(join(DIR, d, "_index.md")))
  .map((slug) => {
    const zh = frontMatter(`${slug}/_index.md`);
    return { slug, zh, en: frontMatter(`${slug}/_index.en.md`), v: frontMatter(`${slug}/${zh.latest}/_index.md`) };
  })
  .sort((a, b) => a.zh.weight - b.zh.weight);

let site, server;
const browsers = {};
before(async () => {
  site = build();
  server = await serve(site.out);
  browsers.chromium = await chromium.launch({ args: ["--font-render-hinting=none"] }); // 同 short-labels：Linux 上关掉字宽取整，CI 与本机一致
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

const read = (p) => readFileSync(join(site.out, p.endsWith("/") ? p + "index.html" : p), "utf8");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const home = (c, lang = "zh") => `${lang === "en" ? "/en" : ""}${P}${c.slug}/`;
const ver = (c) => `${P}${c.slug}/${c.zh.latest}/`;
const chap = (c, ch) => `${ver(c)}${ch.slug}/`;
const url = (c, kind) => `${ver(c)}${c.v.downloads[kind].file.replace(/\.raw$/, "")}`;
const attr = (html, name, value) => html.includes(`${name}=${value}`) || html.includes(`${name}="${value}"`);
const main = (html) => html.match(/<main[\s\S]*<\/main>/)[0];
const fullNotice = (html) => html.match(/<aside class="?s1-notice"? role="?note"? id="?notice"?>[\s\S]*?<\/aside>/)?.[0];
// 比对文字：去掉标签，不换行空格当普通空格
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/ |&nbsp;/g, " ").replace(/&#8203;|​/g, "");

test("测试前提：导入了系统卡，weight 从 1 连续编号，中英文页 front matter 相同，版本号与译文仓库的写法一致", () => {
  assert.ok(cards.length >= 10, `只有 ${cards.length} 份`);
  assert.deepEqual(cards.map((c) => c.zh.weight), cards.map((_, i) => i + 1));
  for (const c of cards) {
    const strip = ({ title, description, ...rest }) => rest;
    assert.deepEqual(strip(c.en), strip(c.zh), c.slug);
    assert.equal(c.zh.official, `https://www.anthropic.com/claude-${c.slug.replaceAll(".", "-")}-system-card`);
    assert.match(c.v.repoVersion, /^\d+\.\d+\.\d+$/);
    assert.equal(c.v.tag, `${c.slug}/v${c.v.repoVersion}`);
    assert.equal(c.v.version, c.zh.latest);
    assert.match(c.v.downloads.html.file, /^files\/claude-[a-z0-9-]+-system-card-zh\.html\.raw$/);
  }
});

// ---------- 构建结果 ----------
test("下载文件：发布在版本目录的 files/ 下，大小和 sha256 与 front matter 一致，HTML 与 .html.raw 逐字节相同，不超过 25 MiB", () => {
  for (const c of cards) {
    for (const kind of ["html", "pdf"]) {
      const f = c.v.downloads[kind];
      const buf = readFileSync(join(site.out, url(c, kind)));
      assert.equal(buf.length, f.bytes, `${c.slug}.${kind} 大小`);
      assert.equal(sha(buf), f.sha256, `${c.slug}.${kind} sha256`);
      assert.ok(buf.length <= LIMIT, `${c.slug}.${kind} 超过 Cloudflare Pages 单文件上限`);
      assert.ok(readFileSync(join(DIR, c.slug, c.zh.latest, f.file)).equals(buf), `${c.slug}.${kind} 与内容目录里的文件不同`);
      assert.ok(!site.exists(`/en${url(c, kind)}`), `${c.slug}.${kind} 只发布一份`);
    }
    assert.ok(!site.exists(`${url(c, "html")}.raw`), ".raw 本身不发布");
  }
});

test("在线阅读的 HTML 原样提供：没有加统计脚本、网站图标、声明或 noindex", () => {
  for (const c of cards) {
    const html = read(url(c, "html"));
    assert.ok(!html.includes("cloudflareinsights") && !/rel="?icon/.test(html) && !/noindex/.test(html), c.slug);
  }
});

test("译文仓库不公开：栏目页、卡片首页、版本页、章节页都没有 GitHub 链接或仓库名", () => {
  for (const p of [P, "/en" + P, ...cards.flatMap((c) => [home(c), home(c, "en"), ver(c), ...c.v.chapters.map((ch) => chap(c, ch))])]) {
    const m = main(read(p));
    assert.ok(!/github\.com\/anyingiit/i.test(m) && !m.includes("anthropic-system-cards-zh"), p);
  }
});

for (const lang of ["zh", "en"]) {
  const list = lang === "en" ? "/en" + P : P;

  test(`${lang} 栏目页：每份卡一条，按官网顺序，版本号，链到卡片首页，在线阅读、HTML、PDF 直链`, () => {
    const html = read(list);
    const rows = [...html.matchAll(/<article class="post-entry sc-entry" id=([^\s>]+)>([\s\S]*?)<\/article>/g)];
    assert.deepEqual(rows.map((m) => m[1]), cards.map((c) => c.slug), "顺序");
    for (const [i, c] of cards.entries()) {
      const row = rows[i][2];
      const name = lang === "zh" ? c.zh.title.replace(/中文译本$/, "") : c.zh.titleEn;
      assert.ok(attr(row, "href", home(c, lang)) && row.includes(`>${name}</a>`), `${c.slug} 链到卡片首页`);
      assert.ok(row.includes(`>${c.v.version}<`), `${c.slug} 版本号`);
      assert.ok(text(row).includes(lang === "zh" ? `原版 ${c.zh.released} 发布 · ${c.zh.pages} 页` : `Published ${c.zh.released} · ${c.zh.pages} pages`), `${c.slug} 日期和页数`);
      assert.ok(attr(row, "href", ver(c)), `${c.slug} 在线阅读`);
      assert.ok(attr(row, "href", url(c, "html")) && attr(row, "download", c.v.downloads.pdf.name), `${c.slug} 下载`);
    }
    assert.ok(!/<summary>[\s\S]*?<a\s[\s\S]*?<\/summary>/.test(html), "要点里不放链接");
    assert.equal(html.match(/mailto:leoycwan@gmail\.com/g)?.length, 2, "声明和权利行各一次");
  });

  test(`${lang} 卡片首页：首屏是版本条、简短声明、开始阅读和目录；下载卡片、完整声明、全部版本`, () => {
    for (const c of cards) {
      const m = main(read(home(c, lang)));
      assert.ok(m.includes(`class=s1-crumb><a href=${list}>`), `${c.slug} 面包屑`);
      const order = ["s1-vbar", "s1-notice-short", "s1-cta", ...(lang === "zh" ? ["sc-toc"] : []), "s1-dl-cards", "id=notice", "s1-versions"]
        .map((k) => m.indexOf(k));
      assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), `${c.slug} 各部分的顺序 ${order}`);
      assert.ok(text(m).includes(`${c.v.version} · ${lang === "zh" ? "最新" : "latest"}`), `${c.slug} 版本条`);
      assert.ok(attr(m, "href", "#notice"), `${c.slug} 简短声明链到完整声明`);
      assert.match(m, new RegExp(`class=s1-btn href=${chap(c, c.v.chapters[0])}>`), `${c.slug} 开始阅读进第一章`);
      assert.ok(attr(m, "href", c.zh.official), `${c.slug} 英文原版`);
      assert.ok(attr(m, "download", c.v.downloads.html.name) && attr(m, "download", c.v.downloads.pdf.name), `${c.slug} 下载用原文件名`);
      assert.ok(m.includes(c.v.downloads.pdf.sha256), `${c.slug} SHA-256`);
      if (lang === "en") assert.ok(!/[（）：]/.test(text(m.replace(/<aside[\s\S]*?<\/aside>/g, "").replace(/<ol class="?s1-toc[\s\S]*?<\/ol>/g, ""))), `${c.slug} 英文页没有全角标点`);
      assert.match(m, /class="?s1-rights/);
    }
  });
}

test("zh 卡片首页和版本页的目录：每章一条，链到章节页，页码范围，含另行翻译的章有标签", () => {
  for (const c of cards) {
    for (const p of [home(c), ver(c)]) {
      const toc = read(p).match(/<ol class="?s1-toc sc-toc"?>([\s\S]*?)<\/ol>/)[1];
      const items = [...toc.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
      assert.equal(items.length, c.v.chapters.length, `${p} 章数`);
      for (const [i, ch] of c.v.chapters.entries()) {
        assert.ok(attr(items[i], "href", chap(c, ch)), `${p} ${ch.slug} 链接`);
        const [a, b] = ch.pages;
        assert.ok(text(items[i]).includes(a === b ? `第 ${a} 页` : `第 ${a}–${b} 页`), `${p} ${ch.slug} 页码`);
        assert.equal(items[i].includes("含另行翻译"), ch.separate, `${p} ${ch.slug} 另行翻译标签`);
        assert.ok(site.exists(chap(c, ch)), `${chap(c, ch)} 不存在`);
      }
    }
  }
});

for (const lang of ["zh", "en"]) {
  test(`${lang} 译者声明：所有卡的条目和措辞相同，只换卡名、日期、页数、版本和「本卡另行翻译的部分」（来自 facts）`, () => {
    const generic = (n) => [...n.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]))
      .filter((s, i) => i > 0 && !/^(本卡另行翻译的部分|Translated separately in this card|原文：|Original:)/.test(s));
    const base = generic(fullNotice(read(home(cards[0], lang))));
    assert.ok(base.length >= 5);
    for (const c of cards) {
      const html = read(home(c, lang));
      const n = fullNotice(html);
      assert.ok(n, `${c.slug} 完整声明`);
      const f = c.zh.facts;
      const g = generic(n);
      // 「2.2 节和少数相关段落」只在有零散段落的卡里出现
      const norm = (s) => s.replace(lang === "zh" ? "和少数相关段落" : " and a few related paragraphs", "");
      assert.deepEqual(g.map(norm), base.map(norm), `${c.slug} 通用条目和第一份卡不同`);
      assert.equal(g.some((s) => s.includes(lang === "zh" ? "和少数相关段落" : "and a few related paragraphs")), f.scattered > 0, `${c.slug} 零散段落`);
      const own = text(n.match(lang === "zh" ? /<li><strong>本卡另行翻译的部分[\s\S]*?<\/li>/ : /<li><strong>Translated separately in this card[\s\S]*?<\/li>/)[0]);
      const want = [lang === "zh" ? `原文第 ${f.s22[0]}–${f.s22[1]} 页` : `original pages ${f.s22[0]}–${f.s22[1]}`];
      if (f.scattered) want.push(lang === "zh" ? `${f.scattered} 个零散段落（原文第 ${f.scatteredPages} 页）` : `${f.scattered} scattered paragraphs`);
      if (f.s22Model) want.push(f.s22Model);
      if (f.unverifiedNumbers) want.push(lang === "zh" ? `${f.unverifiedNumbers} 处原文数字` : `${f.unverifiedNumbers} numbers`);
      for (const s of want) assert.ok(own.includes(s), `${c.slug}：${s}`);
      if (!f.s22Model) assert.ok(!/GPT|使用/.test(own), `${c.slug} 没用别的工具就不提`);
      // 首屏的简短声明里就有本卡的特殊情况
      const short = text(html.match(/<aside class="?s1-notice s1-notice-short"?[\s\S]*?<\/aside>/)[0]);
      if (f.s22Model) assert.ok(short.includes(f.s22Model), `${c.slug} 简短声明里的 ${f.s22Model}`);
      if (f.unverifiedNumbers) assert.ok(short.includes(`${f.unverifiedNumbers}`), `${c.slug} 简短声明里的未核实数字`);
      assert.ok(n.includes(c.zh.titleEn) && text(n).includes(`${c.zh.pages}`), `${c.slug} 卡名和页数`);
      assert.ok(attr(n, "href", c.zh.official), `${c.slug} 声明里的原文链接`);
    }
  });
}

// 译文仓库 Markdown 本身写错、导入时不改译文的地方（交给译文项目修，修好重新导入后从这里删掉）
const KNOWN_MD = {
  "/translations/system-cards/fable-5.1-mythos-5.1/v1.0/section-2/": "图 2.2.3.1.A 的图注首尾多了星号（****[图 2.2.3.1.A]* …*；HTML 里正常）",
  // 下面不是错：模型思考原文里的星号，HTML 里也原样显示
  "/translations/system-cards/opus-4.7/v1.0/section-7/": "「混合在我的二**元决策树里」",
};

test("章节页：重排版没有漏掉的 Markdown，页码分隔和原版版式与本章页码一致，底图都发布了，脚注链到存在的条目，上下章相连", () => {
  for (const c of cards) {
    const fnIds = new Set([...read(chap(c, { slug: "footnotes" })).matchAll(/id=(?:")?fn-(\d+)/g)].map((m) => m[1]));
    assert.ok(fnIds.size > 0, `${c.slug} 脚注一章是空的`);
    const missing = [];
    for (const [i, ch] of c.v.chapters.entries()) {
      const p = chap(c, ch);
      const html = read(p);
      const reflow = html.match(/<div class="post-content md-content s1-reflow"[^>]*>([\s\S]*?)<\/div><div class="?s1-original/)[1];
      const prose = reflow.replace(/<(pre|code)[\s\S]*?<\/\1>/g, "");
      if (KNOWN_MD[p]) assert.ok(/\*\*\S/.test(text(prose)), `${p} 已经修好了，从 KNOWN_MD 里删掉`);
      else assert.ok(!/\*\*\S/.test(text(prose)), `${p} 重排版里露出 **：${text(prose).match(/.{0,20}\*\*\S.{0,20}/)?.[0]}`);
      assert.ok(!/\[\^\d+\]/.test(text(prose)), `${p} 重排版里露出脚注记号`);
      const [a, b] = ch.pages;
      const marks = [...reflow.matchAll(/class="?s1-pg"? id="?p-(\d+)/g)].map((m) => +m[1]);
      assert.ok(marks.every((n) => n >= a && n <= b), `${p} 页码分隔 ${marks} 超出 ${a}–${b}`);
      const tpl = html.match(/<template class="?s1-original-tpl"?>([\s\S]*?)<\/template>/)[1];
      const sheets = [...tpl.matchAll(/aria-label="原文第 (\d+) 页"/g)].map((m) => +m[1]);
      assert.deepEqual(sheets, Array.from({ length: b - a + 1 }, (_, k) => a + k), `${p} 原版版式的页`);
      for (const m of tpl.matchAll(/class="?sc-bg"?[^>]*src="?([^\s>"]+)/g)) assert.ok(site.exists(m[1]), `${p} 底图 ${m[1]} 没有发布`);
      for (const m of reflow.matchAll(/href="?\.\.\/footnotes\/#fn-(\d+)/g)) if (!fnIds.has(m[1])) missing.push(m[1]);
      const prev = c.v.chapters[i - 1], next = c.v.chapters[i + 1];
      if (prev) assert.match(html, new RegExp(`class="?prev"? href="?\\.\\./${prev.slug}/"?>`), `${p} 上一章`);
      if (next) assert.match(html, new RegExp(`class="?next"? href="?\\.\\./${next.slug}/"?>`), `${p} 下一章`);
    }
    // 原文有个别脚注只有引用没有定义（编号跳号），只允许零星几处
    assert.ok(missing.length <= 4, `${c.slug} 找不到的脚注 ${missing}`);
  }
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

// 原版版式截图和 PDF 渲染的基准比对（在页面里用 canvas 算）：灰度，先在 ±2px 内找整体错位最小的对齐（浏览器和 PDF 渲染器的取整差 1px），
// 再按 8×8 像素块取平均比较：两种渲染器的抗锯齿不同，逐像素必然有差；按块比较能抓出错位、缺字、字体不对、底图不对
const compare = (pg, shot, ref) => pg.evaluate(async ([a, b]) => {
  const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const W = Math.min(ia.width, ib.width), H = Math.min(ia.height, ib.height);
  const gray = (img) => {
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
    const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data, out = new Float32Array(img.width * img.height);
    for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
    return { w: img.width, px: out };
  };
  const A = gray(ia), B = gray(ib), M = 2, w = W - 2 * M, h = H - 2 * M;
  const at = (X, x, y) => X.px[y * X.w + x];
  let best = null;
  for (let dy = -M; dy <= M; dy++) for (let dx = -M; dx <= M; dx++) {
    let sum = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) sum += Math.abs(at(A, x + M + dx, y + M + dy) - at(B, x + M, y + M));
    if (!best || sum < best.sum) best = { sum, dx, dy };
  }
  let worst = 0, total = 0, n = 0;
  for (let y = 0; y + 8 <= h; y += 8) for (let x = 0; x + 8 <= w; x += 8) {
    let sa = 0, sb = 0;
    for (let yy = y; yy < y + 8; yy++) for (let xx = x; xx < x + 8; xx++) { sa += at(A, xx + M + best.dx, yy + M + best.dy); sb += at(B, xx + M, yy + M); }
    const d = Math.abs(sa - sb) / 64; worst = Math.max(worst, d); total += d; n++;
  }
  return { size: [ia.width, ia.height, ib.width, ib.height], dx: best.dx, dy: best.dy, worst, mean: total / n };
}, [`data:image/png;base64,${shot.toString("base64")}`, ref]);

const view = (pg, v) => pg.evaluate((v) => document.querySelector(`.s1-switch button[data-view=${v}]`)?.click(), v);
const longest = cards.reduce((a, c) => (c.zh.titleEn.length > a.zh.titleEn.length ? c : a));
const sep = (c) => c.v.chapters.find((ch) => ch.separate);
for (const engine of ENGINES) {
  for (const [name, opts] of [["电脑", { viewport: { width: 1280, height: 800 } }], ["手机", PHONE[engine]], ["320 宽", { ...PHONE[engine], viewport: { width: 320, height: 640 } }]]) {
    test(`${engine} ${name}：栏目页、卡片首页、版本页、章节页（重排版和原版版式）没有横向滚动`, async (t) => {
      const s = await open(t, engine, opts);
      if (!s) return;
      for (const p of [P, "/en" + P, home(longest), home(longest, "en"), ver(longest), chap(longest, sep(longest))]) {
        await s.go(p);
        for (const v of p.includes("/section-") ? ["reflow", "original"] : [null]) {
          if (v) { await view(s.page, v); await s.page.waitForTimeout(200); }
          const ok = await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
          assert.ok(ok, `${p} ${v ?? ""} 有横向滚动`);
        }
      }
      if (name === "手机") {
        // 手机章节页：首屏能看到重排版正文的开头（320 宽的小屏不要求）
        await s.go(chap(longest, sep(longest)));
        await view(s.page, "reflow");
        await s.page.evaluate(() => scrollTo(0, 0));
        const top = await s.page.evaluate(() => document.querySelector(".s1-reflow > :not(.s1-pg)").getBoundingClientRect().top);
        assert.ok(top < (await s.page.evaluate(() => innerHeight)) - 40, `正文从 ${top}px 开始，首屏看不到`);
      }
      await s.done();
    });
  }

  test(`${engine}：原版版式与 PDF 同一页逐像素比对（tests/fixtures/syscards/）`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    if (!s) return;
    for (const f of readdirSync(FIX).filter((x) => x.endsWith(".png"))) {
      const [, slug, n] = f.match(/^(.+)-p(\d+)\.png$/);
      const c = cards.find((x) => x.slug === slug);
      const ch = c.v.chapters.find((x) => x.pages[0] <= +n && +n <= x.pages[1]);
      await s.go(chap(c, ch));
      await view(s.page, "original");
      const sheet = s.page.locator(`.sc-sheet:has(svg[aria-label="原文第 ${+n} 页"])`);
      // 按 PDF 原尺寸（612pt = 816 CSS px）显示，不缩放
      await s.page.addStyleTag({ content: ".s1-sheets, .s1-sheets-inner { transform: none !important; zoom: 1 !important; width: auto !important; max-width: none !important; }" });
      await sheet.scrollIntoViewIfNeeded();
      await s.page.waitForFunction((n) => { const i = document.querySelector(`.sc-sheet:has(svg[aria-label="原文第 ${n} 页"]) img`); return i && i.complete && i.naturalWidth > 0; }, +n);
      await s.page.evaluate(() => document.fonts.ready);
      const ref = `data:image/png;base64,${readFileSync(join(FIX, f)).toString("base64")}`;
      const r = await compare(s.page, await sheet.screenshot(), ref);
      assert.ok(Math.abs(r.size[0] - r.size[2]) <= 2 && Math.abs(r.size[1] - r.size[3]) <= 2, `${f} 尺寸 ${r.size}`);
      assert.ok(r.mean < 1 && r.worst < 30, `${f} 与 PDF 不同：8×8 块平均差 ${r.mean.toFixed(2)}，最大 ${r.worst.toFixed(1)}（错位 ${r.dx},${r.dy}）`);
      // 比对本身灵敏：文字层错开 3px，或底图缺了，都应该被抓出来
      for (const css of [".sc-sheet svg { transform: translate(0, 3px); }", ".sc-sheet .sc-bg { visibility: hidden; }"]) {
        const tag = await s.page.addStyleTag({ content: css });
        const bad = await compare(s.page, await sheet.screenshot(), ref);
        assert.ok(bad.worst >= 30, `${f} 篡改（${css}）后最大块差只有 ${bad.worst.toFixed(1)}，比对不够灵敏`);
        await tag.evaluate((e) => e.remove());
      }
    }
    await s.done();
  });

  test(`${engine}：深色模式下载卡片用主题的深色背景`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
    if (!s) return;
    await s.go(home(cards[0]));
    const bg = await s.page.evaluate(() => getComputedStyle(document.querySelector(".s1-dl-card")).backgroundColor);
    assert.ok(bg.match(/\d+/g).slice(0, 3).reduce((a, b) => a + +b, 0) < 3 * 80, `深色模式卡片背景 ${bg}`);
    await s.done();
  });

  test(`${engine}：Cloudflare 邮件地址混淆下没有脚本错误，下架邮箱照常解开`, async (t) => {
    const s = await open(t, engine, { viewport: { width: 1280, height: 800 } });
    if (!s) return;
    await cfEmailObfuscation(s.ctx, server.url);
    for (const p of [P, "/en" + P, home(cards[0]), home(cards[0], "en"), chap(cards[0], cards[0].v.chapters[1])]) {
      await s.go(p);
      await s.page.waitForLoadState("networkidle");
      assert.equal(await s.page.locator(".__cf_email__").count(), 0);
      assert.equal(await s.page.locator(".s1-rights a").textContent(), "leoycwan@gmail.com");
      assert.equal(await s.page.locator(".s1-rights a").getAttribute("href"), "mailto:leoycwan@gmail.com");
    }
    await s.done();
  });
}
