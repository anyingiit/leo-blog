// 测试共用：用 build.sh（锁定的 Hugo 版本）加上测试短文构建整站，再起一个静态文件服务器
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function build() {
  const out = mkdtempSync(join(tmpdir(), "leo-blog-test-"));
  const env = { ...process.env };
  delete env.CF_PAGES_URL; // 不走预览分支，baseURL 用 hugo.yaml 的
  const r = spawnSync("bash", ["build.sh", "--config", "hugo.yaml,tests/hugo.test.yaml", "-d", out], { cwd: root, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`build failed\n${r.stdout}\n${r.stderr}`);
  return { out, log: r.stdout + r.stderr, exists: (p) => existsSync(join(out, p)), remove: () => rmSync(out, { recursive: true, force: true }) };
}

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".xml": "application/xml",
  ".webp": "image/webp", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml" };

// 站点 baseURL 是正式域名，页面里的绝对地址指向它；测试只用相对路径访问
export function serve(dir) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = join(dir, p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" });
    res.end(readFileSync(f));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

// 原版版式：灰框里每张纸左右两边露出的灰边宽度（像素级）。
// 先按布局量（每张纸的左右留白，CSS 像素），再截一行真实像素核对：从框的两端往里数和灰框同色的像素，左右应一样多。
// 返回 { rect: [{ L, R }...], pixel: { L, R } }，单位都是 CSS 像素；pixel 的精度是 1 个设备像素
export async function sheetMargins(page) {
  const rect = await page.evaluate(() => {
    const box = document.querySelector(".s1-original:not([hidden]) .s1-sheets");
    const a = box.getBoundingClientRect();
    return [...box.querySelectorAll(".s1-sheet")].map((s) => s.getBoundingClientRect()).filter((c) => c.width > 0)
      .map((c) => ({ L: c.left - a.left, R: a.right - c.right }));
  });
  // 截图那一行：第一张纸滚进视口后，取纸上部 40% 高处（避开阴影和页脚），横跨整个灰框（框比视口宽时取视口内的部分）
  const clip = await page.evaluate(() => {
    const box = document.querySelector(".s1-original:not([hidden]) .s1-sheets");
    const s = box.querySelector(".s1-sheet");
    s.scrollIntoView({ block: "start" });
    const a = box.getBoundingClientRect(), c = s.getBoundingClientRect();
    const y = Math.round(Math.max(c.top, 0) + Math.min(c.height, innerHeight - Math.max(c.top, 0)) * 0.4);
    const x0 = Math.max(Math.ceil(a.left), 0), x1 = Math.min(Math.floor(a.right), document.documentElement.clientWidth);
    return { x: x0, y, width: x1 - x0, height: 1, bg: getComputedStyle(box).backgroundColor.match(/\d+/g).slice(0, 3).map(Number) };
  });
  const bg = clip.bg;
  delete clip.bg;
  const png = (await page.screenshot({ clip, animations: "disabled" })).toString("base64");
  const pixel = await page.evaluate(async ([b64, frame]) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, 1).data;
    const px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    // 纸的范围 = 第一列到最后一列明显不同于灰框底色（.s1-sheets 的背景色）的像素
    const off = (i) => px(i).some((v, k) => Math.abs(v - frame[k]) > 6);
    let a = 0, b = img.width - 1;
    while (a < img.width && !off(a)) a++;
    while (b > a && !off(b)) b--;
    return { L: a / devicePixelRatio, R: (img.width - 1 - b) / devicePixelRatio, dpr: devicePixelRatio };
  }, [png, bg]);
  return { rect, pixel };
}

// 模拟 Cloudflare 的邮件地址混淆（Scrape Shield → Email Address Obfuscation，正式站开着）：
// 页面里的 mailto 链接换成 /cdn-cgi/l/email-protection# 加密地址和 [email protected] 占位，
// 并在每个被改的地址后面第一个 <script 前插一个解码脚本（线上实测的位置，可能落进 <template> 里）。
// 解码脚本按线上 email-decode.min.js 的行为写：解开页面和 <template> 里的地址，然后把自己从父节点移走。
// 浏览器上下文 ctx 里经 base 访问的 HTML 都过一遍，返回改写后的页面（按地址），测试可以核对插在哪里。
// intoTemplate：另外在每个 <template> 里也插一个，模拟最坏情况（模板里有脚本时线上就会这样）
export const CF_DECODER = "/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js";
const CF_DECODER_JS = `!function(){"use strict";
var P="/cdn-cgi/l/email-protection#";
function dec(s,i){var k=parseInt(s.substr(i,2),16),o="";for(var j=i+2;j<s.length;j+=2)o+=String.fromCharCode(parseInt(s.substr(j,2),16)^k);try{o=decodeURIComponent(escape(o))}catch(e){}return o}
function run(r){
  r.querySelectorAll("a").forEach(function(a){var i=a.href.indexOf(P);if(i>-1)a.href="mailto:"+dec(a.href,i+P.length)});
  r.querySelectorAll(".__cf_email__").forEach(function(s){s.parentNode.replaceChild(document.createTextNode(dec(s.getAttribute("data-cfemail"),0)),s)});
  r.querySelectorAll("template").forEach(function(t){run(t.content)});
}
run(document);
var me=document.currentScript||document.scripts[document.scripts.length-1];me.parentNode.removeChild(me);
}();`;
export function cfObfuscate(html, { intoTemplate = false } = {}) {
  const enc = (email) => {
    const k = 0x5a, b = Buffer.from(email, "utf8");
    return [k, ...b.map((c) => c ^ k)].map((c) => c.toString(16).padStart(2, "0")).join("");
  };
  html = html.replace(/<a href="?mailto:([^"\s>]+)"?>([^<]*)<\/a>/g, (m, email, text) => {
    const e = enc(email);
    const body = text === email ? `<span class="__cf_email__" data-cfemail="${e}">[email&#160;protected]</span>` : text;
    return `<a href="/cdn-cgi/l/email-protection#${e}">${body}</a>`;
  });
  // 替换后的位置会变，按替换后的文本重新找每个地址，再在它后面第一个 <script 前插解码脚本（同一处只插一次）
  const tag = `<script data-cfasync="false" src="${CF_DECODER}"></script>`;
  const spots = new Set();
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#/g)) {
    const s = html.indexOf("<script", m.index);
    spots.add(s < 0 ? html.lastIndexOf("</body>") : s);
  }
  if (intoTemplate) for (const m of html.matchAll(/<\/template>/g)) spots.add(m.index);
  for (const s of [...spots].sort((a, b) => b - a)) html = html.slice(0, s) + tag + html.slice(s);
  return html;
}
export async function cfEmailObfuscation(ctx, base, opts) {
  const served = new Map();
  await ctx.route(base + "/cdn-cgi/**", (r) => r.fulfill({ contentType: "text/javascript", body: CF_DECODER_JS }));
  await ctx.route(base + "/**", async (r) => {
    if (r.request().resourceType() !== "document") return r.fallback();
    const res = await r.fetch();
    if (!/text\/html/.test(res.headers()["content-type"] || "")) return r.fulfill({ response: res });
    const html = cfObfuscate(await res.text(), opts);
    served.set(new URL(r.request().url()).pathname, html);
    return r.fulfill({ response: res, body: html });
  });
  return served;
}
