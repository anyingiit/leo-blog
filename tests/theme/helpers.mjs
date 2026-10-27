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
    args: ["-s", "tests/theme/example-site", "--themesDir", "../../../themes", "--buildDrafts",
      "--config", `${join(here, "example-site/config.yml")},${join(here, "example-site.overrides.yaml")}`] },
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
  // 样式表全部到位（images-pending 只等到 domcontentloaded，晚到的样式表会改版面）。
  // 用轮询判断，不依赖 load 事件（事件可能在开始监听前就已触发）
  await page.waitForFunction(() => [...document.querySelectorAll("link[rel~=stylesheet]")].every((l) => l.sheet), null, { polling: 50, timeout: 10000 });
  await page.evaluate(async (images) => {
    if (images) {
      for (const img of document.images) img.loading = "eager";
      await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; })));
      // 加载完不等于解码完：未解码时浏览器先用低质量缩放画一版，截图可能截到它
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    }
    // 字体：等所有已开始加载的字体。document.fonts.ready 在 WebKit 里要等整页 load，图片一直不回来（images-pending）时
    // 永远等不到，所以只在图片都加载完的情况下再用它兜底
    await Promise.all([...document.fonts].filter((f) => f.status === "loading").map((f) => f.loaded.catch(() => {})));
    if (images) await document.fonts.ready;
  }, images);
  // CDN 不可用时 Mermaid 不会加载，图表保持源码；否则必须画完，画不出来就让测试失败
  if (mermaid && await page.locator("pre.mermaid").count()) {
    await page.waitForFunction(() => [...document.querySelectorAll("pre.mermaid")].every((p) => p.dataset.processed === "true" && p.querySelector("svg .node, svg .label, svg text")), null, { timeout: 15000 });
  }
  // 最后等版面静止：连续 10 帧里页面高度和所有图片、图表的位置尺寸都不再变化
  await page.evaluate(() => new Promise((ok, fail) => {
    const sig = () => [document.documentElement.scrollHeight, ...[...document.querySelectorAll("img, svg, .katex, pre")].map((e) => {
      const r = e.getBoundingClientRect(); return `${r.x},${r.y},${r.width},${r.height},${e.getElementsByTagName("*").length}`; })].join("|");
    let last = sig(), same = 0;
    const tick = () => { const now = sig(); same = now === last ? same + 1 : 0; last = now; same >= 10 ? ok() : requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => fail(new Error("页面 10 秒内没有静止下来（布局一直在变）")), 10000);
  }));
}

// 整页截图：先把视口拉到整页高度再截"视口"，而不是用 fullPage。
// fullPage 在截图过程中临时改视口，点状下划线等细线的栅格化会随之抖动（同一页两次截图差几十个像素）；
// 页面高度常带小数（如 4641.016px），这里统一向上取整。
// 拉高视口前先 freezeViewportUnits：否则用 vh 的尺寸会跟着视口变高，页面越拉越长、页脚被截掉。
// 冻结后页面高度不再随视口变化，拉一次就到位；没到位说明还有随视口变化的东西，直接报错而不是截一张错的图
export async function fullPage(page) {
  const vp = page.viewportSize();
  await freezeViewportUnits(page);
  const height = () => pageHeight(page);
  let h = await height();
  for (let i = 0; i < 3 && h !== page.viewportSize().height; i++) {
    await page.setViewportSize({ width: vp.width, height: Math.max(h, vp.height) });
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    h = await height();
  }
  if (h !== page.viewportSize().height) throw new Error(`拉高视口后页面高度仍在变化（视口 ${page.viewportSize().height}px，页面 ${h}px）`);
  await repaint(page);
}

// 禁用脚本的页面：requestAnimationFrame 不运行，不能用 fullPage 的等帧，从测试端拉高视口两次（之后由调用方等图片、字体并 repaint）
export async function fullPageNoScript(page) {
  await freezeViewportUnits(page);
  await page.setViewportSize({ width: page.viewportSize().width, height: await pageHeight(page) });
  await page.setViewportSize({ width: page.viewportSize().width, height: await pageHeight(page) });
}

// 页面高度，带小数时向上取整（如 4641.016px → 4642），最后一行像素也截进来
export const pageHeight = (page) => page.evaluate(() =>
  Math.ceil(Math.max(document.documentElement.getBoundingClientRect().height, document.documentElement.scrollHeight)));

// 把用视口高度单位（vh、svh、lvh、dvh、vmin、vmax、vb）写的尺寸，固定成当前视口下的计算值（行内 !important）。
// PaperMod 的 .main 是 min-height: calc(100vh - 页头 - 页脚)，个人主页模式的 .profile 也是；手机上页头折成两行，
// 比主题变量高，视口拉到整页高度时 min-height 跟着变大、页面又变高，永远追不上（示例站 Markdown 页 390 宽：
// 5685 → 视口 5805 → 页面 5865），截出来末尾一大段空白、页脚不见。固定之后，截到的就是读者在原视口里从头滚到尾看到的整页。
// 只扫描写了这些单位的样式规则和 style 属性，冻结的是层叠后的计算值，所以哪条规则胜出都一样。
// 读不到规则的跨域样式表（如 CDN 的 KaTeX）、伪元素上的 vh 管不到；本站和示例站都没有这种情况，fullPage 末尾的检查会兜底
export async function freezeViewportUnits(page) {
  return page.evaluate(() => {
    const unit = /(^|[^\w-])-?[\d.]+(s|l|d)?(vh|vmin|vmax|vb)\b/i;
    const found = new Map(); // 元素 → 要冻结的属性
    const add = (els, props) => { for (const e of els) { const s = found.get(e) || new Set(); props.forEach((p) => s.add(p)); found.set(e, s); } };
    const props = (style) => [...style].filter((p) => unit.test(style.getPropertyValue(p)));
    const walk = (rules) => {
      for (const r of rules) {
        if (r.style && r.selectorText) {
          const ps = props(r.style);
          if (ps.length) { try { add(document.querySelectorAll(r.selectorText), ps); } catch { /* 伪元素等选不到 */ } }
        }
        if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* 跨域样式表读不到规则 */ } }
    for (const e of document.querySelectorAll("[style]")) { const ps = props(e.style); if (ps.length) add([e], ps); }
    const values = [...found].map(([e, ps]) => [e, [...ps].map((p) => [p, getComputedStyle(e).getPropertyValue(p)])]);
    for (const [e, ps] of values) for (const [p, v] of ps) e.style.setProperty(p, v, "important");
    return values.length;
  });
}

// 截图前让整页从头重新绘制一遍，截图只取决于页面最终的样子，与加载过程无关。
// Chromium 只重画页面的一部分时（加载中某段内容先画、某个元素单独重画、窗口尺寸变过），点状下划线的抗锯齿
// 和整页一起画时不同，版面完全一样，像素却差几十个（docs/testing.md「截图与绘制历史」）。机器忙时加载过程不同，
// 截图就偶尔和基准不一致。给根元素临时加 blur(0px)：会移动像素的滤镜让 Chromium 必须整页重画，去掉后再整页画一次。
// 用截图（而不是 requestAnimationFrame）推动出帧，禁用脚本的页面也适用。
export async function repaint(page) {
  const old = await page.evaluate(() => { const s = document.documentElement.style, v = s.filter; s.filter = "blur(0px)"; return v; });
  await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } });
  await page.evaluate((v) => { document.documentElement.style.filter = v; }, old);
}
