# 短片

短片是用 Claude 做的自包含 HTML 动画（例如《Anthropic 的钱与权》：SVG 画面 + 逐句配音）。它们原样放进博客，不需要特殊格式；博客负责封面、放映窗口、短片页和深浅色。

## 放进一部短片

1. **短片文件**：把短片目录整个放到 `assets/films/<名字>/`。`index.html` 是入口，它引用的配音、图片等按原来的相对路径放在同一目录里。再放一张 `poster.png`（或 `.jpg`）当封面，16:9，建议 1600×900；短片有英文版时再放一张 `poster.en.png`，英文页用它。
2. **短片页**：`content/films/<名字>/index.md` 和 `index.en.md`，地址是 `/films/<名字>/`（英文 `/en/films/<名字>/`）。front matter：

   ```yaml
   title: "Anthropic 的钱与权"
   date: 2026-10-27T12:00:00Z
   minutes: 13          # 片长，显示在封面卡片和短片页上
   filmLang: zh         # 短片本身的语言；页面语言不同时，播放地址带 ?lang=<页面语言>
   ShowReadingTime: false
   ShowWordCount: false
   description: "一句话简介"
   ```

   正文写导语、来源和完整文字稿（`## 文字稿 {#transcript}` 下按章节 `###`；英文页写 `## Transcript {#transcript}`，正文里的「阅读文字稿」按钮链到这个锚点）。英文页翻译文字稿，这样不懂中文的读者也能读懂短片。`minutes` 两种语言可以不同（英文配音通常更长）。
3. **在文章里引用**：`{{< film name="<名字>" >}}`。显示为和博客一致的封面卡片（封面、标题、时长），下面一排两个按钮：实心的「播放短片」和描边的「阅读文字稿」。

## 英文版和配音

英文页的播放地址带 `?lang=en`。短片自己读这个参数，换成英文画面、字幕和配音；不认这个参数的短片照常放原版，文字稿仍是英文。《Anthropic 的钱与权》的做法：画面文字过一张中英对照表（`EN`，太长的条目带缩放系数），字幕换成英文，配音从 `narration/en/` 读，每句时长按各自的配音文件。

配音用语音合成时，**直接放引擎输出的文件，不要再压缩**（例如 edge-tts 的 24 kHz MP3），转码只会更差。整部短片的配音几 MB，远低于单个文件 25 MiB 的上限。

## 读者看到的

- **正文里**：先是文章自己的简介，然后是封面卡片，再下面是两个按钮。「播放短片」和封面做同一件事：有脚本时在全窗口对话框里放映，没有脚本（包括 RSS 阅读器）时就是指向短片页的普通链接；Ctrl/⌘/Shift 点击、中键照常在新标签打开短片页。「阅读文字稿」直接到短片页的文字稿。封面不进 Tab 顺序，键盘只停在两个按钮上。读者已经点过播放，所以对话框带 `?autoplay=1` 打开，焦点交给画面，空格和方向键直接可用；短片加载完之前先显示封面；放映时后面的文章不滚动。博客记住看到第几句（sessionStorage），再打开时带 `?at=` 接着放；放完显示「重看」「文字稿」。返回键、Esc、关闭按钮都关掉对话框、留在原文原处，焦点回到「播放短片」；关闭时移除短片，声音随之停止；每次放映都换一个新的 iframe，返回键始终按一下就关。对话框顶栏是和画面一样的深色，右侧的「文字稿」去短片页的文字稿，并顶替掉对话框那条历史记录，从短片页按返回直接回到原文。
- **短片页**有博客的页头页尾，宽幅播放器（最宽 1000px，比正文宽），播放器下面一个「文字稿 ↓」链接，再往下是导语和文字稿。短片页不进全站 RSS（订阅里已经有引用它的文章），站内搜索和站点地图照常收录。

## 博客和短片之间的约定

短片在**沙箱 iframe** 里运行（`sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-presentation"`，没有 `allow-same-origin`），和博客不同源，碰不到博客的页面和存储。构建时 `layouts/_partials/film.html` 只在 `index.html` 的 `<head>` 开头插入三样东西，其余一字不改：

- `<meta name="robots" content="noindex">` 和指向短片页的 canonical：搜索引擎收录短片页，不收录裸播放器；
- 桥接脚本 `assets/js/film-bridge.js`，经 postMessage 交换：
  - 博客 → 短片：`{type:"film:theme", theme}`，设到短片的 `<html data-theme>`；
  - 短片 → 博客：`film:ready`、`film:size`（`<html>` 的高度，短片页据此撑开播放器）、`film:escape`（短片里按了 Esc）。
  - 短片自己可以再发（可选）：`film:progress`（`cue`：当前第几句）、`film:ended`（放完了）。
- 博客打开短片时可能带 `?autoplay=1`（直接开播；浏览器不允许出声时短片应停在暂停状态，不要静音空跑）和 `?at=<句号>`（从第几句开始）。
- 短片的计时不能只靠 `requestAnimationFrame`：播放器滚出视线、标签页在后台时浏览器不给动画帧，配音会停。用定时器或音频的 `ended` 事件推进。
- 地址带 `?embed=fit`（全窗口放映）或 `?embed=page`（短片页）时，桥接脚本给 `<html>` 加 `data-embed="fit|page"`。

短片**可以不理会**这些约定，照样能放映：不认 `data-theme` 就按系统深浅色，不认 `data-embed` 就显示完整页面（全窗口里可以滚动）。认了效果更好，做法是在短片的样式里加几行：

```css
/* 嵌进博客时只留播放器；标题、章节、文字稿由博客页面提供 */
[data-embed] header, [data-embed] footer { display: none; }
/* 全窗口放映时，播放器铺满窗口，画面占去控制条以外的全部高度 */
[data-embed="fit"] .player { height: 100dvh; display: flex; flex-direction: column; }
[data-embed="fit"] .stage { flex: 1; min-height: 0; }
```

## 短片必须满足的（`tests/film.test.mjs` 检查）

- 不引用外部样式和脚本（例如 Google Fonts、CDN）：字体服务连不上时整页会白屏十几秒。用系统字体，或者把字体文件放进短片目录。
- 引用的本地文件都存在；有 `poster.png/jpg`；有中英文短片页。
- 不直接访问博客页面（`window.parent`、`top.location`）。
- 单个文件不超过 Cloudflare Pages 的 25 MiB 上限（`tests/build.test.mjs` 检查整站）。
- 手机横屏全窗口放映时画面占屏幕一半以上，控制条在屏幕内。
- 原版不是英文的短片，在英文页放映时画面、字幕、按钮里没有中文，配音从英文文件加载；有 `poster.en.*` 时英文页用它。

改动短片时只做必要的修改：上面几条，让 `data-embed`、`data-theme` 生效的几行样式，以及英文版。
