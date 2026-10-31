// 把 tests/ 下的站点回归测试（*.test.mjs）分成几组，CI 的 Regression tests 任务每组一个、同时运行（docs/testing.md「CI 并行」）。
// 原则：每个测试文件都在且只在一组里跑（新加的文件不用登记，按默认耗时自动分进去）；
// 一个文件拆开跑时，按测试名拆成互补的两半（--test-name-pattern 和 --test-skip-pattern 用同一个正则），合起来正好是整个文件。
// 用法：node tests/ci-shards.mjs <第几组，从 1 开始> <组数>   在 tests/ 目录下运行，依次执行分到这一组的测试，任何一个失败退出码就非 0
//       node tests/ci-shards.mjs --list <组数>             只打印分组和估计耗时
import { readdirSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

// 2026-10-30 CI 实测的单个文件耗时（秒，含各自的整站构建），只用来把各组排得差不多长；不准也不影响覆盖
export const SECONDS = {
  "s1-behavior.test.mjs": 165, "short-labels.test.mjs": 74, "site.test.mjs": 55, "s1-links.test.mjs": 51,
  "bilingual.test.mjs": 37, "mobile.test.mjs": 15, "browser.test.mjs": 14, "lang-switch.test.mjs": 13,
  "s1.test.mjs": 10, "build.test.mjs": 6, "s1-overlap.test.mjs": 6, "seo.test.mjs": 4,
  "perf.test.mjs": 45, // PR #67 新增，本地实测约 40 秒
};
export const DEFAULT_SECONDS = 10;

// 单个文件比其他组都长时按测试名拆开：s1-behavior 里 WebKit 的用例约占四分之三
export const SPLIT = { "s1-behavior.test.mjs": { pattern: "webkit", seconds: 125 } };

export const testFiles = () => readdirSync(dir).filter((f) => f.endsWith(".test.mjs")).sort();

// 返回 n 组，每组是若干运行单元 { file, pattern?, skip?, seconds }。最长的先放进当前最短的组（LPT），结果是确定的
export function shards(files, n) {
  const units = [];
  for (const file of files) {
    const s = SPLIT[file];
    const total = SECONDS[file] ?? DEFAULT_SECONDS;
    if (s) units.push({ file, pattern: s.pattern, seconds: s.seconds }, { file, skip: s.pattern, seconds: Math.max(total - s.seconds, 1) });
    else units.push({ file, seconds: total });
  }
  units.sort((a, b) => b.seconds - a.seconds || a.file.localeCompare(b.file) || (a.pattern ? -1 : 1));
  const groups = Array.from({ length: n }, () => ({ seconds: 0, units: [] }));
  for (const u of units) {
    const g = groups.reduce((min, g) => (g.seconds < min.seconds ? g : min));
    g.units.push(u);
    g.seconds += u.seconds;
  }
  return groups;
}

// TAP 输出里实际跑了几个测试（通过加失败）。按名字筛选的半个文件一个都没跑，说明测试名变了、筛选落空，要算失败
export function ranCount(tap) {
  const n = (k) => Number(tap.match(new RegExp(`^# ${k} (\\d+)$`, "m"))?.[1] ?? 0);
  return n("pass") + n("fail");
}

// 一组里不带名字筛选的文件合成一次 node --test，拆开的半个文件各自单独一次（筛选参数作用于整个进程）
export function commands(group) {
  const whole = group.units.filter((u) => !u.pattern && !u.skip).map((u) => u.file).sort();
  const cmds = whole.length ? [whole] : [];
  for (const u of group.units) {
    if (u.pattern) cmds.push([`--test-name-pattern=${u.pattern}`, u.file]);
    if (u.skip) cmds.push([`--test-skip-pattern=${u.skip}`, u.file]);
  }
  return cmds.map((args) => ["--test", "--test-concurrency=1", ...args]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const list = args[0] === "--list";
  const n = Number(args[1]);
  const i = Number(args[0]);
  if (!Number.isInteger(n) || n < 1 || (!list && !(Number.isInteger(i) && i >= 1 && i <= n))) {
    console.error("用法：node ci-shards.mjs <第几组> <组数> | --list <组数>");
    process.exit(2);
  }
  const groups = shards(testFiles(), n);
  if (list) {
    groups.forEach((g, k) => console.log(`第 ${k + 1} 组（约 ${g.seconds} 秒）：${commands(g).map((c) => c.slice(2).join(" ")).join(" ； ")}`));
    process.exit(0);
  }
  let failed = false;
  const tmp = mkdtempSync(join(tmpdir(), "ci-shards-"));
  commands(groups[i - 1]).forEach((cmd, k) => {
    console.log(`\n$ node ${cmd.join(" ")}`);
    const tap = join(tmp, `${k}.tap`);
    const reporters = ["--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=tap", `--test-reporter-destination=${tap}`];
    const r = spawnSync(process.execPath, [...reporters, ...cmd], { cwd: dir, stdio: "inherit" });
    if (r.status !== 0) failed = true;
    else if (cmd.some((a) => a.startsWith("--test-name-pattern") || a.startsWith("--test-skip-pattern")) && ranCount(readFileSync(tap, "utf8")) === 0) {
      console.log(`::error::按名字筛选后一个测试也没跑：${cmd.join(" ")}（测试名变了？见 tests/ci-shards.mjs 的 SPLIT）`);
      failed = true;
    }
  });
  process.exit(failed ? 1 : 0);
}
