# 测试

博客里凡是 PaperMod 之外自己写的东西（模板、渲染钩子、配置约定、构建脚本、工具脚本），都要有可重复运行的回归测试，并且由 CI 在每个 PR 和每次合入 `main` 时执行。

## 测试清单

| 测试 | 覆盖什么 | CI 里的步骤 |
| --- | --- | --- |
| `tests/site.test.mjs` | 站点整体：短文栏目、中英文副本、英文配图、公式/Mermaid/提示框、`build.sh` 预览地址、CDN 版本锁定（详见下文） | Regression tests |
| `tests/ci-coverage.test.mjs` | 覆盖检查脚本 `tests/ci-coverage.mjs` 本身，以及本仓库每个测试文件都在 CI 里执行 | Regression tests |
| `tests/build.test.mjs`、`tests/browser.test.mjs` | 图片处理（WebP、尺寸档位）、短文原位分组、折叠、图集（见 [tests/README.md](../tests/README.md)） | Regression tests |
| `tests/lang-switch.test.mjs` | 页头语言切换跳到当前页的译文，没有译文才回首页；Chromium 和 WebKit 都跑（见 [docs/language-switch.md](language-switch.md)） | Regression tests |
| `tools/image-i18n/test_render.py` | 英文配图脚本 `render.py`，并核对 `content/` 里提交的英文图和 `.i18n.yaml` 一致（见 [image-translation.md](image-translation.md)） | Test → Test image-i18n |
| `tests/theme/visual.spec.mjs` | 像素级截图：本站和 PaperMod 官方示例站的页面，Chromium/WebKit × 电脑/平板/手机 × 浅色/深色，以及"图片未加载""CDN 不可用"两种网络状态、禁用脚本时的首页和文章 | Visual (浏览器-设备)，6 个任务 |
| `tests/theme/repaint.spec.mjs` | 截图只取决于页面最终的样子，与绘制历史无关（见「截图与绘制历史」） | Visual (浏览器-设备)，6 个任务 |
| `tests/theme/behavior.spec.mjs` | 主题交互：深色模式、站内搜索、复制代码、目录、页头和文内语言切换、返回顶部、菜单、短文图集灯箱和折叠、键盘焦点框、无脚本错误、无横向滚动、慢网下的布局偏移和最终渲染 | Visual (浏览器-设备)，6 个任务 |
| `tests/theme/output.spec.mjs` | 非视觉输出快照：文件清单、页面 `<head>`（SEO、Open Graph、hreflang）、RSS、搜索索引、站点地图 | Visual (chromium-desktop) |
| `.github/workflows/ci.yml` 里的检查 | 所有 action 都锁定到完整 commit SHA；每个测试文件都被 CI 执行 | Lint |

## `tests/site.test.mjs` 检查的内容

只用 Node 内置模块（`node:test`），不需要 `npm install`。测试用 `build.sh` 构建整站（锁定的 Hugo 版本、和 Cloudflare Pages 相同的 `--minify`），然后读取生成的 HTML：

- **短文栏目**（`content/notes/`、`layouts/notes/list.html`、`hugo.yaml` 的 `mainSections`/`permalinks`/菜单）：中英文首页和归档只列长文；`/notes/` 按时间线列出全部短文并展开全文（和单篇页正文一致）；单篇地址 `/notes/<slug>/`；短文 RSS；菜单第一项是「短文」/「Notes」；草稿不发布。
- **中英文副本**（项目规则）：每篇已发布的文章都有对应的 `.en.md`，反之亦然；slug、date 一致，页面互相链接；标签数量相同，「随笔」译为「Notes」。
- **英文配图**：有 `.i18n.yaml` 的图，英文页引用 `.en` 版，中文页用原图，构建结果里也是如此。
- **公式、Mermaid、提示框**（`layouts/_markup/`、`layouts/_partials/extend_head.html`）：用草稿 `content/posts/markdown-test/` 检查 `$…$`/`$$…$$` 渲染成 KaTeX、` ```mermaid ` 输出 `<pre class=mermaid>`、`> [!NOTE]` 等提示框带中文标题；KaTeX 样式和 Mermaid 脚本只在需要的页面加载；正文不会被误当成公式（例如英文里成对出现的美元金额）。
- **`build.sh`**：预览构建（`CF_PAGES_BRANCH` 不是 `main`）的链接和 RSS 指向 `CF_PAGES_URL`，`main` 用正式域名。

这些断言都做过反向验证：分别人为破坏 13 处（例如首页收入短文、栏目只给摘要、删掉渲染钩子、预览不换地址、英文页用中文图、删掉英文副本、撤销美元转义），每一处都会让对应的测试失败。

## 主题与样式测试（`tests/theme/`）

PaperMod 本身没有测试（它的 CI 只检查示例站能否构建成功），所以这里以它的官方示例站为参照自己搭了一套。

**两个参照站**（每次测试都用仓库锁定的 Hugo 和 `themes/PaperMod` 重新构建，`--clock` 固定"当前时间"）：

- `tests/theme/example-site/`：PaperMod 官方 exampleSite 原样拷贝（来源见其中的 `SOURCE.md`），代表主题自身的行为，包括多语言、RTL、个人主页模式、封面图、代码高亮等。
- `tests/theme/site-fixture/content/`：本站的模板、样式和配置，加上一套固定的测试文章（中英文长文、短文、带图短文）。用固定文章而不是真实文章，发新文章时不需要更新基准图。

**像素级比对**：`toHaveScreenshot` 容差为 0（`maxDiffPixels: 0, threshold: 0`），整页截图，关闭动画、隐藏光标。为了让同一页每次截图完全一致，截图前会等图片加载完、字体就绪、Mermaid 画完、版面连续 10 帧不变，并把视口拉到整页高度、让整页重新绘制一遍再截（`helpers.mjs` 的 `settle`、`fullPage`、`repaint`，原因见下面的「截图与绘制历史」）。浏览器的所有请求都由测试直接返回本地文件，不访问外网；页面用到的 KaTeX、Mermaid 由 `tests/theme/package.json` 锁定的本地副本提供，版本与线上一致（`tests/site.test.mjs` 会检查这一点）。

**设备与浏览器**：Chromium（对应 Chrome）和 WebKit（Safari 的引擎；它不等于真正的 Safari 应用，后者只能在 macOS 上运行），各自在电脑 1280×800、平板 820×1180、手机 390×844 三种视口下运行，平板和手机开启触屏；不开 Playwright 的 isMobile（移动端视口缩放），因为它会让 srcset 选图取决于时序、基准无法固定（原因见 `playwright.config.mjs`），响应式布局仍按视口宽度生效。截图按 CSS 像素 1:1 保存。

**网络状态**：正常；图片一直没有响应（检查加载前的版面）；CDN 不可用（KaTeX 样式、Mermaid 加载失败时的降级显示）；Slow 3G（400ms 延迟、约 50KB/s，检查布局偏移 CLS ≤ 0.1，且最终渲染与正常网络逐像素一致）。CLS 只有 Chromium 能测。"图片一直没有响应"在 WebKit 上只检查页面能稳定、Mermaid 图表照常画出，不截图：WebKit 截图前要等整页 load，图片不回来就永远截不了。

**运行环境**：CI 的 Visual 任务固定在 Playwright 官方镜像 `mcr.microsoft.com/playwright:v1.63.0-noble`（按 digest 锁定）里运行，基准图 `tests/theme/__snapshots__/` 也是在这个镜像里生成的。不同机器的字体和渲染不同，本地截图和基准不一致是正常的，以 CI 为准。浏览器 × 设备共 6 个任务并行，非视觉的输出快照只在 chromium-desktop 任务里跑。

**改了样式、需要更新基准图时**：推送后 CI 的 Visual 任务会失败，失败的任务在同一镜像里重新生成有变化或缺失的基准图，并上传名为 `visual-<浏览器>-<设备>` 的产物，里面有每张图的期望/实际/差异对比（`test-results-failed/`、`playwright-report/`）和新基准（`__snapshots__/`）。同仓库的 PR 还会由 `Publish regenerated baselines` 任务把所有新基准合并推到 `ci-baselines/pr-<编号>` 分支（这个任务只有它有写权限，不执行仓库代码）。逐张确认差异都是预期的改动后取回提交：

```bash
git fetch origin ci-baselines/pr-<编号>
git diff HEAD FETCH_HEAD --stat -- tests/theme/__snapshots__   # 看哪些图变了
git checkout FETCH_HEAD -- tests/theme/__snapshots__ && git commit -m "Update screenshot baselines"
```

PR 合并后可以删掉对应的 `ci-baselines/` 分支。

**截图与绘制历史**：Chromium 画点状下划线（PaperMod 文章元信息里的链接、`<abbr>` 等）时，只重画页面的一部分和整页一起画，抗锯齿结果不同：版面逐个元素量过完全一样，像素却差几十个。页面加载时哪些部分先画、哪些部分单独重画过，取决于机器当时忙不忙，所以 CI 偶尔会在 Markdown 示例页上差 32 像素（2026-10-27 PR #24、#25 各一次，重跑通过）。本地把浏览器主线程放慢 8 倍（`Emulation.setCPUThrottlingRate`）就能复现：同一页 32 次截出 2～4 种结果。另有两种操作必定复现：窗口宽度变 1px 再变回，或把元信息行隐藏再显示。

所以每次截图前都由 `repaint` 让整页从头重画：给根元素临时加 `filter: blur(0px)`（会移动像素的滤镜让 Chromium 必须整页重画），出一帧后去掉，再整页画一次。之后放慢 8 倍各 40 次、电脑和手机都只有一种结果。新写截图测试时，截图前要么调用 `fullPage`（里面已经调用 `repaint`），要么直接调用 `repaint`。`repaint.spec.mjs` 用上面两种必定复现的操作检查这一点：去掉 `repaint` 它就失败；如果哪天 Chromium 不再有这个问题，它的前提检查会失败，那时可以去掉 `repaint` 和这个测试。

不用 Playwright 自带的 `fullPage: true`：它在截图过程中另画视口以外的部分，`repaint` 管不到，放慢后同样会截出不同结果。

**验证截图稳定**：零容差要求同一提交每次渲染都逐像素相同。在 Actions 页手动运行 CI（Run workflow），选要测的分支，把 `repeat_each` 设为 3 或更大，每个用例会重复执行这么多次，有任何一次不同都会失败。任务日志开头会打印运行机器的 CPU 型号，便于排查不同机器之间的差异。

## 本地运行

```bash
cd tests && npm ci && npx playwright install chromium webkit && npm test && cd ..   # tests/ 下全部 *.test.mjs；site/ci-coverage 两个文件也可单独用 node --test 运行
node tests/ci-coverage.mjs                                    # 检查每个测试文件都在 CI 里执行

cd tests/theme && npm ci && npx playwright install chromium webkit && npx playwright test   # 主题测试；本地截图和 CI 基准可能有像素差异，以 CI 为准
cd ../..

python3 -m venv /tmp/venv
/tmp/venv/bin/pip install -r tools/image-i18n/requirements.txt
/tmp/venv/bin/python -m unittest discover -s tools/image-i18n -v
```

## 新增测试时

1. 测试文件按约定命名：Python 用 `test_*.py`（`unittest discover` 只认 `test*.py`），JavaScript 用 `*.test.mjs`。
2. 在 `.github/workflows/ci.yml` 里执行它：写出文件路径，或者让某个步骤以它所在的目录为单位运行（例如 `discover -s <目录>`、`working-directory: <目录>` 后跑 `npm test`）。
3. 漏了第 2 步时，Lint 里的 “Check that CI runs every test file”（`tests/ci-coverage.mjs`）会失败，并指出是哪个文件。主题（`themes/`）、`node_modules/` 和测试素材（`fixtures/`）里的文件不算。
