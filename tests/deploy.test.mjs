// 部署工作流 .github/workflows/deploy.yml 的约定（docs/deploy.md）：改工作流时这些前提不能丢
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./helpers.mjs";

const wf = readFileSync(join(root, ".github/workflows/deploy.yml"), "utf8");
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const step = (name) => wf.split(/\n {6}- /).find((s) => s.includes(`name: ${name}\n`)) ?? "";

test("正式站用 CF_PAGES_BRANCH=main 构建（正式域名、访问统计），不带预览地址；部署到生产分支 main", () => {
  const build = step("Build");
  assert.match(build, /if \[ "\$BRANCH" = main \]; then\n\s+CF_PAGES_BRANCH=main bash build\.sh\n/);
  assert.match(wf, /BRANCH: \$\{\{ github\.event_name == 'push' && 'main' \|\|/);
  assert.match(wf, /push:\n\s+branches: \[main\]/);
});

test("预览：站点地址和上传用的分支名是同一个 pr-<编号>，站内链接指向这次预览自己的分支别名", () => {
  assert.match(wf, /format\('pr-\{0\}', github\.event\.pull_request\.number\)/);
  assert.match(step("Build"), /CF_PAGES_BRANCH="\$BRANCH" CF_PAGES_URL="https:\/\/\$BRANCH\.leo-blog-bgy\.pages\.dev" bash build\.sh/);
  assert.match(step("Upload to Cloudflare Pages"), /--branch="\$BRANCH"/);
  assert.match(step("Comment preview links"), /https:\/\/\$\{process\.env\.BRANCH\}\.leo-blog-bgy\.pages\.dev/);
});

test("外部仓库的 PR 不部署；令牌只给上传这一步", () => {
  assert.match(wf, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.doesNotMatch(wf, /pull_request_target/);
  assert.equal(wf.match(/secrets\.CLOUDFLARE_API_TOKEN \}\}/g).length, 1, "CLOUDFLARE_API_TOKEN 只应传给上传步骤");
  assert.match(step("Upload to Cloudflare Pages"), /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
});

test("和 CI 用同一份 Hugo 图片缓存（键完全相同，部署时能命中）", () => {
  const key = (y) => y.match(/key: (hugo-resources-[^\n]+)\n\s+restore-keys: ([^\n]+)/).slice(1);
  assert.deepEqual(key(wf), key(ci));
});

test("wrangler 锁定精确版本，装的就是锁文件里的那一版（npm ci，不跑安装脚本）", () => {
  const pkg = JSON.parse(readFileSync(join(root, "tools/deploy/package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(root, "tools/deploy/package-lock.json"), "utf8"));
  const v = pkg.devDependencies.wrangler;
  assert.match(v, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.packages["node_modules/wrangler"].version, v);
  assert.match(lock.packages["node_modules/wrangler"].integrity, /^sha512-/);
  assert.match(step("Install wrangler"), /npm ci --ignore-scripts/);
});
