// 站点回归测试（只用 Node 内置模块，不需要 npm install）：
// 用 build.sh（锁定的 Hugo 版本、和 Cloudflare Pages 一样的 --minify）构建整站，检查 PaperMod 之外自己加的部分：
// 短文栏目（content/notes、layouts/notes/list.html、mainSections）、中英文副本、英文配图、
// 按需加载 KaTeX/Mermaid（layouts/_partials/extend_head.html）、渲染钩子（layouts/_markup/）、build.sh 的预览地址。
// 运行：node --test tests/site.test.mjs（说明见 docs/testing.md）
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
// 短文：content/notes 下除 _index 以外的 .md（文件夹形式取 index.md）
const notes = contentFiles
  .filter((f) => f.startsWith("notes/") && !f.includes("_index") && !f.endsWith(".en.md") && !isDraft(f))
  .map((f) => ({ file: f, slug: field(frontMatter(join(root, "content", f)), "slug") || f.replace(/^notes\/|(\/index)?\.md$/g, "") }));
const posts = contentFiles
  .filter((f) => f.startsWith("posts/") && !f.endsWith(".en.md") && !isDraft(f))
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

// ── 主题测试里的 CDN 本地副本必须和线上加载的版本一致（tests/theme/package.json）──────────

test("KaTeX、Mermaid 的线上地址锁定了精确版本，并与主题测试使用的版本一致", () => {
  const head = readFileSync(join(root, "layouts/_partials/extend_head.html"), "utf8");
  const pkg = JSON.parse(readFileSync(join(root, "tests/theme/package.json"), "utf8")).devDependencies;
  for (const name of ["katex", "mermaid"]) {
    const m = head.match(new RegExp(`cdn\\.jsdelivr\\.net/npm/${name}@([^/]+)/`));
    assert.ok(m, `extend_head.html 里没有 ${name} 的 CDN 地址`);
    assert.match(m[1], /^\d+\.\d+\.\d+$/, `${name} 要锁定到精确版本，现在是 @${m[1]}`);
    assert.equal(m[1], pkg[name], `${name}：线上 @${m[1]}，主题测试用 ${pkg[name]}`);
  }
});

test("Playwright 的 npm 版本与 CI 镜像一致（浏览器装在镜像里，版本不同会找不到浏览器）", () => {
  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  const images = [...ci.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]);
  assert.ok(images.length >= 2, "ci.yml 里应有两个任务使用 Playwright 镜像");
  for (const [file, name] of [["tests/package.json", "playwright"], ["tests/theme/package.json", "@playwright/test"]]) {
    const v = JSON.parse(readFileSync(join(root, file), "utf8")).devDependencies[name];
    for (const img of images) assert.equal(v, img, `${file} 的 ${name} 是 ${v}，CI 镜像是 v${img}`);
  }
});
