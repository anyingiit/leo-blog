// 决定这次 CI 要跑哪些测试（.github/workflows/ci.yml 的 Lint and build 任务调用，说明见 docs/testing.md「CI 用量」）。
// 原则：只跳过输入没有变、已经在完全相同的文件上通过过的测试；拿不准就全跑。
//   - 主题视觉/交互/输出测试用 tests/theme/site-fixture 里的固定文章构建，不读 content/；
//     文档（docs/、根目录的 .md）也不进入任何构建。只改这些文件时，视觉测试的输入与 main 完全相同，跳过 WebKit 任务和视觉测试，
//     站点回归测试（读 content/）照跑。
//   - 合并 PR 产生的 main 提交，如果它的文件树和 PR 分支最后一个提交完全相同，且那个提交的 PR CI 已经通过，
//     这棵树已经测过一遍，main 上不再重复跑。
// 用法：node tests/ci-plan.mjs [--tested] < 改动文件列表（每行一个；读不到列表就传空，按全跑处理）
//   输出 GitHub Actions 的 step output：regression=true|false、visual=true|false、browsers=<JSON 数组>
import { readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 不进入主题测试任何构建的文件
export const notThemeInput = (f) => f.startsWith("content/") || f.startsWith("docs/") || /^[^/]+\.md$/.test(f);

// event：github.event_name；files：改动的文件（null 表示没拿到）；tested：main 上的合并提交与已通过 CI 的 PR 提交文件树相同
export function plan({ event, files, tested = false }) {
  if (event === "push" && tested) return { regression: false, visual: false, browsers: [] };
  const full = { regression: true, visual: true, browsers: ["chromium", "webkit"] };
  if (event === "workflow_dispatch" || !files || files.length === 0) return full;
  if (files.every(notThemeInput)) return { regression: true, visual: false, browsers: ["chromium"] };
  return full;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let input = "";
  try { input = readFileSync(0, "utf8"); } catch { /* 没有输入：全跑 */ }
  const files = input.split("\n").map((s) => s.trim()).filter(Boolean);
  const p = plan({ event: process.env.GITHUB_EVENT_NAME, files: files.length ? files : null, tested: process.argv.includes("--tested") });
  const lines = `regression=${p.regression}\nvisual=${p.visual}\nbrowsers=${JSON.stringify(p.browsers)}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
  console.log(`改动 ${files.length} 个文件${files.length ? `：\n  ${files.slice(0, 50).join("\n  ")}` : ""}\n${lines}`);
}
