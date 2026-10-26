# 测试

博客里凡是 PaperMod 之外自己写的东西（模板、渲染钩子、配置约定、构建脚本、工具脚本），都要有可重复运行的回归测试，并且由 CI 在每个 PR 和每次合入 `main` 时执行。

## 测试清单

| 测试 | 覆盖什么 | CI 里的步骤 |
| --- | --- | --- |
| `tests/site.test.mjs` | 站点整体：短文栏目、中英文副本、英文配图、公式/Mermaid/提示框、`build.sh` 预览地址（详见下文） | Test → Test site |
| `tests/ci-coverage.test.mjs` | 覆盖检查脚本 `tests/ci-coverage.mjs` 本身，以及本仓库每个测试文件都在 CI 里执行 | Test → Test site |
| `tools/image-i18n/test_render.py` | 英文配图脚本 `render.py`，并核对 `content/` 里提交的英文图和 `.i18n.yaml` 一致（见 [image-translation.md](image-translation.md)） | Test → Test image-i18n |
| `.github/workflows/ci.yml` 里的检查 | 所有 action 都锁定到完整 commit SHA；每个测试文件都被 CI 执行 | Lint |

## `tests/site.test.mjs` 检查的内容

只用 Node 内置模块（`node:test`），不需要 `npm install`。测试用 `build.sh` 构建整站（锁定的 Hugo 版本、和 Cloudflare Pages 相同的 `--minify`），然后读取生成的 HTML：

- **短文栏目**（`content/notes/`、`layouts/notes/list.html`、`hugo.yaml` 的 `mainSections`/`permalinks`/菜单）：中英文首页和归档只列长文；`/notes/` 按时间线列出全部短文并展开全文（和单篇页正文一致）；单篇地址 `/notes/<slug>/`；短文 RSS；菜单第一项是「短文」/「Notes」；草稿不发布。
- **中英文副本**（项目规则）：每篇已发布的文章都有对应的 `.en.md`，反之亦然；slug、date 一致，页面互相链接；标签数量相同，「随笔」译为「Notes」。
- **英文配图**：有 `.i18n.yaml` 的图，英文页引用 `.en` 版，中文页用原图，构建结果里也是如此。
- **公式、Mermaid、提示框**（`layouts/_markup/`、`layouts/_partials/extend_head.html`）：用草稿 `content/posts/markdown-test/` 检查 `$…$`/`$$…$$` 渲染成 KaTeX、` ```mermaid ` 输出 `<pre class=mermaid>`、`> [!NOTE]` 等提示框带中文标题；KaTeX 样式和 Mermaid 脚本只在需要的页面加载；正文不会被误当成公式（例如英文里成对出现的美元金额）。
- **`build.sh`**：预览构建（`CF_PAGES_BRANCH` 不是 `main`）的链接和 RSS 指向 `CF_PAGES_URL`，`main` 用正式域名。

这些断言都做过反向验证：分别人为破坏 13 处（例如首页收入短文、栏目只给摘要、删掉渲染钩子、预览不换地址、英文页用中文图、删掉英文副本、撤销美元转义），每一处都会让对应的测试失败。

## 本地运行

```bash
node --test tests/site.test.mjs tests/ci-coverage.test.mjs   # 需要 Node 18+，首次会由 build.sh 下载 Hugo
node tests/ci-coverage.mjs                                    # 检查每个测试文件都在 CI 里执行

python3 -m venv /tmp/venv
/tmp/venv/bin/pip install -r tools/image-i18n/requirements.txt
/tmp/venv/bin/python -m unittest discover -s tools/image-i18n -v
```

## 新增测试时

1. 测试文件按约定命名：Python 用 `test_*.py`（`unittest discover` 只认 `test*.py`），JavaScript 用 `*.test.mjs`。
2. 在 `.github/workflows/ci.yml` 里执行它：写出文件路径，或者让某个步骤以它所在的目录为单位运行（例如 `discover -s <目录>`、`working-directory: <目录>` 后跑 `npm test`）。
3. 漏了第 2 步时，Lint 里的 “Check that CI runs every test file”（`tests/ci-coverage.mjs`）会失败，并指出是哪个文件。主题（`themes/`）、`node_modules/` 和测试素材（`fixtures/`）里的文件不算。
