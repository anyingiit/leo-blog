# 测试用字体

`tests/s1-overlap.test.mjs` 检查 S-1 原版版式的文字重叠。结果取决于字宽，所以测试不用机器上装的字体，
而是把页面用到的每个字体名都换成这里的文件，本地和 CI 结果一致。都是 SIL Open Font License 1.1。

| 页面里的字体 | 换成 | 来源 |
| --- | --- | --- |
| Georgia | `gelasio/`：Gelasio（字宽与 Georgia 相同） | npm `@fontsource/gelasio@5.3.0` 的 latin 子集 |
| Times New Roman | `liberation/LiberationSerif-*`（字宽与 Times New Roman 相同） | Ubuntu noble `fonts-liberation2`，取拉丁字符子集 |
| Helvetica | `liberation/LiberationSans-*`（字宽与 Arial/Helvetica 相同） | 同上 |
| 宋体类（Songti SC、STSong、Noto Serif CJK SC 等） | `noto-cjk/NotoSerifCJK-*-s1.woff2` | Ubuntu noble `fonts-noto-cjk` 1:20230817，按 `noto-cjk/chars.txt` 取子集 |
| 黑体类（PingFang SC、Noto Sans CJK SC 等） | `noto-cjk/NotoSansCJK-*-s1.woff2` | 同上 |

`noto-cjk/chars.txt` 是 S-1 v1.1.1 冻结 HTML 里出现的全部字符。新版本出现新字符时测试会提示，按下面重新生成：

```bash
pip install fonttools brotli   # 另需 apt install fonts-noto-cjk
for f in SerifCJK-Regular SerifCJK-Bold SansCJK-Regular SansCJK-Bold; do
  pyftsubset /usr/share/fonts/opentype/noto/Noto$f.ttc --font-number=2 --text-file=noto-cjk/chars.txt \
    --flavor=woff2 --layout-features='*' --output-file=noto-cjk/Noto$f-s1.woff2
done
```
