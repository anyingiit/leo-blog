// 主题测试共用：构建两个参照站，并把浏览器的所有请求都接到本地文件上（不访问外网，结果可复现）
import { spawnSync } from "node:child_process";
import { existsSync, statSync, readFileSync, rmSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, "..", "..");
export const out = join(here, ".out");

// 两个站点：PaperMod 官方示例站（主题的参照数据）、本站的模板和配置加上固定测试文章
// --clock 固定"当前时间"，页脚年份等不会随日期变化
export const sites = {
  example: { host: "example.test", dir: join(out, "example"),
    args: ["-s", "tests/theme/example-site", "--themesDir", "../../../themes", "--buildDrafts"] },
  site: { host: "blog.test", dir: join(out, "site"),
    args: ["--contentDir", "tests/theme/site-fixture/content"] },
};
export const CLOCK = "2026-10-26T12:00:00Z";

export function buildAll() {
  rmSync(out, { recursive: true, force: true });
  for (const s of Object.values(sites)) {
    const env = { ...process.env };
    delete env.CF_PAGES_URL;
    delete env.CF_PAGES_BRANCH;
    const r = spawnSync("bash", ["build.sh", ...s.args, "-b", `http://${s.host}/`, "-d", s.dir, "--clock", CLOCK],
      { cwd: root, env, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`build failed\n${r.stdout}\n${r.stderr}`);
  }
}

// 页面里用到的 CDN 资源由 package.json 锁定的本地副本提供，版本与线上一致（layouts/_partials/extend_head.html）
const pkg = JSON.parse(readFileSync(join(here, "package.json"), "utf8")).devDependencies;
export const cdn = {
  [`https://cdn.jsdelivr.net/npm/katex@${pkg.katex}/dist/`]: join(here, "node_modules/katex/dist/"),
  [`https://cdn.jsdelivr.net/npm/mermaid@${pkg.mermaid}/dist/`]: join(here, "node_modules/mermaid/dist/"),
};

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };

function file(path) {
  let f = path;
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  return existsSync(f) ? f : null;
}

// network：
//   "online"（默认）— 站点和 CDN 都可用；其他外部地址一律断开
//   "cdn-down"      — CDN 不可用（KaTeX 样式、Mermaid 加载失败）
//   "images-pending"— 图片请求一直没有响应，相当于图片还在路上
//   "slow-3g"       — 每个响应按 Chrome DevTools "Slow 3G" 的参数延迟（400ms + 约 50KB/s）。
//                     请求都由 route 直接返回，浏览器自带的限速对它不起作用，所以在这里模拟；Chromium、WebKit 都适用
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
export async function connect(context, network = "online") {
  await context.route("**/*", async (route) => {
    const fulfill = route.fulfill.bind(route);
    if (network === "slow-3g") route.fulfill = async (r) => { await sleep(400 + ((r.body?.length || 0) / (50 * 1024)) * 1000); return fulfill(r); };
    const url = new URL(route.request().url());
    const site = Object.values(sites).find((s) => s.host === url.host);
    if (site) {
      const f = file(join(site.dir, decodeURIComponent(url.pathname)));
      if (network === "images-pending" && f && /\.(png|jpe?g|webp|gif)$/i.test(f)) return; // 不响应
      if (!f) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, contentType: types[extname(f)] || "application/octet-stream", body: readFileSync(f) });
    }
    if (network !== "cdn-down") {
      for (const [prefix, dir] of Object.entries(cdn)) {
        if (url.href.startsWith(prefix)) {
          const f = file(join(dir, url.href.slice(prefix.length).split("?")[0]));
          if (f) return route.fulfill({ status: 200, contentType: types[extname(f)], body: readFileSync(f),
            headers: { "access-control-allow-origin": "*" } });
        }
      }
    }
    return route.abort("internetdisconnected");
  });
}

// 截图前让页面静止：懒加载的图片全部加载完（或确认还在等待）、字体就绪、Mermaid 画完
export async function settle(page, { images = true, mermaid = true } = {}) {
  await page.evaluate(async (images) => {
    if (images) {
      for (const img of document.images) img.loading = "eager";
      await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; })));
      // 加载完不等于解码完：未解码时浏览器先用低质量缩放画一版，截图可能截到它
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    }
    await document.fonts.ready;
  }, images);
  // CDN 不可用时 Mermaid 不会加载，图表保持源码；否则必须画完，画不出来就让测试失败
  if (mermaid && await page.locator("pre.mermaid").count()) {
    await page.waitForFunction(() => [...document.querySelectorAll("pre.mermaid")].every((p) => p.dataset.processed === "true" && p.querySelector("svg .node, svg .label, svg text")), null, { timeout: 15000 });
  }
  // 最后等版面静止：连续 10 帧里页面高度和所有图片、图表的位置尺寸都不再变化
  await page.evaluate(() => new Promise((ok) => {
    const sig = () => [document.documentElement.scrollHeight, ...[...document.querySelectorAll("img, svg, .katex, pre")].map((e) => {
      const r = e.getBoundingClientRect(); return `${r.x},${r.y},${r.width},${r.height},${e.getElementsByTagName("*").length}`; })].join("|");
    let last = sig(), same = 0;
    const tick = () => { const now = sig(); same = now === last ? same + 1 : 0; last = now; same >= 10 ? ok() : requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
}

// 整页截图：先把视口拉到整页高度再截"视口"，而不是用 fullPage。
// fullPage 在截图过程中临时改视口，点状下划线等细线的栅格化会随之抖动（同一页两次截图差几十个像素）；
// 页面高度常带小数（如 4641.016px），这里统一向上取整。
export async function fullPage(page) {
  const vp = page.viewportSize();
  for (let i = 0; i < 3; i++) {
    const h = await page.evaluate(() => Math.ceil(Math.max(document.documentElement.getBoundingClientRect().height, document.documentElement.scrollHeight)));
    if (h === page.viewportSize().height) break;
    await page.setViewportSize({ width: vp.width, height: Math.max(h, vp.height) });
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  }
}
