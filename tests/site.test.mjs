// 站点回归测试（只用 Node 内置模块，不需要 npm install）：
// 用 build.sh（锁定的 Hugo 版本、和 Cloudflare Pages 一样的 --minify）构建整站，检查 PaperMod 之外自己加的部分：
// 短文栏目（content/notes、layouts/notes/list.html、mainSections）、中英文副本、英文配图、
// 按需加载 KaTeX/Mermaid（layouts/_partials/extend_head.html）、渲染钩子（layouts/_markup/）、build.sh 的预览地址。
// 运行：node --test tests/site.test.mjs（说明见 docs/testing.md）
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "https://douseful.eu.org/";

function build(args = [], env = {}) {
  const out = mkdtempSync(join(tmpdir(), "leo-blog-site-"));
  const e = { ...process.env, ...env };
  for (const k of ["CF_PAGES_URL", "CF_PAGES_BRANCH"]) if (!(k in env)) delete e[k];
  const r = spawnSync("bash", ["build.sh", "-d", out, ...args], { cwd: root, env: e, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`build failed\n${r.stdout}\n${r.stderr}`);
  return {
    out,
    log: r.stdout + r.stderr,
    exists: (p) => existsSync(join(out, p)),
    read: (p) => readFileSync(join(out, p.endsWith("/") || p === "" ? join(p, "index.html") : p), "utf8"),
    remove: () => rmSync(out, { recursive: true, force: true }),
  };
}

// --minify 会去掉属性的引号，下面的匹配对两种写法都适用
const hrefs = (html) => [...html.matchAll(/href="?([^"\s>]+)/g)].map((m) => m[1]);
const main = (html) => html.split(/<main[^>]*>/)[1].split("</main>")[0];
const noteEntries = (html) => main(html).split(/<article class="?note-entry"?>/).slice(1).map((a) => a.split("</article>")[0]);
// 首页和短文栏目每页 10 篇（hugo.yaml 的 pagination.pagerSize），把 <列表>/page/2/、/page/3/… 的正文都拼起来
function allPagesOf(s, list) {
  const parts = [main(s.read(list))];
  for (let n = 2; s.exists(`${list}page/${n}/index.html`); n++) parts.push(main(s.read(`${list}page/${n}/`)));
  return parts.join("\n");
}

// 读 content 里的文章：路径、语言、front matter
function frontMatter(file) {
  const m = readFileSync(file, "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : "";
}
const field = (fm, key) => (fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const tags = (fm) => (field(fm, "tags") || "").replace(/^\[|\]$/g, "").split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const contentFiles = walk(join(root, "content")).filter((f) => f.endsWith(".md")).map((f) => relative(join(root, "content"), f));
const isDraft = (f) => field(frontMatter(join(root, "content", f)), "draft") === "true";
// 短文、长文：content/notes、content/posts 下除 _index 以外的 .md（文件夹形式取 index.md）
const notes = contentFiles
  .filter((f) => f.startsWith("notes/") && !f.includes("_index") && !f.endsWith(".en.md") && !isDraft(f))
  .map((f) => { const fm = frontMatter(join(root, "content", f)); return { file: f, film: !!field(fm, "film"), slug: field(fm, "slug") || f.replace(/^notes\/(films\/)?|(\/index)?\.md$/g, "") }; });
const posts = contentFiles
  .filter((f) => f.startsWith("posts/") && !f.includes("_index") && !f.endsWith(".en.md") && !isDraft(f))
  .map((f) => ({ file: f, slug: field(frontMatter(join(root, "content", f)), "slug") || f.replace(/^posts\/|(\/index)?\.md$/g, "") }));

let site, drafts;
before(() => {
  site = build();
  drafts = build(["--buildDrafts"]);
});
after(() => { site?.remove(); drafts?.remove(); });

test("测试的前提：content 里至少有一篇短文和一篇长文", () => {
  assert.ok(notes.length > 0 && posts.length > 0, `notes=${notes.length} posts=${posts.length}`);
});

// ── 短文栏目（PR #14）────────────────────────────────────────────

for (const [lang, prefix] of [["中文", ""], ["英文", "en/"]]) {
  test(`${lang}首页只列长文，不列短文`, () => {
    const links = hrefs(allPagesOf(site, prefix));
    for (const p of posts) assert.ok(links.includes(`${PROD}${prefix}posts/${p.slug}/`), `首页缺少长文 ${p.slug}`);
    for (const n of notes) assert.ok(!links.includes(`${PROD}${prefix}notes/${n.slug}/`), `首页不该出现短文 ${n.slug}`);
  });

  test(`${lang}归档只收长文`, () => {
    const links = hrefs(main(site.read(`${prefix}archives/`)));
    for (const p of posts) assert.ok(links.includes(`${PROD}${prefix}posts/${p.slug}/`), `归档缺少长文 ${p.slug}`);
    assert.ok(!links.some((l) => /\/notes\/[^/]+\/$/.test(l)), "归档里不该有短文");
  });

  test(`${lang}短文栏目按时间线列出全部短文，并展开全文`, () => {
    const entries = noteEntries(`<main>${allPagesOf(site, `${prefix}notes/`)}</main>`);
    assert.equal(entries.length, notes.length);
    for (const n of notes) {
      const entry = entries.find((e) => e.includes(`${PROD}${prefix}notes/${n.slug}/`));
      assert.ok(entry, `短文栏目缺少 ${n.slug}`);
      // 短片的文章（front matter 有 film:）只放导语和封面（链接到文章，标着「短片 · 时长」），播放器和文字稿在文章页
      if (n.film) {
        assert.match(entry, new RegExp(`<a class="?film-cover"? href="?${(PROD + prefix + "notes/" + n.slug + "/").replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"?`), `${n.slug} 的封面要链接到短片文章`);
        assert.ok(!entry.includes("film-frame") && !entry.includes('id="transcript"') && !entry.includes("id=transcript"), `${n.slug} 在栏目里不放播放器和文字稿`);
        continue;
      }
      // 展开全文：栏目里的正文和单篇页的正文一致，而不是摘要
      const single = site.read(`${prefix}notes/${n.slug}/`).split(/<div class="?post-content[^>]*>/)[1].split(/<\/div>\s*<footer/)[0];
      assert.ok(entry.includes(single.trim()), `${n.slug} 在栏目里不是全文`);
    }
  });

  test(`${lang}短文单篇地址是 /notes/<slug>/，栏目有 RSS`, () => {
    const rss = site.read(`${prefix}notes/index.xml`);
    for (const n of notes) {
      assert.ok(site.exists(`${prefix}notes/${n.slug}/index.html`), `缺少 ${prefix}notes/${n.slug}/`);
      assert.ok(rss.includes(`<link>${PROD}${prefix}notes/${n.slug}/</link>`), `RSS 缺少 ${n.slug}`);
    }
    for (const p of posts) assert.ok(site.exists(`${prefix}posts/${p.slug}/index.html`), `缺少 ${prefix}posts/${p.slug}/`);
  });
}

test("导航菜单第一项是短文栏目（中文「短文」、英文「Notes」）", () => {
  const menu = (html) => html.match(/<ul id="?menu"?[^>]*>([\s\S]*?)<\/ul>/)[1];
  assert.match(menu(site.read("")), new RegExp(`^<li><a href="?${PROD}notes/"?[^>]*><span>短文</span>`));
  assert.match(menu(site.read("en/")), new RegExp(`^<li><a href="?${PROD}en/notes/"?[^>]*><span>Notes</span>`));
});

test("列表里没有 0 分钟、0 字的条目（没有正文的栏目页不显示阅读时长和字数）", () => {
  for (const list of ["", "en/", "translations/", "en/translations/", "notes/", "en/notes/", "archives/", "en/archives/"]) {
    if (!site.exists(`${list}index.html`)) continue;
    assert.doesNotMatch(allPagesOf(site, list), /(^|[>\s·])0 (分钟|字|min\b|words?\b)/, `${list || "首页"} 有 0 分钟或 0 字`);
  }
});

test("正文里的链接不指向页面自己（Markdown 站内链接会被换成当前语言的页面，跨语言链接要用 relref 加 lang）", () => {
  const pages = walk(site.out).filter((f) => f.endsWith("index.html")).map((f) => relative(site.out, f));
  const self = [];
  for (const f of pages) {
    const html = readFileSync(join(site.out, f), "utf8");
    const body = html.split(/<div class="?post-content[^>]*>/)[1]?.split("</main>")[0];
    if (!body) continue;
    const path = "/" + f.replace(/index\.html$/, "");
    for (const h of hrefs(body)) if (h === path || h === PROD + path.slice(1)) self.push(`${path} → ${h}`);
  }
  assert.deepEqual(self, []);
});

// 旧地址跳转（front matter 的 aliases）：从 Hugo 0.158 起，英文页的 alias 相对于语言根目录，
// 写 /posts/x/ 生成 /en/posts/x/；写成 /en/posts/x/ 会生成 /en/en/posts/x/，旧链接就失效了
test("aliases 里的旧地址都能跳到文章（英文页的 alias 不带 /en 前缀）", () => {
  let checked = 0;
  for (const f of contentFiles.filter((f) => !isDraft(f))) {
    const list = (field(frontMatter(join(root, "content", f)), "aliases") || "").replace(/^\[|\]$/g, "").split(",").map((a) => a.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    const en = f.endsWith(".en.md");
    for (const a of list) {
      assert.ok(!(en && a.startsWith("/en/")), `${f} 的 alias ${a} 不要带 /en 前缀（会生成 /en/en/…）`);
      const path = `${en ? "en" : ""}${a}`.replace(/^\//, "");
      assert.ok(site.exists(`${path}index.html`), `${f} 的旧地址 /${path} 没有生成跳转页`);
      assert.match(site.read(path), /http-equiv="?refresh/, `/${path} 不是跳转页`);
      checked++;
    }
  }
  assert.ok(!site.exists("en/en"), "生成了 /en/en/ 目录（英文 alias 写成了带 /en 的形式）");
  assert.ok(checked > 0, "content 里没有 aliases，这条测试没有覆盖到");
});

test("草稿不发布", () => {
  for (const f of contentFiles.filter(isDraft)) {
    const slug = field(frontMatter(join(root, "content", f)), "slug");
    assert.ok(!site.exists(`${dirname(f).split("/")[0]}/${slug}/index.html`), `草稿 ${f} 被发布了`);
  }
});

// ── 中英文副本（项目规则：每篇文章都有英文副本）─────────────────────────

// 例外：S-1 这类英文文件的中文译本（translations/<译本>/<版本>/），英文版就是原文（SEC 上的原件），只在译本首页给英文说明
const isS1Version = (f) => /^translations\/[^/]+\/v[^/]+\//.test(f);

test("每篇已发布的中文文章都有英文副本，反之亦然", () => {
  for (const f of contentFiles.filter((f) => !isDraft(f) && !isS1Version(f))) {
    const twin = f.endsWith(".en.md") ? f.replace(/\.en\.md$/, ".md") : f.replace(/\.md$/, ".en.md");
    assert.ok(contentFiles.includes(twin), `${f} 缺少对应的 ${twin}`);
  }
});

test("中英文副本的 slug、date 一致，页面互相链接", () => {
  for (const f of contentFiles.filter((f) => f.endsWith(".en.md") && /^(notes|posts)\//.test(f) && !f.includes("_index"))) {
    const en = frontMatter(join(root, "content", f)), zh = frontMatter(join(root, "content", f.replace(/\.en\.md$/, ".md")));
    for (const k of ["slug", "date"]) assert.equal(field(en, k), field(zh, k), `${f} 的 ${k} 和中文不一致`);
    const section = f.split("/")[0], slug = field(zh, "slug");
    assert.ok(hrefs(site.read(`${section}/${slug}/`)).includes(`${PROD}en/${section}/${slug}/`), `${slug} 中文页没有链到英文页`);
    assert.ok(hrefs(site.read(`en/${section}/${slug}/`)).includes(`${PROD}${section}/${slug}/`), `${slug} 英文页没有链回中文页`);
  }
});

test("标签成对翻译：中文和英文标签数量相同，「随笔」对应「Notes」", () => {
  for (const f of contentFiles.filter((f) => f.endsWith(".en.md") && /^(notes|posts)\//.test(f) && !f.includes("_index"))) {
    const en = tags(frontMatter(join(root, "content", f))), zh = tags(frontMatter(join(root, "content", f.replace(/\.en\.md$/, ".md"))));
    assert.equal(en.length, zh.length, `${f} 的标签 ${en} 和中文 ${zh} 数量不同`);
    assert.equal(en.includes("Notes"), zh.includes("随笔"), `${f}：中文的「随笔」要译成「Notes」`);
  }
});

test("正文图片都是懒加载、异步解码（layouts/_markup/render-image.html）", () => {
  let n = 0;
  for (const { path, html } of allPages(site)) {
    for (const img of (html.includes("<main") ? main(html) : "").match(/<img [^>]*>/g) || []) {
      if (!/loading="?lazy/.test(img)) continue;
      n++;
      assert.match(img, /decoding="?async/, `${path} 的图片缺少 decoding=async：${img.slice(0, 120)}`);
    }
  }
  assert.ok(n > 0, "没有找到懒加载的正文图片，测试前提不成立");
});

test("有英文版的配图：英文页用 .en 图，中文页用原图（docs/image-translation.md）", () => {
  const specs = walk(join(root, "content")).filter((f) => f.endsWith(".i18n.yaml"));
  assert.ok(specs.length > 0, "content 里没有找到 .i18n.yaml，测试前提不成立");
  for (const spec of specs) {
    const dir = relative(join(root, "content"), dirname(spec));
    const base = spec.split("/").pop().replace(/\.i18n\.yaml$/, "");
    const img = readdirSync(dirname(spec)).find((n) => n.startsWith(base + ".") && !n.includes(".en.") && !n.endsWith(".yaml"));
    const enImg = img.replace(/(\.[^.]+)$/, ".en$1");
    const zhMd = readFileSync(join(dirname(spec), "index.md"), "utf8"), enMd = readFileSync(join(dirname(spec), "index.en.md"), "utf8");
    assert.ok(zhMd.includes(`(${img})`), `${dir}/index.md 应该引用 ${img}`);
    assert.ok(enMd.includes(`(${enImg})`) && !enMd.includes(`(${img})`), `${dir}/index.en.md 应该引用 ${enImg} 而不是 ${img}`);
    const slug = field(frontMatter(join(dirname(spec), "index.md")), "slug");
    const section = dir.split("/")[0];
    // 构建时可能把图转成 WebP（文件名变成 <名字>_hu_<hash>.webp），所以只比较去掉扩展名的部分
    const enStem = enImg.replace(/\.[^.]+$/, "");
    assert.ok(site.read(`en/${section}/${slug}/`).includes(enStem), `英文页 /en/${section}/${slug}/ 没有用 ${enImg}`);
    assert.ok(!site.read(`${section}/${slug}/`).includes(enStem), `中文页 /${section}/${slug}/ 不该用 ${enImg}`);
  }
});

// ── 数学公式、Mermaid、提示框（layouts/_markup、extend_head.html）────────────

const allPages = (s) => walk(s.out).filter((f) => f.endsWith(".html")).map((f) => ({ path: relative(s.out, f), html: readFileSync(f, "utf8") }));

test("KaTeX 样式只在有公式的页面加载，Mermaid 只在有图表的页面加载", () => {
  for (const s of [site, drafts]) {
    for (const { path, html } of allPages(s)) {
      const hasMath = /class="?katex"?>/.test(html), hasMermaid = /<pre class="?mermaid"?>/.test(html);
      assert.equal(html.includes("katex.min.css"), hasMath, `${path}: KaTeX 样式与是否有公式不一致`);
      assert.equal(html.includes("mermaid.esm.min.mjs"), hasMermaid, `${path}: Mermaid 脚本与是否有图表不一致`);
    }
  }
});

test("文中的美元金额不会被当成公式（$30 … $1.32 这样成对出现时）", () => {
  // 公式源码里出现连续的英文单词，说明是正文被误当成了公式
  for (const { path, html } of allPages(site)) {
    for (const [, tex] of html.matchAll(/<annotation encoding="?application\/x-tex"?>([^<]*)/g)) {
      assert.doesNotMatch(tex, /(?<!\\)\b[a-zA-Z]{3,}\s+[a-zA-Z]{3,}\s+[a-zA-Z]{3,}\b/, `${path} 把正文渲染成了公式：${tex.slice(0, 80)}`);
    }
  }
  // 草稿测试文章里固定放了一句同段两个金额（content/posts/markdown-test），写法同 README：\$30
  assert.ok(drafts.read("posts/markdown-test/").includes("输出每百万 token 收费 $30，整篇只花了 $1.32。"), "\\$30、\\$1.32 应原样显示");
});

test("$…$ 和 $$…$$ 渲染成 KaTeX（行内和块级）", () => {
  const html = drafts.read("posts/markdown-test/");
  assert.match(html, /<annotation encoding="?application\/x-tex"?>E = mc\^2<\/annotation>/);
  assert.match(html, /<span class="?katex-display"?>[\s\S]*?\\int_0\^\\infty/);
  assert.ok(html.includes("katex.min.css"));
});

test("```mermaid 代码块输出 <pre class=mermaid>，并加载 Mermaid", () => {
  const html = drafts.read("posts/markdown-test/");
  assert.match(html, /<pre class="?mermaid"?>graph LR\n\s*A\[选模板\] --&gt; B\[博客 MVP\]/);
  assert.ok(html.includes("mermaid.esm.min.mjs"));
  // 不能等 window load 才画：Safari 里一张还在加载的图片会让图表一直不出现（主题测试 images-pending 在 WebKit 上发现）
  assert.match(html, /startOnLoad:\s*false/);
  assert.ok(html.includes("mermaid.run()"));
});

test("GitHub 风格提示框带中文标题，普通引用不受影响", () => {
  const html = drafts.read("posts/markdown-test/");
  for (const [type, title, text] of [["note", "注意", "这是注意。"], ["tip", "提示", "这是提示。"], ["warning", "警告", "这是警告。"]]) {
    assert.match(html, new RegExp(`<blockquote class="alert alert-${type}"><p class="?alert-title"?>${title}</p>\\s*<p>${text}</p>`));
  }
  assert.match(html, /<blockquote>\s*<p>普通引用。<\/p>/);
});

// ── build.sh：预览构建用 Cloudflare 的预览地址（README「部署」）─────────────────

test("预览构建（非 main 分支）里的链接指向预览地址，main 分支用正式域名", () => {
  const preview = build([], { CF_PAGES_URL: "https://abc123.leo-blog.pages.dev", CF_PAGES_BRANCH: "feature-x" });
  const prod = build([], { CF_PAGES_URL: "https://abc123.leo-blog.pages.dev", CF_PAGES_BRANCH: "main" });
  try {
    const p = preview.read("");
    assert.ok(hrefs(p).includes("https://abc123.leo-blog.pages.dev/notes/"), "预览站链接没有改成预览地址");
    assert.ok(!p.includes(PROD), "预览站里不该还有正式域名");
    assert.ok(preview.read("en/notes/index.xml").includes("<link>https://abc123.leo-blog.pages.dev/en/notes/</link>"));
    const m = prod.read("");
    assert.ok(hrefs(m).includes(`${PROD}notes/`));
    assert.ok(!m.includes("pages.dev"), "main 分支的构建不该用预览地址");
  } finally {
    preview.remove();
    prod.remove();
  }
});

// ── Cloudflare Web Analytics（docs/analytics.md）────────────────────────────

// 站点生成的所有 .html（含下载文件），路径相对于输出目录
const htmlFiles = (dir) => readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".html"));
// 原样提供的下载文件（S-1 冻结 HTML、双语译文全文）、S-1 的单文件完整 HTML，以及原样发布的短片播放器（在文章的 iframe 里，文章已经计数）
const isDownload = (f) => /(^|\/)files\//.test(f) || f.endsWith("/full.html") || /^films\/[^/]+\/play\//.test(f);
const BEACON = "static.cloudflareinsights.com/beacon.min.js";

test("访问统计只在正式站加载：main 分支每个站点页面都有，下载文件、预览站、本地构建都没有", () => {
  const env = { HUGO_PARAMS_CFANALYTICSTOKEN: "test-token-123" };
  const prod = build([], { ...env, CF_PAGES_BRANCH: "main" });
  const preview = build([], { ...env, CF_PAGES_URL: "https://abc123.leo-blog.pages.dev", CF_PAGES_BRANCH: "feature-x" });
  try {
    const files = htmlFiles(prod.out);
    const downloads = files.filter(isDownload);
    assert.ok(downloads.some((f) => f.includes("anthropic-s1/")) && downloads.some((f) => f.includes("bitter-lesson/")), `没找到下载文件：${downloads}`);
    for (const f of files) {
      const html = prod.read(f);
      if (isDownload(f)) assert.ok(!html.includes("cloudflareinsights"), `${f} 是原样提供的下载文件，不能注入统计脚本`);
      // 跳转页（aliases）没有页脚，不需要统计
      else if (!/<meta http-equiv="?refresh/.test(html)) {
        assert.equal(html.split(BEACON).length - 1, 1, `${f} 应当正好加载一次统计脚本`);
        assert.ok(html.includes(`data-cf-beacon='{"token":"test-token-123"}'`), `${f} 的令牌不对`);
        assert.match(html, /<script type="?module"? src="?https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/, `${f}：脚本要和后台给的片段一样用 type=module，不能阻塞页面`);
      }
    }
    for (const f of ["", "en/", "notes/", "translations/anthropic-s1/", "404.html"]) assert.ok(prod.read(f).includes(BEACON), `${f || "首页"} 没有统计脚本`);
    for (const f of htmlFiles(preview.out)) assert.ok(!preview.read(f).includes("cloudflareinsights"), `预览站 ${f} 不该加载统计`);
    for (const f of htmlFiles(site.out)) assert.ok(!site.read(f).includes("cloudflareinsights"), `本地构建 ${f} 不该加载统计`);
  } finally {
    prod.remove();
    preview.remove();
  }
});

// ── 主题测试里的 CDN 本地副本必须和线上加载的版本一致（tests/theme/package.json）──────────

test("KaTeX 的线上地址锁定了精确版本，并与主题测试使用的版本一致", () => {
  const head = readFileSync(join(root, "layouts/_partials/extend_head.html"), "utf8");
  const pkg = JSON.parse(readFileSync(join(root, "tests/theme/package.json"), "utf8")).devDependencies;
  const m = head.match(/cdn\.jsdelivr\.net\/npm\/katex@([^/]+)\//);
  assert.ok(m, "extend_head.html 里没有 KaTeX 的 CDN 地址");
  assert.match(m[1], /^\d+\.\d+\.\d+$/, `KaTeX 要锁定到精确版本，现在是 @${m[1]}`);
  assert.equal(m[1], pkg.katex, `KaTeX：线上 @${m[1]}，主题测试用 ${pkg.katex}`);
});

// ── Mermaid 由本站提供（static/vendor/mermaid/，tools/vendor-mermaid.sh）──────────

test("Mermaid 从本站加载，版本目录和主题测试锁定的版本一致", () => {
  const head = readFileSync(join(root, "layouts/_partials/extend_head.html"), "utf8");
  const pkg = JSON.parse(readFileSync(join(root, "tests/theme/package.json"), "utf8")).devDependencies;
  assert.doesNotMatch(head, /https?:\/\/[^"']*mermaid/, "Mermaid 不应再从外站加载");
  const m = head.match(/from "\/vendor\/mermaid\/([^/]+)\/mermaid\.esm\.min\.mjs"/);
  assert.ok(m, "extend_head.html 没有从 /vendor/mermaid/ 引入 Mermaid");
  assert.equal(m[1], pkg.mermaid, `Mermaid：页面用 ${m[1]}，主题测试锁定 ${pkg.mermaid}`);
  assert.deepEqual(readdirSync(join(root, "static/vendor/mermaid")), [pkg.mermaid], "只保留当前版本");
});

test("Mermaid 引用的每个分块都发布了，页面上的地址在构建结果里存在", () => {
  const html = drafts.read("posts/markdown-test/");
  const entry = html.match(/from"?\s*"?(\/vendor\/mermaid\/[^"]+\.mjs)"/)?.[1];
  assert.ok(entry, "页面里没有找到 Mermaid 的地址");
  const seen = new Set(), queue = [join(site.out, entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    assert.ok(existsSync(file), `缺少 ${relative(site.out, file)}`);
    const code = readFileSync(file, "utf8");
    for (const [, spec] of code.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*"(\.{1,2}\/[^"]+)"/g)) queue.push(join(dirname(file), spec));
  }
  assert.ok(seen.size > 50, `只找到 ${seen.size} 个分块，解析 import 的正则可能失效了`);
});

test("Mermaid 文件设了长期缓存，其他文件不受影响", () => {
  const headers = readFileSync(join(site.out, "_headers"), "utf8");
  assert.match(headers, /^\/vendor\/mermaid\/\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m);
  assert.equal(headers.match(/immutable/g).length, 1);
});

test("Playwright 的 npm 版本与 CI 镜像一致（浏览器装在镜像里，版本不同会找不到浏览器）", () => {
  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  const images = [...ci.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]);
  assert.ok(images.length >= 1, "ci.yml 里的浏览器测试任务应使用 Playwright 镜像");
  for (const [file, name] of [["tests/package.json", "playwright"], ["tests/theme/package.json", "@playwright/test"]]) {
    const v = JSON.parse(readFileSync(join(root, file), "utf8")).devDependencies[name];
    for (const img of images) assert.equal(v, img, `${file} 的 ${name} 是 ${v}，CI 镜像是 v${img}`);
  }
});

// ── 网站图标（static/，tools/favicon/build.mjs 生成，docs/favicon.md）──────────────

const ICONS = ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "safari-pinned-tab.svg"];
const versioned = (f) => f.replace(/(\.[a-z]+)$/, `.${createHash("sha256").update(readFileSync(join(root, "static", f))).digest("hex").slice(0, 8)}$1`);
const iconHrefs = (html) => [...html.matchAll(/<link [^>]*rel="?(?:icon|apple-touch-icon|mask-icon)"?[^>]*>/g)].map((m) => m[0].match(/href="?([^"\s>]+)/)[1]);

test("每个页面都有 PaperMod 的 5 个图标链接，指向的文件都存在（中英文页、404、S-1、双语译文）", () => {
  // 不含原样提供的下载文件和短片播放器（films/<名字>/play/，在文章的 iframe 里显示，浏览器标签页用的是文章的图标）
  const pages = walk(site.out).map((f) => relative(site.out, f)).filter((f) => f.endsWith(".html") && !/\/files\//.test(f) && !/^films\/[^/]+\/play\//.test(f));
  for (const must of ["index.html", "en/index.html", "404.html", "en/404.html", "translations/anthropic-s1/index.html", "translations/bitter-lesson/index.html"]) assert.ok(pages.includes(must), must);
  const want = ICONS.map((f) => `${PROD}icons/${versioned(f)}`);
  for (const p of pages) {
    const html = readFileSync(join(site.out, p), "utf8");
    if (/<meta http-equiv="?refresh/.test(html)) continue; // aliases 生成的跳转页只有跳转，没有完整的 <head>
    const icons = iconHrefs(html);
    assert.deepEqual(icons, want, `${p} 的图标链接（hugo.yaml 的 params.assets.favicon* 要和 static/icons/ 的文件名一致）`);
    for (const href of icons) assert.ok(site.exists(href.slice(PROD.length)), `${p}: ${href} 指向的文件不存在`);
  }
});

// 浏览器（尤其 Safari）按图标地址长期记住「取不到」或旧图标：2026-10-29 加上图标后，之前访问过正式站的
// 设备一直不显示新图标，只加 ?v= 参数时有的 iPhone Safari 仍然不行。所以页面引用的是文件名带内容版本号的副本，
// 图标一改文件名就变。这里检查副本和根目录的默认文件逐字节相同、版本号就是内容的 sha256，且没有残留的旧版本
test("static/icons/ 是 5 个图标的版本号副本：内容与根目录文件相同，文件名带内容 sha256 前 8 位，没有旧版本残留", () => {
  assert.deepEqual(readdirSync(join(root, "static/icons")).sort(), ICONS.map(versioned).sort(), "重新运行 tools/favicon/build.mjs");
  for (const f of ICONS) assert.ok(readFileSync(join(root, "static/icons", versioned(f))).equals(readFileSync(join(root, "static", f))), f);
});

test("可下载的完整 HTML 保持原样，不带图标链接", () => {
  const files = walk(site.out).map((f) => relative(site.out, f)).filter((f) => /\/files\/[^/]+\.html$/.test(f));
  assert.ok(files.length >= 2, `找到 ${files.length} 个下载文件`);
  for (const f of files) assert.deepEqual(iconHrefs(readFileSync(join(site.out, f), "utf8")), [], f);
});
