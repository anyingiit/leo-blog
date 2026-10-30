# 部署

站点在 GitHub Actions 里构建，再用 `wrangler pages deploy` 上传到 Cloudflare Pages 项目 `leo-blog`（`.github/workflows/deploy.yml`）。

| 事件 | 构建方式 | 部署到 |
| --- | --- | --- |
| PR（同仓库分支） | `CF_PAGES_BRANCH=pr-<编号> CF_PAGES_URL=https://pr-<编号>.leo-blog-bgy.pages.dev bash build.sh`：站内链接指向预览地址，带测试短文 | 分支 `pr-<编号>`，预览链接写进 PR 的固定评论 |
| push 到 `main` | `CF_PAGES_BRANCH=main bash build.sh`：正式域名、访问统计 | 生产分支 `main`（douseful.eu.org） |

`build.sh` 和原来 Cloudflare 构建时调用的是同一个脚本，环境变量也一样，所以构建结果不变。

## 为什么不用 Cloudflare 自己构建

2026-10-30 查了 12 次 Cloudflare 构建：推送后 4–6 分钟才有预览，其中排队 0–3.5 分钟（免费版同一时间只能构建一个，几个分支同时推送就排队，`ci-baselines/*` 这类分支也占位），构建 1.5–3.5 分钟（每次从零把配图转成 WebP）。CI 并行后只要 3 分钟左右，Cloudflare 成了最慢的一环。

在 Actions 里：各 PR 同时构建；复用 CI 的 Hugo 图片缓存（`resources/_gen`，键和 CI 完全相同，并且跑在同一个 Playwright 容器里：缓存按压缩方式区分，容器里用 gzip、ubuntu-latest 用 zstd，不在同一环境就读不到），有缓存时整站构建几秒；wrangler 只上传内容变了的文件。用 wrangler 上传不受 Cloudflare 构建并发的限制。

## 预览地址

预览的分支名用 `pr-<编号>`，不用 Git 分支名：Cloudflare 的分支别名要截到 28 个字符，截断后撞名还会加随机后缀（如 `claude-project-thread-et7wkx-70cp`），构建前就无法知道地址，站内链接也就没法指向它。`pr-<编号>` 短且唯一，构建前就能确定。

PR 评论里有两个地址：本次提交的固定地址（`<8 位>.leo-blog-bgy.pages.dev`），和始终指向这个 PR 最新提交的 `pr-<编号>.leo-blog-bgy.pages.dev`。站内链接都指向后者。

PR 的预览构建的是 GitHub 的合并预览提交（PR 分支合入当前 main 的结果），也就是合并后会上线的内容。

## 令牌

仓库 secret `CLOUDFLARE_API_TOKEN`：在 Cloudflare 后台 My Profile → API Tokens → Create Token → Custom token，权限只选 Account → Cloudflare Pages → Edit，资源选本账户（不能选域名 douseful.eu.org：Pages 项目属于账户，限定在域名上的令牌上传时报 Authentication error [code: 10000]）。然后在本机：

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo anyingiit/leo-blog   # 按提示粘贴令牌
```

没有这个 secret 时部署任务跳过并给出提示，不会失败。外部仓库的 PR 拿不到 secret，不部署预览。令牌只传给上传那一步。

## Cloudflare 后台的设置

改用 Actions 部署后，要关掉 Cloudflare 的自动构建，否则同一个提交会构建两遍：项目 Settings → Builds → Branch control，关闭生产分支自动部署，预览部署选 None。Git 连接本身保留（wrangler 可以向 Git 集成的项目上传）。

## 测试

`tests/deploy.test.mjs` 检查工作流的约定：正式站用 `CF_PAGES_BRANCH=main` 构建并部署到 `main`；预览的站点地址和上传分支名是同一个 `pr-<编号>`；外部 PR 不部署、令牌只给上传步骤；Hugo 缓存键和容器都和 CI 相同；wrangler 锁定版本并按锁文件安装。`build.sh` 本身在预览、正式两种模式下的输出由 `tests/site.test.mjs` 检查。
