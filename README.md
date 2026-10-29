# Leoblog

Hugo + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 静态博客，部署在 Cloudflare Pages（push 到 `main` 即发布）。

CF Pages 构建命令为 `bash build.sh`：`main` 按 `hugo.yaml` 的 `baseURL` 生成，其他分支的预览构建改用 `$CF_PAGES_URL`，保证预览站内链接不跳回主站。

Hugo 版本只锁在 `build.sh` 的 `HUGO_VERSION`（当前 0.158.0，即 PaperMod 自己的 CI 所用版本）：CF Pages 和 CI 都跑 `build.sh`，版本不符时脚本会下载官方二进制并校验 sha256，CF 后台的 `HUGO_VERSION` 环境变量不起作用。升级时改该变量及同文件里的 sha256 即可。

<a id="getting-started"></a>

## 本地开发

```bash
git clone --recurse-submodules <repo>
hugo server -D        # 本地预览（含草稿）
hugo new posts/<slug>.md   # 长文，写完把 draft 改成 false 再 push
hugo new notes/<slug>.md   # 短文（随笔、感想）
```

长文和短文分开放：`content/posts/` 是整理过的长文，出现在首页、归档和上一篇/下一篇里；`content/notes/` 是随笔、感想这类短文，只在「短文」栏目（`/notes/`）里按时间线展开全文，单篇页不显示目录和阅读时长。两者共用标签、搜索和全站 RSS，`/notes/index.xml` 是只含短文的 RSS。

图片：带图的文章用文件夹形式（`content/notes/<slug>/index.md`，长文同理），图片放在同一个文件夹里，正文用相对路径引用。Typora 的 `./文件名.assets/图.png` 写法可以直接用：把 `.md` 改名为 `index.md`，和 `文件名.assets/` 一起放进 `<slug>/` 文件夹即可，不用改正文。构建时 jpg/png/webp 会缩成 480–1600px 的多档 WebP（原图不上线）并写上宽高、懒加载；点击图片打开图集，可左右切换。短文栏目里单张图最高 24rem，连续两张及以上的图在原位分组（手机上是方块网格，电脑上是等高行），超过一屏的短文先折叠。引用的图片找不到时构建会给出警告。这些都是自定义开发，回归测试见 [tests/README.md](tests/README.md)。

英文译文：在原文旁放同名 `<slug>.en.md`（slug 保持一致），发布在 `/en/posts/<slug>/`，并与中文版自动互链。含中文文字的配图要给英文页配英文版，原则见 [docs/image-translation.md](docs/image-translation.md)。

Markdown 扩展：`$...$` / `$$...$$` 数学公式（构建期 KaTeX）、` ```mermaid ` 图、`> [!NOTE]` 提示框。语法样例见 `content/posts/markdown-test/`（草稿，不发布）。

PR 预览：Cloudflare Pages 会为每个 PR 分支部署预览，`.github/workflows/pages-preview-comment.yml` 从 CF 的 check run 中取出预览链接，写进 PR 的一条固定评论（每次 push 原地更新）。

正文里的美元金额要写成 `\$30`：同一段里出现两个 `$` 时，中间的文字会被当成公式渲染。

测试：全部自定义测试都在 CI（`.github/workflows/ci.yml`）里运行，新加的测试文件没接进 CI 会直接让 CI 失败。清单、本地运行方法和覆盖范围见 [docs/testing.md](docs/testing.md)。

## 许可证

- 代码（配置、模板、脚本等）：[MIT](LICENSE)
- `content/` 下的文章：[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)
