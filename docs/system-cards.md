# Anthropic 系统卡中文译本

`/translations/system-cards/`（英文页 `/en/translations/system-cards/`）发布译文仓库 anyingiit/anthropic-system-cards-zh 里的系统卡中文译本。**译文仓库不公开**（用户 2026-10-30），页面上不放仓库链接、不引用仓库里的文件。译文由那个仓库维护，本站只发布、不改译文（和 S-1 译本一样：发现译文问题就记下来交给译文项目，改好后重新导入）。

## 页面

和 S-1 译本同一套样式（`s1.css` 的声明框、版本表、在线阅读按钮、下载卡片、权利行），`assets/css/extended/syscards.css` 只放不同的地方：

- **栏目页**（`layouts/syscards/list.html`）：总的译者声明，再是一张表（同 S-1 版本表）：系统卡、原版发布日期、页数、全文下载（HTML ↗ / PDF ↓）。**顺序和 Anthropic 官网系统卡列表（https://www.anthropic.com/system-cards）相同**（用户 2026-10-30），导入时取官网顺序写进 weight。手机上每份卡一段，页数列加「页」，下载列不隐藏（S-1 隐藏是因为版本页另有下载卡片；这里栏目页就是直接拿文件的地方）。
- **每份卡一个页面**（`layouts/syscards/single.html`，`/translations/system-cards/<目录名>/`）：面包屑回栏目、标题、这份卡的译者声明、「在线阅读」按钮和英文原版链接、HTML/PDF 下载卡片和 SHA-256、权利行。
- **译者声明**（`layouts/_partials/syscards/notice.html`）：所有卡同一套条目和措辞（同 S-1 的声明）——是什么（原名、日期、页数，非官方）、翻译方式（Claude Opus 5.5 多代理、两轮交叉审校、按章终审；人工没有检查一致性）、译者另行翻译的部分（2.2 节页码、零散段落及页码、另用的模型、合入的单元和图片数、Claude 未读未审、脚本只查格式和数字、未核实的数字）、版式（逐页对应、修复的问题数、段落空白、内部链接不可点、emoji/高亮差异）、原文链接和定稿日期、以英文原版为准、权利和下架邮箱。数字来自 front matter 的 `facts`，由导入脚本从译文仓库每份卡的翻译说明（README）里取；某项没有就整句不出现。只陈述事实，不教读者怎么读。
- **在线阅读就是译文仓库的单文件 HTML，逐字节原样发布**（项目规则：提供的 HTML 原样提供），不套本站版面、不加统计脚本和图标。它自带浅色/深色样式、目录和 `text-size-adjust`。
- 英文页结构相同，链接到同一份中文文件；文件只发布一份（在中文卡片页下的 `files/`）。

## 下载文件

- HTML：`content/translations/system-cards/<目录名>/files/claude-<名>-system-card-zh.html.raw`，发布为同名 `.html`（`.html` 会被 Hugo 当成文章，所以存成 `.raw`；`layouts/_partials/syscards/files.html` 用 `resources.Copy` 发布）。网址里的文件名和官网英文版地址对应；下载时用译文仓库里的原文件名（`download` 属性）。
- PDF：Cloudflare Pages 单个文件不能超过 25 MiB。没超的原样复制；超过的（2026-10-30 导入时 6 份，27–44 MiB）由 `import.py` 的 `slim_pdf` **无损瘦身**：这些 PDF 里大部分图片都存了两份完全相同的副本，合并成一份，再按最高级别重新压缩 Flate 流。不重采样、不转 JPEG，每页渲染像素、文字层、书签、链接都和原文件相同（导入时逐页核对，见下）。瘦身后 14.6–22.9 MB。front matter 里记着原文件的大小和 sha256（`sourceBytes`、`sourceSha256`）。
  - 只合并图片和图片引用的调色板、色彩空间、蒙版：字体、表单、页面内容流哪怕字节相同，引用的资源也可能不同，合并会改变文字层（第一版就因此换掉了几页的隐藏文字，渲染一样但复制、搜索出来的字不同，逐页对比查出来的）。
  - 用户 2026-10-30 选的是「压缩 PDF 后放进博客」（接受画质略降）；实际做到了无损。
- 每个文件的大小、sha256、有没有书签写在该卡 `index.md` 的 `downloads` 里，测试逐个核对。

## 导入和更新

```bash
git -C ../anthropic-system-cards-zh pull            # 译文仓库，必须是已提交的干净状态
pip install -r tools/syscard-import/requirements.txt
python3 tools/syscard-import/import.py ../anthropic-system-cards-zh --date <发布日期> --check-links
SYSCARDS_SRC=../anthropic-system-cards-zh python3 -m unittest discover -s tools/syscard-import -v   # 含瘦身 PDF 与原文件逐页对比
```

`import.py` 整体重写 `content/translations/system-cards/` 下的 `_index.md`、`_index.en.md` 和每份卡的目录（正文不保留，说明文字改在模板或脚本里）。每份卡的标题、日期、页数和声明用到的数字取自该卡 README 和 HTML 的 `<title>`；README 第一段或 2.2 节页码找不到时脚本报错停下，其余数字找不到就是 null，声明里那句不出现。顺序取自官网系统卡列表，列表里找不到某份卡时脚本报错停下。英文原版地址按官网规则 `https://www.anthropic.com/claude-<目录名，点换成横线>-system-card` 拼出，`--check-links` 联网逐个确认能打开。新增一份卡只要它在译文仓库里有自己的目录和 README，重新导入即可。

## 测试

- `tests/syscards.test.mjs`：构建结果（文件原样发布、大小/sha256、≤ 25 MiB、只发一份；栏目页按官网顺序、链接齐全；卡片页面包屑、在线阅读、下载、英文原版；每份卡的声明条目统一、数字与 facts 一致；没有 GitHub 链接；中英互链、栏目收录）和浏览器行为（Chromium/WebKit：电脑、手机、320 宽无横向滚动，手机上表格的页数和下载列，深色模式，在线阅读新标签打开，Cloudflare 邮件混淆下无脚本错误）。
- `tools/syscard-import/test_import.py`：瘦身只合并图片、渲染和文字层不变、结果可复现（合成 PDF）；README 解析（含 Opus 5.5 的不同写法）、官网顺序解析；仓库里每份卡的 weight、中英 front matter 一致、没有 GitHub 链接、文件大小/sha256/页数/书签、瘦身过的没有重复图片；设 `SYSCARDS_SRC` 时 HTML 逐字节、PDF 与原文件逐页对比。
