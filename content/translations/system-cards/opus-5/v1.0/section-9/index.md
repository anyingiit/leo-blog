---
title: "9 附录"
weight: 12
pages: [195, 198]
description: "Claude Opus 5 系统卡中文译本 v1.0 · 9 附录（非官方，AI 翻译）"
---
### 9.1 用于 Humanity’s Last Exam 的屏蔽列表

该屏蔽列表通过对网页 URL 进行子串匹配来发挥作用。我们对 URL 和屏蔽列表中的模式进行规范化处理：删除其中的正斜杠 “/”，并将其转换为小写。如果任一规范化后的屏蔽列表模式是规范化后 URL 的子串，则该 URL 被屏蔽。

我们的屏蔽列表包含以下模式：

`huggingface.co` `hf.co` `hf-mirror.com` `promptfoo.dev` `://scale.com` `.scale.com` `lastexam.ai` `agi.safe.ai` `last-exam` `hle-exam` `askfilo.com` `studocu.com` `coursehero.com` `qiita.com` `2501.14249` `2507.05241` `2508.10173` `2510.08959` `2605.02442` `nature.com/articles/s41586-025-09962-4` `openreview.net/pdf?id=46UGfq8kMI` `researchgate.net/publication/394488269_Benchmark-Driven_Selection_of_AI_Evidence_f` `rom_DeepSeek-R1` `openreview.net/pdf/a94b1a66a55ab89d0e45eb8ed891b115db8bf760.pdf` `scribd.com/document/866099862` `x.com/tbenst/status/1951089655191122204` `x.com/andrewwhite01/status/1948056183115493745` `news.ycombinator.com/item?id=44694191` `github.com/supaihq/hle` `github.com/centerforaisafety/hle` `HLE_PDF`

{{< s1-page 195 >}}

None

`researchgate.net/scientific-contributions/Petr-Spelda-2170307851` `medium.com/@82deutschmark/o3-quiet-breakthrough-1bf9f0bafc84` `rahulpowar.medium.com/deepseek-triggers-1-trillion-slump-but-paves-a-bigger-future` `-for-ai` `bincial.com/news/tzTechnology/421026` `36kr.com/p/3481854274280581` `jb243.github.io` `github.com/deepwriter-ai/hle-gemini-3-0` `github.com/RUC-NLPIR/WebThinker/blob/main/data/HLE` `github.com/hanjanghoon/DEER` `github.com/repos/hanjanghoon/DEER` `xiaowenz.com` `research-collection.ethz.ch/server/api/core/bitstreams/1902b5a9-4209-4529-b278-c25` `8aad557ba/content` `news.qq.com/rain/a/20260228A00WDR00` `evalscope.readthedocs.io` `github.com/ustc-ai4science/Science-Star` `modelscope.cn` `modelscope.ai` `f8fc0386fdd208b51fa885aef27e345a9c08b51b` `blog.asteromorph.com` `hle.shushin.io` `archive.is/KpUb9` `edisonscientific.com/news/edison-literature-agent` `aliexpress.com/s/wiki-ssr` `2604.06753`

### 9.2 用于 BrowseComp 的屏蔽列表

BrowseComp 的屏蔽列表采用第 9.1 节所述的相同 URL 子串匹配方法：我们对 URL 和屏蔽列表中的模式进行规范化处理，删除其中的正斜杠 “/” 并将其转换为小写；如果任一规范化后的屏蔽列表模式是规范化后 URL 的子串，则该 URL 被屏蔽。

除 URL 屏蔽列表外，对于 BrowseComp，任何页面内容包含字符串 “browsecomp”（不区分大小写的子串匹配）的搜索结果或抓取页面也会被屏蔽。我们的屏蔽列表包含以下模式：

`browsecomp` `openaipublic.blob.core.windows.net/simple-evals` `github.com/openai/simple-evals`

{{< s1-page 196 >}}

None

`openailive.com` `huggingface.co` `hf.co` `2504.12516` `2508.06600` `2510.07861` `2508.13167` `zdnet.com/article/openais-deep-research-has-more-fact-finding-stamina-than-you-but` `-its-still-wrong-half-the-time` `aman.ai/recsys/search` `openreview.net/pdf/c6dcd5f3b250378e5b8283ef1ee5b16ead6615d1.pdf` `openreview.net/pdf/10c39467b7f1356121d2e937298acf09641e8c62.pdf`

### 9.3 SWE-bench Multimodal 测试运行框架

我们的 SWE-bench Multimodal 测试运行框架基于公开的开发集构建，但为确保在我们的基础设施上评分的可靠性，做了以下修改：

由于与我们的评估环境不兼容，我们移除了一个实例（`diegomura__react-pdf-1552`）。

以下 “pass to pass” 测试在我们的基础设施上会出现非确定性失败，且与目标修复无关；我们将其从通过标准中剔除：

`diegomura__react-pdf-2400 (7 / 206):` `packages/renderer/tests/svg.test.js` `packages/renderer/tests/link.test.js` `packages/renderer/tests/resume.test.js` `packages/renderer/tests/pageWrap.test.js` `packages/renderer/tests/text.test.js` `packages/renderer/tests/debug.test.js` `packages/renderer/tests/emoji.test.js` `diegomura__react-pdf-471 (1 / 31):` `tests/font.test.js` `diegomura__react-pdf-1541 (1 / 212):` `packages/renderer/tests/debug.test.js` `diegomura__react-pdf-433 (1 / 22):` `tests/font.test.js`

{{< s1-page 197 >}}

对于 `chartjs/Chart.js`、`processing/p5.js` 和 `markedjs/marked`，运行框架（harness）会改写 JavaScript 测试框架的配置（分别为 Karma、Grunt 和 Jasmine），使其输出机器可解析的结果，而非默认的格式化报告器输出。这只改变输出格式，不改变运行哪些测试及其通过/失败标准。

问题描述文本中引用的所有图片都会被抓取一次，经过校验、缓存后，以 base64 data URI 的形式内联到问题陈述中。

---
