// 非视觉输出快照：生成的文件清单、页面 <head>（SEO、Open Graph、hreflang、RSS/JSON 链接）、RSS、搜索索引、站点地图。
// 截图看不到的主题行为都在这里；升级主题或 Hugo 时，任何变化都会以文本差异的形式列出来。
import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sites } from "./helpers.mjs";

const walk = (d) => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);
const read = (site, p) => readFileSync(join(sites[site].dir, p), "utf8");
// 每个标签一行，便于看差异
const lines = (html) => html.replace(/></g, ">\n<");
const head = (html) => lines(html.split(/<head>/)[1].split("</head>")[0])
  .replace(/<style>[\s\S]*?<\/style>/g, "<style>…</style>"); // 内联样式的内容由截图覆盖

const pages = {
  site: ["index.html", "posts/sample-post/index.html", "en/posts/sample-post/index.html", "notes/index.html", "notes/sample-note/index.html", "tags/index.html", "search/index.html", "404.html"],
  example: ["index.html", "posts/markdown-syntax/index.html", "posts/inner-section/cover-page/index.html", "fr/index.html", "fa/index.html", "archives/index.html", "search/index.html"],
};
const feeds = {
  site: ["index.xml", "notes/index.xml", "en/index.xml", "index.json", "sitemap.xml", "robots.txt"],
  example: ["index.xml", "index.json", "sitemap.xml", "robots.txt", "llms.txt", "fr/index.xml"],
};

for (const site of Object.keys(sites)) {
  test(`${site}：生成的文件清单`, () => {
    const files = walk(sites[site].dir).map((f) => relative(sites[site].dir, f)).sort();
    expect(files.join("\n") + "\n").toMatchSnapshot(`${site}-files.txt`);
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
