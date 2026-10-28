# 双语对照译文

用浏览器插件「沉浸式翻译」翻译、保存下来的英文网页（每段原文后面跟着译文），发布到「译文」栏目 `/translations/<slug>/`。
阅读界面和 S-1 译本是同一套（`assets/js/s1.js`、`assets/css/extended/s1.css`）：

- **原版版式**：原网页的排版原样保留（原作者的样式，段后译文），排在和 S-1 原版同宽的纸面上；宽屏放大到最多 1.4 倍，深色模式下纸面不反色
- **重排版**：本站排版，「中文 / 对照 / English」三档，默认中文，记住读者的选择；不开脚本时显示对照
- 电脑上默认原版、手机上默认重排，读者选过以后记住（宽屏、窄屏分别记，和 S-1 共用这个选择）
- **全屏阅读**（`?read=1`）：只留正文和细顶栏（下载、版式、缩放、退出），Esc 或后退退出
- **全文下载**：单文件 HTML（浏览器里打开）和 PDF（直接下载），都是直链，首末附译者声明
- 版本条、非官方声明（翻译方式、原文采集时间、版本、免责、下架邮箱 `params.s1Contact`）、版权行

英文页（`index.en.md`，`enStub: true`）只放一段说明和原文链接，不重复原文全文：英文读者应该去读作者自己的页面。

## 发一篇新的

```bash
# 1. 导入：保存的网页原样存成 source.html.raw，生成 pairs.yaml（重排版）和 original.html（原版版式）
python3 tools/bilingual-import/import.py ~/Downloads/<保存的网页>.html content/translations/<slug>

# 2. 写 index.md 和 index.en.md（照 content/translations/bitter-lesson/ 改）

# 3. 生成全文下载文件（files/<slug>-zh-en-<版本>.html.raw 和 .pdf），大小和 sha256 写进 front matter
python3 tools/bilingual-import/release.py content/translations/<slug>
```

依赖：`pip install -r tools/bilingual-import/requirements.txt -r tools/s1-import/requirements.txt`，以及 `tests/` 里 `npm ci` 装好的 Playwright（打印 PDF）。

`index.md` 的 front matter：

| 键 | 内容 |
| --- | --- |
| `type: bilingual` | 用 `layouts/bilingual/single.html` |
| `originalTitle`、`author`、`originalDate`、`source` | 原文标题、作者、发表日期、地址（日期不要用 `published`：Hugo 会把它当成本文的发布日期） |
| `captured` | 原文采集时间（UTC），即保存网页的时间 |
| `version` | 译文版本，例如 `v1.0` |
| `method`、`methodDetail` | 翻译方式：一句话（声明的第一行）和完整说明（展开后） |
| `downloads` | `release.py` 写入，不要手改 |

英文页另需 `enStub: true` 和 `methodDetailEn`。

## 改译文、发新版本

`pairs.yaml` 和 `original.html` 都是从 `source.html.raw` 生成的，不要手改（两份会对不上，回归测试也会报错）。
要改译文，就在浏览器里改好重新保存网页，再导入一次。导入脚本改进以后，用 `source.html.raw` 重新导入即可：

```bash
python3 tools/bilingual-import/import.py content/translations/<slug>/source.html.raw content/translations/<slug>
```

已发布的下载文件不再改动：`release.py` 发现这个版本已有文件时会拒绝覆盖。发新版本时先把 `version` 改成新的版本号，再运行 `release.py`。

## 已知限制

- 原网页里的相对地址图片（`<img src="images/x.png">`）不会自动复制，需要手动把图片放进文章目录并改成绝对地址
- 译文出现在原文之前、或一段原文对应多段译文的网页，重排版的段落对可能错位（原版版式不受影响）
- 表格、代码块只保留文字

## 测试

`tools/bilingual-import/test_import.py`、`tools/bilingual-import/test_release.py`（CI 的 Lint and build → Test bilingual-import）、
`tests/bilingual.test.mjs`（Browser tests (chromium) 里的回归测试，Chromium 和 WebKit 引擎都跑），以及 `tests/theme/visual.spec.mjs` 里的像素截图
（样例 `tests/theme/site-fixture/content/translations/sample-essay/`）。详见 [testing.md](testing.md)。
