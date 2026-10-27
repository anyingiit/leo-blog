// S-1 译本和译文栏目的链接：每个链接都去它该去的地方
//   静态（读构建结果）：站内地址存在、#片段有对应的 id、不意外指回自己、中英文页之间只在该跨的地方跨、
//     SEC 原文/附件和邮箱地址格式正确、原版里的跨章链接（目录、「目录」回链）都指到目标章节里、
//     冻结的完整 HTML 是单文件且页内链接都能落到锚点上
//   PDF（冻结文件）：书签指向各章首页，页内链接指向和 HTML 相同的原文页（需要 python3 + pypdf，没有就跳过）
//   浏览器实点（Chromium；装了 WebKit 也跑）：菜单、语言切换、面包屑、上一章/下一章、全屏阅读的目录/翻章/跳页、
//     原版里的跨章链接、下载、版本菜单（测试样例 /s1-test/）、离线打开完整 HTML
// 已知问题用 test.todo 标注，修好后把 todo 去掉
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium, webkit, devices } from "playwright";
import { build, serve, root } from "./helpers.mjs";

const PROD = "https://douseful.eu.org";
const V = "/translations/anthropic-s1/v1.0/";
const NAME = "anthropic-s1-zh-unofficial-v1.0";
const CONTENT = join(root, "content", V);
const SEC = /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/2130357\/000162828026067168\/[a-z0-9-]+\.htm$/;

// 章节：content 里的目录（按 weight 排序），标题和原文页范围取自 front matter
const chapters = readdirSync(CONTENT)
  .filter((d) => existsSync(join(CONTENT, d, "index.md")))
  .map((slug) => {
    const fm = readFileSync(join(CONTENT, slug, "index.md"), "utf8").split(/^---$/m)[1];
    const [, from, to] = fm.match(/^pages: \[(\d+), (\d+)\]/m).map(Number);
    return { slug, title: fm.match(/^title: "(.*)"$/m)[1], weight: +fm.match(/^weight: (\d+)/m)[1], from, to };
  })
  .sort((a, b) => a.weight - b.weight);
const chapterOfPage = (n) => chapters.find((c) => n >= c.from && n <= c.to);

// 要扫的页面：栏目页（中英）、译本首页（中英）、版本页、全部章节页、冻结的完整 HTML
const PAGES = ["/translations/", "/en/translations/", "/translations/anthropic-s1/", "/en/translations/anthropic-s1/", V,
  ...chapters.map((c) => `${V}${c.slug}/`), `${V}files/${NAME}.html`];

let site, server, browsers = {};
before(async () => {
  site = build();
  server = await serve(site.out);
  browsers.chromium = await chromium.launch();
  // CI 里必须有 WebKit；本地没装时只跳过 WebKit 的点击测试
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { for (const b of Object.values(browsers)) await b?.close(); server?.close(); site?.remove(); });

// ---------- 读 HTML（Hugo 压缩后的属性可能不带引号）----------
const fileOf = (path) => {
  const f = join(site.out, decodeURIComponent(path));
  return existsSync(f) && statSync(f).isDirectory() ? join(f, "index.html") : f;
};
const cache = new Map();
function parse(path) {
  if (cache.has(path)) return cache.get(path);
  const raw = readFileSync(fileOf(path), "utf8");
  // 内联脚本、样式里的 "<" 不是标签；原版视图在 <template> 里，脚本切换到原版时才放进页面
  const html = raw.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, "$1</script>").replace(/(<style\b[^>]*>)[\s\S]*?<\/style>/g, "$1</style>");
  const tplStart = html.indexOf("<template class=s1-original-tpl>"), tplEnd = html.indexOf("</template>", tplStart);
  const inTpl = (i) => tplStart >= 0 && i > tplStart && i < tplEnd;
  const ids = new Set(), tplIds = new Set(), links = [];
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    const [tag, attrs] = [m[1].toLowerCase(), {}];
    for (const a of m[2].matchAll(/([\w:-]+)(?:=("[^"]*"|'[^']*'|[^\s"'>]+))?/g)) attrs[a[1].toLowerCase()] = (a[2] ?? "").replace(/^["']|["']$/g, "").replace(/&amp;/g, "&");
    for (const k of ["id", ...(tag === "a" ? ["name"] : [])]) if (attrs[k]) (inTpl(m.index) ? tplIds : ids).add(attrs[k]);
    for (const k of ["href", "src", "srcset"]) {
      if (attrs[k] === undefined) continue;
      const vals = k === "srcset" ? attrs[k].split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean) : [attrs[k]];
      for (const v of vals) links.push({ tag, attr: k, url: v.trim(), attrs, at: m.index, tpl: inTpl(m.index), before: html.slice(Math.max(0, m.index - 120), m.index), after: html.slice(m.index + m[0].length, m.index + m[0].length + 60), text: tag === "a" ? html.slice(m.index + m[0].length, html.indexOf("</a>", m.index)).replace(/<[^>]+>/g, "").replace(/\s+/g, "") : "" });
    }
  }
  const r = { html, ids, tplIds, links };
  cache.set(path, r);
  return r;
}
// 把链接解析成网址（以正式域名为基准，站内地址 = 同源）
const resolve = (url, page) => new URL(url, PROD + page);
const isEn = (p) => p.startsWith("/en/");

// PaperMod 默认引用、本站一直没放的站点图标（全站都 404，见下面的 todo）
const ICONS = ["/favicon.ico", "/favicon-16x16.png", "/favicon-32x32.png", "/apple-touch-icon.png", "/safari-pinned-tab.svg"];

test("扫描范围：栏目页、译本首页、版本页、32 个章节页和完整 HTML 都已生成", () => {
  assert.equal(chapters.length, 32);
  for (const p of PAGES) assert.ok(existsSync(fileOf(p)), p);
});

test("站内地址都存在（href、src、srcset）", () => {
  const missing = [];
  for (const page of PAGES) for (const l of parse(page).links) {
    if (/^(mailto|tel|javascript|data):/.test(l.url)) continue;
    const u = resolve(l.url, page);
    if (u.origin !== PROD || ICONS.includes(u.pathname)) continue;
    if (!existsSync(fileOf(u.pathname))) missing.push(`${page} → ${l.url}`);
  }
  assert.deepEqual(missing, []);
});

test.todo("站点图标（favicon、apple-touch-icon 等）存在：PaperMod 在每页 <head> 里引用，static/ 里没有，全站都是 404", () => {
  assert.deepEqual(ICONS.filter((p) => !existsSync(fileOf(p))), []);
});

test("#片段都有对应的 id（原版视图的 id 在 <template> 里，也算）", () => {
  const bad = [];
  for (const page of PAGES) for (const l of parse(page).links) {
    if (l.tag !== "a" || !l.url.includes("#")) continue;
    const u = resolve(l.url, page);
    if (u.origin !== PROD) continue;
    const frag = decodeURIComponent(u.hash.slice(1));
    if (!frag) continue;
    const t = parse(u.pathname);
    if (!t.ids.has(frag) && !t.tplIds.has(frag)) bad.push(`${page} → ${l.url}`);
  }
  assert.deepEqual(bad, []);
});

test("链接不意外指回自己：只有菜单当前项、目录/版本菜单的当前项可以（带 ?read=1 或 #片段的不算）", () => {
  const self = [];
  for (const page of PAGES) for (const l of parse(page).links) {
    if (l.tag !== "a" || l.attr !== "href") continue;
    const u = resolve(l.url, page);
    if (u.origin !== PROD || u.pathname !== page || u.search || u.hash) continue;
    const marked = /<li[^>]*aria-current[^>]*>\s*$/.test(l.before) || /^<span class=active>/.test(l.after);
    if (!marked) self.push(`${page} → ${l.url}「${l.text}」`);
  }
  assert.deepEqual(self, []);
});

test("中英文页之间只在该跨的地方跨：语言切换，以及英文说明页正文里的中文译本链接", () => {
  const cross = [];
  for (const page of PAGES.filter((p) => !p.includes("/files/"))) for (const l of parse(page).links) {
    if (l.tag !== "a") continue;
    const u = resolve(l.url, page);
    if (u.origin !== PROD || isEn(u.pathname) === isEn(page) || u.pathname === "/" || u.pathname === "/en/") continue;
    const sw = l.attrs["aria-label"] === (isEn(page) ? "中文" : "English");
    if (!sw) cross.push(`${page} → ${u.pathname}`);
  }
  // 英文说明页的正文链到中文译本首页（以前被 Hugo 换成了英文页自己，点了原地刷新）
  assert.deepEqual(cross, ["/en/translations/anthropic-s1/ → /translations/anthropic-s1/"]);
  // 章节页、版本页没有英文版，语言切换去英文说明页
  for (const page of [V, `${V}mdna/`]) {
    const sw = parse(page).links.find((l) => l.attrs["aria-label"] === "English");
    assert.equal(resolve(sw.url, page).pathname, "/en/translations/anthropic-s1/", page);
  }
  for (const [zh, en] of [["/translations/", "/en/translations/"], ["/translations/anthropic-s1/", "/en/translations/anthropic-s1/"]]) {
    assert.equal(resolve(parse(zh).links.find((l) => l.attrs["aria-label"] === "English").url, zh).pathname, en);
    assert.equal(resolve(parse(en).links.find((l) => l.attrs["aria-label"] === "中文").url, en).pathname, zh);
  }
});

test("外链：SEC 原文和附件地址、mailto 格式正确，没有别的协议", () => {
  const sec = new Set(), bad = [];
  for (const page of PAGES) for (const l of parse(page).links) {
    if (l.tag !== "a") continue;
    if (l.url.startsWith("mailto:")) { if (l.url !== "mailto:leoycwan@gmail.com") bad.push(`${page} → ${l.url}`); continue; }
    if (/^(tel|javascript|data|ftp|file):/i.test(l.url)) { bad.push(`${page} → ${l.url}`); continue; }
    const u = resolve(l.url, page);
    if (u.hostname.endsWith("sec.gov")) { if (SEC.test(l.url)) sec.add(l.url); else bad.push(`${page} → ${l.url}`); }
    else if (u.origin !== PROD && !["gohugo.io", "github.com", "www.linkedin.com"].includes(u.hostname)) bad.push(`${page} → ${l.url}`);
    else if (u.protocol !== "https:") bad.push(`${page} → ${l.url}`);
  }
  assert.deepEqual(bad, []);
  // 原文 1 个 + 附件索引里的 33 个附件
  assert.ok(sec.has("https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/anthropicpbc-sx1.htm"));
  assert.equal(sec.size, 34);
  for (const page of ["/translations/anthropic-s1/", "/en/translations/anthropic-s1/", V, `${V}cover/`]) {
    assert.ok(parse(page).links.some((l) => l.url.endsWith("anthropicpbc-sx1.htm")), `${page} 没有 SEC 原文链接`);
  }
});

// 原版里的链接（SEC 原件自带的目录、每页顶部的「目录」回链、正文里的「参见第 xx 页」）：
// [来源章节, 来源原文页, 目标章节, 目标 id, 目标原文页, 链接文字]
function crossRefs() {
  const pageOfId = new Map(), out = [];
  for (const c of chapters) {
    const { html } = parse(`${V}${c.slug}/`);
    const tpl = html.slice(html.indexOf("<template class=s1-original-tpl>"), html.indexOf("</template>"));
    tpl.split("<div class=s1-sheet ").slice(1).forEach((sheet, k) => {
      for (const m of sheet.matchAll(/\bid=("?)([^"\s>]+)\1/g)) pageOfId.set(m[2], { slug: c.slug, page: c.from + k });
    });
  }
  for (const c of chapters) for (const l of parse(`${V}${c.slug}/`).links) {
    if (l.tag !== "a" || !l.url.includes("#")) continue;
    const u = resolve(l.url, `${V}${c.slug}/`), id = decodeURIComponent(u.hash.slice(1));
    if (!u.pathname.startsWith(V) || u.hash === "#top") continue; // #top 是 PaperMod 的返回顶部
    out.push({ src: c.slug, tpl: l.tpl, slug: u.pathname.slice(V.length, -1), id, target: pageOfId.get(id), text: l.text });
  }
  return { out, pageOfId };
}

test("原版里的跨章链接：都在原版视图里，目标 id 在所指章节的原版里（444 个，包括每页顶部的「目录」回链）", () => {
  const { out } = crossRefs();
  assert.equal(out.length, 444);
  assert.deepEqual(out.filter((r) => !r.tpl).map((r) => r.id), [], "原版之外不应有 #id 链接");
  assert.deepEqual(out.filter((r) => r.target?.slug !== r.slug).map((r) => `${r.src} → ${r.slug}#${r.id}`), []);
  // 「目录」回链（375 个）都落在封面第 11 页的目录上
  const toc = out.filter((r) => r.text === "目录");
  assert.ok(toc.length >= 370);
  assert.deepEqual([...new Set(toc.map((r) => `${r.target.slug} p${r.target.page}`))], ["cover p11"]);
});

test("封面目录里的章节名链接落在同名章节里（招股说明书概要、风险因素、MD&A、业务、治理结构的锚点在各自的分隔图页上，分隔图归入后一章）", () => {
  const { out } = crossRefs();
  const wrong = [];
  for (const r of out.filter((r) => r.src === "cover")) {
    const ch = chapters.find((c) => c.title === r.text);
    if (ch && r.slug !== ch.slug) wrong.push(`「${r.text}」→ ${r.slug}（原文第 ${r.target.page} 页），应在 ${ch.slug}（第 ${ch.from}–${ch.to} 页）`);
  }
  assert.deepEqual(wrong, []);
});

test("完整 HTML（冻结文件）：单文件，32 章锚点齐全，页内链接都能落到锚点，外链只有 SEC、本站和邮箱", () => {
  const p = `${V}files/${NAME}.html`, { ids, links } = parse(p);
  assert.ok(chapters.every((c) => ids.has(`ch-${c.slug}`)));
  const bad = [];
  for (const l of links) {
    if (l.tag === "link" && /canonical|alternate/.test(l.attrs.rel)) continue;
    if (l.attr !== "href" || l.tag !== "a") { if (!l.url.startsWith("data:")) bad.push(`外部资源 ${l.tag} ${l.url.slice(0, 80)}`); continue; }
    if (l.url.startsWith("#")) { if (!ids.has(decodeURIComponent(l.url.slice(1)))) bad.push(`缺锚点 ${l.url}`); continue; }
    if (!(SEC.test(l.url) || l.url.startsWith(PROD + V) || l.url === "mailto:leoycwan@gmail.com")) bad.push(`外链 ${l.url}`);
  }
  assert.deepEqual(bad, []);
  assert.equal(links.filter((l) => l.url.startsWith("#i")).length, 444);
});

// ---------- PDF ----------
// 冻结 PDF：第 1 页是译者声明和目录，原文第 n 页是 PDF 第 n+1 页（0 起算的页序号 = n）
function readPdf() {
  const py = String.raw`
import json, sys, pypdf
r = pypdf.PdfReader(sys.argv[1]); nd = r.named_destinations
def walk(o, d=0):
    for x in o:
        if isinstance(x, list): yield from walk(x, d + 1)
        else: yield [d, x.title, r.get_destination_page_number(x)]
links = []
for i, pg in enumerate(r.pages):
    for a in pg.get("/Annots") or []:
        a = a.get_object(); d = a.get("/Dest")
        if a.get("/Subtype") == "/Link" and d is not None:
            name = str(d).lstrip("/"); t = nd.get(str(d))
            links.append([i, name, r.get_destination_page_number(t) if t is not None else None])
print(json.dumps({"pages": len(r.pages), "outline": list(walk(r.outline)), "links": links}))`;
  const pdf = join(CONTENT, "files", `${NAME}.pdf`);
  const r = spawnSync("python3", ["-I", "-c", py, pdf], { encoding: "utf8", maxBuffer: 1 << 26 });
  return r.status === 0 ? JSON.parse(r.stdout) : null;
}
let pdfData;
const pdf = (t) => {
  pdfData ??= readPdf() ?? false;
  if (!pdfData) { if (process.env.CI) throw new Error("CI 里必须有 python3 + pypdf"); t.skip("没有 python3 + pypdf（pip install -r tools/s1-import/requirements.txt）"); }
  return pdfData;
};

test("PDF 书签：32 章各指向本章第一页", (t) => {
  const d = pdf(t); if (!d) return;
  assert.equal(d.pages, 423);
  const marks = d.outline.filter(([depth]) => depth === 1);
  assert.deepEqual(marks.map(([, title, page]) => [title, page]), chapters.map((c) => [c.title, c.from]));
});

// 分隔图页（原文第 15、37、143、189、253 页）上的锚点在页顶 top:0，Chromium 打印时曾把目标页算成 2 倍；pdf.cjs 打印前把它们挪下 1pt
test("PDF 页内链接：目录链接指向各章首页，原版链接指向和 HTML 相同的原文页", (t) => {
  const d = pdf(t); if (!d) return;
  const { pageOfId } = crossRefs(), bad = [];
  for (const [src, name, target] of d.links) {
    const want = name.startsWith("ch-") ? chapters.find((c) => `ch-${c.slug}` === name)?.from : pageOfId.get(name)?.page;
    if (want === undefined || target !== want) bad.push(`PDF 第 ${src + 1} 页 → ${name}：指向第 ${target === null ? "（无）" : target + 1} 页，应为第 ${want + 1} 页`);
  }
  assert.deepEqual(bad, []);
  assert.equal(d.links.length, 477);
});

// ---------- 浏览器实点 ----------
// 页面里的绝对地址指向正式域名，测试里把它们转给本地服务器
async function open(engine, opts = { viewport: { width: 1440, height: 900 } }) {
  const ctx = await browsers[engine].newContext(opts);
  await ctx.route((u) => u.origin === PROD, async (r) => r.fulfill({ response: await r.fetch({ url: r.request().url().replace(PROD, server.url) }) }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const where = (page) => page.evaluate(() => ({
  path: location.pathname, search: location.search, hash: decodeURIComponent(location.hash.slice(1)),
  immersive: document.body.classList.contains("s1-immersive"), y: Math.round(scrollY),
  counter: document.querySelector(".s1-ibar-page")?.textContent || "",
  original: document.querySelector(".s1-original")?.hidden === false,
  same: window.__s1mark === 1, // 没有重新加载
}));
const mark = (page) => page.evaluate(() => { window.__s1mark = 1; });
// 点一下并等新页面加载完（检查不是原地刷新：之前打的标记应该没了）
async function go(page, target) {
  await mark(page);
  await Promise.all([page.waitForEvent("framenavigated", { timeout: 15000 }), typeof target === "function" ? target() : page.locator(target).first().click()]);
  await page.waitForLoadState("load");
  await page.waitForTimeout(150); // s1.js 在 load 后切换版式、滚动到锚点
  const w = await where(page);
  assert.equal(w.same, false, `${w.path} 没有重新加载`);
  return w;
}
// 锚点元素相对视口顶部的位置（全屏阅读时顶栏 56px 挡在上面）
const anchorTop = (page) => page.evaluate(() => {
  const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  return el ? Math.round(el.getBoundingClientRect().top) : null;
});

for (const engine of ["chromium", "webkit"]) {
  const skip = (t) => { if (!browsers[engine]) { t.skip("本地没有安装 WebKit（npx playwright install webkit）"); return true; } };

  test(`${engine}：菜单、语言切换、面包屑、栏目列表、英文说明页的链接`, async (t) => {
    if (skip(t)) return;
    const { ctx, page, errors } = await open(engine);
    await page.goto(server.url + "/translations/anthropic-s1/");
    assert.equal((await go(page, "#menu a[title=译文]")).path, "/translations/");
    assert.equal((await go(page, "main a.entry-link[href$='/translations/anthropic-s1/']")).path, "/translations/anthropic-s1/");
    assert.equal((await go(page, "a[aria-label=English]")).path, "/en/translations/anthropic-s1/");
    // 英文说明页正文里的中文译本链接（曾经是原地刷新）
    assert.equal((await go(page, "main .post-content a[href='/translations/anthropic-s1/']")).path, "/translations/anthropic-s1/");
    await page.goto(server.url + "/en/translations/anthropic-s1/");
    assert.equal((await go(page, "a[aria-label=中文]")).path, "/translations/anthropic-s1/");
    await page.goto(server.url + "/en/translations/");
    assert.equal((await go(page, "main a.entry-link")).path, "/en/translations/anthropic-s1/");
    // 章节页：面包屑、语言切换
    await page.goto(server.url + `${V}mdna/`);
    assert.equal((await go(page, ".s1-crumb a >> nth=1")).path, V);
    assert.equal((await go(page, `.s1-toc a[href='${V}business/']`)).path, `${V}business/`);
    assert.equal((await go(page, ".s1-crumb a >> nth=0")).path, "/translations/anthropic-s1/");
    await page.goto(server.url + `${V}mdna/`);
    assert.equal((await go(page, "a[aria-label=English]")).path, "/en/translations/anthropic-s1/");
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test(`${engine}：章节翻页、全屏阅读的目录/翻章/跳页/退出`, async (t) => {
    if (skip(t)) return;
    const { ctx, page, errors } = await open(engine);
    await page.goto(server.url + `${V}mdna/`);
    let w = await go(page, "nav.s1-paginav a.next");
    assert.deepEqual([w.path, w.y], [`${V}business/`, 0]);
    w = await go(page, "nav.s1-paginav a.prev");
    assert.equal(w.path, `${V}mdna/`);
    // 进入全屏阅读：同一页，不重新加载
    await mark(page);
    await page.click("[data-enter]");
    w = await where(page);
    assert.deepEqual([w.search, w.immersive, w.same, w.counter], ["?read=1", true, true, "143 / 421"]);
    // 目录面板里的其他章节：留在全屏阅读
    await page.click(".s1-ibar summary");
    w = await go(page, `.s1-ibar .s1-toc a[href='${V}business/']`);
    assert.deepEqual([w.path, w.search, w.immersive, w.y], [`${V}business/`, "?read=1", true, 0]);
    // ] [ 翻章、顶栏按钮翻章
    w = await go(page, () => page.keyboard.press("]"));
    assert.deepEqual([w.path, w.search, w.immersive], [`${V}governance/`, "?read=1", true]);
    w = await go(page, () => page.keyboard.press("["));
    assert.deepEqual([w.path, w.immersive], [`${V}business/`, true]);
    w = await go(page, ".s1-ibar [data-dir=prev]");
    assert.deepEqual([w.path, w.immersive], [`${V}mdna/`, true]);
    // 跳页：别的章节去那一章的那一页；本章内只滚动
    page.once("dialog", (d) => d.accept("300"));
    w = await go(page, ".s1-ibar-page");
    assert.deepEqual([w.path, w.search, w.immersive, w.counter], [`${V}principal-stockholders/`, "?read=1", true, "300 / 421"]);
    await mark(page);
    page.once("dialog", (d) => d.accept("302"));
    await page.click(".s1-ibar-page");
    await page.waitForTimeout(150);
    w = await where(page);
    assert.deepEqual([w.same, w.counter], [true, "302 / 421"]);
    // 退出：回到普通页面，留在原处
    await page.click("[data-exit]");
    w = await where(page);
    assert.deepEqual([w.path, w.search, w.immersive, w.same], [`${V}principal-stockholders/`, "", false, true]);
    assert.ok(w.y > 0);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test(`${engine}：全屏阅读的目录里点当前章，留在全屏阅读、停在原处、目录收起`, async (t) => {
    if (skip(t)) return;
    const { ctx, page } = await open(engine);
    await page.goto(server.url + `${V}business/?read=1`);
    await page.evaluate(() => scrollTo(0, 20000));
    await page.click(".s1-ibar summary");
    await mark(page);
    const y0 = Math.round(await page.evaluate(() => scrollY));
    await page.locator(".s1-ibar .s1-toc li[aria-current] a").click();
    await page.waitForTimeout(300);
    const w = await where(page);
    const tocOpen = await page.evaluate(() => !!document.querySelector(".s1-ibar-toc[open]"));
    await ctx.close();
    assert.deepEqual([w.search, w.immersive, w.same, w.y, tocOpen], ["?read=1", true, true, y0, false]);
  });

  test(`${engine}：原版里的跨章链接（封面目录、每页「目录」回链）跳到目标位置，手机上也切到原版`, async (t) => {
    if (skip(t)) return;
    let { ctx, page, errors } = await open(engine);
    await page.goto(server.url + `${V}cover/`);
    assert.equal((await where(page)).original, true, "宽屏默认原版");
    const toc = page.locator(".s1-original a", { hasText: "风险因素" }).first();
    let w = await go(page, () => toc.click());
    assert.deepEqual([w.path, w.hash, w.original], [`${V}risk-factors/`, "ica694c859b8e458dbf6a73f56dde9d42_2972", true]);
    assert.ok(Math.abs(await anchorTop(page)) <= 2, "锚点在视口顶部");
    w = await go(page, () => page.locator(".s1-original a", { hasText: "目录" }).first().click());
    assert.deepEqual([w.path, w.hash], [`${V}cover/`, "if79d5262bb1f4e24ac84b67b9de9b345_12633"]);
    assert.ok(Math.abs(await anchorTop(page)) <= 2);
    assert.equal(await page.evaluate(() => document.getElementById(location.hash.slice(1)).closest(".s1-sheet").dataset.page), "11");
    // 全屏阅读里：留在全屏，锚点在顶栏下面
    await page.goto(server.url + `${V}business/?read=1`);
    w = await go(page, () => page.locator(".s1-original a", { hasText: "目录" }).first().click());
    assert.deepEqual([w.path, w.search, w.immersive, w.counter], [`${V}cover/`, "?read=1", true, "11 / 421"]);
    const top = await anchorTop(page);
    assert.ok(top >= 50 && top <= 70, `锚点在顶栏下面：${top}`);
    assert.deepEqual(errors, []);
    await ctx.close();
    // 手机默认重排版，带 #id 打开时切到原版并滚到锚点
    ({ ctx, page, errors } = await open(engine, devices["iPhone 13"]));
    await page.goto(server.url + `${V}selected-definitions/#ica694c859b8e458dbf6a73f56dde9d42_179`);
    await page.waitForTimeout(300);
    w = await where(page);
    assert.equal(w.original, true);
    assert.ok(Math.abs(await anchorTop(page)) <= 2);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test(`${engine}：全屏阅读里跳到某页页顶的锚点时，顶栏页码显示这一页`, async (t) => {
    if (skip(t)) return;
    const { ctx, page } = await open(engine);
    await page.goto(server.url + `${V}risk-factors/?read=1#ica694c859b8e458dbf6a73f56dde9d42_2972`);
    await page.waitForTimeout(300);
    const w = await where(page);
    await ctx.close();
    assert.equal(w.counter, "37 / 421");
  });

  test(`${engine}：下载链接：HTML 在新标签页打开、PDF 和 .html 直接下载`, async (t) => {
    if (skip(t)) return;
    const { ctx, page } = await open(engine);
    await page.goto(server.url + V);
    const [popup] = await Promise.all([ctx.waitForEvent("page"), page.click(".s1-dl-card a[target=_blank]")]);
    await popup.waitForLoadState("domcontentloaded");
    assert.equal(new URL(popup.url()).pathname, `${V}files/${NAME}.html`);
    assert.match(await popup.title(), /非官方/);
    await popup.close();
    for (const sel of [`.s1-dl-card a[href$='.pdf']`, `.s1-dl-card a[download$='.html']`, `.s1-vbar a[href$='.pdf']`]) {
      if (sel.startsWith(".s1-vbar")) await page.goto(server.url + `${V}cover/`);
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click(sel)]);
      assert.match(dl.suggestedFilename(), new RegExp(`^${NAME}\\.(pdf|html)$`), sel);
      assert.equal(new URL(dl.url()).pathname, `${V}files/${dl.suggestedFilename()}`);
      await dl.cancel().catch(() => {});
    }
    await ctx.close();
  });

  test(`${engine}：版本菜单（测试样例 /s1-test/）去其他版本的同一章，「全部版本」落到版本表`, async (t) => {
    if (skip(t)) return;
    const { ctx, page } = await open(engine);
    await page.goto(server.url + "/s1-test/v1.0/cover/");
    await page.click(".s1-vmenu summary");
    let w = await go(page, ".s1-vmenu a[href='/s1-test/v0.9/cover/']");
    assert.equal(w.path, "/s1-test/v0.9/cover/");
    w = await go(page, ".s1-old a");
    assert.equal(w.path, "/s1-test/v1.0/cover/");
    await page.click(".s1-vmenu summary");
    w = await go(page, ".s1-vmenu a[href$='#versions']");
    assert.deepEqual([w.path, w.hash], ["/s1-test/", "versions"]);
    // 版本表在页尾附近，页面滚到底时它不一定在视口最上面，但要在视口里
    const [top, vh] = [await anchorTop(page), await page.evaluate(() => innerHeight)];
    assert.ok(top !== null && top >= -2 && top < vh - 40, `版本表在视口里：${top}`);
    assert.ok(w.y > 0 || top <= 2, "滚动到了版本表");
    await ctx.close();
  });
}

test("chromium：离线打开下载的完整 HTML，章节目录和原版链接都能跳到锚点，不请求任何网络资源", async () => {
  const dir = mkdtempSync(join(tmpdir(), "s1-offline-"));
  const file = join(dir, `${NAME}.html`);
  copyFileSync(fileOf(`${V}files/${NAME}.html`), file);
  const ctx = await browsers.chromium.newContext({ viewport: { width: 1280, height: 900 }, offline: true });
  const page = await ctx.newPage();
  const net = [];
  page.on("request", (r) => { if (!/^(file|data):/.test(r.url())) net.push(r.url()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  for (const [sel, nth] of [["a[href='#ch-risk-factors']", 0], ["a[href='#if79d5262bb1f4e24ac84b67b9de9b345_12633']", 100], ["a[href='#ica694c859b8e458dbf6a73f56dde9d42_13']", 0]]) {
    const y0 = await page.evaluate(() => scrollY);
    await page.locator(sel).nth(nth).click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => location.hash), sel.match(/'(#[^']+)'/)[1]);
    assert.ok(Math.abs(await anchorTop(page)) <= 2, sel);
    assert.notEqual(await page.evaluate(() => scrollY), y0, sel);
  }
  assert.deepEqual(net, []);
  await ctx.close();
  rmSync(dir, { recursive: true, force: true });
});
