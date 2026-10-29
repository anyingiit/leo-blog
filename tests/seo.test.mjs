// 搜索引擎相关的输出（docs/seo.md）：用正式构建（不带测试短文）检查
//   - 站点地图和页面的 robots/canonical 一致：要求收录的页面都在站点地图里，站点地图里的都要求收录
//   - S-1 译本：最新版本的版本页和章节在站点地图里；历史版本 noindex、不在站点地图里
//   - 每个要求收录的页面都有像样的搜索摘要：不是 PaperMod 的兜底文字、不含 Markdown、不从图注开始
//   - 文章的作者写进 <meta name=author> 和结构化数据，但不显示在日期那一行（译文的原作者照常显示）
//   - 带配图的短文用它的配图作分享图（og:image / twitter:image），英文页用英文图
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./helpers.mjs";

const BASE = readFileSync(join(root, "hugo.yaml"), "utf8").match(/^baseURL: (\S+)$/m)[1];
const AUTHOR = readFileSync(join(root, "hugo.yaml"), "utf8").match(/^ {2}author: (.+)$/m)?.[1];

let out;
before(() => {
  out = mkdtempSync(join(tmpdir(), "leo-blog-seo-"));
  const env = { ...process.env };
  delete env.CF_PAGES_URL;
  const r = spawnSync("bash", ["build.sh", "-d", out], { cwd: root, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`build failed\n${r.stdout}\n${r.stderr}`);
});
after(() => out && rmSync(out, { recursive: true, force: true }));

const read = (p) => readFileSync(join(out, p), "utf8");
const attr = (h, re) => h.match(re)?.[1];
// <meta name|property=… content=…>：压缩后的属性值可能是双引号、单引号（值里有双引号时）或不加引号
const meta = (h, key) => {
  const m = h.match(new RegExp(`<meta (?:name|property)="?${key}"? content=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`));
  return m && (m[1] ?? m[2] ?? m[3]);
};
const urlToFile = (u) => decodeURIComponent(u.slice(BASE.length - 1)).replace(/\/$/, "/index.html").slice(1);

// 构建出的每个 HTML 页面（跳过 alias 跳转页、下载文件、单文件完整 HTML）
function pages() {
  return readdirSync(out, { recursive: true }).map(String)
    .filter((f) => f.endsWith(".html") && !f.includes("/files/") && !f.endsWith("full.html"))
    .map((f) => {
      const h = read(f);
      return { f, h, redirect: /http-equiv="?refresh/.test(h.slice(0, 600)),
        robots: meta(h, "robots"),
        canonical: attr(h, /<link rel="?canonical"? href="?([^" >]+)/),
        description: meta(h, "description") };
    })
    .filter((p) => !p.redirect);
}
const sitemap = () => ["zh/sitemap.xml", "en/sitemap.xml"]
  .flatMap((f) => [...read(f).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

test("站点地图和页面一致：要求收录的页面都在站点地图里，站点地图里的页面都要求收录", () => {
  const listed = new Set(sitemap());
  const indexable = pages().filter((p) => p.robots === "index, follow" && p.canonical && !/(^|\/)404\.html$/.test(p.f));
  const missing = indexable.filter((p) => p.canonical === BASE + p.f.replace(/index\.html$/, "") && !listed.has(p.canonical)).map((p) => p.f);
  assert.deepEqual(missing, [], "要求收录但不在站点地图里");
  for (const u of listed) {
    const f = urlToFile(u);
    assert.ok(existsSync(join(out, f)), `站点地图里的 ${u} 没有对应页面`);
    assert.equal(meta(read(f), "robots"), "index, follow", `站点地图里的 ${u} 不要求收录`);
  }
});

test("S-1 译本：最新版本进站点地图并要求收录，历史版本 noindex", () => {
  const dir = join(root, "content/translations/anthropic-s1");
  const latest = readFileSync(join(dir, "_index.md"), "utf8").match(/^latest: (\S+)$/m)[1];
  const versions = readdirSync(dir).filter((v) => existsSync(join(dir, v, "_index.md")));
  assert.ok(versions.length >= 2 && versions.includes(latest));
  const listed = new Set(sitemap());
  for (const v of versions) {
    const chapters = readdirSync(join(dir, v)).filter((c) => existsSync(join(dir, v, c, "index.md")));
    assert.ok(chapters.length > 0, v);
    for (const p of ["", ...chapters.map((c) => `${c}/`)]) {
      const url = `${BASE}translations/anthropic-s1/${v}/${p}`;
      const robots = meta(read(urlToFile(url)), "robots");
      if (v === latest) {
        assert.equal(robots, "index, follow", url);
        assert.ok(listed.has(url), `${url} 不在站点地图里`);
      } else {
        assert.equal(robots, "noindex, nofollow", url);
        assert.ok(!listed.has(url), `历史版本 ${url} 不该在站点地图里`);
      }
    }
  }
});

test("要求收录的页面都有像样的搜索摘要", () => {
  for (const p of pages().filter((p) => p.robots === "index, follow" && !/(^|\/)404\.html$/.test(p.f))) {
    const d = (p.description ?? "").trim();
    assert.ok(d.length >= 8, `${p.f} 的摘要太短：${JSON.stringify(d)}`);
    assert.doesNotMatch(d, /\]\(|\*\*|^#/, `${p.f} 的摘要里有 Markdown：${d}`);
    assert.doesNotMatch(d, / - Leoblog$/, `${p.f} 用了 PaperMod 的兜底摘要「标题 - 站名」`);
    assert.doesNotMatch(d, /^[a-z]+$/, `${p.f} 的摘要只有一个英文单词：${d}`);
    assert.doesNotMatch(d, /^(图片出自|Image from)/, `${p.f} 的摘要从图注开始`);
  }
  // 中文站的长文栏目标题是中文
  assert.match(read("posts/index.html"), /<title>长文 \| Leoblog<\/title>/);
});

test("文章作者写进 meta 和结构化数据，不显示在日期那一行；译文的原作者照常显示", () => {
  assert.ok(AUTHOR, "hugo.yaml 没有设 params.author");
  const articles = pages().filter((p) => /"@type":"BlogPosting"/.test(p.h));
  assert.ok(articles.length > 10);
  for (const p of articles) {
    const ld = JSON.parse(p.h.match(/<script type="?application\/ld\+json"?>(\{"@context":"https:\/\/schema.org","@type":"BlogPosting".*?)<\/script>/s)[1]);
    assert.ok(ld.author?.name, `${p.f} 的结构化数据没有作者`);
    assert.equal(meta(p.h, "author"), ld.author.name, p.f);
  }
  for (const f of ["index.html", "en/index.html", "posts/blog-postmortem/index.html", "notes/index.html", "notes/clever/index.html",
    "translations/index.html", "en/translations/index.html", "translations/anthropic-s1/index.html"]) {
    const meta = [...read(f).matchAll(/class="?(?:post-meta|entry-footer|note-meta)"?>(.*?)<\/(?:div|footer)>/gs)].map((m) => m[1]).join("\n");
    assert.ok(!meta.includes(`<span>${AUTHOR}</span>`), `${f} 的日期那一行显示了站点作者`);
  }
  assert.match(read("translations/index.html"), /<span>Rich Sutton（理查德·萨顿）<\/span>/);
});

test("带配图的短文和长文用自己的配图作分享图，英文页用英文图", () => {
  const bundles = ["posts", "notes"].flatMap((s) => readdirSync(join(root, "content", s), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => `${s}/${d.name}`));
  let checked = 0;
  for (const b of bundles) {
    for (const [md, prefix] of [["index.md", ""], ["index.en.md", "en/"]]) {
      const src = join(root, "content", b, md);
      if (!existsSync(src)) continue;
      const fm = readFileSync(src, "utf8");
      if (/^draft: true$/m.test(fm)) continue;
      const img = fm.match(/!\[[^\]]*\]\(([^)\s]+\.(?:png|jpe?g|webp))/)?.[1];
      if (!img) continue;
      const h = read(`${prefix}${b}/index.html`);
      const og = meta(h, "og:image");
      assert.equal(og, `${BASE}${prefix}${b}/${img}`, `${prefix}${b} 的分享图应是正文第一张图`);
      assert.ok(existsSync(join(out, urlToFile(og))), `${og} 没有发布`);
      assert.equal(meta(h, "twitter:image"), og);
      assert.equal(meta(h, "twitter:card"), "summary_large_image");
      if (prefix) assert.match(img, /\.en\./, `${b} 英文页应用英文图`);
      checked++;
    }
  }
  assert.ok(checked >= 4, `只检查到 ${checked} 篇带图的文章`);
});
