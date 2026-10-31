# 短片

短片是用 Claude 做的自包含 HTML 动画（例如《谁在控制 Anthropic》：SVG 画面 + 逐句配音）。它们原样放进博客，不需要特殊格式；博客负责播放器所在的文章、封面、可下载的 MP4 和深浅色。短片是原创的，需要时可以为博客调整（例如手机上的控制条）。

## 放进一部短片

1. **短片文件**：把短片目录整个放到 `assets/films/<名字>/`。`index.html` 是入口，它引用的配音、图片等按原来的相对路径放在同一目录里。再放一张 `poster.png`（或 `.jpg`）当封面，16:9，建议 1600×900；短片有英文版时再放一张 `poster.en.png`，英文页用它。可下载的视频放 `video.mp4`（默认语言）和 `video.en.mp4`，做法见下文「MP4」。
2. **短片的文章**：一部短片有一篇自己的文章，放在短文下的次级栏目「短片」里（`content/notes/films/<slug>/index.md` 和 `index.en.md`，地址仍是 `/notes/<slug>/`），看片和读文字稿都在这一篇里。front matter 加：

   ```yaml
   film: <名字>         # 这篇就是这部短片的文章
   minutes: 14          # 片长，显示在章节目录和时间线的封面上
   filmLang: zh         # 短片本身的语言；页面语言不同时，播放地址带 ?lang=<页面语言>
   ```

   正文依次是：一段导语（也是时间线里显示的摘要，不要写「下面的」），`<!--more-->`，`{{< film name="<名字>" >}}`（宽幅播放器、章节目录、MP4 下载），来源和免责声明，然后是完整文字稿（`## 文字稿 {#transcript}` 下按章节 `###`，章节顺序和短片一致；英文页写 `## Transcript {#transcript}`）。英文页翻译文字稿，这样不懂中文的读者也能读懂短片。`minutes` 两种语言可以不同（英文配音通常更长）。

## 英文版和配音

英文页的播放地址带 `?lang=en`。短片自己读这个参数，换成英文画面、字幕和配音；不认这个参数的短片照常放原版，文字稿仍是英文。《谁在控制 Anthropic》的做法：画面文字过一张中英对照表（`EN`，太长的条目带缩放系数），字幕换成英文，配音从 `narration/en/` 读，每句时长按各自的配音文件。

配音用语音合成时，**直接放引擎输出的文件，不要再压缩**（例如 edge-tts 的 24 kHz MP3），转码只会更差。整部短片的配音几 MB，远低于单个文件 25 MiB 的上限。

## 读者看到的

- **短片的文章**：标题、导语，然后是宽幅播放器：跳出 720px 正文栏，和 S-1 原版版式同一个上限 1240px，整个播放器（画面 + 字幕和控制条）放得进一屏；矮窗口（手机横屏）铺满宽度。画好之前显示封面；开播前画面上有一个浅色的大播放键（放在开场画面下方的空白处），点它开播并把整个播放器连同控制条滚进屏幕。下面是展开的章节目录（PaperMod 文章目录的样子，标题旁写片长），每章右边是开始时间和「从这里播放」（▶），点章名跳到文字稿里那一章。再往下是 MP4 下载卡片（同 S-1 的下载卡片，直链），然后是来源和文字稿。页面上没有另外的「播放」「全屏」按钮：短片自己的控制条已经有了，同一件事只出现一次。
- **全屏**：只有短片控制条上的「全屏」。浏览器能让元素全屏时（电脑、安卓）是浏览器全屏；不能时（iPhone）短片发 `film:fullscreen`，博客把同一个播放器铺满窗口（不重新加载，进度不丢），顶上一条和画面同色的细栏写着标题和「✕ 退出」。「退出」、返回键、Esc 都回到原来的滚动位置。
- **没有脚本时**：播放器位置显示封面，大播放键和「从这里播放」不出现（按了也没用），下载照常可用。
- **短文时间线和「短片」栏目**（`/notes/`、`/notes/films/`，同一个模板 `layouts/notes/list.html`）：短片的文章只显示导语和封面，封面链接到文章，左下角写着「▶ 短片 · 约 14 分钟」；播放器和文字稿只在文章页。短文的 RSS 也收录次级栏目里的文章（`layouts/notes/rss.xml`）。

## MP4

给想离线看、转发或在别处播放的读者。从 HTML 短片录出来，画面和网页里一样，配音就是短片用的配音文件：

1. 用 Playwright 在 1920×1080 打开 `index.html?embed=fit`（`&lang=en` 出英文版），隐藏控制条和进度条，字幕放大到 30px，关掉旁白（短片按配音时长静音走），点播放，用 CDP 的 `Page.startScreencast` 存下每一帧和时间戳；
2. 音轨：每句的配音补静音到「配音时长 + 550ms」（和短片的节奏一样，见短片里的 `AUD`、`GAP`），按顺序接起来；
3. ffmpeg 按时间戳拼帧（concat，每帧时长 = 到下一帧的间隔），H.264（`-tune animation -crf 26`，30fps）+ AAC 单声道 64 kbps（配音原文件是 24 kHz 单声道 48 kbps 的 MP3，64 kbps 的 AAC 听不出差别），`-movflags +faststart`。

每个文件不超过 Cloudflare Pages 的 25 MiB（`tests/film.test.mjs` 检查）。14 分钟的短片约 19 MB。改了短片的画面或配音要重新录。

## 博客和短片之间的约定

短片在**沙箱 iframe** 里运行（`sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-presentation"`，没有 `allow-same-origin`），和博客不同源，碰不到博客的页面和存储。构建时 `layouts/_partials/film.html` 只在 `index.html` 的 `<head>` 开头插入三样东西，其余一字不改：

- `<meta name="robots" content="noindex">` 和指向短片文章的 canonical：搜索引擎收录文章，不收录裸播放器；
- `html{-webkit-text-size-adjust:100%;text-size-adjust:100%}`：关掉 iOS 的文字自动放大。短片按窗口缩小显示时，iPhone（Safari 和 X、微信等应用内浏览器）会把小字放大，排好的画面互相重叠；
- 桥接脚本 `assets/js/film-bridge.js`，经 postMessage 交换：
  - 博客 → 短片：`{type:"film:theme", theme}`，设到短片的 `<html data-theme>`；
  - 博客 → 短片：`{type:"film:embed", embed}`，博客把播放器铺满窗口（`fit`）或还原（`page`）时改短片的 `<html data-embed>`；
  - 短片 → 博客：`film:ready`、`film:size`（`<html>` 的高度，文章里的播放器据此撑开）、`film:escape`（短片里按了 Esc）。
  - 短片自己可以再发（可选）：`film:progress`（`cue`：当前第几句）、`film:ended`（放完了）、`film:playing`（真的开播了，有配音时等声音出来再发；博客收起画面上的大播放按钮）、`film:blocked`（浏览器不让出声，见下文；博客同样收起大按钮）、`film:chapters`（`starts`：每章开始的秒数，标在章节目录上）、`film:fullscreen`（浏览器不能让元素全屏时，请博客把播放器铺满窗口或还原）。
  - 博客 → 短片（可选）：`film:play`（开播）、`film:seek`（`chapter`：从第几章放）。

手机上要注意的几件事（真实短片的测试会检查）：

- iOS 不让跨源 iframe 在读者点它之前出声，博客发来的 `film:play` 会被拒。短片要接住 `play()` 的 `NotAllowedError`：停在原处，在画面上放一个盖住整个画面的播放按钮，读者在短片里点一下就能放，并发 `film:blocked`。
- iPhone 没有元素全屏（只有视频能全屏）。`document.fullscreenEnabled` 为假时，嵌在博客里的短片照样显示「全屏」，点了发 `film:fullscreen`，由博客铺满窗口；单独打开（不在 iframe 里）时不显示。
- 手机竖屏上控制按钮要排成一行（`tests/film.test.mjs` 查 375 和 390 宽、中英文）：窄屏时「上一句」「下一句」只留箭头（`aria-label` 写全），按钮间距收小。
- 触屏上（`pointer: coarse`）控制按钮不小于 44px；悬停样式放进 `@media (hover: hover)`，否则点过之后一直停在悬停样式。
- 短片的计时不能只靠 `requestAnimationFrame`：播放器滚出视线、标签页在后台时浏览器不给动画帧，配音会停。用定时器或音频的 `ended` 事件推进。
- 地址带 `?embed=page`（文章里的播放器）时，桥接脚本给 `<html>` 加 `data-embed="page"`；铺满窗口时博客经 `film:embed` 改成 `fit`。

短片**可以不理会**这些约定，照样能放映：不认 `data-theme` 就按系统深浅色，不认 `data-embed` 就显示完整页面（全窗口里可以滚动）。认了效果更好，做法是在短片的样式里加几行：

```css
/* 嵌进博客时只留播放器；标题、章节、文字稿由博客页面提供 */
[data-embed] header, [data-embed] footer { display: none; }
/* 铺满窗口时（iPhone 上的「全屏」），播放器占满窗口，画面占去控制条以外的全部高度 */
[data-embed="fit"] .player { height: 100dvh; display: flex; flex-direction: column; }
[data-embed="fit"] .stage { flex: 1; min-height: 0; }
```

## 短片必须满足的（`tests/film.test.mjs`、`tests/mobile.test.mjs` 检查）

- 不引用外部样式和脚本（例如 Google Fonts、CDN）：字体服务连不上时整页会白屏十几秒。用系统字体，或者把字体文件放进短片目录。
- 引用的本地文件都存在；有 `poster.png/jpg`；有中英文的短片文章。
- 不直接访问博客页面（`window.parent`、`top.location`）。
- 单个文件不超过 Cloudflare Pages 的 25 MiB 上限（`tests/build.test.mjs` 检查整站）。
- 原版不是英文的短片，在英文页放映时画面、字幕、按钮里没有中文，配音从英文文件加载；有 `poster.en.*` 时英文页用它。

短片是原创的，可以为博客调整，但改动要有理由：上面几条、让 `data-embed`、`data-theme` 生效的样式、手机上的控制条、英文版。
