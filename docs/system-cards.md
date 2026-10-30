# Anthropic 系统卡中文译本

`/translations/system-cards/`（英文页 `/en/translations/system-cards/`）发布译文仓库 anyingiit/anthropic-system-cards-zh 里的系统卡中文译本。**译文仓库不公开**（用户 2026-10-30），页面上不放仓库链接、不引用仓库里的文件。译文由那个仓库维护，本站只发布、不改译文（和 S-1 译本一样：发现译文问题就记下来交给译文项目，改好后重新导入）。

## 页面

和 S-1 译本同构（2026-10-30 第三轮：A「S-1 同构」、B「卡片首页即目录」、C「整卡一页」、D「栏目页直达章节」4 个方案，5 位独立评审后定为 A 的结构 + B 的卡片首页首屏；报告 https://claude.ai/artifact/RpauRUc78LUNXUKqgXmiAu ）。模板 `layouts/syscards/`、`layouts/_partials/syscards/`，样式沿用 S-1（`s1.css`、`s1.js`：版本条、简短声明、下载卡片、目录、重排/原版切换、全屏阅读、权利行），`assets/css/extended/syscards.css` 只放不同的地方。

- **栏目页** `/translations/system-cards/`（`list.html`）：简短声明，每份卡一条 PaperMod 文章条目：卡名链到卡片首页，版本号胶囊、原版日期、页数，「在线阅读」（版本页）、「HTML ↗」「PDF ↓ 大小」直链。**顺序和 Anthropic 官网系统卡列表相同**（导入时写进 weight）。
- **卡片首页** `<卡>/`（`list.html`，同 S-1 译本首页）：首屏是版本条（版本、日期、全文下载）、简短声明（不折叠，「完整声明」链到页内 `#notice`）、「从头阅读」和英文原版、目录；往下是下载卡片（SHA-256）、完整声明、全部版本。英文页和 S-1 英文页一样不列中文目录。
- **版本页** `<卡>/<版本>/`：版本条、简短声明、下载卡片、目录。每个版本有固定网址，只增不改（同 S-1）。
- **章节页** `<卡>/<版本>/<章>/`（`single.html`，同 S-1 章节页）：重排版（译文仓库的 Markdown）和原版版式（PDF 的页面）切换，全屏阅读 `?read=1`。简短声明在章节页只留一句（手机首屏要露出正文），展开仍是完整声明。
  - 章节由 `tools/syscard-import/chapters.py` 按 `## ` 标题切分，封面单独一章；页码连续覆盖全部页，下一章从页中间开始时那一页两章都有。目录里给含另行翻译部分的章标「含另行翻译」。
  - **原版版式 = 去掉文字的底图 + SVG 文字层**：底图是 PDF 页去掉文字（保留图片和线条）后 3 倍渲染的 WebP（612pt → 1836px，2x 屏上表格线也不发软）；文字按 PDF 里每个字的坐标排进 SVG（可选中、可搜索，外链可点），字体是译文排版用的字体按全部卡用到的字取子集（`static/translations/system-cards/fonts/`，CSS 由导入生成 `assets/css/extended/syscards-fonts.css`）。字体缺字的那一段文字留在底图里。每页约 25 KB，比整页图片小得多。PDF 本身的排版问题（如 Haiku 5.5 第 12 页图注压在表格线上）原样保留，要在译文仓库修。
  - 重排版：`<!-- p.N -->` 换成 S-1 的页码分隔（这一页到此结束）；译文的强调星号在中文里 CommonMark 常配不上（全角标点旁、几段拼成一串、图注里套着嵌套），导入时先按译文的写法配对，再改写成 CommonMark 一定照此配对的样子（内层改用 `_`、在需要的一侧补零宽空格实体、只包住标点的去掉、配不上的转义成普通字符），见 `chapters._emphasis`；脚注定义都在「脚注」一章、引用在别的章，换成短代码 `sc-fn`（定义）和 `sc-fnref`（引用，链到脚注一章）。图片缩到最宽 1600px 转 WebP，构建时不再处理（`render-image.html` 对系统卡原样输出）。
- **短标签不断行**：页数、页码范围、日期用不换行空格或 `.sc-nobr`（全站检查 `tests/short-labels.test.mjs`）。
- **译者声明**（`notice.html`）：所有卡同一套条目和措辞（翻译流程相同，用户 2026-10-30）：是什么、翻译方式、译者另行翻译的部分、版式、原文和译本版本、以英文原版为准、权利和下架邮箱。每份卡只换卡名、日期、页数、版本，外加一条「本卡另行翻译的部分」：2.2 节页码、零散段落数和页码、另用的工具（Opus 5.5 用 GPT-6 Astra）、未核实的数字，来自 front matter 的 `facts`（导入脚本从各卡 README 取）。简短声明（`notice-short.html`）也带上另用的工具和未核实的数字。只陈述事实，不教读者怎么读。
- **全文下载**：HTML 是译文仓库的单文件 HTML，逐字节原样发布（不加统计脚本和图标）；PDF 只给下载，不在页面里内嵌。文件只发布一份（版本目录的 `files/` 下），英文页链到同一份。

## 版本号

和译文仓库同步：译文仓库每份卡单独编号（语义化版本，首版 1.0.0），tag `<卡>/vX.Y.Z`，各卡 `CHANGELOG.md`，根目录 `versions.json` 记版本、日期和文件 sha256。导入时读 `versions.json` 并核对文件，网页上按 S-1 的写法显示（1.0.0 → v1.0，1.1.1 → v1.1.1），版本目录名同显示名。front matter 里有 `repoVersion`、`tag`、`versionDate`。

## 下载文件

- HTML：`content/translations/system-cards/<卡>/<版本>/files/claude-<名>-system-card-zh.html.raw`，发布为同名 `.html`（`.html` 会被 Hugo 当成文章，所以存成 `.raw`；`layouts/_partials/syscards/files.html` 用 `resources.Copy` 发布）。网址里的文件名和官网英文版地址对应；下载时用译文仓库里的原文件名（`download` 属性）。
- PDF：Cloudflare Pages 单个文件不能超过 25 MiB。没超的原样复制；超过的（2026-10-30 导入时 6 份，27–44 MiB）由 `import.py` 的 `slim_pdf` **无损瘦身**：这些 PDF 里大部分图片都存了两份完全相同的副本，合并成一份，再按最高级别重新压缩 Flate 流。不重采样、不转 JPEG，每页渲染像素、文字层、书签、链接都和原文件相同（导入时逐页核对，见下）。瘦身后 14.6–22.9 MB。front matter 里记着原文件的大小和 sha256（`sourceBytes`、`sourceSha256`）。
  - 只合并图片和图片引用的调色板、色彩空间、蒙版：字体、表单、页面内容流哪怕字节相同，引用的资源也可能不同，合并会改变文字层（第一版就因此换掉了几页的隐藏文字，渲染一样但复制、搜索出来的字不同，逐页对比查出来的）。
  - 用户 2026-10-30 选的是「压缩 PDF 后放进博客」（接受画质略降）；实际做到了无损。
- 每个文件的大小、sha256、有没有书签写在版本页 `<卡>/<版本>/_index.md` 的 `downloads` 里，测试逐个核对。

## 导入和更新

```bash
git -C ../anthropic-system-cards-zh pull            # 译文仓库，必须是已提交的干净状态
pip install -r tools/syscard-import/requirements.txt
python3 tools/syscard-import/import.py ../anthropic-system-cards-zh --date <发布日期> --check-links
SYSCARDS_SRC=../anthropic-system-cards-zh python3 -m unittest discover -s tools/syscard-import -v   # 含瘦身 PDF 与原文件逐页对比
```

`import.py` 整体重写 `content/translations/system-cards/` 下的 `_index.md`、`_index.en.md` 和每份卡的目录（卡片首页、版本页、每章的 `index.md`、`original.html`、`bg/`、`images/`），以及字体子集（正文不保留，说明文字改在模板或脚本里）。每份卡的标题、日期、页数和声明用到的数字取自该卡 README 和 HTML 的 `<title>`；README 第一段或 2.2 节页码找不到时脚本报错停下，其余数字找不到就是 null，声明里那句不出现。顺序取自官网系统卡列表，列表里找不到某份卡时脚本报错停下。英文原版地址按官网规则 `https://www.anthropic.com/claude-<目录名，点换成横线>-system-card` 拼出，`--check-links` 联网逐个确认能打开。新增一份卡只要它在译文仓库里有自己的目录和 README，重新导入即可。

## 测试

- `tests/syscards.test.mjs`：构建结果（文件原样发布、大小/sha256、≤ 25 MiB、只发一份；没有仓库链接；栏目页按官网顺序、版本号、直链；卡片首页各部分的顺序、版本条、开始阅读、目录（每章、页码、另行翻译标签）、完整声明锚点；所有卡声明的通用条目逐字相同、本卡条目与 facts 一致、简短声明带特殊情况；章节页重排版没有漏掉的 `**` 和脚注记号、页码分隔和原版版式的页与本章页码一致、底图都发布、脚注链接有目标、上下章相连）和浏览器行为（Chromium/WebKit：电脑、手机、320 宽无横向滚动，手机章节页首屏有正文，**原版版式与 PDF 同一页按 8×8 像素块比对**，深色模式，Cloudflare 邮件混淆下无脚本错误）。
- 像素基准 `tests/fixtures/syscards/*.png`：`tools/syscard-import/reference.py` 用 PDF 按 96 dpi 渲染的 4 页（封面、表格和图注、2.2 节译注、图表页）。换了 PDF 就重新生成，`test_import.py` 会检查基准是不是现在这份 PDF 渲染的。
- `tools/syscard-import/test_import.py`：瘦身只合并图片、渲染和文字层不变、可复现（合成 PDF）；README 解析、官网顺序解析；加粗和脚注的转换；仓库里每份卡的 weight、中英 front matter、版本号写法、文件大小/sha256/页数/书签、章节连续覆盖全部页、每章的原版页和底图、脚注引用；像素基准是最新的；设 `SYSCARDS_SRC` 时 HTML 逐字节、PDF 与原文件逐页对比。
