# 搜索引擎（SEO）

2026-10-29 做过一次整站评估（报告在项目文件 `seo-audit/report.md`），按用户要求修了问题 1、2、4、5、7；问题 3（网站图标）另做，问题 6（S-1 长章节性能）暂时搁置。这里记录现在的约定，回归测试是 `tests/seo.test.mjs`。

## 站点地图和 robots

- 站点地图用 Hugo 自带模板的原样拷贝 `layouts/sitemap.xml`，末尾补上 S-1 译本**最新版本**的版本页和章节。它们在导入时设了 `build.list: local`（不进首页、RSS、站内搜索），自带模板会漏掉。
- S-1 的**历史版本** noindex：和最新版几乎相同，避免重复收录；页面照常可以访问。做法是在译本首页 `content/translations/anthropic-s1/_index.md` 的 `cascade` 里给历史版本目录设 `robotsNoIndex`。
- **发布 S-1 新版本时**：改 `latest` 的同时，把原来的最新版加进这个 `cascade` 的 `target.path`。忘了的话 `tests/seo.test.mjs` 会失败。
- 规则由测试兜底：要求收录（`index, follow`）的页面都必须在站点地图里，站点地图里的页面都必须要求收录。

## 搜索摘要（description）

- PaperMod 的 `<meta name=description>` 先用 `description`，没有就用 `summary`（自动截取正文开头）。
- 文章页 PaperMod 会把 `description` 显示在标题下面，所以只想改搜索摘要、不想改页面时写 `summary`。正文以图片或图注开头的短文要写 `summary`，否则摘要会截到图注。中英文同步。
- 栏目页的 `description` 只放纯文字。`/notes/` 带链接的那半句写在 `_index.md` 正文里，`layouts/notes/list.html` 把它接在 `description` 后面显示，页面和以前完全一样。

## 作者

`hugo.yaml` 的 `params.author`（Leo）写进 `<meta name=author>` 和文章的结构化数据。长文、短文、S-1 译本用 `hideAuthor` 让日期那一行照旧不显示作者；双语译文写了原作者的 `author`，原样显示。

## 分享图

有配图的文章在 front matter 写 `images: [配图文件名]`（英文页写英文图），PaperMod 就会输出 `og:image`、`twitter:image` 和大图卡片。站点级默认分享图（`params.images`）等网站图标定下来再加。
