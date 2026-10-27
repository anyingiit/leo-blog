// tests/ci-plan.mjs 的单元测试：CI 只在输入确实没变时才跳过测试
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { plan, notThemeInput } from "./ci-plan.mjs";

const full = { regression: true, visual: true, browsers: ["chromium", "webkit"] };
const contentOnly = { regression: true, visual: false, browsers: ["chromium"] };

test("只改文章、文档时跳过视觉测试，回归测试照跑", () => {
  for (const event of ["pull_request", "push"]) {
    assert.deepEqual(plan({ event, files: ["content/notes/a/index.md", "content/notes/a/index.en.md", "content/notes/a/a.assets/1.png"] }), contentOnly);
    assert.deepEqual(plan({ event, files: ["docs/testing.md", "README.md", "content/posts/x.md"] }), contentOnly);
  }
});

test("改到主题测试的任何输入都全跑", () => {
  for (const f of ["layouts/notes/list.html", "assets/css/extended/custom.css", "hugo.yaml", "i18n/en.yaml", "static/x.txt",
    "build.sh", "themes/PaperMod", "tests/theme/visual.spec.mjs", "tests/theme/__snapshots__/output/files.txt",
    ".github/workflows/ci.yml", "tests/README.md", "assets/films/x/index.html", "contents/x.md", "content.md/x"]) {
    assert.equal(notThemeInput(f), false, f);
    assert.deepEqual(plan({ event: "pull_request", files: ["content/notes/a.md", f] }), full, f);
  }
});

test("拿不到改动列表、手动运行时全跑", () => {
  assert.deepEqual(plan({ event: "pull_request", files: null }), full);
  assert.deepEqual(plan({ event: "pull_request", files: [] }), full);
  assert.deepEqual(plan({ event: "workflow_dispatch", files: ["content/a.md"] }), full);
});

test("main 上的合并提交与已通过的 PR 提交文件树相同时整次跳过；只对 push 生效", () => {
  assert.deepEqual(plan({ event: "push", files: ["layouts/a.html"], tested: true }), { regression: false, visual: false, browsers: [] });
  assert.deepEqual(plan({ event: "pull_request", files: ["layouts/a.html"], tested: true }), full);
  assert.deepEqual(plan({ event: "workflow_dispatch", files: null, tested: true }), full);
});

test("命令行：从标准输入读文件列表，写 GITHUB_OUTPUT", () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), "ci-plan.mjs");
  const out = join(mkdtempSync(join(tmpdir(), "ci-plan-")), "out");
  const run = (input, event, args = []) => {
    execFileSync("node", [script, ...args], { input, env: { ...process.env, GITHUB_EVENT_NAME: event, GITHUB_OUTPUT: out } });
    return Object.fromEntries(readFileSync(out, "utf8").trim().split("\n").slice(-3).map((l) => l.split(/=(.*)/s).slice(0, 2)));
  };
  assert.deepEqual(run("content/a.md\ndocs/b.md\n", "pull_request"), { regression: "true", visual: "false", browsers: '["chromium"]' });
  assert.deepEqual(run("", "pull_request"), { regression: "true", visual: "true", browsers: '["chromium","webkit"]' });
  assert.deepEqual(run("layouts/a.html\n", "push", ["--tested"]), { regression: "false", visual: "false", browsers: "[]" });
});

// 主题测试的站点只从固定文章构建：content/ 不是它的输入，这是跳过视觉测试的前提
test("主题测试的本站构建不读 content/", () => {
  const helpers = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "theme/helpers.mjs"), "utf8");
  assert.match(helpers, /"--contentDir", "tests\/theme\/site-fixture\/content"/);
  const hugo = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../hugo.yaml"), "utf8");
  assert.doesNotMatch(hugo, /^\s*mounts:/m, "hugo.yaml 里加了 module mounts，要重新确认 content/ 之外有没有被主题测试读到的内容");
});
