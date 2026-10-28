// 临时探针：WebKit（iPhone 13）里第 251 页「日落条款」表格修复前后的截图，以 base64 打到日志，确认后删除
import { webkit, devices } from "playwright";
import fs from "node:fs";
fs.copyFileSync("../content/translations/anthropic-s1/v1.1/files/anthropic-s1-zh-unofficial-v1.1.html.raw", "/tmp/s1.html");
const b = await webkit.launch();
for (const fix of [false, true]) {
  const p = await (await b.newContext(devices["iPhone 13"])).newPage();
  await p.goto("file:///tmp/s1.html", { waitUntil: "load" });
  if (!fix) await p.evaluate(() => { for (const e of document.querySelectorAll(".s1-sheets-inner")) e.style.removeProperty("--s1-z"); });
  const r = await p.evaluate(() => { const t = [...document.querySelectorAll("td")].find((t) => t.textContent.trim() === "T类日落时点").closest("table"); scrollTo(0, t.getBoundingClientRect().top + scrollY - 70); const r = t.getBoundingClientRect(); return { x: r.x, y: r.y }; });
  await p.waitForTimeout(400);
  const s = (await p.screenshot({ type: "jpeg", quality: 60, clip: { x: r.x - 6, y: r.y - 6, width: 300, height: 60 } })).toString("base64");
  for (let i = 0; i < s.length; i += 4000) console.log(`J${fix ? "A" : "B"} ${s.slice(i, i + 4000)}`);
  await p.close();
}
await b.close();
