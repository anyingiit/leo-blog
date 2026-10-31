# 网站图标

2026-10-29 选定的方案 F：PaperMod 默认主题色 `#2e2e33` 的深色圆角方块，中间一个白色粗体 L，方块内侧有一圈 1 像素的灰边（`#55555a`）。设计过程、其他方案和评审意见见[方案报告](https://claude.ai/artifact/9miXYQ1brraMEmVqLAa74t)。

## 文件

PaperMod 的 `head.html` 默认会输出下面 5 个链接，文件名用主题默认的，放在 `static/`，不改模板。`hugo.yaml` 的 `params.assets.favicon*` 只给地址加上版本号 `?v=<文件 sha256 前 8 位>`（见下面「缓存」）：

| 文件 | 用途 |
| --- | --- |
| `favicon.ico` | 16/32/48 三档，每档直接嵌入 PNG |
| `favicon-16x16.png`、`favicon-32x32.png` | 浏览器标签，普通屏和高分屏 |
| `apple-touch-icon.png` | 180×180，iPhone 主屏和 Safari 个人收藏。满版不透明方形，不带圆角和灰边，由 iOS 自己切圆角 |
| `safari-pinned-tab.svg` | 旧版 Safari 的固定标签，单色剪影。新版已经不用，但主题总会输出这个链接，不放会 404 |

另外生成站点默认分享图 `share.png`（1200×630，满版主题色底、L 原大小放在正中，不透明），由 `hugo.yaml` 的 `params.images` 引用，用法见 [seo.md](seo.md)。

所有页面都用 PaperMod 的同一个 `<head>`，包括 S-1 和双语译文。可下载的完整 HTML 用的是独立模板，不带图标链接，文件保持原样。

## 设计要点

- 画布 512 单位，16px 下每像素 32 单位。L 的竖笔是第 5–7 列，横笔是第 10–12 行，都落在整像素上，小尺寸下不发虚。
- 灰边是为了让方块在 Chrome 深色标签栏（约 `#35363a`）和深色壁纸上也能看出轮廓。只用主题色的话，方块会和背景融在一起。

## 缓存

浏览器（尤其 Safari）按图标地址把图标长期存在本地，地址不变就一直用存下来的，不会因为服务器上的文件变了就去取新的。2026-10-29 刚加图标时地址没有版本号，之前访问过正式站的浏览器存的是「这个站没有图标」，于是一直不显示新图标；预览站是新域名，没有旧记录，所以显示正常（2026-10-31 查明，服务器上的文件和仓库逐字节一致）。

所以图标地址带文件内容的版本号：图标一改，地址就变，所有浏览器都会去取新的。`tests/site.test.mjs` 会检查每个页面的图标地址都带着当前文件的版本号，改了图标忘了改 `hugo.yaml` 会失败并给出新值。

已经添加到 iPhone 主屏或 Safari 个人收藏里的图标是添加时存下的，换地址也不会自动更新，需要删掉重新添加。

## 修改

改 `tools/favicon/build.mjs` 里的常量或路径，然后重新生成，再把 `hugo.yaml` 里对应的 `?v=` 改成新文件 sha256 的前 8 位（`sha256sum static/<文件> | cut -c1-8`）：

```bash
cd tests && npm ci
node ../tools/favicon/build.mjs   # 写入 static/
npm test -- favicon.test.mjs
```

`tests/favicon.test.mjs` 会检查提交的文件和脚本输出逐像素一致，并按上面的设计逐像素检查 16px 图标。改了设计就要同步改这些断言。另外 `tests/theme/__snapshots__/output/site-files.txt` 里列着这 5 个文件，增删文件要一起更新。
