# 安全

本站是 Cloudflare Pages 上的静态站：没有服务器端代码、登录、表单和数据库，主要风险在**供应链**（外站脚本、构建依赖、GitHub Actions）和**托管配置**（Cloudflare、DNS）。这里记录仓库里自动检查的部分；需要在 Cloudflare 或 GitHub 后台改的设置不在仓库里，见 2026-10-30 的安全审查报告。

## 自动检查（`tests/security.test.mjs`）

每个 PR 的站点回归测试都会跑（Browser tests (chromium) 的 Run regression tests 步骤），不构建站点，约 1 秒。

| 检查 | 为什么 |
| --- | --- |
| 模板（`layouts/`）和文章（`content/`）里从外站加载的 `<script src>`、`<link rel=stylesheet/preload/modulepreload>` 必须带 `integrity` 和 `crossorigin` | CDN 上的文件被篡改时，浏览器会拒绝执行或应用，而不是在读者的浏览器里运行别人的代码 |
| 行内 `<script>` 不 `import` 外站模块 | `import` 语句没法写 `integrity` |
| 每个工作流有顶层 `permissions`，不用 `write-all` | 令牌默认只读，写权限只给需要的任务 |
| 不用 `pull_request_target`、`workflow_run` | 这两种触发器带着写权限和密钥处理外部 PR，是 Actions 被入侵最常见的入口 |
| `run` 脚本里不直接写 `${{ github.event.pull_request.title }}`、`${{ github.head_ref }}` 这类外部文字 | 会被当成命令执行（脚本注入）。要用就先放进 `env:`，再以 `"$VAR"` 引用 |
| `actions/checkout` 都设 `persist-credentials: false` | 令牌不留在 `.git/config`，后面的步骤（包括 npm 包的安装脚本）读不到 |
| `.claude/settings.json` 里的第三方插件市场用 `ref` 锁定到版本标签（如 `v1.0.3`） | 插件会在每个 Claude Code 会话里自动加载；不锁定的话，对方仓库一更新就生效 |
| `static/_headers` 给全站加 `Content-Security-Policy: frame-ancestors 'self'` 和 `Permissions-Policy`（关掉摄像头、麦克风、定位、支付、USB），其他路径不另设 CSP | 别的网站不能把本站套进 iframe 冒充；本站自己的 iframe（短片）不受影响。不做完整 CSP：内联脚本多，要么形同虚设，要么容易把页面弄坏 |
| `git ls-files` 列出的文本文件不含 GitHub、AWS、Google、Slack、Stripe、Anthropic、OpenAI 密钥和私钥 | 只认有固定前缀的格式；原样 HTML 里的 base64 图片会命中宽泛的规则，所以不查"长随机串" |

另外，`ci.yml` 的 Lint and build 任务检查每个 `uses:` 都锁定到完整的提交哈希。

`tests/theme/behavior.spec.mjs` 的「KaTeX 样式表的 SRI 校验通过」在 Chromium、WebKit × 三种设备里打开带公式的短文，核对 `integrity` 等于本地副本（`tests/theme/package.json` 锁定、与线上同版本）的 sha384，并确认浏览器真的应用了样式表。**升级 KaTeX 时**：改 `extend_head.html` 里的版本号和 `integrity`（`openssl dgst -sha384 -binary tests/theme/node_modules/katex/dist/katex.min.css | openssl base64 -A`），同时改 `tests/theme/package.json`。

## 外站资源和例外

| 资源 | SRI | 说明 |
| --- | --- | --- |
| KaTeX 样式表（jsDelivr，锁定 0.16.22） | 有 | 只在有公式的页面加载；字体由样式表引用，浏览器不对字体做 SRI |
| Cloudflare Web Analytics（`static.cloudflareinsights.com/beacon.min.js`） | 没有 | 不带版本号，Cloudflare 原地更新，固定哈希会让统计随时失效；只在正式站加载（[analytics.md](analytics.md)），不进下载文件 |

Mermaid 不是外站资源：它放在本站 `static/vendor/mermaid/`，和锁定的 npm 包逐字节相同（`tests/theme/output.spec.mjs`），升级步骤见 [testing.md](testing.md)。

新增外站资源时先带上 SRI；确实没法带的，写进本表和 `tests/security.test.mjs` 的例外列表，并说明原因。

原样提供的译文 HTML（`content/**/*.html.raw`、S-1 原版视图）里没有脚本，只有指向原出处的普通链接。

## 依赖更新

Dependabot（`.github/dependabot.yml`）每周检查 GitHub Actions、`tests/` 和 `tests/theme/` 的 npm 包、`tools/` 下三个 Python 工具的 `requirements.txt`。Playwright、KaTeX、Mermaid 要和 CI 镜像、线上 CDN 版本或本站副本一起改，所以不自动升级。`ci.yml` 里给 `s1-links.test.mjs` 单独下载的 pypdf wheel 是另一处锁定，升级 `tools/s1-import` 的 pypdf 时顺手一起改。Hugo 在 `build.sh` 里锁定版本并校验 sha256，PaperMod 是子模块（升级要重做页头语言切换，见 [language-switch.md](language-switch.md)）。
