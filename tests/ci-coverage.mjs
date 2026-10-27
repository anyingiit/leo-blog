// 检查仓库里的每个测试文件都会被 CI 执行（.github/workflows/ci.yml），防止新加的测试只在本地跑。
// 规则（说明见 docs/testing.md）：
//   - 测试文件：test*.py / *_test.py、*.test.{js,mjs,cjs,ts}、*.spec.{js,mjs,cjs,ts}
//   - *_test.py 不会被 `unittest discover` 的默认规则 test*.py 发现，一律视为漏跑，请改名
//   - 其余测试文件的路径、或它所在的目录，必须在 ci.yml 里作为完整的路径出现
//     （例如 `discover -s tools/image-i18n`、`node --test tests/site.test.mjs`、`working-directory: tests`）
// 用法：node tests/ci-coverage.mjs（在仓库根目录或任意目录运行均可）
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_FILE = /(^|\/)(test[^/]*\.py|[^/]+_test\.py|[^/]+\.(test|spec)\.(js|mjs|cjs|ts))$/;
const IGNORED = /(^|\/)(node_modules|themes|fixtures)\//;

export const isTestFile = (path) => TEST_FILE.test(path) && !IGNORED.test(path);

// ci.yml 里是否以完整路径的形式提到了 path（前后不能紧跟路径字符，避免 "tests" 命中 "tests/site.test.mjs" 这类前缀）。
// 整行注释不算：注释里提到的路径并不会被执行
export function mentions(ci, path) {
  ci = ci.replace(/^\s*#.*$/gm, "");
  const esc = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s"'=:,\\[])(\\./)?${esc}/?($|[\\s"',\\]])`, "m").test(ci);
}

// 返回没被 CI 执行的测试文件及原因
export function uncovered(files, ci) {
  const problems = [];
  for (const f of files.filter(isTestFile)) {
    if (/_test\.py$/.test(f)) {
      problems.push({ file: f, reason: "unittest discover 只认 test*.py，请改名为 test_*.py" });
      continue;
    }
    if (!mentions(ci, f) && !mentions(ci, posix.dirname(f))) {
      problems.push({ file: f, reason: `ci.yml 里没有执行它（既没有提到 ${f}，也没有提到目录 ${posix.dirname(f)}）` });
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  const tests = files.filter(isTestFile);
  const problems = uncovered(files, ci);
  for (const p of problems) console.log(`::error file=${p.file}::${p.reason}`);
  if (problems.length) process.exit(1);
  console.log(`CI 覆盖了全部 ${tests.length} 个测试文件：\n  ${tests.join("\n  ")}`);
}
