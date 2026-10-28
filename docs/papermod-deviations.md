# 与 PaperMod 不同的地方

本站的样式和行为以 PaperMod 为准（项目规则，2026-10-28）：影响风格的样式和配置一般不改，除非必要；二次开发要与 PaperMod 的风格一致。
下面列出与 PaperMod（`themes/PaperMod`，当前锁定 1181196，2026-10-25 的上游最新版；需要 Hugo ≥ 0.158）不同的每一处，以及为什么保留。新增偏离时先在这里写明理由，并取得用户确认。

## 配置（`hugo.yaml`）

只用 PaperMod 文档里的配置项（阅读时长、字数、目录、复制按钮、上一篇/下一篇、深色模式、搜索等），以及站点功能需要的 Hugo 配置：

| 配置 | 为什么 |
|---|---|
| `mainSections: [posts]`、`permalinks`、菜单「短文 / 译文」 | 短文和译文栏目（用户要求，PR #14、#24） |
| `outputFormats.s1full` | S-1 完整 HTML 下载（用户选定 D4，PR #24） |
| `cascade.build.publishResources: false` | 原图不上线，只发 WebP（用户确认，PR #16） |
| `ignoreFiles`、`markup.goldmark.passthrough` | 英文配图描述文件不进站；公式（站点上线时就有） |

## 模板

| 文件 | 和 PaperMod 的差别 | 为什么 |
|---|---|---|
| `_partials/header.html` | PaperMod 原样拷贝，只改语言切换链接 | 用户要求切换到当前页的译文（PR #22，`docs/language-switch.md`） |
| `_partials/extend_head.html` | 按需加载 KaTeX、Mermaid（PaperMod 提供的扩展点） | 公式和图表。Mermaid 锁定 11.17.2：浮动的 `@11` 会让截图基准随上游变化；用 `mermaid.run()` 而不是 `startOnLoad`：Safari 里有图片未加载完时图表不出现（PR #20） |
| `_partials/extend_footer.html` | 图集灯箱、短文折叠（PaperMod 提供的扩展点） | 用户选定（PR #16） |
| `_markup/render-*.html` | 提示框、Mermaid、公式、图片转 WebP | 站点上线时的功能；图片处理（PR #16） |
| `notes/`、`s1/`、`bilingual/`、`_partials/s1/`、`_partials/bilingual/` | 本站栏目自己的模板 | 只作用于这些栏目的页面 |

## 样式（`assets/css/extended/`）

- `custom.css`：只给本站自己的组件写样式（提示框、短文卡片、图片分组、灯箱）。颜色、圆角、间距一律用 PaperMod 的变量（`--entry`、`--border`、`--radius`、`--gap`、`--secondary`），不改 PaperMod 自己元素（页头、菜单、代码块、表格、归档、复制按钮）的样式。唯一的例外见下面「用户批准的例外」。
- `s1.css`、`bilingual.css`：只作用于译文页面（`.s1-*`、`.bl-*`，或页面里有 `.s1-original` 时的正文宽度）。

### 用户批准的例外

| 改动 | 和 PaperMod 的差别 | 为什么 |
|---|---|---|
| 横滑提示阴影（`custom.css`「能横向滚动的宽内容」） | 表格、代码块、公式超出宽度能左右滑时，露出内容的那一侧边缘有一道阴影；放得下时看不出差别（只有圆角抗锯齿差 1–3 个色阶） | iOS 平时不显示滚动条，读者看不出表格右边还有内容，容易漏读（例如 S-1 目录在手机上最长的一行）。用户 2026-10-28 确认这违反「以 PaperMod 为准」，但对读表有益，批准作为例外保留（PR #36 引入，PR #38 保留）。测试：`tests/theme/behavior.spec.mjs`「能横滑的表格、代码块、公式有边缘阴影」 |

### 2026-10-28 还原的偏离

下面这几处是 PR #36（手机端检查）改的。它们不是用户要求的，也不是修必要的问题，改变了 PaperMod 原有的样式或行为。用户确认后已还原（理由：原版已足够呈现信息，或这项功能没必要；脱离原版框架持续改下去会失去风格）：

| 还原的改动 | 现在（与 PaperMod 一致） |
|---|---|
| 提示框色条改成五种颜色 | 恢复 #36 之前的写法，色条是 PaperMod 引用块的样式，标题文字仍有颜色 |
| 页头菜单放不下时折行 | PaperMod 的整行横滑（`.menu { overflow-x: auto }`） |
| 归档月份标题 `max-width: 100%` | PaperMod 的固定 200px |
| 触屏上常驻「复制」按钮 | PaperMod 的悬停才显示 |
| 窄屏（≤480px）短文卡片内边距改成上下 16px、左右 14px（PaperMod 手机上的 `--gap` 本来就是 14px，实际只多了上下各 2px） | 和 PaperMod 文章卡片一样用 `var(--gap)`，手机上四边 14px |
| 灯箱底色 0.96 | 恢复 0.88 |

保留的 #36 改动：灯箱的功能修复（横扫后第一次点按被吞、不能双指放大、横屏时计数压住图注、iOS 工具栏导致图注被挤出屏幕），以及 S-1 全屏阅读顶栏、横版页、版本表的修复。灯箱和 S-1 阅读界面是本站自己的组件，这些修的是点不到、看不到的实际问题。
