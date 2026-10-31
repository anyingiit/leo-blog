# 回归测试

图片处理、短文栏目的原位分组、折叠和图集都是在 PaperMod 之外自己写的（`layouts/_markup/render-image.html`、`layouts/notes/list.html`、`layouts/_partials/extend_footer.html`、`assets/css/extended/custom.css`），改动这些文件或升级 Hugo、主题时，用这里的测试确认没有弄坏。

```bash
cd tests
npm ci
npx playwright install chromium webkit   # 首次运行
npm test
```

- `fixtures/content/` 是测试短文（1、2、5、12 张图，gif/svg、引号、链接里的图、找不到的图、长文字、内嵌 SVG 示意图）。测试和 PR 预览构建会通过 `hugo.test.yaml` 把它们挂进站点，正式构建不包含。
- `build.test.mjs`：用 `build.sh`（锁定的 Hugo 版本）构建整站，关闭 JavaScript 读取生成的 HTML，检查 WebP 尺寸档位、宽高、原图不发布、分组结构和顺序、转义、警告、中英文案。
- `browser.test.mjs`：用 Chromium 在手机（iPhone 13）和电脑（1280px）视口下检查：无横向滚动、加载前占位、手机方块网格、电脑等高行（同行等高、不变形、铺满）、+N 角标位置、图集的点击/键盘/滑动/关闭、折叠展开收起、无宽高图片加载后重新折叠、英文文案、关闭 JS 时内容完整；内嵌 SVG 示意图（`layouts/_shortcodes/theme-svg.html`）的颜色在浅色、深色下都等于 PaperMod 主题变量，文字不出图、不出底色块。

- `lang-switch.test.mjs`：页头语言切换（`layouts/_partials/header.html`、`lang_switch_url.html`）跳到当前页的对应语言版本，没有时退到最近的上级页；检查主题拷贝只差一处、各类页面的去向、全站每一页，以及 Chromium 和 WebKit 下的真实点击。详见 [docs/language-switch.md](../docs/language-switch.md)。

CI（`.github/workflows/ci.yml` 的 Regression tests 任务，分 5 组）在每个 PR 上运行。新增展示规则时，先在 `fixtures` 里加一篇能复现的短文，再加对应断言。
