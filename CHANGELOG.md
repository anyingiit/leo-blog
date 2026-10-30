<!-- Source: Keep a Changelog 1.1.0 (MIT) — https://keepachangelog.com/en/1.1.0/ -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project structure.
- 「短文」栏目（`content/notes/`，`/notes/`）：随笔、感想与长文分开，首页和归档只列长文。
- 「译文」栏目（`/translations/`）：Anthropic S-1 非官方中文译本全文 v1.0，原版版式 / 重排版切换、全屏阅读、历史版本，完整 HTML 和 PDF 直链下载（`tools/s1-import/`）。

### Changed

- S-1 译本发布 v1.1.1（译文仓库 anthropic-s1-zh v1.1.1：封面「抄送」栏和第 2 页标题在字体略宽的电脑上文字重叠，只改版式），v1.0、v1.1 保留为历史版本；新增 `tests/s1-overlap.test.mjs` 检查原版版式的文字重叠；版本表下载链接不再从中间断行。
- S-1 译本发布 v1.1（译文仓库 anthropic-s1-zh v1.1.0：依外部审校清单修订语义、术语、体例和版式），v1.0 保留为历史版本；导入脚本遇到内容变了的同名配图时加内容哈希另存。
- 《博客项目取得重大进展》移入短文，旧地址 `/posts/blog-project-progress/` 自动跳转。

### Fixed

- 短文图集灯箱：灯箱里有选区时（Ctrl/Cmd+A，或图片加载前在灯箱上拖出的），电脑上按住图片拖动变成浏览器原生的拖动选区，换图失效；现在灯箱里取消原生拖动。这也是「电脑上用鼠标拖动换图」测试偶发显示 1 / 12 的原因。新增回归测试「有选区时鼠标拖动图片照样换图」（Chromium、WebKit 各三种设备），以及「长短文靠近页尾时收起，滚到最底」。
- 主题截图测试偶发差几十个像素（点状下划线随绘制过程变化）：截图前让整页重新绘制一遍，并加回归测试 `tests/theme/repaint.spec.mjs`。

[Unreleased]: https://github.com/anyingiit/leo-blog/commits/main
