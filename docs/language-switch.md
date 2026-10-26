# 页头语言切换

## 问题

PaperMod 原版的页头语言切换（`themes/PaperMod/layouts/_partials/header.html`）遍历的是 `site.Home.Translations`，也就是**首页**的各语言版本，所以无论在哪一页点「En」/「中」，都会跳到另一种语言的首页。这是主题的默认行为，不是本站配置的问题。文章元信息里的「语言: En」（`translation_list.html`）用的是当前页的 `.Translations`，所以那里一直是对的。

## 现在的规则

页头切换链接由 `layouts/_partials/lang_switch_url.html` 计算：

1. 当前页有目标语言版本（同名 `.en.md`，Hugo 自动互链）→ 去那一页。文章、短文、栏目、归档、搜索、标签总览、两种语言同名的标签（如 `AI`）都属于这种。
2. 没有 → 沿 `.Ancestors` 往上找最近一个有目标语言版本的页面：
   - 没有英文版的短文/长文 → 英文的 `/en/notes/` 或 `/en/posts/`；
   - 译名不同的标签（`随笔` ↔ `Notes`、`博客开发` ↔ `Blog Development` 等，Hugo 视为不同的标签）→ 对方语言的标签总览 `/tags/`、`/en/tags/`。
3. 404 页 → 对方语言首页。
4. 以上都找不到时退回对方语言首页（PaperMod 原来的行为）。

## 对主题的改动

`layouts/_partials/header.html` 是 PaperMod 原文件的拷贝，第一行加了说明注释，另外只把语言切换的

```
<a href="{{- .Permalink -}}" title=
```

换成

```
<a href="{{- partial "lang_switch_url.html" (dict "page" $ "lang" .Lang "fallback" .Permalink) -}}" title=
```

**升级 PaperMod 后**：重新把主题的 `header.html` 拷过来，保留第一行注释，重做上面这一处替换。`tests/lang-switch.test.mjs` 的第一个测试会逐字比较两者，主题的页头有任何变化而这里没跟上时都会失败。

## 测试

`tests/lang-switch.test.mjs`（CI 的 Regression tests 任务，`npm test` 一起运行）：

- 主题拷贝与原版只差这一处；
- 各类页面的期望去向（长文、短文、带图短文、没有英文版的短文、栏目、归档、搜索、标签总览、同名标签、译名不同的标签、404，中→英和英→中）；
- 遍历构建出的所有页面：有 `hreflang` 对应版本时必须切到它；没有时必须去一个存在的、对方语言的上级页面，不允许退回首页（首页和 404 除外）；
- 真实点击：Chromium（Chrome）和 WebKit（Safari 引擎）× 电脑、手机视口，在文章里点「En」到英文文章，再点「中」回到中文文章。本地没装 WebKit 时只跳过 WebKit 的两项，CI 里必须运行。

反向验证：删掉 `header.html` 覆盖（恢复主题原行为）会让 18 项失败；去掉"沿上级查找"会让 4 项失败；主题的 `header.html` 有改动时第一项失败。
