// 网站图标（static/ 下 PaperMod 默认读取的 5 个文件，tools/favicon/build.mjs 生成，说明见 docs/favicon.md）：
// 文件格式、16px 下的逐像素设计（整像素对齐的 L、内圈灰边、透明圆角）、主屏图标不透明，
// 以及提交的文件就是生成脚本的输出（防止有人只换了图片、或改了脚本没重新生成）。
// 页面里的图标链接都能取到文件，在 site.test.mjs 里用整站构建检查。
// 运行：cd tests && node --test favicon.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./helpers.mjs";
import { render, BG, FG, RING } from "../tools/favicon/build.mjs";

const staticFile = (f) => readFileSync(join(root, "static", f));

// 解码 8 位 RGB/RGBA、非隔行的 PNG（Chromium 截图就是这种），返回 { width, height, colorType, px(x, y) → [r,g,b,a] }
function decodePng(buf) {
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG 文件头");
  let pos = 8, ihdr, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("latin1", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  assert.equal(ihdr.depth, 8);
  assert.equal(ihdr.interlace, 0);
  const bpp = { 2: 3, 6: 4 }[ihdr.colorType];
  assert.ok(bpp, `不支持的颜色类型 ${ihdr.colorType}`);
  const raw = inflateSync(Buffer.concat(idat)), stride = ihdr.width * bpp, out = Buffer.alloc(stride * ihdr.height);
  for (let y = 0; y < ihdr.height; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  return { ...ihdr, px: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2], bpp === 4 ? out[i + 3] : 255]; } };
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test("favicon.ico 含 16/32/48 三档，16 和 32 与单独的 PNG 完全相同", () => {
  const ico = staticFile("favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1, "类型是图标");
  const n = ico.readUInt16LE(4), entries = {};
  for (let i = 0; i < n; i++) {
    const e = 6 + 16 * i, size = ico[e] || 256, data = ico.subarray(ico.readUInt32LE(e + 12), ico.readUInt32LE(e + 12) + ico.readUInt32LE(e + 8));
    const png = decodePng(data);
    assert.deepEqual([png.width, png.height], [size, size], `第 ${i + 1} 档的 PNG 尺寸`);
    entries[size] = data;
  }
  assert.deepEqual(Object.keys(entries).map(Number).sort((a, b) => a - b), [16, 32, 48]);
  assert.ok(entries[16].equals(staticFile("favicon-16x16.png")));
  assert.ok(entries[32].equals(staticFile("favicon-32x32.png")));
});

test("16px 图标逐像素：整像素的白色 L、主题色底、灰色内圈、透明圆角", () => {
  const p = decodePng(staticFile("favicon-16x16.png"));
  assert.deepEqual([p.width, p.height, p.colorType], [16, 16, 6], "16×16 RGBA");
  const isL = (x, y) => (x >= 5 && x <= 7 && y >= 3 && y <= 12) || (x >= 5 && x <= 11 && y >= 10 && y <= 12);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x === 0 || y === 0 || x === 15 || y === 15, nearCorner = Math.min(x, 15 - x) + Math.min(y, 15 - y) < 4;
    if (nearCorner) continue; // 圆角的抗锯齿过渡，下面单独检查
    const want = isL(x, y) ? [...rgb(FG), 255] : edge ? [...rgb(RING), 255] : [...rgb(BG), 255];
    assert.deepEqual(p.px(x, y), want, `(${x},${y})`);
  }
  for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) assert.ok(p.px(x, y)[3] <= 16, `角 (${x},${y}) 基本透明（抗锯齿残留 ≤ 6%）`);
});

test("32px 图标：L 同样落在整像素上（竖笔第 10–15 列，横笔第 20–25 行）", () => {
  const p = decodePng(staticFile("favicon-32x32.png"));
  assert.deepEqual([p.width, p.height], [32, 32]);
  for (const [x, y] of [[10, 6], [15, 6], [10, 25], [23, 20], [23, 25]]) assert.deepEqual(p.px(x, y), [...rgb(FG), 255], `L 内 (${x},${y})`);
  for (const [x, y] of [[9, 6], [16, 6], [24, 22], [16, 19]]) assert.deepEqual(p.px(x, y), [...rgb(BG), 255], `L 外 (${x},${y})`);
});

test("apple-touch-icon：180×180、不透明（iOS 透明处会补黑）、满版底色、白色 L 在中间", () => {
  const p = decodePng(staticFile("apple-touch-icon.png"));
  assert.deepEqual([p.width, p.height], [180, 180]);
  assert.equal(p.colorType, 2, "RGB，没有透明通道");
  for (const [x, y] of [[0, 0], [179, 0], [0, 179], [179, 179], [90, 20]]) assert.deepEqual(p.px(x, y), [...rgb(BG), 255], `底色 (${x},${y})`);
  assert.deepEqual(p.px(80, 90), [...rgb(FG), 255], "L 竖笔");
});

test("safari-pinned-tab.svg 是单色剪影（不带描边和颜色）", () => {
  const svg = staticFile("safari-pinned-tab.svg").toString();
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /stroke|fill="#|<metadata|<image/);
});

test("提交的图标文件就是 tools/favicon/build.mjs 的输出", async () => {
  const out = mkdtempSync(join(tmpdir(), "leo-blog-favicon-"));
  try {
    await render(out);
    for (const f of ["favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png"]) {
      const a = decodePng(staticFile(f)), b = decodePng(readFileSync(join(out, f)));
      assert.deepEqual([a.width, a.height, a.colorType], [b.width, b.height, b.colorType], f);
      for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) assert.deepEqual(a.px(x, y), b.px(x, y), `${f} (${x},${y})`);
    }
    assert.equal(staticFile("safari-pinned-tab.svg").toString(), readFileSync(join(out, "safari-pinned-tab.svg"), "utf8"));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
