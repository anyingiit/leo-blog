# Anthropic 系统卡中文译本

`/translations/system-cards/`（英文页 `/en/translations/system-cards/`）发布 GitHub 仓库 [anyingiit/anthropic-system-cards-zh](https://github.com/anyingiit/anthropic-system-cards-zh) 里的系统卡中文译本。译文由那个仓库维护，本站只发布、不改译文（和 S-1 译本一样：发现译文问题就记下来交给译文项目，改好后重新导入）。

## 页面

一个页面列出全部系统卡（`layouts/syscards/list.html`，按原版发布日期从新到旧），沿用 S-1 译本的声明框和权利行样式（`s1.css`），卡片列表的样式在 `assets/css/extended/syscards.css`：

- **译者声明**（`layouts/_partials/syscards/notice.html`）：非官方、翻译方式、2.2 节由译者另行翻译未经 Claude 审校、译文一致性未经人工核对、以官网英文原版为准、下架邮箱（`params.s1Contact`）、译文仓库和导入的提交。
- **每份卡一张卡片**：中文名、英文原名、原版发布日期、页数、这份卡 2.2 节的说明；链接：在线阅读、HTML 下载、PDF 下载、英文原版（Anthropic 官网）、翻译说明（译文仓库里该卡的 README，固定到导入的提交）。
- **在线阅读就是译文仓库的单文件 HTML，逐字节原样发布**（项目规则：提供的 HTML 原样提供），不套本站版面、不加统计脚本和图标。它自带浅色/深色样式、目录和 `text-size-adjust`。
- 英文页列同样的卡片，链接到中文译文和英文原版；文件只发布一份（`/translations/system-cards/files/`）。

## 下载文件

- HTML：`content/translations/system-cards/files/<目录名>.html.raw`，发布为 `files/<目录名>.html`（`.html` 会被 Hugo 当成文章，所以存成 `.raw`；`layouts/_partials/syscards/file.html` 用 `resources.Copy` 发布）。下载时用译文仓库里的原文件名（`download` 属性）。
- PDF：Cloudflare Pages 单个文件不能超过 25 MiB。没超的原样复制；超过的（2026-10-30 导入时 6 份，27–44 MiB）由 `import.py` 的 `slim_pdf` **无损瘦身**：这些 PDF 里大部分图片都存了两份完全相同的副本，合并成一份，再按最高级别重新压缩 Flate 流。不重采样、不转 JPEG，每页渲染像素、文字层、书签、链接都和原文件相同（导入时逐页核对，见下）。瘦身后 14.6–22.9 MB。front matter 里记着原文件的大小和 sha256（`sourceBytes`、`sourceSha256`）。
  - 只合并图片和图片引用的调色板、色彩空间、蒙版：字体、表单、页面内容流哪怕字节相同，引用的资源也可能不同，合并会改变文字层（第一版就因此换掉了几页的隐藏文字，渲染一样但复制、搜索出来的字不同，逐页对比查出来的）。
  - 用户 2026-10-30 选的是「压缩 PDF 后放进博客」（接受画质略降）；实际做到了无损。
- 每个文件的大小和 sha256 写在 `_index.md` 的 `cards` 里，测试逐个核对。

## 导入和更新

```bash
git -C ../anthropic-system-cards-zh pull            # 译文仓库，必须是已提交的干净状态
pip install -r tools/syscard-import/requirements.txt
python3 tools/syscard-import/import.py ../anthropic-system-cards-zh --date <发布日期> --check-links
SYSCARDS_SRC=../anthropic-system-cards-zh python3 -m unittest discover -s tools/syscard-import -v   # 含瘦身 PDF 与原文件逐页对比
```

`import.py` 整体重写 `content/translations/system-cards/` 下的 `_index.md`、`_index.en.md` 和 `files/`（正文不保留，说明文字改在模板或脚本里）。每份卡的标题、日期、页数、2.2 节说明取自该卡 README 第一段和「为什么 Claude 不翻译」一条、以及 HTML 的 `<title>`；README 写法变了脚本会报错停下。英文原版地址按官网规则 `https://www.anthropic.com/claude-<目录名，点换成横线>-system-card` 拼出，`--check-links` 联网逐个确认能打开。新增一份卡只要它在译文仓库里有自己的目录和 README，重新导入即可。

## 测试

- `tests/syscards.test.mjs`：构建结果（文件原样发布、大小/sha256、≤ 25 MiB、只发一份、链接齐全、声明、中英互链、栏目收录）和浏览器行为（Chromium/WebKit：电脑、手机、320 宽无横向滚动，深色模式，在线阅读新标签打开，Cloudflare 邮件混淆下无脚本错误）。
- `tools/syscard-import/test_import.py`：瘦身只合并图片、渲染和文字层不变、结果可复现（合成 PDF）；README 解析；仓库里每份卡的文件大小/sha256/页数、瘦身过的没有重复图片；设 `SYSCARDS_SRC` 时与原文件逐页对比。
