// 安全回归测试（只用 Node 内置模块，不构建站点，几秒跑完；说明见 docs/security.md）：
// 1. 模板和文章里从外站加载的脚本、样式表都带子资源完整性校验（SRI），CDN 被篡改时浏览器拒绝执行
// 2. GitHub Actions 工作流：默认只读权限、不用会把写权限和密钥交给外部 PR 的触发器、run 里不直接拼接 PR 标题等外部文字、
//    检出代码不留下凭据
//    全站响应头：frame-ancestors、Permissions-Policy（static/_headers）
// 3. 仓库里跟踪的文件不含常见格式的密钥（GitHub、AWS、Google、Slack、Stripe、Anthropic、OpenAI、私钥）
// 运行：node --test tests/security.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, keep) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, keep));
    else if (keep(p)) out.push(p);
  }
  return out;
}

// ── 1. 外站脚本、样式表必须带 SRI ──────────────────────────────

// 没法带 SRI 的外站资源，逐条说明原因（docs/security.md「第三方脚本」）。新增例外先写进文档并取得确认
const SRI_EXEMPT = [
  // Cloudflare Web Analytics 的统计脚本不带版本号，Cloudflare 会原地更新它，固定哈希会让统计随时失效；只在正式站加载（docs/analytics.md）
  "https://static.cloudflareinsights.com/beacon.min.js",
];

// 外站地址：http(s):// 或 //host
const external = (url) => /^(https?:)?\/\//i.test(url.trim());

// 找出 HTML（含 Hugo 模板）里从外站加载、却没带 integrity 的 <script src>、<link rel=stylesheet|modulepreload|preload>
export function missingSri(html) {
  const problems = [];
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const isScript = /^<script/i.test(tag);
    const url = (tag.match(isScript ? /\ssrc=["']?([^"'\s>]+)/i : /\shref=["']?([^"'\s>]+)/i) || [])[1];
    if (!url || !external(url) || SRI_EXEMPT.includes(url)) continue;
    if (!isScript && !/\srel=["']?(stylesheet|modulepreload|preload)\b/i.test(tag)) continue;
    if (!/\sintegrity=["']?sha(256|384|512)-[A-Za-z0-9+/]+=*/i.test(tag)) problems.push(`缺少 integrity：${tag}`);
    else if (!/\scrossorigin\b/i.test(tag)) problems.push(`有 integrity 但缺少 crossorigin（跨域资源不加它，SRI 校验会直接失败）：${tag}`);
  }
  return problems;
}

// 行内 <script type=module> 里 import 外站模块（import 语句没法写 integrity）
export function externalImports(html) {
  const found = [];
  for (const [, body] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    for (const [, url] of body.matchAll(/\bimport\s*(?:[^'"()]*?\bfrom\s*)?\(?\s*["']([^"']+)["']/g)) {
      if (external(url)) found.push(url);
    }
  }
  return found;
}

test("检查器自测：能认出缺 SRI 的外站脚本和样式表，放过本站资源、带 SRI 的和已登记的例外", () => {
  assert.equal(missingSri('<script src="https://cdn.example.com/a.js"></script>').length, 1);
  assert.equal(missingSri("<script src=//cdn.example.com/a.js></script>").length, 1);
  assert.equal(missingSri('<link rel="stylesheet" href="https://cdn.example.com/a.css">').length, 1);
  assert.equal(missingSri('<link rel=stylesheet href=https://cdn.example.com/a.css integrity=sha384-abc>').length, 1, "缺 crossorigin");
  assert.equal(missingSri('<link rel="stylesheet" href="https://cdn.example.com/a.css" integrity="sha384-abc+/=" crossorigin="anonymous">').length, 0);
  assert.equal(missingSri('<link rel="canonical" href="https://douseful.eu.org/">').length, 0, "不是加载资源的 link");
  assert.equal(missingSri('<script src="/js/a.js"></script>').length, 0, "本站资源");
  assert.equal(missingSri(`<script type=module src="${SRI_EXEMPT[0]}"></script>`).length, 0, "登记过的例外");
  assert.deepEqual(externalImports('<script type="module">import x from "https://evil.example/x.mjs";</script>'), ["https://evil.example/x.mjs"]);
  assert.deepEqual(externalImports('<script type="module">await import("https://evil.example/x.mjs")</script>'), ["https://evil.example/x.mjs"]);
  assert.deepEqual(externalImports('<script>import m from "https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs"</script>'), ["https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs"]);
  assert.deepEqual(externalImports('<script type="module">import m from "/vendor/mermaid/11.17.2/mermaid.esm.min.mjs"</script>'), [], "本站模块");
});

test("模板和文章里从外站加载的脚本、样式表都带 SRI（例外逐条登记在本文件和 docs/security.md）", () => {
  const files = [
    ...walk(join(root, "layouts"), (p) => p.endsWith(".html")),
    ...walk(join(root, "content"), (p) => /\.(md|html)$/.test(p)),
  ];
  const problems = [];
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const p of missingSri(html)) problems.push(`${relative(root, f)}：${p}`);
    for (const u of externalImports(html)) problems.push(`${relative(root, f)}：行内脚本 import 了外站模块 ${u}`);
  }
  assert.deepEqual(problems, []);
});

// ── 2. GitHub Actions 工作流 ─────────────────────────────────

const workflows = readdirSync(join(root, ".github/workflows"))
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ name: f, text: readFileSync(join(root, ".github/workflows", f), "utf8") }));
const code = (text) => text.replace(/^\s*#.*$/gm, "");

test("每个工作流都在顶层声明 permissions（默认只读，写权限只给需要的任务）", () => {
  assert.ok(workflows.length > 0);
  for (const { name, text } of workflows) {
    assert.match(code(text), /^permissions:/m, `${name} 没有顶层 permissions，令牌会用仓库默认权限`);
    assert.doesNotMatch(code(text), /^permissions:\s*write-all/m, `${name} 不要用 write-all`);
  }
});

test("不用 pull_request_target、workflow_run 触发器（它们带着写权限和密钥运行外部 PR 的内容）", () => {
  for (const { name, text } of workflows) {
    assert.doesNotMatch(code(text), /^\s*(pull_request_target|workflow_run)\s*:/m, name);
    assert.doesNotMatch(code(text), /^on:\s*\[?[^\n]*\b(pull_request_target|workflow_run)\b/m, name);
  }
});

// 这些字段由提 PR、写评论的人决定，直接写进 run 脚本会被当成命令执行（脚本注入）；要用就先放进 env，再以 "$VAR" 引用
const UNTRUSTED = /\$\{\{\s*github\.(head_ref|event\.(issue|pull_request|comment|review|review_comment|discussion|head_commit|commits|pages)\.[\w.]*(title|body|ref|label|name|message|email|description|default_branch))\b/;
test("run 脚本里不直接拼接 PR 标题、分支名、评论等外部文字（防脚本注入）", () => {
  assert.match("run: echo ${{ github.event.pull_request.title }}", UNTRUSTED, "自测");
  assert.match("run: git checkout ${{ github.head_ref }}", UNTRUSTED, "自测");
  assert.doesNotMatch("run: echo ${{ github.event.pull_request.head.sha }}", UNTRUSTED, "自测：提交哈希是安全的");
  for (const { name, text } of workflows) {
    const lines = code(text).split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)(-\s+)?run:\s*(\|[-+]?|>[-+]?)?\s*(.*)$/);
      if (!m) continue;
      const indent = m[1].length + (m[2] || "").length;
      const block = [m[4]];
      for (let j = i + 1; j < lines.length && (lines[j].trim() === "" || lines[j].search(/\S/) > indent); j++) block.push(lines[j]);
      const bad = block.find((l) => UNTRUSTED.test(l));
      assert.equal(bad, undefined, `${name} 第 ${i + 1} 行的 run 脚本直接拼接了外部文字：${bad}`);
    }
  }
});

test("actions/checkout 都设了 persist-credentials: false（令牌不留在 .git/config 里，后续步骤读不到）", () => {
  for (const { name, text } of workflows) {
    const steps = code(text).split(/\n(?=\s*- )/).filter((s) => /uses:\s*actions\/checkout@/.test(s));
    for (const s of steps) assert.match(s, /persist-credentials:\s*false/, `${name}：${s.trim().split("\n")[0]}`);
  }
});

// ── 安全响应头（static/_headers，Cloudflare Pages 按路径加响应头）──────────

test("全站响应头：禁止别的网站用 iframe 嵌入本站，关掉用不到的浏览器权限", () => {
  const rules = {};
  let path = null;
  for (const line of readFileSync(join(root, "static/_headers"), "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    if (!/^\s/.test(line)) { path = line.trim(); rules[path] ??= {}; continue; }
    const m = line.trim().match(/^([^:]+):\s*(.*)$/);
    rules[path][m[1].toLowerCase()] = m[2];
  }
  const all = rules["/*"] || {};
  assert.equal(all["content-security-policy"], "frame-ancestors 'self'", "/* 要设 Content-Security-Policy: frame-ancestors 'self'");
  for (const feature of ["camera", "microphone", "geolocation"]) {
    assert.match(all["permissions-policy"] || "", new RegExp(`(^|,\\s*)${feature}=\\(\\)`), `Permissions-Policy 要关掉 ${feature}`);
  }
  // 其他路径不另设 CSP：Cloudflare 会把同名头合并成两条，浏览器按更严的执行，容易把页面弄坏
  for (const [p, h] of Object.entries(rules)) if (p !== "/*") assert.ok(!("content-security-policy" in h), `${p} 另设了 CSP`);
});

// ── 3. 不提交密钥 ────────────────────────────────────────

// 只认有固定前缀、误报极少的格式。原样 HTML 里的 base64 图片会命中宽泛的规则，所以不查「长随机串」这类
const SECRETS = {
  "GitHub 令牌": /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/,
  "AWS 访问密钥": /\b(AKIA|ASIA)[0-9A-Z]{16}\b/,
  "Google API 密钥": /\bAIza[0-9A-Za-z_-]{35}\b/,
  "Slack 令牌": /\bxox[abposr]-[0-9A-Za-z-]{10,}/,
  "Stripe 密钥": /\b[rs]k_live_[0-9A-Za-z]{20,}/,
  "Anthropic 密钥": /\bsk-ant-[A-Za-z0-9_-]{20,}/,
  "OpenAI 密钥": /\bsk-(proj-)?[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/,
  "私钥": /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/,
  "网址里的密码": /\bhttps?:\/\/[^\s/:@"'$]+:[^\s/@"'$]{6,}@[\w.-]+/,
};
const BINARY = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".pdf", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".m4a", ".zip"]);

export function findSecrets(text) {
  return Object.entries(SECRETS).filter(([, re]) => re.test(text)).map(([k]) => k);
}

test("检查器自测：认得出各类密钥，不把普通文字和 base64 图片当密钥", () => {
  const fake = (...parts) => parts.join(""); // 拆开写，免得本文件自己被扫描命中
  assert.deepEqual(findSecrets(fake("token: gh", "p_", "a".repeat(36))), ["GitHub 令牌"]);
  assert.deepEqual(findSecrets(fake("AK", "IA", "ABCDEFGHIJKLMNOP")), ["AWS 访问密钥"]);
  assert.deepEqual(findSecrets(fake("-----BEGIN ", "PRIVATE KEY-----")), ["私钥"]);
  assert.deepEqual(findSecrets(fake("https://user:", "hunter22@example.com")), ["网址里的密码"]);
  assert.deepEqual(findSecrets('git push "https://x-access-token:${GH_TOKEN}@github.com/x.git"'), [], "变量占位不是密钥");
  assert.deepEqual(findSecrets("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), []);
});

test("仓库里跟踪的文件不含密钥（git ls-files，跳过图片、PDF、字体等二进制文件）", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 })
    .split("\0").filter((f) => f && !BINARY.has(extname(f).toLowerCase()));
  assert.ok(files.length > 100, `只找到 ${files.length} 个文件，git ls-files 可能没在仓库里运行`);
  const hits = [];
  for (const f of files) {
    let text;
    try { text = readFileSync(join(root, f), "utf8"); } catch { continue; } // 子模块目录等
    for (const kind of findSecrets(text)) hits.push(`${f}：${kind}`);
  }
  assert.deepEqual(hits, []);
});

// ── 4. Claude Code 插件来源锁定版本 ─────────────────────────────

// .claude/settings.json 里的第三方插件市场会在每个 Claude Code 会话里自动加载；不锁定的话，对方仓库一更新就生效
test(".claude/settings.json 的插件市场都锁定到版本号（ref 是 vX.Y.Z 这样的标签，不跟随分支）", () => {
  const settings = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
  const markets = Object.entries(settings.extraKnownMarketplaces || {});
  for (const [name, { source }] of markets) {
    if (!["github", "git"].includes(source.source)) continue; // 本地目录等不经网络
    assert.match(source.ref || "", /^v?\d+\.\d+\.\d+$/, `插件市场 ${name} 没有锁定版本：${JSON.stringify(source)}`);
  }
});

test("Python 依赖都在本目录 requirements.txt 里写明，不用 -r 引用别的文件；双语导入工具和 S-1 导入工具的 PDF 库版本相同", () => {
  // -r 引用的文件改版本后 GitHub 依赖图不会重新解析引用它的文件，安全警报会一直停在旧版本上
  const pins = (p) => Object.fromEntries(readFileSync(join(root, p), "utf8").split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#")).map((l) => {
      assert.match(l, /^[A-Za-z0-9._-]+==[0-9][^\s]*$/, `${p}：每行一个用 == 锁定的包（不用 -r、>=）：${l}`);
      return l.split("==");
    }));
  const reqs = execFileSync("git", ["ls-files", "*requirements*.txt"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  assert.ok(reqs.length >= 3);
  for (const p of reqs) pins(p);
  const s1 = pins("tools/s1-import/requirements.txt");
  const bi = pins("tools/bilingual-import/requirements.txt");
  for (const name of ["pypdf", "pikepdf"]) assert.equal(bi[name], s1[name], `${name} 两处版本要相同`);
});
