// 同一个标签在不同文章里大小写不同（如 "html" 和 "HTML"）时，Hugo 0.153 起每次构建随机取其中一种作标签名，
// 页面内容因此不固定：主题像素测试随机失败，正式站点每次部署的标签名也可能来回变。
// 有这种情况就要给标签建一个 <标签类>/<标签>/_index.md 固定标题（docs/testing.md「构建必须可复现」）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { root } from "./helpers.mjs";

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// front matter 里的列表字段：tags: [a, "b"] 或换行的 - a
function lists(file) {
  const fm = (readFileSync(file, "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
  const out = {};
  const lines = fm.split("\n");
  lines.forEach((line, i) => {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) return;
    const unq = (s) => s.trim().replace(/^["']|["']$/g, "");
    if (m[2].startsWith("[")) out[m[1]] = m[2].replace(/^\[|\]\s*$/g, "").split(",").map(unq).filter(Boolean);
    else if (m[2] === "") {
      const items = [];
      for (let j = i + 1; j < lines.length && /^\s+-\s/.test(lines[j]); j++) items.push(unq(lines[j].replace(/^\s+-\s/, "")));
      if (items.length) out[m[1]] = items;
    }
  });
  return out;
}

// 返回大小写不一致、又没有 _index 固定标题的标签：[{ lang, taxonomy, term, spellings }]
export function unpinnedCaseCollisions(contentDirs, defaultLang) {
  const terms = new Map();
  for (const dir of contentDirs) {
    for (const f of walk(dir).filter((p) => p.endsWith(".md") && !/(^|[\\/])_index(\.\w+)?\.md$/.test(p))) {
      const lang = (f.match(/\.(\w\w)\.md$/) || [])[1] || defaultLang;
      for (const [key, values] of Object.entries(lists(f))) {
        if (!/(tags|categories|series)$/i.test(key)) continue;
        for (const v of values) {
          const id = `${lang}\0${key.toLowerCase()}\0${v.toLowerCase().replace(/\s+/g, "-")}`;
          if (!terms.has(id)) terms.set(id, new Map());
          terms.get(id).set(v, relative(root, f).split(sep).join("/"));
        }
      }
    }
  }
  return [...terms].filter(([, s]) => s.size > 1).map(([id, s]) => {
    const [lang, taxonomy, term] = id.split("\0");
    return { lang, taxonomy, term, spellings: Object.fromEntries(s) };
  }).filter(({ lang, taxonomy, term }) => !contentDirs.some((d) =>
    [`_index.${lang}.md`, ...(lang === defaultLang ? ["_index.md"] : [])].some((n) => existsSync(join(d, taxonomy, term, n)))));
}

const sites = {
  "正式站点（content + 预览用测试短文）": [[join(root, "content"), join(root, "tests/fixtures")], "zh"],
  "主题测试站（tests/theme/site-fixture）": [[join(root, "tests/theme/site-fixture/content")], "zh"],
  // 示例站内容保持原样，固定标题放在 example-site-terms（由 example-site.overrides.yaml 挂载进 content）
  "PaperMod 示例站（tests/theme/example-site）": [[join(root, "tests/theme/example-site/content"), join(root, "tests/theme/example-site-terms")], "en"],
};

for (const [name, [dirs, lang]] of Object.entries(sites)) {
  test(`${name}：大小写不同的同名标签都固定了标题，构建结果可复现`, () => {
    assert.deepEqual(unpinnedCaseCollisions(dirs.filter(existsSync), lang), []);
  });
}

test("检查本身有效：去掉固定标题后能发现示例站的 html / HTML", () => {
  const found = unpinnedCaseCollisions([join(root, "tests/theme/example-site/content")], "en");
  assert.deepEqual(found.map((c) => `${c.lang}/${c.taxonomy}/${c.term}`), ["en/tags/html"]);
  assert.deepEqual(Object.keys(found[0].spellings).sort(), ["HTML", "html"]);
});
