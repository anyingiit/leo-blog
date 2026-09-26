# Leoblog

Hugo + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 静态博客，部署在 Cloudflare Pages（push 到 `main` 即发布）。

CF Pages 构建命令为 `bash build.sh`：`main` 按 `hugo.yaml` 的 `baseURL` 生成，其他分支的预览构建改用 `$CF_PAGES_URL`，保证预览站内链接不跳回主站。

<a id="getting-started"></a>

## 本地开发

```bash
git clone --recurse-submodules <repo>
hugo server -D        # 本地预览（含草稿）
hugo new posts/<slug>.md   # 新文章，写完把 draft 改成 false 再 push
```

英文译文：在原文旁放同名 `<slug>.en.md`（slug 保持一致），发布在 `/en/posts/<slug>/`，并与中文版自动互链。

Markdown 扩展：`$...$` / `$$...$$` 数学公式（构建期 KaTeX）、` ```mermaid ` 图、`> [!NOTE]` 提示框。语法样例见 `content/posts/markdown-test/`（草稿，不发布）。

PR 预览：Cloudflare Pages 会为每个 PR 分支部署预览，`.github/workflows/pages-preview-comment.yml` 从 CF 的 check run 中取出预览链接，写进 PR 的一条固定评论（每次 push 原地更新）。

## 许可证

- 代码（配置、模板、脚本等）：[MIT](LICENSE)
- `content/` 下的文章：[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)
