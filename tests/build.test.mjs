// 构建产物检查（关闭 JavaScript 读取生成的 HTML）：图片缩放、原位分组、文案、原图不上线、转义、警告
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { build, serve, root } from "./helpers.mjs";

let site, server, browser, ctx;
before(async () => {
  site = build();
  server = await serve(site.out);
  browser = await chromium.launch();
  ctx = await browser.newContext({ javaScriptEnabled: false });
});
after(async () => { await browser?.close(); server?.close(); site?.remove(); });

// 读出某页里某篇短文卡片（或单篇正文）中的图片和分组信息
async function inspect(path, slug) {
  const page = await ctx.newPage();
  await page.goto(server.url + path);
  const data = await page.evaluate((slug) => {
    const scope = slug
      ? [...document.querySelectorAll("article.note-entry")].find((a) => a.querySelector(`a[href*="/notes/${slug}/"]`))
      : document.querySelector(".post-content");
    if (!scope) return null;
    const img = (e) => Object.fromEntries([...e.attributes].map((a) => [a.name, a.value]));
    const body = scope.querySelector(".note-body") || scope;
    return {
      imgs: [...scope.querySelectorAll("img")].map(img),
      groups: [...scope.querySelectorAll(".img-group")].map((g) => ({ cls: g.className, rows: [...g.querySelectorAll(".img-row")].map((r) => r.querySelectorAll("img").length), imgs: [...g.querySelectorAll("img")].map(img), more: g.querySelector(".note-more")?.textContent ?? null })),
      // 正文顶层块的顺序：p 的文字、单张图、分组
      flow: [...body.children].map((c) => c.classList.contains("img-group") ? `group:${c.querySelectorAll("img").length}` : c.querySelector("img") && !c.textContent.trim() ? "img" : c.textContent.trim()),
      expand: body.dataset.expand, collapse: body.dataset.collapse,
    };
  }, slug);
  await page.close();
  assert.ok(data, `${path} 里找不到 ${slug ?? "正文"}`);
  return data;
}
const widths = (img) => img.srcset.split(", ").map((s) => +s.split(" ")[1].replace("w", ""));

test("文章文件夹里的 jpg/png 缩成多档 WebP，带宽高、懒加载和放大地址", async () => {
  const { imgs } = await inspect("/notes/", "image-test");
  const photo = imgs.find((i) => i.alt.includes("4032"));
  assert.match(photo.src, /_hu_[0-9a-f]+\.webp$/);
  assert.deepEqual(widths(photo), [480, 800, 1200, 1600]);
  assert.equal(photo.width, "1600");
  assert.equal(photo.height, "1200");
  assert.equal(photo.loading, "lazy");
  assert.equal(photo["data-zoom"], photo.src);
  assert.equal(photo.class, "photo");
});

test("比 1600px 窄的图不放大，srcset 只到原图宽度；png 标为截图", async () => {
  const { imgs } = await inspect("/notes/", "image-test");
  const shot = imgs.find((i) => i.alt === "首页");
  assert.deepEqual(widths(shot), [480, 800, 1200, 1500]);
  assert.equal(shot.class, "shot");
});

test("原图不发布", () => {
  assert.equal(site.exists("notes/travel-photos/travel-photos.assets/IMG_01.jpg"), false);
  assert.equal(site.exists("notes/image-test/图片测试.assets/photo.jpg"), false);
});

test("gif、svg 原样输出，不加宽高", async () => {
  const { imgs } = await inspect("/notes/", "edge-cases");
  const gif = imgs.find((i) => i.alt === "动图");
  assert.match(gif.src, /anim\.gif$/);
  assert.equal(gif.width, undefined);
  assert.ok(site.exists("notes/edge-cases/anim.gif"));
  assert.match(imgs.find((i) => i.alt === "很高的 SVG").src, /tall\.svg$/);
});

test("alt 和 title 里的引号原样保留，不多出反斜杠", async () => {
  const { imgs } = await inspect("/notes/", "edge-cases");
  const q = imgs.find((i) => i.src.includes("quote_hu_"));
  assert.equal(q.alt, '带"引号"的图注');
  assert.equal(q.title, '标题里有"引号"');
});

test("找不到的图片在构建时给出警告", () => {
  assert.match(site.log, /edge-cases\/index\.md: 找不到图片 "\.\/missing\.png"/);
});

test("原位分组：单张图留在原位，「几张截图：」后的 4 张截图在原位排成两列", async () => {
  const { flow, groups } = await inspect("/notes/", "image-test");
  assert.deepEqual(flow.slice(1), ["img", "几张截图：", "group:4", "结尾的一段文字。"]);
  assert.equal(groups[0].cls, "img-group cols-2 n-4");
  assert.deepEqual(groups[0].rows, [2, 2]);
  assert.ok(groups[0].imgs.every((i) => /^\(min-width: 768px\) \d+px, 50vw$/.test(i.sizes)), groups[0].imgs.map((i) => i.sizes).join(" | "));
});

test("原位分组：12 张排三列并显示 +3，2 张并排，1 张不分组", async () => {
  const twelve = await inspect("/notes/", "travel-photos");
  assert.equal(twelve.groups[0].cls, "img-group cols-3 n-12");
  assert.equal(twelve.groups[0].imgs.length, 12, "12 张都要在 HTML 里，图集才能翻到");
  assert.equal(twelve.groups[0].more, "+3");
  assert.deepEqual(twelve.groups[0].rows, [3, 3, 6], "第 10 张起放在最后一行并隐藏");
  assert.ok(twelve.groups[0].imgs.every((i) => /^\(min-width: 768px\) \d+px, 33vw$/.test(i.sizes)));
  assert.equal((await inspect("/notes/", "two-photos")).groups[0].cls, "img-group cols-2 n-2");
  assert.equal((await inspect("/notes/", "single-photo")).groups.length, 0);
});

test("包在链接里的图片、中间隔着文字的图片不分组", async () => {
  assert.equal((await inspect("/notes/", "edge-cases")).groups.length, 0);
});

test("单篇页不分组，图片保持正文原样", async () => {
  const { imgs, groups } = await inspect("/notes/travel-photos/");
  assert.equal(groups.length, 0);
  assert.equal(imgs.length, 12);
  assert.ok(imgs.every((i) => i.sizes === "(min-width: 768px) 720px, 100vw"));
});

test("英文站同样分组，折叠按钮文案是英文", async () => {
  const en = await inspect("/en/notes/", "travel-photos");
  assert.equal(en.groups[0].cls, "img-group cols-3 n-12");
  assert.deepEqual([en.expand, en.collapse], ["Show more", "Show less"]);
  const zh = await inspect("/notes/", "travel-photos");
  assert.deepEqual([zh.expand, zh.collapse], ["展开全文", "收起"]);
});

test("测试短文只在 tests/fixtures 里，正式内容目录不包含它们", () => {
  const notes = readdirSync(`${root}/content/notes`);
  for (const slug of readdirSync(`${root}/tests/fixtures/content/notes`)) assert.ok(!notes.includes(slug), slug);
});

test("构建时按张数分行：2→2，3→3，4→2+2，7→4+3；sizes 按每张图在电脑上的宽度（同一行加起来等于正文宽减去缝）", async () => {
  for (const [slug, plan] of [["two-photos", [2]], ["three-photos", [3]], ["four-photos", [2, 2]], ["seven-photos", [4, 3]], ["travel-photos", [3, 3, 6]]]) {
    const { groups } = await inspect("/notes/", slug);
    assert.deepEqual(groups[0].rows, plan, slug);
  }
  const { groups } = await inspect("/notes/", "three-photos");
  const px = groups[0].imgs.map((i) => +i.sizes.match(/\) (\d+)px/)[1]);
  const total = px.reduce((a, b) => a + b, 0);
  assert.ok(total >= 670 - 8 && total <= 670 - 8 + 3, `三张的 sizes 合计 ${total}`);
  assert.ok(px[0] < px[1] && px[1] < px[2], `竖图最窄、16:9 最宽：${px}`);
});

test("CSS 括号配平（多一个 } 会让后面的规则整条失效）", () => {
  const css = readFileSync(`${root}/assets/css/extended/custom.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  for (const ch of css) { if (ch === "{") depth++; if (ch === "}") depth--; assert.ok(depth >= 0, "多了 }"); }
  assert.equal(depth, 0, "少了 }");
});
