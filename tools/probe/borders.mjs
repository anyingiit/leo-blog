// 临时探针：原文表格 1pt 框线在手机缩放（zoom≈0.47）下是否画出来。只用于排查，确认后删除
import { chromium, webkit, devices } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.argv[2];
const URL = "/translations/anthropic-s1/v1.1/files/anthropic-s1-zh-unofficial-v1.1.html";
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(8799);
const variants = [
  ["chromium", "iPhone13", { ...devices["iPhone 13"], isMobile: true }, null],
  ["webkit", "iPhone13", devices["iPhone 13"], null],
  ["webkit", "dpr2-390", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, null],
  ["webkit", "dpr1-390", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }, null],
  ["webkit", "desktop", { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }, null],
  ["webkit", "iPhone13-transform", devices["iPhone 13"], "transform"],
];
for (const [eng, name, opts, mode] of variants) {
  const b = await (eng === "webkit" ? webkit : chromium).launch();
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  await p.goto("http://localhost:8799" + URL, { waitUntil: "load" });
  if (mode === "transform") await p.evaluate(() => { for (const e of document.querySelectorAll(".s1-sheets-inner")) { const z = parseFloat(e.style.zoom || 1); e.style.zoom = ""; e.style.transform = `scale(${z})`; e.style.transformOrigin = "0 0"; e.parentElement.style.height = e.offsetHeight * z + "px"; } });
  const info = await p.evaluate(() => {
    const td = [...document.querySelectorAll("td")].find((t) => t.textContent.trim() === "触发条件");
    td.scrollIntoView({ block: "center" });
    const r = td.getBoundingClientRect(), cs = getComputedStyle(td);
    return { x: r.x, y: r.y, w: r.width, h: r.height, bt: cs.borderTopWidth, bl: cs.borderLeftWidth, collapse: getComputedStyle(td.closest("table")).borderCollapse, zoom: td.closest(".s1-sheets-inner").style.zoom };
  });
  await p.waitForTimeout(300);
  const r2 = await p.evaluate(() => { const td = [...document.querySelectorAll("td")].find((t) => t.textContent.trim() === "触发条件"); const r = td.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const pad = 4;
  const buf = await p.screenshot({ clip: { x: Math.max(0, r2.x - pad), y: Math.max(0, r2.y - pad), width: Math.min(r2.w + pad * 2, 380), height: Math.min(r2.h + pad * 2, 300) } });
  // 统计左边缘附近每一列、顶部每一行的深色像素比例（框线应是一整列/一整行深色）
  const cols = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data, W = img.width, H = img.height;
    const dk = (x, y) => { const i = (y * W + x) * 4; return d[i] + d[i + 1] + d[i + 2] < 300; };
    const col = [], row = [];
    for (let x = 0; x < Math.min(W, 40); x++) { let n = 0; for (let y = 0; y < H; y++) n += dk(x, y); col.push(Math.round(100 * n / H)); }
    for (let y = 0; y < Math.min(H, 40); y++) { let n = 0; for (let x = 0; x < W; x++) n += dk(x, y); row.push(Math.round(100 * n / W)); }
    return `图 ${W}x${H} 左侧各列深色%: ${col.join(",")} | 顶部各行深色%: ${row.join(",")}`;
  }, buf.toString("base64"));
  console.log(`[${eng} ${name}] ${JSON.stringify(info)}\n  ${cols}`);
  await b.close();
}
srv.close();
