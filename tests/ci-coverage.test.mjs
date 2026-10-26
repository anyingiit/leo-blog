// tests/ci-coverage.mjs 的单元测试，以及对本仓库 ci.yml 的实际检查
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isTestFile, mentions, uncovered } from "./ci-coverage.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("识别测试文件，跳过主题、依赖和测试素材", () => {
  for (const f of ["tools/image-i18n/test_render.py", "a/foo_test.py", "tests/site.test.mjs", "tests/x.spec.ts", "tests/build.test.js"]) assert.ok(isTestFile(f), f);
  for (const f of ["tools/image-i18n/render.py", "tests/helpers.mjs", "tests/ci-coverage.mjs", "themes/PaperMod/test_x.py",
    "tests/node_modules/pkg/a.test.js", "tests/fixtures/content/notes/a.test.js", "content/posts/markdown-test/index.md"]) assert.ok(!isTestFile(f), f);
});

test("路径要完整出现在 ci.yml 里，前缀不算", () => {
  const ci = "run: node --test tests/site.test.mjs\n  python -m unittest discover -s tools/image-i18n -v\n";
  assert.ok(mentions(ci, "tests/site.test.mjs"));
  assert.ok(mentions(ci, "tools/image-i18n"));
  assert.ok(!mentions(ci, "tests"), "tests/site.test.mjs 不代表整个 tests 目录都在跑");
  assert.ok(!mentions(ci, "tools"));
  assert.ok(!mentions(ci, "tests/site"));
  assert.ok(mentions("working-directory: tests\n", "tests"));
  assert.ok(mentions('working-directory: "./tests/"\n', "tests"));
});

test("没被执行的测试文件会被报出来", () => {
  const ci = "node --test tests/site.test.mjs\nunittest discover -s tools/image-i18n\n";
  const files = ["tests/site.test.mjs", "tests/new.test.mjs", "tools/image-i18n/test_render.py", "tools/other/test_x.py", "tools/image-i18n/foo_test.py"];
  assert.deepEqual(uncovered(files, ci).map((p) => p.file), ["tests/new.test.mjs", "tools/other/test_x.py", "tools/image-i18n/foo_test.py"]);
});

test("本仓库：每个测试文件都在 CI 里执行", () => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  assert.deepEqual(uncovered(files, ci), []);
});
