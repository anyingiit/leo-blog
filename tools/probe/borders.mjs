// 临时探针：在 CI 的 WebKit（iPhone 13）里截原文第 251 页「日落条款」表格，修复前后各一张，以 base64 打到日志里。确认后删除
import { webkit, devices } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.argv[2];
const URL = "/translations/anthropic-s1/v1.1/files/anthropic-s1-zh-unofficial-v1.1.html";
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(8799);
for (const fix of [false, true]) {
  const b = await webkit.launch();
  const p = await (await b.newContext(devices["iPhone 13"])).newPage();
  await p.goto("http://localhost:8799" + URL, { waitUntil: "load" });
  if (!fix) await p.evaluate(() => { for (const e of document.querySelectorAll(".s1-sheets-inner")) e.style.removeProperty("--s1-z"); });
  await p.evaluate(() => { const td = [...document.querySelectorAll("td")].find((t) => t.textContent.trim() === "触发条件"); scrollTo(0, td.closest("table").getBoundingClientRect().top + scrollY - 40); });
  await p.waitForTimeout(500);
  const buf = await p.screenshot();
  const s = buf.toString("base64");
  console.log(`PNG ${fix ? "after" : "before"} ${s.length}`);
  for (let i = 0; i < s.length; i += 4000) console.log(`B64 ${fix ? "after" : "before"} ${s.slice(i, i + 4000)}`);
  await b.close();
}
srv.close();
