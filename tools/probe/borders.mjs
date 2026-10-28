// 临时探针：WebKit（iPhone 13）里不同细线宽度的实际效果，确认后删除
import { webkit, devices } from "playwright";
import fs from "node:fs";
fs.copyFileSync("../content/translations/anthropic-s1/v1.1/files/anthropic-s1-zh-unofficial-v1.1.html.raw", "/tmp/s1.html");
const URL = "file:///tmp/s1.html";
const Z = 0.4665;
// 细线（1pt）和双线（3pt）各试几种宽度，单位 CSS px（缩放前）
const V = [["原样", null, null], ["1设备px", 1 / (Z * 3), 3 / (Z * 3)], ["1.5设备px", 1.5 / (Z * 3), 4.5 / (Z * 3)], ["2设备px", 2 / (Z * 3), 6 / (Z * 3)], ["现方案1CSSpx", 1 / Z, 3 / Z]];
const prof = (p, buf, edge) => p.evaluate(async ([b64, edge]) => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data, W = img.width, H = img.height;
  const dk = (x, y) => { const i = (y * W + x) * 4; return d[i] + d[i + 1] + d[i + 2] < 300; };
  const out = [];
  if (edge === "left") for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) n += dk(x, y); out.push(Math.round(100 * n / H)); }
  else for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) n += dk(x, y); out.push(Math.round(100 * n / W)); }
  return out.join(",");
}, [buf.toString("base64"), edge]);
const b = await webkit.launch();
for (const [label, w1, w3] of V) {
  const p = await (await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } })).newPage();
  await p.goto(URL, { waitUntil: "load" });
  await p.evaluate(([w1, w3]) => {
    for (const e of document.querySelectorAll(".s1-sheets-inner")) e.style.removeProperty("--s1-z");
    if (w1 == null) return;
    const s = document.createElement("style"); let css = "";
    for (const side of ["top", "bottom", "left", "right"]) css += `td[style*="border-${side}:1pt solid"]{border-${side}-width:${w1}px!important}td[style*="border-${side}:.75pt solid"],td[style*="border-${side}:0.75pt solid"]{border-${side}-width:${w1}px!important}td[style*="border-${side}:3pt double"]{border-${side}-width:${w3}px!important}`;
    s.textContent = css; document.head.append(s);
  }, [w1, w3]);
  const td = await p.evaluateHandle(() => [...document.querySelectorAll("td")].find((t) => t.textContent.trim() === "T类日落时点"));
  await td.evaluate((t) => { scrollTo(0, t.getBoundingClientRect().top + scrollY - 100); });
  await p.waitForTimeout(400);
  const r = await td.evaluate((t) => { const a = t.getBoundingClientRect(), tb = t.closest("table").getBoundingClientRect(); return { x: a.x, y: a.y, w: a.width, h: a.height, th: tb.height }; });
  const crop = await p.screenshot({ clip: { x: r.x - 3, y: r.y - 3, width: 60, height: r.h + 10 } });
  const left = await p.screenshot({ clip: { x: r.x - 3, y: r.y + r.h + 4, width: 8, height: 60 } });
  console.log(`== ${label} 表头格高 ${r.h.toFixed(2)} 表高 ${r.th.toFixed(2)} 左竖线各列深色%: ${await prof(p, left, "left")}`);
  const dbl = await p.$('td[style*="border-bottom:3pt double"]');
  if (dbl) { await dbl.evaluate((t) => t.scrollIntoView({ block: "center" })); await p.waitForTimeout(200); const q = await dbl.boundingBox(); console.log(`   双线各行深色%: ${await prof(p, await p.screenshot({ clip: { x: q.x + 2, y: q.y + q.height - 6, width: Math.min(q.width - 4, 100), height: 12 } }), "bottom")}`); }
  console.log(`PNG ${label} ${crop.toString("base64")}`);
  await p.close();
}
await b.close();
