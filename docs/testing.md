# 测试

博客里凡是 PaperMod 之外自己写的东西（模板、渲染钩子、配置约定、构建脚本、工具脚本），都要有可重复运行的回归测试，并且由 CI 在每个 PR 和每次合入 `main` 时执行。

## 测试清单

| 测试 | 覆盖什么 | CI 里的步骤 |
| --- | --- | --- |
| `tests/site.test.mjs` | 站点整体：短文栏目、中英文副本、英文配图、公式/Mermaid/提示框、访问统计只在正式站加载、`build.sh` 预览地址、CDN 版本锁定（详见下文） | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/ci-plan.test.mjs` | CI 跳过测试的规则：只在输入确实没变时跳过（见「CI 用量」） | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/ci-coverage.test.mjs` | 覆盖检查脚本 `tests/ci-coverage.mjs` 本身，以及本仓库每个测试文件都在 CI 里执行 | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/build.test.mjs`、`tests/browser.test.mjs` | 图片处理（WebP、尺寸档位）、短文原位分组、折叠、图集（见 [tests/README.md](../tests/README.md)） | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/mobile.test.mjs` | 手机端契约（见「手机端」）：站点生成的每个自带 `<html>` 的页面（含短片等独立页面；内容目录里原样提供的 `.html.raw` 下载文件不查，保留原始 HTML 的一切特征）都关掉 iOS 文字自动放大、不禁止双指缩放；以真实手机参数（isMobile、DPR 2/3、触屏）在 Chromium 和 WebKit 上打开主要页面，320 宽、390 宽、横屏、安卓下都没有横向滚动，能点的东西没有被挤出屏幕或被裁掉，输入框不小于 16px | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/favicon.test.mjs` | 网站图标（[favicon.md](favicon.md)）：`favicon.ico` 含 16/32/48 三档且与单独的 PNG 相同；16px 图标逐像素符合设计（整像素的白色 L、主题色底、灰色内圈、透明圆角），32px 的 L 也落在整像素上；`apple-touch-icon.png` 180×180 不透明；Safari 固定标签图是单色剪影；提交的文件就是 `tools/favicon/build.mjs` 的输出 | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/lang-switch.test.mjs` | 页头语言切换跳到当前页的译文，没有译文才回首页；Chromium 和 WebKit 都跑（见 [docs/language-switch.md](language-switch.md)） | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tools/image-i18n/test_render.py` | 英文配图脚本 `render.py`，并核对 `content/` 里提交的英文图和 `.i18n.yaml` 一致（见 [image-translation.md](image-translation.md)） | Lint and build → Test image-i18n |
| `tests/s1.test.mjs` | S-1 译本的全文下载：入口位置（卡片、版本条、版本表、全屏阅读目录面板）、直链无门槛、冻结文件原样发布且与 sha256 一致、打印成 PDF 时原文页不被缩小（横版页单独用横版纸）、原版视图图片不被压成 0 宽、未发布版本的单文件 `full.html`、章节 `original.html` 不单独发布、下载文件 noindex、手机和电脑无横向滚动、显示原版页的页面（含完整 HTML 和每个版本的冻结文件）都关掉了 iOS 文字自动放大（`text-size-adjust: 100%`，否则 iPhone 上原版页文字重叠；CI 的浏览器没有这个功能，截图测不出来）；完整 HTML 和 SEC 原页一样不设 viewport、不用脚本缩放（原样提供，手机由浏览器整页缩小）；以及和 PaperMod 的契约（译本样式依赖的 9 个 CSS 变量、页头/正文/页脚/返回顶部结构，宽版和全屏阅读仍然生效），升级主题时由它发现样式要跟着改 | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/s1-links.test.mjs` | S-1 译本和译文栏目的每个链接：站内地址存在、`#片段` 有对应 id、不意外指回本页、中英文页只在该跨的地方跨、外链格式、原版 444 个跨章交叉引用、封面目录章节名落在同名章节、冻结 HTML 离线可跳；冻结 PDF 的书签和 477 个页内链接指向正确页（pypdf）；Chromium 和 WebKit 实点菜单、语言切换、翻章、全屏阅读目录/跳页/页码、下载、版本菜单 | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/s1-behavior.test.mjs` | S-1 译本的用户行为清单（116 条，见各测试名）：栏目与导航、译本首页/版本页/章节页、重排与原版的默认/记忆/切换时停在同一页、缩放、沉浸阅读的进入退出（按钮、Esc、后退）、页码与跳页（含跳到下一章）、翻章、目录面板、缩放记忆、本机存储被禁用时照常可用、手机上原版页里表格细线和双线画得出来（完整 HTML 由浏览器整页缩小；站内原版视图用 zoom 缩小时 iPhone 的 WebKit 曾把 1pt 细线画成 0 宽；按像素检查）、原版页在灰框里居中（竖版和横版页、手机/电脑/宽屏、全屏阅读，按布局和截图像素检查）、正式站开着的 Cloudflare 邮件地址混淆下没有脚本错误、下架邮箱照常解开（`helpers.mjs` 的 `cfEmailObfuscation` 按线上实测改写页面并插入解码脚本；原版模板里不放脚本，万一有也不执行）、短文里链到原版某处（`#id:~:text=`）的链接在加载前后被浏览器设回顶部时仍回到原处（iOS Safari 在标签页里第一次用手指点进来时偶尔出现，iOS 模拟器真实点击复现；CI 的浏览器复现不了，用拖住 load、加载前后滚回顶部来模拟；有高亮句子时回到句子处而不是 id 处；读者动过页面就不再管）；Chromium 和 WebKit | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/s1-overlap.test.mjs` | S-1 译本最新版本冻结 HTML 的原版版式，在 Chromium 和 WebKit（≈Safari）里各查一遍（与译文仓库 `pipeline/text/check_overlap.js` 是同一套检查）：421 页里不同文字块的行不互相压住；给译文文字块加 0.02em 字距模拟比测量时略宽的字体（Mac 的 Georgia 等），也不能压住（v1.1 封面「抄送」栏和第 2 页标题曾在 Mac 上重叠）。结果取决于字宽，测试不用机器上的字体，页面用到的字体名都换成 `tests/fixtures/fonts` 里的文件（Georgia → 字宽相同的 Gelasio，Times New Roman/Helvetica → Liberation，中文 → Noto CJK 子集，均为 OFL），并检查字体子集包含最新版本的全部字符；反向验证：同样的检查在 v1.1 上找出那 3 处 | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tools/s1-import/test_release.py` | 发布脚本 `release.py`（PDF 文字层的部首修正、不覆盖已发布版本），以及仓库里每个已发布版本的冻结 HTML/PDF：大小和 sha256、PDF 页数和尺寸、每页「非官方」标记、书签、元数据、HTML 单文件且首末都有译者声明 | Lint and build → Test s1-import |
| `tools/s1-import/test_import.py` | 导入脚本 `import.py` 把译文 Markdown 转成 Hugo 正文：脚注标记保留为上标，被误包进 `<sup>` 的整句、中文、点线引导符去掉上标；章首前只有图片的整页分隔图归入后一章；导入新版本时内容变了的同名配图加内容哈希另存，旧版本仍用原图 | Lint and build → Test s1-import |
| `tests/bilingual.test.mjs` | 双语对照译文（[bilingual-translations.md](bilingual-translations.md)）：全文下载是冻结文件原样发布（大小、sha256）、直链无门槛、小文件按 KB 显示；站内显示原版版式的页面都关掉了 iOS 文字自动放大；导入用的源文件不发布；版本条、声明、版权行；重排版段落齐全；英文页只放说明不放原文全文、中英互链；Chromium 和 WebKit 上的首次默认版式（电脑原版、手机重排）、版式和「中文/对照/English」记住选择、全屏阅读进出（按钮、Esc、后退）、缩放、无横向滚动、深色模式纸面不反色且纸面里每个元素的文字颜色和浅色模式一致、原版版式的纸在灰框里居中（手机/平板/电脑/宽屏、全屏阅读含缩小、深色，布局差 ≤ 0.5px、截图差 ≤ 1 个设备像素）、本机存储被禁用、不开脚本、段落锚点、Cloudflare 邮件地址混淆下没有脚本错误 | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tools/bilingual-import/test_import.py` | 导入脚本 `import.py`：沉浸式翻译网页拆成段落对（标题/作者进 header、行内 Markdown、特殊字符转义、插件注入的脚本/弹窗去掉）、原版片段（作者样式加 `.bl-sheet` 前缀、译文换成统一的 span）；仓库里每篇用 `source.html.raw` 重新导入，结果逐字节不变 | Lint and build → Test bilingual-import |
| `tools/bilingual-import/test_release.py` | 发布脚本 `release.py`（不覆盖已发布版本；下载的 HTML 是保存的原网页原样，去掉加的声明和 noindex 后与原网页逐字节相同；和 S-1 共用文字层修正），以及每篇已发布的冻结 HTML/PDF：大小和 sha256、和 `source.html.raw` 对得上、首末有声明、没有加原网页没有的样式、PDF 每页「非官方」标记、无部首字符、尺寸、元数据、标签结构 | Lint and build → Test bilingual-import |
| `tests/theme/visual.spec.mjs` | 像素级截图：本站和 PaperMod 官方示例站的页面，Chromium/WebKit × 电脑/平板/手机 × 浅色/深色，以及"图片未加载""CDN 不可用"两种网络状态、禁用脚本时的首页和文章 | Browser tests（chromium、webkit 两个任务，各跑三种设备） |
| `tests/theme/repaint.spec.mjs` | 截图只取决于页面最终的样子，与绘制历史无关（见「截图与绘制历史」） | Browser tests（chromium、webkit 两个任务，各跑三种设备） |
| `tests/theme/fullpage.spec.mjs` | 整页截图截到完整页面：高度等于原视口下的页面高度，页脚在截图里（见「整页截图与 vh」） | Browser tests（chromium、webkit 两个任务，各跑三种设备） |
| `tests/theme/behavior.spec.mjs` | 主题交互：深色模式、站内搜索、复制代码、目录、页头和文内语言切换、返回顶部、菜单、短文图集灯箱和折叠、键盘焦点框、无脚本错误、无横向滚动、慢网下的布局偏移和最终渲染、能横滑的表格和代码块有边缘阴影（放得下时除圆角外逐像素不变） | Browser tests（chromium、webkit 两个任务，各跑三种设备） |
| `tests/seo.test.mjs` | 搜索引擎相关输出（正式构建，见 [seo.md](seo.md)）：站点地图和页面的 robots/canonical 一致（要求收录的都在站点地图里，站点地图里的都要求收录）；S-1 最新版本进站点地图、历史版本 noindex；每个要求收录的页面都有像样的摘要（不是兜底文字、不含 Markdown、不从图注开始）；文章作者进 meta 和结构化数据但不显示在日期那一行，译文原作者照常显示；带配图的文章用自己的配图作分享图，英文页用英文图；其他页面用 1200×630 的站点默认分享图 | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/taxonomy-case.test.mjs` | 构建可复现：同一个标签在不同文章里大小写不同（如 `html` 和 `HTML`）时必须用 `_index.md` 固定标题，否则 Hugo 每次构建随机取一种（见「构建必须可复现」）；查正式站点（含预览用测试短文）、主题测试站、PaperMod 示例站，并确认去掉固定标题后能查出示例站的问题 | Browser tests (chromium) 里的 Run regression tests 步骤 |
| `tests/theme/output.spec.mjs` | 非视觉输出快照：文件清单、页面 `<head>`（SEO、Open Graph、hreflang）、RSS、搜索索引、站点地图 | Browser tests (chromium) |
| `.github/workflows/ci.yml` 里的检查 | 所有 action 都锁定到完整 commit SHA；每个测试文件都被 CI 执行 | Lint and build |

## `tests/site.test.mjs` 检查的内容

只用 Node 内置模块（`node:test`），不需要 `npm install`。测试用 `build.sh` 构建整站（锁定的 Hugo 版本、和 Cloudflare Pages 相同的 `--minify`），然后读取生成的 HTML：

- **短文栏目**（`content/notes/`、`layouts/notes/list.html`、`hugo.yaml` 的 `mainSections`/`permalinks`/菜单）：中英文首页和归档只列长文；`/notes/` 按时间线列出全部短文并展开全文（和单篇页正文一致）；单篇地址 `/notes/<slug>/`；短文 RSS；菜单第一项是「短文」/「Notes」；草稿不发布。
- **中英文副本**（项目规则）：每篇已发布的文章都有对应的 `.en.md`，反之亦然；slug、date 一致，页面互相链接；标签数量相同，「随笔」译为「Notes」。
- **英文配图**：有 `.i18n.yaml` 的图，英文页引用 `.en` 版，中文页用原图，构建结果里也是如此。
- **公式、Mermaid、提示框**（`layouts/_markup/`、`layouts/_partials/extend_head.html`）：用草稿 `content/posts/markdown-test/` 检查 `$…$`/`$$…$$` 渲染成 KaTeX、` ```mermaid ` 输出 `<pre class=mermaid>`、`> [!NOTE]` 等提示框带中文标题；KaTeX 样式和 Mermaid 脚本只在需要的页面加载；正文不会被误当成公式（例如英文里成对出现的美元金额）。
- **网站图标**：除跳转页外的每个页面（中英文页、404、S-1、双语译文）都有 PaperMod 的 5 个图标链接，指向的文件都存在；可下载的完整 HTML 不带图标链接。
- **访问统计**（[analytics.md](analytics.md)）：Cloudflare Web Analytics 的脚本只在 `main` 分支构建时加载，每个站点页面正好一次，原样提供的下载文件、预览站、本地构建里都没有。
- **文字排版测试覆盖 WebKit**：逐行量文字位置的测试（用 `Range.getClientRects()`，如重叠、断行检查）必须同时启动 Chromium 和 WebKit，CI 里 WebKit 启动失败要报错。S-1 v1.1 封面的重叠只在 Mac 的 Safari 上看到，当时的检查只用 Chromium，没有查出来。`tests/theme/` 的 spec 由配置自动在两种内核里跑，不在此列。
- **`build.sh`**：预览构建（`CF_PAGES_BRANCH` 不是 `main`）的链接和 RSS 指向 `CF_PAGES_URL`，`main` 用正式域名。

这些断言都做过反向验证：分别人为破坏 13 处（例如首页收入短文、栏目只给摘要、删掉渲染钩子、预览不换地址、英文页用中文图、删掉英文副本、撤销美元转义），每一处都会让对应的测试失败。

## 主题与样式测试（`tests/theme/`）

PaperMod 本身没有测试（它的 CI 只检查示例站能否构建成功），所以这里以它的官方示例站为参照自己搭了一套。

**两个参照站**（每次测试都用仓库锁定的 Hugo 和 `themes/PaperMod` 重新构建，`--clock` 固定"当前时间"）：

- `tests/theme/example-site/`：PaperMod 官方 exampleSite 原样拷贝（来源见其中的 `SOURCE.md`），代表主题自身的行为，包括多语言、RTL、个人主页模式、封面图、代码高亮等。
- `tests/theme/site-fixture/content/`：本站的模板、样式和配置，加上一套固定的测试文章（中英文长文、短文、带图短文）。用固定文章而不是真实文章，发新文章时不需要更新基准图。

**像素级比对**：`toHaveScreenshot` 容差为 0（`maxDiffPixels: 0, threshold: 0`），整页截图，关闭动画、隐藏光标。为了让同一页每次截图完全一致，截图前会等图片加载完、字体就绪、Mermaid 画完、版面连续 10 帧不变，并把视口拉到整页高度、让整页重新绘制一遍再截（`helpers.mjs` 的 `settle`、`fullPage`、`repaint`，原因见下面的「截图与绘制历史」「整页截图与 vh」）。浏览器的所有请求都由测试直接返回本地文件，不访问外网；页面用到的 KaTeX、Mermaid 由 `tests/theme/package.json` 锁定的本地副本提供，版本与线上一致（`tests/site.test.mjs` 会检查这一点）。

**设备与浏览器**：Chromium（对应 Chrome）和 WebKit（Safari 的引擎；它不等于真正的 Safari 应用，后者只能在 macOS 上运行），各自在电脑 1280×800、平板 820×1180、手机 390×844 三种视口下运行，平板和手机开启触屏；不开 Playwright 的 isMobile（移动端视口缩放），因为它会让 srcset 选图取决于时序、基准无法固定（原因见 `playwright.config.mjs`），响应式布局仍按视口宽度生效。截图按 CSS 像素 1:1 保存。

**网络状态**：正常；图片一直没有响应（检查加载前的版面）；CDN 不可用（KaTeX 样式、Mermaid 加载失败时的降级显示）；Slow 3G（400ms 延迟、约 50KB/s，检查布局偏移 CLS ≤ 0.1，且最终渲染与正常网络逐像素一致）。CLS 只有 Chromium 能测。"图片一直没有响应"在 WebKit 上只检查页面能稳定、Mermaid 图表照常画出，不截图：WebKit 截图前要等整页 load，图片不回来就永远截不了。

**运行环境**：CI 的浏览器测试任务固定在 Playwright 官方镜像 `mcr.microsoft.com/playwright:v1.63.0-noble`（按 digest 锁定）里运行，基准图 `tests/theme/__snapshots__/` 也是在这个镜像里生成的。不同机器的字体和渲染不同，本地截图和基准不一致是正常的，以 CI 为准。每个浏览器一个任务（两个任务并行），三种设备在任务内依次跑；非视觉的输出快照只在 chromium 任务里跑。

**改了样式、需要更新基准图时**：推送后 CI 的 Browser tests 任务会失败，失败的任务在同一镜像里重新生成有变化或缺失的基准图，并上传名为 `visual-<浏览器>` 的产物，里面有每张图的期望/实际/差异对比（`test-results-failed/`、`playwright-report/`）和新基准（`__snapshots__/`）。同仓库的 PR 还会由 `Publish regenerated baselines` 任务把所有新基准合并推到 `ci-baselines/pr-<编号>` 分支（这个任务只有它有写权限，不执行仓库代码）。逐张确认差异都是预期的改动后取回提交：

```bash
git fetch origin ci-baselines/pr-<编号>
git diff HEAD FETCH_HEAD --stat -- tests/theme/__snapshots__   # 看哪些图变了
git checkout FETCH_HEAD -- tests/theme/__snapshots__ && git commit -m "Update screenshot baselines"
```

PR 合并后可以删掉对应的 `ci-baselines/` 分支。

**截图与绘制历史**：Chromium 画点状下划线（PaperMod 文章元信息里的链接、`<abbr>` 等）时，只重画页面的一部分和整页一起画，抗锯齿结果不同：版面逐个元素量过完全一样，像素却差几十个。页面加载时哪些部分先画、哪些部分单独重画过，取决于机器当时忙不忙，所以 CI 偶尔会在 Markdown 示例页上差 32 像素（2026-10-27 PR #24、#25 各一次，重跑通过）。本地把浏览器主线程放慢 8 倍（`Emulation.setCPUThrottlingRate`）就能复现：同一页 32 次截出 2～4 种结果。另有两种操作必定复现：窗口宽度变 1px 再变回，或把元信息行隐藏再显示。

所以每次截图前都由 `repaint` 让整页从头重画：给根元素临时加 `filter: blur(0px)`（会移动像素的滤镜让 Chromium 必须整页重画），出一帧后去掉，再整页画一次。之后放慢 8 倍各 40 次、电脑和手机都只有一种结果。新写截图测试时，截图前要么调用 `fullPage`（里面已经调用 `repaint`），要么直接调用 `repaint`。`repaint.spec.mjs` 用上面两种必定复现的操作检查这一点：去掉 `repaint` 它就失败；如果哪天 Chromium 不再有这个问题，它的前提检查会失败，那时可以去掉 `repaint` 和这个测试。

**整页截图与 vh**：`fullPage` 把视口拉到整页高度再截视口。PaperMod 的 `.main`（以及个人主页模式的 `.profile`）是 `min-height: calc(100vh - 页头 - 页脚)`，视口一拉高，`min-height` 也跟着变大；手机上页头折成两行，比主题变量 `--header-height` 高，页面永远比视口高一截，截出来末尾一大段空白、页脚被截掉（示例站 Markdown 页 390 宽：5685 → 视口 5805 → 页面 5865；电脑上也会多出 1px）。所以拉高视口之前，`freezeViewportUnits` 先把所有用 `vh`/`svh`/`dvh`/`vmin` 等单位写的尺寸固定成原视口下的计算值，截到的就是读者在原视口里从头滚到尾看到的页面。拉高后页面高度还在变，`fullPage` 直接报错，不会截一张错的图。`fullpage.spec.mjs` 在 6 个浏览器×设备上检查几类页面（长文、归档、个人主页、不满一屏的页面、404、禁用脚本）：截图高度等于原视口下的页面高度、页脚位置不变；去掉冻结，三种设备都会失败。

不用 Playwright 自带的 `fullPage: true`：它在截图过程中另画视口以外的部分，`repaint` 管不到，放慢后同样会截出不同结果。

**构建必须可复现**：截图比的是浏览器画出来的页面，页面本身（Hugo 生成的 HTML）也必须每次构建都一样。Hugo 0.153 起（本仓库 2026-10-28 从 0.151 升到 0.158），同一个标签在不同文章里写法大小写不同时，标签名每次构建随机取其中一种：PaperMod 示例站的 Markdown 语法页写 `html`、音视频页写 `HTML`，本机连续构建 40 次，`Html` 17 次、`HTML` 23 次（0.151、0.152 各 20 次全是 `Html`）。标签页和这两篇文章因此有两种样子，CI 上 example-markdown（浅色、深色）、example-tags 三种设备共 9 张截图随机失败，约 1% 像素不同，和当次改动无关。浏览器端的稳定措施（`repaint`、`freezeViewportUnits`）管不到这一层。

办法是给这种标签建 `<标签类>/<标签>/_index.md`，在 `title` 里固定标题。示例站内容保持原样，固定标题放在 `tests/theme/example-site-terms/`，由 `example-site.overrides.yaml` 挂进示例站的 content（取 `Html`，与 0.152 及以前的结果相同，生成的文件与随机到 `Html` 时逐字节相同）；主题测试站的 `test`/`Test` 同样固定（`site-fixture/content/tags/test/_index.en.md`，输出不变）。`tests/taxonomy-case.test.mjs` 检查所有站点，以后正式文章出现 `AI`/`ai` 这类写法时也会报出来，否则线上标签名会随每次部署来回变。

**验证截图稳定**：零容差要求同一提交每次渲染都逐像素相同。在 Actions 页手动运行 CI（Run workflow），选要测的分支，把 `repeat_each` 设为 3 或更大，每个用例会重复执行这么多次，有任何一次不同都会失败。注意它只重复截图，不重新构建（两个站点在 `global-setup.mjs` 里每个任务只构建一次），所以查不出构建结果随机的问题；这类问题由上面的「构建必须可复现」检查负责，怀疑时也可以本机连续构建几十次比较输出。任务日志开头会打印运行机器的 CPU 型号，便于排查不同机器之间的差异。

**CI 用量**：私有仓库的 GitHub 托管运行机按分钟计费，每个任务单独向上取整到整分钟，免费额度用完后任务分不到运行机、两秒就失败（2026-10-27 遇到过）。所以 CI 按两条原则安排：

1. 任务按"计费分钟"而不是按"并行度"拆。几十秒的检查（action 锁定、测试覆盖、构建、image-i18n）合在 Lint and build 一个任务里；浏览器测试每个浏览器一个任务，拉 Playwright 镜像（约 50 秒）和取整各只算两次。
2. 只跳过输入没有变、已经在完全相同的文件上通过过的测试，拿不准就全跑（`tests/ci-plan.mjs`，单元测试 `tests/ci-plan.test.mjs`）：
   - 只改 `content/`、`docs/`、根目录 `.md` 时，跳过 WebKit 任务和视觉测试，站点回归测试照跑。主题测试的本站只用 `tests/theme/site-fixture` 里的固定文章构建，不读 `content/`，文档也不进入任何构建，所以视觉测试的输入和 main 完全相同。发文章是最常见的改动，这类运行只要约 3 分钟。
   - 合并 PR 产生的 main 提交，文件树和 PR 分支最后一个提交完全相同（PR 合并前已包含最新 main，几乎总是如此），而那个提交的 PR CI 已经通过时，main 上不再重复跑。
   - 手动运行（Run workflow）、拿不到改动列表、或者改到上面以外的任何文件，都全跑。

3. 同一件事只做一次。整站构建由站点回归测试（`site.test.mjs` 用 `build.sh` 构建正式站）完成，Lint and build 不再单独构建；Hugo 处理过的图片（`resources/_gen`）用 `actions/cache` 跨运行复用，整站冷构建约 55 秒，有缓存约 2 秒。Hugo 按源文件和处理参数给缓存文件命名，内容变了就会重新生成；Hugo 版本（`build.sh`）或图片渲染钩子（`layouts/_markup/`）变了，整份缓存作废。

一次全量运行约 13 计费分钟（原来 10 个任务约 20 分钟），测试内容不变。新增任务或让主题测试读取新目录前，先对照这两条。

## 手机端

2026-10-28 用户在 iPhone 上发现 S-1 完整 HTML 文字重叠，随后对全站做了一次手机端检查（问题清单见项目文件 `mobile-audit/`）。找到的问题都在上面那套截图测试看不到的地方：

- **截图测试不开手机模式**：为了基准稳定，主题截图在 DPR 1、不开 isMobile 下拍，390 宽是它唯一的手机宽度。320 宽（iPhone SE，也相当于 Safari 把页面放大到 120%）、横屏、安卓 360 宽都没有测，全屏阅读顶栏挤坏就出在这些宽度。（英文菜单在 320 宽放不下时整行横滑，是 PaperMod 原有行为，按项目规则保留，检查时把 `#menu` 当作横向滚动的容器。）
- **只看 scrollWidth 测不出「被压扁」**：flex 布局放不下时先压缩子元素，不会溢出。全屏阅读顶栏的目录入口被压成 0 宽、缩放组被裁，`scrollWidth <= clientWidth` 照样成立。现在逐个量控件：完整可见、在容器和屏幕里、至少 44×44。
- **iOS 独有的行为 CI 的浏览器都没有**：文字自动放大、按设备像素取整的细线、地址栏收放后 `vh` 和可见高度不一致、点击事件委托、没有元素全屏 API、跨源 iframe 不能自动播放。能写成规则的写成静态检查（`mobile.test.mjs` 查站点生成的每个独立页面的 `-webkit-text-size-adjust`，原样提供的下载 HTML 不改也不查；全屏层用 `dvh` 并保留 `vh` 回退）；S-1 原文页表格细线按设备像素取整后消失的问题，由框线修复单独处理和测试；其余的只能在 iOS 上看。

因此：

- `tests/mobile.test.mjs`：真实手机参数下逐页检查，Chromium 跑 iPhone SE、iPhone 13 竖屏和横屏、Pixel 7，WebKit 跑三种 iPhone。只做几何检查不截图，两个浏览器合计约 1 分钟。
- `tests/s1-behavior.test.mjs` 的手机用例：全屏阅读顶栏逐个量控件（320 宽和 390/412 宽、重排和原版）；横版页和竖版页同宽、不横向滚动；版本表每一项都在屏幕里。
- `tests/browser.test.mjs`：灯箱横扫后第一次点按不被吞掉、能双指放大、横屏时计数/图注/关闭按钮/图片互不遮挡。
- **iOS 模拟器只做复核**：用户的 Mac 上有 Xcode 的 iOS 模拟器，可以用 Safari 打开真实页面截图。它不进 CI，只在大改样式、发现严重的手机问题、发布大版本时用（用户 2026-10-28 定的）。

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
