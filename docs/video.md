# 文章里的视频

视频和图片一样放进文章文件夹（page bundle，或 Typora 的 `X.assets/`），用图片的写法插入：

```markdown
![视频说明](片名.mp4)
```

`layouts/_markup/render-image.html` 遇到视频文件（mp4/webm）就输出 `<video>`：

- 带播放控件，`preload="metadata"` 只先取时长等元数据，读者点播放才下载正文；`playsinline` 让 iPhone 在页面里播放，不强制全屏。
- **封面**：同一文件夹里同名的 jpg/jpeg/png/webp（`片名.jpg`）。构建时缩成 WebP（最宽 1600px），并用它的宽高写上 `width`/`height`/`--ar`，视频加载前就占好位置，页面不会跳。没有封面也能播放，但构建会给出警告。原封面图不发布。
- 方括号里的说明是视频的无障碍名称（`aria-label`），浏览器不支持视频时显示为下载链接。
- 尺寸（`assets/css/extended/custom.css`）：单篇页铺满正文宽度、最高 80vh（竖屏视频不会超过一屏）；短文栏目里和图片一样最高 24rem。视频不进图片分组和点击放大的图集。
- 中英文页共用同一个视频文件，只发布一份。视频里如果有中文字幕或画面文字，英文页按 [image-translation.md](image-translation.md) 的原则判断：有英文版就引用英文版，没有就在英文正文里用文字交代视频内容。

## 发布前压缩

视频原样发布，所以要先压好：

- **Cloudflare Pages 单个文件最大 25 MiB**，超过会让整站部署失败。
- **编码用 H.264 + AAC 的 MP4**：Chrome、Safari（含 iPhone）都能直接播放。HEVC/AV1 在部分浏览器上放不了。
- **moov 放在文件开头**（`-movflags +faststart`）：浏览器拿到开头就能开始播放和拖动，不用等整个文件下完。

常用命令（按 25 MiB 以内反推码率；画面以讲解/幻灯片为主时 720p 足够）：

```bash
# 时长（秒）
ffprobe -v error -show_entries format=duration -of csv=p=0 in.mp4
# 视频码率 ≈ 23 MiB × 8 / 时长 − 音频 64k，两遍编码精确控制体积
ffmpeg -y -i in.mp4 -vf "scale=-2:'min(720,ih)'" -c:v libx264 -preset slow -b:v <码率>k -pass 1 -an -f mp4 /dev/null
ffmpeg -y -i in.mp4 -vf "scale=-2:'min(720,ih)'" -c:v libx264 -preset slow -b:v <码率>k -pass 2 \
  -pix_fmt yuv420p -c:a aac -b:a 64k -ac 1 -movflags +faststart out.mp4
# 封面：取一帧有代表性的画面
ffmpeg -y -ss 3 -i out.mp4 -frames:v 1 -q:v 3 out.jpg
```

压到 25 MiB 以内画质仍不能接受（很长的视频）时，就不要放进仓库，改为上传到视频平台再链接或嵌入。

## 测试

- `tests/build.test.mjs`：`tests/fixtures/content/notes/video-note/` 的输出（`<video>` 属性、封面 WebP 和占位宽高、Typora `.assets`、没有封面时的警告、不进分组、中英文共用一个文件），以及构建结果里没有超过 25 MiB 的文件。
- `tests/browser.test.mjs`：手机和电脑视口下视频按封面宽高比占位、短文栏目最高 24rem、单篇页最高 80vh、不横向滚动、点视频不打开图集。
- `tests/site.test.mjs`：`content/` 里每个 mp4 都是 H.264、moov 在前、不超过 25 MiB。
