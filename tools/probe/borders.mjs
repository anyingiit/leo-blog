// 临时探针：原文表格细线在手机缩放（zoom≈0.47）下是否画出来。只用于排查，确认后删除
import { chromium, webkit, devices } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.argv[2];
const URL = "/translations/anthropic-s1/v1.1/files/anthropic-s1-zh-unofficial-v1.1.html";
const CH = "/translations/anthropic-s1/v1.1/financial-statements-2/";
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } const t = f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : f.endsWith(".webp") ? "image/webp" : "application/octet-stream"; r.writeHead(200, { "content-type": t }); fs.createReadStream(f).pipe(r); }).listen(8799);
// 测量：在单元格边缘附近截一条，返回各列（竖线）或各行（横线）的深色比例
async function measure(p, sel, edge) {
  const r = await p.evaluate(([sel]) => { const td = document.querySelector(sel); td.scrollIntoView({ block: "center" }); return null; }, [sel]);
  await p.waitForTimeout(300);
  const b = await p.evaluate(([sel]) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, [sel]);
  const clip = edge === "left" ? { x: b.x - 4, y: b.y + 2, width: 10, height: Math.min(b.h - 4, 150) } : { x: b.x + 2, y: b.y + b.h - 6, width: Math.min(b.w - 4, 150), height: 12 };
  const buf = await p.screenshot({ clip });
  return p.evaluate(async ([b64, edge]) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data, W = img.width, H = img.height;
    const dk = (x, y) => { const i = (y * W + x) * 4; return d[i] + d[i + 1] + d[i + 2] < 300; };
    const out = [];
    if (edge === "left") for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) n += dk(x, y); out.push(Math.round(100 * n / H)); }
    else for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) n += dk(x, y); out.push(Math.round(100 * n / W)); }
    return out.join(",");
  }, [buf.toString("base64"), edge]);
}
const SINGLE = '.s1-sheet td[style*="border-left:1pt solid"]';
const DOUBLE = '.s1-sheet td[style*="border-bottom:3pt double"]';
for (const [eng, dev] of [["chromium", devices["iPhone 13"]], ["webkit", devices["iPhone 13"]], ["webkit", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  for (const [label, url, fix] of [["完整HTML 修复后", URL, true], ["完整HTML 去掉修复", URL, false], ["站内原版 修复后", CH, true]]) {
    const b = await (eng === "webkit" ? webkit : chromium).launch();
    const ctx = await b.newContext(dev); const p = await ctx.newPage();
    if (url === CH) await ctx.addInitScript(() => { try { localStorage.setItem("s1-view-narrow", "original"); } catch {} });
    await p.goto("http://localhost:8799" + url, { waitUntil: "load" });
    if (!fix) await p.evaluate(() => { for (const e of document.querySelectorAll(".s1-sheets-inner")) e.style.removeProperty("--s1-z"); });
    const z = await p.evaluate(() => [document.querySelector(".s1-sheets-inner").style.zoom, document.querySelector(".s1-sheets-inner").style.getPropertyValue("--s1-z")]);
    let single = "无", dbl = "无";
    try { if (await p.$(SINGLE)) single = await measure(p, SINGLE, "left"); } catch (e) { single = "错误 " + e.message; }
    try { if (await p.$(DOUBLE)) dbl = await measure(p, DOUBLE, "bottom"); } catch (e) { dbl = "错误 " + e.message; }
    console.log(`[${eng} dpr${dev.deviceScaleFactor} ${label}] zoom=${z[0]} --s1-z=${z[1]}\n  1pt 竖线各列深色%: ${single}\n  3pt 双线各行深色%: ${dbl}`);
    await b.close();
  }
}
srv.close();
