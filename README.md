# Leoblog

Hugo + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 静态博客，部署在 Cloudflare Pages（push 到 `main` 即发布）。

```bash
git clone --recurse-submodules <repo>
hugo server -D        # 本地预览（含草稿）
hugo new posts/<slug>.md   # 新文章，写完把 draft 改成 false 再 push
```

Markdown 扩展：`$...$` / `$$...$$` 数学公式（构建期 KaTeX）、` ```mermaid ` 图、`> [!NOTE]` 提示框。语法样例见 `content/posts/markdown-test/`（草稿，不发布）。
