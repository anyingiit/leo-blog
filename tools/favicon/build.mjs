// 生成网站图标（方案 F：PaperMod 主题色深色圆角方块 + 白色粗 L + 1px 灰色内圈，说明见 docs/favicon.md）。
// 输出 PaperMod head.html 默认读取的 5 个文件名，放进 static/ 后全站生效，不需要改 hugo.yaml：
//   favicon.ico（16/32/48）、favicon-16x16.png、favicon-32x32.png、apple-touch-icon.png（180，不透明）、safari-pinned-tab.svg
// 另外生成站点默认分享图 share.png（1200×630，hugo.yaml 的 params.images，没有自己配图的页面分享时用它）
// 用法：cd tests && npm ci && node ../tools/favicon/build.mjs [输出目录，默认 static/]
// 栅格化用 tests/ 里锁定版本的 Playwright Chromium，和 CI 的回归测试同一个浏览器
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

// 画布 512 单位；16px 下每像素 32 单位，L 的竖横笔都落在整像素上（竖笔第 5–7 列，横笔第 10–12 行）
export const BG = "#2e2e33"; // PaperMod 默认 theme_color
export const FG = "#ffffff";
export const RING = "#55555a"; // 深色标签栏（≈#35363a）和深色壁纸上也能看出方块轮廓
export const L = "M160 96H256V320H384V416H160Z";

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>\n`;
// 标签、书签用：圆角方块，四角透明，内侧一圈 1px（16px 下）灰边
export const FAVICON = svg(`<rect width="512" height="512" rx="112" fill="${BG}"/><rect x="16" y="16" width="480" height="480" rx="96" fill="none" stroke="${RING}" stroke-width="32"/><path d="${L}" fill="${FG}"/>`);
// 主屏用：满版不透明方形，iOS 自己切圆角，所以不带圆角和灰边；L 缩到 80% 留出圆角安全区
export const TOUCH = svg(`<rect width="512" height="512" fill="${BG}"/><path transform="translate(51.2 51.2) scale(.8)" d="${L}" fill="${FG}"/>`);
// 默认分享图：1200×630 满版底色，L 原大小放在正中（X、Telegram 的大图卡片是 1.91:1；裁成正方形缩略图时 L 也还在中间）
export const SHARE_SIZE = [1200, 630];
export const SHARE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${BG}"/><path transform="translate(328 59)" d="${L}" fill="${FG}"/></svg>\n`;
// 旧版 Safari 固定标签：单色剪影，L 镂空
export const MASK = svg(`<path fill-rule="evenodd" d="M112 0H400A112 112 0 0 1 512 112V400A112 112 0 0 1 400 512H112A112 112 0 0 1 0 400V112A112 112 0 0 1 112 0Z${L}"/>`);

// ICO：每档直接嵌 PNG（Windows Vista 起和所有现代浏览器都支持）
export function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size, e);
    head.writeUInt8(size, e + 1);
    head.writeUInt16LE(1, e + 4); // 色彩平面
    head.writeUInt16LE(32, e + 6); // 每像素位数
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

export async function render(outDir) {
  const { chromium } = createRequire(join(root, "tests/package.json"))("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const png = async (source, width, height = width) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>*{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}" width=${width} height=${height}>`);
    await page.locator("img").evaluate((img) => img.decode());
    return page.screenshot({ omitBackground: true });
  };
  const sizes = {};
  for (const n of [16, 32, 48]) sizes[n] = await png(FAVICON, n);
  const touch = await png(TOUCH, 180);
  const share = await png(SHARE, ...SHARE_SIZE);
  await browser.close();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "favicon-16x16.png"), sizes[16]);
  writeFileSync(join(outDir, "favicon-32x32.png"), sizes[32]);
  writeFileSync(join(outDir, "favicon.ico"), ico([16, 32, 48].map((size) => ({ size, data: sizes[size] }))));
  writeFileSync(join(outDir, "apple-touch-icon.png"), touch);
  writeFileSync(join(outDir, "safari-pinned-tab.svg"), MASK);
  writeFileSync(join(outDir, "share.png"), share);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await render(process.argv[2] || join(root, "static"));
