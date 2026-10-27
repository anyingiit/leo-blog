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
  ".webp": "image/webp", ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml" };

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
