# Leoblog

Hugo + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 静态博客，部署在 Cloudflare Pages（push 到 `main` 即发布）。

CF Pages 构建命令为 `bash build.sh`：`main` 按 `hugo.yaml` 的 `baseURL` 生成，其他分支的预览构建改用 `$CF_PAGES_URL`，保证预览站内链接不跳回主站。

Hugo 版本只锁在 `build.sh` 的 `HUGO_VERSION`（当前 0.151.0）：CF Pages 和 CI 都跑 `build.sh`，版本不符时脚本会下载官方二进制并校验 sha256，CF 后台的 `HUGO_VERSION` 环境变量不起作用。升级时改该变量及同文件里的 sha256 即可。

<a id="getting-started"></a>

## 本地开发

```bash
git clone --recurse-submodules <repo>
hugo server -D        # 本地预览（含草稿）
hugo new posts/<slug>.md   # 长文，写完把 draft 改成 false 再 push
hugo new notes/<slug>.md   # 短文（随笔、感想）
```

长文和短文分开放：`content/posts/` 是整理过的长文，出现在首页、归档和上一篇/下一篇里；`content/notes/` 是随笔、感想这类短文，只在「短文」栏目（`/notes/`）里按时间线展开全文，单篇页不显示目录和阅读时长。两者共用标签、搜索和全站 RSS，`/notes/index.xml` 是只含短文的 RSS。

英文译文：在原文旁放同名 `<slug>.en.md`（slug 保持一致），发布在 `/en/posts/<slug>/`，并与中文版自动互链。含中文文字的配图要给英文页配英文版，原则见 [docs/image-translation.md](docs/image-translation.md)。

Markdown 扩展：`$...$` / `$$...$$` 数学公式（构建期 KaTeX）、` ```mermaid ` 图、`> [!NOTE]` 提示框。语法样例见 `content/posts/markdown-test/`（草稿，不发布）。

PR 预览：Cloudflare Pages 会为每个 PR 分支部署预览，`.github/workflows/pages-preview-comment.yml` 从 CF 的 check run 中取出预览链接，写进 PR 的一条固定评论（每次 push 原地更新）。

## 许可证

- 代码（配置、模板、脚本等）：[MIT](LICENSE)
- `content/` 下的文章：[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)
