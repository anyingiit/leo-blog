# 访问统计（Cloudflare Web Analytics）

用 Cloudflare Web Analytics 看每篇文章的访问量、来源和真实读者的加载速度。它免费、不用 Cookie、不收集个人信息。

## 怎么接入

不用 Cloudflare 后台的「自动注入」（它在边缘改写所有 HTML，包括原样提供的下载文件，和 Email Address Obfuscation 是同一类问题）。改为手动放脚本：

- 令牌写在 `hugo.yaml` 的 `params.cfAnalyticsToken`。令牌是公开值，本来就会出现在页面里。留空就不加载。
- 脚本在 `layouts/_partials/extend_footer.html`，也就是 PaperMod 的页脚扩展点，所以只出现在用主题页脚的站点页面上。S-1 冻结 HTML、双语译文全文、S-1 单文件 `full.html` 都不经过这里。
- 只在 Cloudflare Pages 的 `main` 分支构建里加载（`CF_PAGES_BRANCH`，`hugo.yaml` 的 `security.funcs.getenv` 放行了这个变量）。预览站、本地构建和 CI 都不加载，所以测试不会访问外网，预览流量也不会混进统计。

## 后台设置

Cloudflare 后台 → Web Analytics → Add a site，主机名填 `douseful.eu.org`，选手动放 JS 片段（不要开自动注入）。把片段里的 `token` 填进 `hugo.yaml`。

## 测试

`tests/site.test.mjs` 的「访问统计只在正式站加载」：用测试令牌按 `main` 分支构建，检查每个站点页面正好加载一次脚本、令牌正确，下载文件里没有；预览构建和普通本地构建里一个页面都没有。已做反向验证：去掉分支判断时预览站检查失败，去掉脚本时站点页面检查失败。
