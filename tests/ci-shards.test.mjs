// tests/ci-shards.mjs 的单元测试：回归测试分组后，每个测试都在且只在一组里跑
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { shards, commands, testFiles, ranCount, SPLIT } from "./ci-shards.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const ci = readFileSync(join(dir, "../.github/workflows/ci.yml"), "utf8");
// matrix 写成「组/组数」（任务名显示为 Regression tests (1/5)），运行时拆成两个参数
const shardList = ci.match(/shard: \[([\d/, ]+)\]/)?.[1].split(",").map((x) => x.trim());
const N = shardList?.length;

test("ci.yml 的分组数和 matrix 一致：每一组都有任务去跑", () => {
  assert.ok(shardList, "ci.yml 里找不到 shard 的 matrix");
  assert.deepEqual(shardList, Array.from({ length: N }, (_, i) => `${i + 1}/${N}`));
  assert.ok(ci.includes('SHARD: ${{ matrix.shard }}') && ci.includes('node ci-shards.mjs "${SHARD%/*}" "${SHARD#*/}"'),
    "ci.yml 应把 matrix.shard 拆成 <第几组> <组数> 传给 ci-shards.mjs");
  // 拆参数的写法本身：1/5 → 1 5
  assert.equal(execFileSync("bash", ["-c", 'SHARD=3/5; echo "${SHARD%/*} ${SHARD#*/}"'], { encoding: "utf8" }).trim(), "3 5");
});

test("每个测试文件都在且只在一组里；拆开的文件两半互补", () => {
  const files = testFiles();
  assert.ok(files.includes("site.test.mjs") && files.includes("ci-shards.test.mjs"));
  for (const n of [1, 2, N, 8]) {
    const units = shards(files, n).flatMap((g) => g.units);
    for (const f of files) {
      const u = units.filter((x) => x.file === f);
      if (SPLIT[f]) {
        assert.deepEqual(u.map((x) => x.pattern ?? null).filter(Boolean), [SPLIT[f].pattern], f);
        assert.deepEqual(u.map((x) => x.skip ?? null).filter(Boolean), [SPLIT[f].pattern], f);
        assert.equal(u.length, 2, f);
      } else assert.equal(u.length, 1, f);
    }
    assert.equal(units.length, files.length + Object.keys(SPLIT).filter((f) => files.includes(f)).length);
  }
});

test("没登记耗时的新测试文件也会被分进某一组", () => {
  const groups = shards(["a.test.mjs", "zz-new.test.mjs"], 2);
  assert.deepEqual(groups.flatMap((g) => g.units.map((u) => u.file)).sort(), ["a.test.mjs", "zz-new.test.mjs"]);
});

test("按名字筛选的半个文件一个测试都没跑时算失败（从 TAP 输出数通过和失败的个数）", () => {
  assert.equal(ranCount("TAP version 13\n1..3\n# tests 3\n# pass 2\n# fail 1\n# skipped 0\n"), 3);
  assert.equal(ranCount("TAP version 13\n1..0\n# tests 0\n# pass 0\n# fail 0\n"), 0);
  assert.equal(ranCount("TAP version 13\n1..5\n# tests 5\n# pass 0\n# fail 0\n# skipped 5\n"), 0);
});

test("命令：整文件合成一次运行，拆开的半个文件单独运行并带筛选参数", () => {
  const cmds = commands({ units: [{ file: "b.test.mjs" }, { file: "x.test.mjs", skip: "webkit" }, { file: "a.test.mjs" }] });
  assert.deepEqual(cmds, [
    ["--test", "--test-concurrency=1", "a.test.mjs", "b.test.mjs"],
    ["--test", "--test-concurrency=1", "--test-skip-pattern=webkit", "x.test.mjs"],
  ]);
});

test("命令行：--list 打印每一组，参数不对时退出码 2", () => {
  const out = execFileSync("node", [join(dir, "ci-shards.mjs"), "--list", String(N)], { encoding: "utf8" });
  assert.equal(out.trim().split("\n").length, N);
  assert.throws(() => execFileSync("node", [join(dir, "ci-shards.mjs"), String(N + 1), String(N)], { stdio: "pipe" }), (e) => e.status === 2);
});
