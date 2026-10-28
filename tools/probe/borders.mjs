// 临时探针：WebKit（iPhone 13）里完整 HTML 去掉自加的缩放（viewport 和 zoom 脚本）后，像 SEC 原页一样由浏览器整页缩小的效果，确认后删除
import { webkit, devices } from "playwright";
import fs from "node:fs";
const raw = fs.readFileSync("../content/translations/anthropic-s1/v1.1/files/anthropic-s1-zh-unofficial-v1.1.html.raw", "utf8");
fs.writeFileSync("/tmp/cur.html", raw);
const plain = raw.replace(/<meta name=viewport[^>]*>/, "").replace(/<script>\{const \w=\(\)=>\{const \w=Math\.min\(1,document[\s\S]*?<\/script>/, "");
console.log("stripped", raw.length - plain.length);
fs.writeFileSync("/tmp/plain.html", plain);
const b = await webkit.launch();
const dump = (tag, buf) => { const s = buf.toString("base64"); for (let i = 0; i < s.length; i += 4000) console.log(`J${tag} ${s.slice(i, i + 4000)}`); };
for (const v of ["cur", "plain"]) {
  const p = await (await b.newContext(devices["iPhone 13"])).newPage();
  await p.goto(`file:///tmp/${v}.html`, { waitUntil: "load" });
  await p.waitForTimeout(500);
  console.log(v, JSON.stringify(await p.evaluate(() => ({ cw: document.documentElement.clientWidth, iw: innerWidth, vv: visualViewport.scale, z: document.querySelector(".s1-sheets-inner").style.zoom }))));
  dump(v + "top", await p.screenshot({ type: "jpeg", quality: 55 }));
  await p.evaluate(() => { const t = [...document.querySelectorAll("td")].find((t) => t.textContent.trim() === "T类日落时点").closest("table"); scrollTo(0, t.getBoundingClientRect().top + scrollY - 80); });
  await p.waitForTimeout(500);
  dump(v + "tab", await p.screenshot({ type: "jpeg", quality: 55 }));
  await p.close();
}
await b.close();
