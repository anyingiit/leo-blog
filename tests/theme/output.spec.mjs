// 非视觉输出快照：生成的文件清单、页面 <head>（SEO、Open Graph、hreflang、RSS/JSON 链接）、RSS、搜索索引、站点地图。
// 截图看不到的主题行为都在这里；升级主题或 Hugo 时，任何变化都会以文本差异的形式列出来。
import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sites } from "./helpers.mjs";

const walk = (d) => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);
const read = (site, p) => readFileSync(join(sites[site].dir, p), "utf8");
// 每个标签一行，便于看差异。资源指纹（文件名里的哈希、SRI）换成占位符：CSS/JS 内容的变化由截图和交互测试判断，
// 这里只关心引用了哪些资源，否则改一个字的样式也会让所有 <head> 快照失败、看不出真正的问题
const unhash = (s) => s.replace(/\.[0-9a-f]{64}\.(css|js)\b/g, ".<hash>.$1").replace(/sha(256|384|512)-[A-Za-z0-9+/=]+/g, "sha$1-<hash>");
const lines = (html) => unhash(html).replace(/></g, ">\n<");
const head = (html) => lines(html.split(/<head>/)[1].split("</head>")[0])
  .replace(/<style>[\s\S]*?<\/style>/g, "<style>…</style>"); // 内联样式的内容由截图覆盖

const pages = {
  site: ["index.html", "posts/sample-post/index.html", "en/posts/sample-post/index.html", "notes/index.html", "en/notes/index.html", "en/index.html", "notes/sample-note/index.html", "tags/index.html", "search/index.html", "404.html"],
  example: ["index.html", "posts/markdown-syntax/index.html", "posts/inner-section/cover-page/index.html", "fr/index.html", "fa/index.html", "archives/index.html", "search/index.html"],
};
const feeds = {
  site: ["index.xml", "notes/index.xml", "en/index.xml", "index.json", "sitemap.xml", "robots.txt"],
  example: ["index.xml", "index.json", "sitemap.xml", "robots.txt", "llms.txt", "fr/index.xml"],
};

for (const site of Object.keys(sites)) {
  test(`${site}：生成的文件清单`, () => {
    const files = walk(sites[site].dir).map((f) => relative(sites[site].dir, f)).sort();
    expect(unhash(files.join("\n")) + "\n").toMatchSnapshot(`${site}-files.txt`);
  });
  for (const p of pages[site]) {
    test(`${site}：${p} 的 <head>`, () => {
      expect(head(read(site, p))).toMatchSnapshot(`${site}-head-${p.replace(/\/?index\.html$/, "").replace(/\//g, "_") || "home"}.txt`);
    });
  }
  for (const f of feeds[site]) {
    test(`${site}：${f}`, () => {
      const text = read(site, f);
      expect(f.endsWith(".json") ? JSON.stringify(JSON.parse(text), null, 1) : lines(text)).toMatchSnapshot(`${site}-${f.replace(/\//g, "_")}.txt`);
    });
  }
}
