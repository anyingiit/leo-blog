# Anthropic 系统卡中文译本

`/translations/system-cards/`（英文页 `/en/translations/system-cards/`）发布译文仓库 anyingiit/anthropic-system-cards-zh 里的系统卡中文译本。**译文仓库不公开**（用户 2026-10-30），页面上不放仓库链接、不引用仓库里的文件。译文由那个仓库维护，本站只发布、不改译文（和 S-1 译本一样：发现译文问题就记下来交给译文项目，改好后重新导入）。

## 页面

和 S-1 译本同构（2026-10-30 第三轮：A「S-1 同构」、B「卡片首页即目录」、C「整卡一页」、D「栏目页直达章节」4 个方案，5 位独立评审后定为 A 的结构；用户要求卡片首页与 S-1 译本首页风格一致，不用 B 的首屏；报告 https://claude.ai/artifact/RpauRUc78LUNXUKqgXmiAu ）。模板 `layouts/syscards/`、`layouts/_partials/syscards/`，样式沿用 S-1（`s1.css`、`s1.js`：版本条、简短声明、下载卡片、目录、重排/原版切换、全屏阅读、权利行），`assets/css/extended/syscards.css` 只放不同的地方。

- **栏目页** `/translations/system-cards/`（`list.html`）：简短声明，每份卡一条 PaperMod 文章条目，和「译文」栏目页一样只有标题和一行信息（原版发布日期、页数），整条可点进卡片首页；版本号、在线阅读和下载都在卡片首页（用户 2026-10-31：原来每条带版本胶囊和三个链接，信息太多、不知道看哪里，要和 PaperMod 一样简约）。**顺序和 Anthropic 官网系统卡列表相同**（导入时写进 weight）。
- **卡片首页** `<卡>/`（`list.html`，和 S-1 译本首页同样的顺序）：完整声明、「开始阅读最新版」和英文原版、下载卡片（SHA-256）、目录（v1.0）、全部版本。英文页同 S-1 英文页：标题、声明各条写成段落、中文译本的链接，没有下载、目录和版本表。
- **版本页** `<卡>/<版本>/`：版本条、简短声明、下载卡片、目录。每个版本有固定网址，只增不改（同 S-1）。
- **章节页** `<卡>/<版本>/<章>/`（`single.html`，同 S-1 章节页）：重排版（译文仓库的 Markdown）和原版版式（PDF 的页面）切换，全屏阅读 `?read=1`。简短声明在章节页只留一句（手机首屏要露出正文），展开仍是完整声明。
  - 章节由 `tools/syscard-import/chapters.py` 按 `## ` 标题切分，封面单独一章；页码连续覆盖全部页，下一章从页中间开始时那一页两章都有。目录里给含另行翻译部分的章标「含另行翻译」。
  - **原版版式 = 去掉文字的底图 + SVG 文字层**：底图是 PDF 页去掉文字（保留图片和线条）后 3 倍渲染的 WebP（612pt → 1836px，2x 屏上表格线也不发软）；文字按 PDF 里每个字的坐标排进 SVG（可选中、可搜索，外链可点），字体是译文排版用的字体取子集：西文字体小，按全部卡用到的字取一份共用（`static/translations/system-cards/fonts/`，CSS 由导入生成 `assets/css/extended/syscards-fonts.css`）；中文字体大，按章只取这一章用到的字（章节目录 `fonts/`，`@font-face` 写在 `original.html` 开头，网址占位 `scfont:` 由模板换掉），原来全部卡共用一份时一章首屏要下 1.1 MB 中文字体，超出网页性能预算（`tests/perf.test.mjs`，电脑首屏合计 900 KB），按章后约 0.1–0.3 MB。字体缺字的那一段文字留在底图里。每页约 25 KB，比整页图片小得多。PDF 本身的排版问题（如 Haiku 5.5 第 12 页图注压在表格线上）原样保留，要在译文仓库修。
  - 重排版：`<!-- p.N -->` 换成 S-1 的页码分隔（这一页到此结束）；译文的强调星号在中文里 CommonMark 常配不上（全角标点旁、几段拼成一串、图注里套着嵌套），导入时先按译文的写法配对，再改写成 CommonMark 一定照此配对的样子（内层改用 `_`、在需要的一侧补零宽空格实体、只包住标点的去掉、配不上的转义成普通字符），见 `chapters._emphasis`；脚注定义都在「脚注」一章、引用在别的章，换成短代码 `sc-fn`（定义）和 `sc-fnref`（引用，链到脚注一章）。图片缩到最宽 1600px 转 WebP，构建时不再处理（`render-image.html` 对系统卡原样输出）。
- **短标签不断行**：页数、页码范围、日期用不换行空格或 `.sc-nobr`（全站检查 `tests/short-labels.test.mjs`）。
- **译者声明**（`notice.html`）：所有卡同一套条目和措辞（翻译流程相同，用户 2026-10-30）：是什么、翻译方式、译者另行翻译的部分、版式、原文和译本版本、以英文原版为准、权利和下架邮箱。每份卡只换卡名、日期、页数、版本，外加一条「本卡另行翻译的部分」：2.2 节页码、零散段落数和页码、另用的工具（Opus 5.5 用 GPT-6 Astra）、未核实的数字，来自 front matter 的 `facts`（导入脚本从各卡 README 取）。简短声明（`notice-short.html`）也带上另用的工具和未核实的数字。只陈述事实，不教读者怎么读。
- **全文下载**：译文仓库的单文件 HTML 和 PDF，加上和 S-1 下载文件同样的译者声明（见「下载文件」），不加统计脚本和图标；PDF 只给下载，不在页面里内嵌。文件只发布一份（版本目录的 `files/` 下），英文页链到同一份。

## 版本号

和译文仓库同步：译文仓库每份卡单独编号（语义化版本，首版 1.0.0），tag `<卡>/vX.Y.Z`，各卡 `CHANGELOG.md`，根目录 `versions.json` 记版本、日期和文件 sha256。导入时读 `versions.json` 并核对文件，网页上按 S-1 的写法显示（1.0.0 → v1.0，1.1.1 → v1.1.1），版本目录名同显示名。front matter 里有 `repoVersion`、`tag`、`versionDate`。

## 下载文件

- HTML：`content/translations/system-cards/<卡>/<版本>/files/claude-<名>-system-card-zh.html.raw`，发布为同名 `.html`（`.html` 会被 Hugo 当成文章，所以存成 `.raw`；`layouts/_partials/syscards/files.html` 用 `resources.Copy` 发布）。网址里的文件名和官网英文版地址对应；下载时用译文仓库里的原文件名（`download` 属性）。
- PDF：Cloudflare Pages 单个文件不能超过 25 MiB。没超的原样复制；超过的（2026-10-30 导入时 6 份，27–44 MiB）由 `import.py` 的 `slim_pdf` **无损瘦身**：这些 PDF 里大部分图片都存了两份完全相同的副本，合并成一份，再按最高级别重新压缩 Flate 流。不重采样、不转 JPEG，每页渲染像素、文字层、书签、链接都和原文件相同（导入时逐页核对，见下）。瘦身后 14.6–22.9 MB。front matter 里记着原文件的大小和 sha256（`sourceBytes`、`sourceSha256`）。
  - 只合并图片和图片引用的调色板、色彩空间、蒙版：字体、表单、页面内容流哪怕字节相同，引用的资源也可能不同，合并会改变文字层（第一版就因此换掉了几页的隐藏文字，渲染一样但复制、搜索出来的字不同，逐页对比查出来的）。
  - 用户 2026-10-30 选的是「压缩 PDF 后放进博客」（接受画质略降）；实际做到了无损。
- **译者声明**（`tools/syscard-import/release.py`，导入时自动运行；用户 2026-10-31：PDF 头部要有译注、HTML 的译注要和网站一致，样式都同 S-1 的下载文件）。声明的文字就是网站卡片首页的完整声明（构建一次站点后取 `aside#notice`），所以各卡措辞一致、和网页相同：
  - HTML：顶部加 S-1 那样的「非官方 AI 译本」横幅（随页面滚动停在顶部，打印时不出现），标题下的「关于本译本」（译文仓库自带，各卡措辞不一）换成版本信息和完整声明，正文结尾再附一份；`<head>` 加 noindex（同 S-1）和声明框的样式（只用 `dl-`、`s1-notice` 类名，不碰原文样式）。加的每一段都包在 `<!-- sc-dl -->…<!-- /sc-dl -->` 里，去掉后与原文件去掉「关于本译本」逐字节相同（`test_import.py` 设 `SYSCARDS_SRC` 时核对）。
  - PDF：同 S-1 的 PDF：第一页是标题、版本信息、完整声明和目录（每章可点，跳到原版那一页；标出含另行翻译的章），最后一页再附声明；每页下面加 18pt 页边，印「非官方 AI 译本 v1.0 · 与 Anthropic 无关，译文一致性未经人工核对，以 Anthropic 英文原版为准 · 第 N / M 页」，原文页 612×792pt 的内容不动（页面变成 612×810pt）。声明页和页脚由 Chromium 打印（`tools/s1-import/pdf.cjs`，文字层的部首字符同 S-1 改回汉字），pikepdf 叠到原文页上；原文有书签的，最前面加一条「译者声明」。每份 PDF 多了约 0.4–1.3 MB，最大的 Opus 4.7 24.3 MiB，仍在 25 MiB 以内。
  - 处理前的文件大小和 sha256 记在 `downloads.<html|pdf>.source`；已经加过声明的版本不再处理，要重做先重新导入。像素基准（`reference.py`）取 PDF 第 N+1 页的原文部分，和原文件渲染逐像素相同。
- 每个文件的大小、sha256、有没有书签写在版本页 `<卡>/<版本>/_index.md` 的 `downloads` 里，测试逐个核对。

## 导入和更新

```bash
git -C ../anthropic-system-cards-zh pull            # 译文仓库，必须是已提交的干净状态
pip install -r tools/syscard-import/requirements.txt
python3 tools/syscard-import/import.py ../anthropic-system-cards-zh --date <发布日期> --check-links
SYSCARDS_SRC=../anthropic-system-cards-zh python3 -m unittest discover -s tools/syscard-import -v   # 含下载文件与原文件对比
```

`import.py` 整体重写 `content/translations/system-cards/` 下的 `_index.md`、`_index.en.md` 和每份卡的目录（卡片首页、版本页、每章的 `index.md`、`original.html`、`bg/`、`images/`），以及字体子集（正文不保留，说明文字改在模板或脚本里），最后运行 `release.py` 给下载文件加译者声明（会用 `build.sh` 构建一次站点）。每份卡的标题、日期、页数和声明用到的数字取自该卡 README 和 HTML 的 `<title>`；README 第一段或 2.2 节页码找不到时脚本报错停下，其余数字找不到就是 null，声明里那句不出现。顺序取自官网系统卡列表，列表里找不到某份卡时脚本报错停下。英文原版地址按官网规则 `https://www.anthropic.com/claude-<目录名，点换成横线>-system-card` 拼出，`--check-links` 联网逐个确认能打开。新增一份卡只要它在译文仓库里有自己的目录和 README，重新导入即可。

## 测试

- `tests/syscards.test.mjs`：构建结果（文件原样发布、大小/sha256、≤ 25 MiB、只发一份；HTML 首末的声明和卡片首页相同、noindex；没有仓库链接；栏目页是 PaperMod 文章条目、按官网顺序、只链卡片首页；卡片首页各部分的顺序同 S-1 首页、开始阅读最新版、目录（每章、页码、另行翻译标签）；所有卡声明的通用条目逐字相同、本卡条目与 facts 一致、版本页简短声明带特殊情况；章节页重排版没有漏掉的 `**` 和脚注记号、页码分隔和原版版式的页与本章页码一致、底图都发布、脚注链接有目标、上下章相连）和浏览器行为（Chromium/WebKit：电脑、手机、320 宽无横向滚动，手机章节页首屏有正文，**原版版式与 PDF 同一页按 8×8 像素块比对**，深色模式，Cloudflare 邮件混淆下无脚本错误）。
- 像素基准 `tests/fixtures/syscards/*.png`：`tools/syscard-import/reference.py` 用 PDF 按 96 dpi 渲染的 4 页（PDF 第 N+1 页去掉页脚的部分，即原版第 N 页）（封面、表格和图注、2.2 节译注、图表页）。换了 PDF 就重新生成，`test_import.py` 会检查基准是不是现在这份 PDF 渲染的。
- `tools/syscard-import/test_import.py`：瘦身只合并图片、渲染和文字层不变、可复现（合成 PDF）；README 解析、官网顺序解析；加粗和脚注的转换；仓库里每份卡的 weight、中英 front matter、版本号写法、文件大小/sha256/页数/书签、章节连续覆盖全部页、每章的原版页和底图、脚注引用；像素基准是最新的；加声明（合成 HTML；每份下载文件的声明页、页脚、目录链接）；设 `SYSCARDS_SRC` 时 HTML 去掉加的声明后逐字节、PDF 去掉首末声明页后逐页（像素、文字层、链接、书签）与原文件对比。
