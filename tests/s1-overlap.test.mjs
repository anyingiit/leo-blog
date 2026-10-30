// S-1 译本原版版式里的文字不互相压住，换一台字体略宽的电脑也不会。
//
// 译文 HTML 按原文测量的字宽定每个文字块的宽度。有些块恰好卡在边上（如封面「抄送」栏曾把
// “Scott Booth”“Anthropic, PBC”合成一段、段宽等于原文字宽）：Mac 上的 Georgia 比测量时宽一丝，
// 就多折一行，压在下一行“548 Market Street”上（v1.1，译文仓库 v1.1.1 修正）。
//
// 结果取决于字宽，所以不用机器上装的字体：页面用到的每个字体名都换成 tests/fixtures/fonts 里的文件
// （Georgia → 字宽相同的 Gelasio，Times New Roman/Helvetica → Liberation，中文 → Noto CJK 子集，见那里的 README），
// 本地和 CI 结果一致。再给译文文字块加 0.02em 字距，模拟比测量时略宽的字体。最新版本的冻结 HTML 在原字距和加宽后都必须 0 处重叠；
// 反向验证：同样的检查在 v1.1 上要找出已知的 3 处（第 1 页两处、第 2 页标题一处），证明它查得出问题。
// Chromium（≈Chrome）和 WebKit（≈Safari）都查：v1.1 的问题是在 Mac 的 Safari 上看到的。CI 里两个都必须有，
// 本地没装 WebKit 时跳过（npx playwright install webkit）。与译文仓库的 pipeline/text/check_overlap.js 是同一套检查。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, webkit } from "playwright";
import { root } from "./helpers.mjs";

const S1 = join(root, "content/translations/anthropic-s1");
const LATEST = readFileSync(join(S1, "_index.md"), "utf8").match(/^latest: (\S+)$/m)[1];
const frozen = (v) => join(S1, v, "files", `anthropic-s1-zh-unofficial-${v}.html.raw`);
const FONTS = join(root, "tests/fixtures/fonts");
const W = [[400, "normal"], [700, "normal"], [400, "italic"], [700, "italic"]];
const face = (family, file, w, s) => `@font-face{font-family:'${family}';font-weight:${w};font-style:${s};src:url(/fonts/${file})}`;
const FACES = [
  ...W.map(([w, s]) => face("Georgia", `gelasio/gelasio-latin-${w}-${s}.woff2`, w, s)),
  ...W.map(([w, s]) => face("Times New Roman", `liberation/LiberationSerif-${{ "400normal": "Regular", "700normal": "Bold", "400italic": "Italic", "700italic": "BoldItalic" }[w + s]}.woff2`, w, s)),
  ...[400, 700].map((w) => face("Helvetica", `liberation/LiberationSans-${w === 700 ? "Bold" : "Regular"}.woff2`, w, "normal")),
  ...["Songti SC", "STSong", "Noto Serif SC", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun"].flatMap((f) =>
    [400, 700].map((w) => face(f, `noto-cjk/NotoSerifCJK-${w === 700 ? "Bold" : "Regular"}-s1.woff2`, w, "normal"))),
  ...["PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei"].flatMap((f) =>
    [400, 700].map((w) => face(f, `noto-cjk/NotoSansCJK-${w === 700 ? "Bold" : "Regular"}-s1.woff2`, w, "normal"))),
].join("");

const ENGINES = ["chromium", "webkit"];
const browsers = {};
// Linux 上 Chromium 的字体微调（hinting）会把字宽取整，同一字体量出的行宽和 Mac（不取整）不同，CI 镜像默认就开着；
// 关掉它，字宽与 Mac 一致，本地和 CI 结果也一致。WebKit 本来就按不取整的字宽排版（实测开关微调结果相同）
before(async () => {
  browsers.chromium = await chromium.launch({ args: ["--font-render-hinting=none"] });
  browsers.webkit = await webkit.launch().catch((e) => { if (process.env.CI) throw e; return null; });
});
after(async () => { await Promise.all(Object.values(browsers).map((b) => b?.close())); });

// 打开冻结的完整 HTML（只留前 maxPages 页），按 spacings 逐个加字距，返回每种字距下的重叠
async function overlaps(engine, file, spacings, maxPages = Infinity) {
  const page = await browsers[engine].newPage({ viewport: { width: 1000, height: 1000 } });
  await page.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === "/s1.html") return r.fulfill({ contentType: "text/html; charset=utf-8", body: readFileSync(file) });
    if (u.pathname.startsWith("/fonts/")) return r.fulfill({ contentType: "font/woff2", body: readFileSync(join(FONTS, decodeURIComponent(u.pathname.slice(7)))) });
    return r.abort();
  });
  await page.goto("http://s1.test/s1.html", { waitUntil: "load", timeout: 300000 });
  await page.evaluate((max) => {
    [...document.querySelectorAll('div[style*="margin:10px auto"]')].slice(max).forEach((p) => p.remove());
  }, Number.isFinite(maxPages) ? maxPages : 1e9);
  await page.addStyleTag({ content: FACES + "div.zh{letter-spacing:var(--s1-test-spacing,0)}" +
    // 冻结文件给每页设了 content-visibility:auto，屏幕外的页不排版、量不到，测试时全部排出来
    "[style*='content-visibility']{content-visibility:visible!important}" });
  // 先把所有替换字体都加载完，避免量到系统字体的字宽
  const failed = await page.evaluate(async () => {
    await Promise.allSettled([...document.fonts].map((f) => f.load()));
    return [...document.fonts].filter((f) => f.status !== "loaded").map((f) => f.family);
  });
  assert.deepEqual(failed, [], "测试字体没有加载成功");
  const out = {};
  for (const sp of spacings) {
    out[sp] = await page.evaluate(async (sp) => {
      document.documentElement.style.setProperty("--s1-test-spacing", sp);
      document.body.offsetHeight;
      await document.fonts.ready;
      // 每个文字节点的每一行；“块”= 最近的 div.zh 或绝对定位元素；不同块的行上下交叠超过较矮一行的 35% 算压住
      // （相邻行的行框本来就略有交叠，原文本身在这个标准下也没有重叠）
      const boxes = [], owners = new Map();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) {
        if (!n.data.trim()) continue;
        let o = n.parentElement;
        while (o && !o.classList.contains("zh") && getComputedStyle(o).position !== "absolute") o = o.parentElement;
        o = o || n.parentElement;
        if (!owners.has(o)) owners.set(o, owners.size);
        const r = document.createRange(); r.selectNodeContents(n);
        for (const q of r.getClientRects())
          if (q.width >= 1 && q.height >= 1) boxes.push({ o: owners.get(o), x: q.left + scrollX, y: q.top + scrollY, w: q.width, h: q.height, t: n.data.trim().slice(0, 30) });
      }
      const pages = [...document.querySelectorAll('div[style*="margin:10px auto"]')].map((d) => d.getBoundingClientRect().top + scrollY);
      const pageOf = (y) => pages.filter((t) => t <= y).length;
      boxes.sort((a, b) => a.y - b.y);
      const hits = [];
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i];
        for (let j = i + 1; j < boxes.length && boxes[j].y < a.y + a.h; j++) {
          const c = boxes[j];
          if (c.o === a.o) continue;
          const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
          const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
          if (ox > 1 && oy / Math.min(a.h, c.h) > 0.35) hits.push(`第 ${pageOf(a.y)} 页「${a.t}」×「${c.t}」`);
        }
      }
      return hits;
    }, sp);
  }
  await page.close();
  return out;
}

test("测试用的中文字体子集包含最新版本用到的全部字符", () => {
  const have = new Set(readFileSync(join(FONTS, "noto-cjk/chars.txt"), "utf8"));
  const text = readFileSync(frozen(LATEST), "utf8").replace(/data:[^"') ]+/g, "").replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, "");
  const missing = [...new Set(text)].filter((c) => /[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f]/.test(c) && !have.has(c));
  assert.deepEqual(missing, [], "按 tests/fixtures/fonts/README.md 重新生成字体子集");
});

for (const engine of ENGINES) {
  const skip = (t) => { if (browsers[engine]) return false; t.skip("本地没有安装 WebKit（npx playwright install webkit）"); return true; };

  test(`${engine}：最新版本 ${LATEST} 的原版版式：文字不互相压住，字体略宽（+0.02em）时也不会`, async (t) => {
    if (skip(t)) return;
    const r = await overlaps(engine, frozen(LATEST), ["0", "0.02em"]);
    assert.deepEqual(r["0"], []);
    assert.deepEqual(r["0.02em"], []);
  });

  test(`${engine}：反向验证，同样的检查在 v1.1 上找出封面抄送栏和第 2 页标题的重叠`, async (t) => {
    if (skip(t)) return;
    const r = await overlaps(engine, frozen("v1.1"), ["0", "0.02em"], 3);
    assert.deepEqual(r["0"], [], "v1.1 在测量用的字宽下本来不重叠（问题只在字体略宽时出现）");
    const hits = r["0.02em"].join("\n");
    assert.equal(r["0.02em"].length, 3, hits);
    assert.match(hits, /第 1 页.*Scott Booth Anthropic, PBC/);
    assert.match(hits, /第 1 页.*Calise Y\. Cheng/);
    assert.match(hits, /第 2 页「Anthropic, PBC」/);
  });
}
