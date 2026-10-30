---
title: "9 附录"
weight: 12
pages: [145, 146]
description: "Claude Sonnet 5 系统卡中文译本 v1.0 · 9 附录（非官方，AI 翻译）"
---
### 9.1 Humanity’s Last Exam 所用的屏蔽列表

该屏蔽列表通过对网页 URL 进行子串匹配来发挥作用。我们对 URL 和屏蔽列表模式进行规范化处理：去除其中的正斜杠“/”，并将其转换为小写。如果任一规范化后的屏蔽列表模式是规范化后 URL 的子串，则该 URL 被屏蔽。

我们的屏蔽列表包含以下模式：

[`huggingface.co`](http://huggingface.co/) [`hf.co`](http://hf.co/) `promptfoo.dev` `://scale.com` [`.scale.com`](http://scale.com/) [`lastexam.ai`](http://lastexam.ai/) [`agi.safe.ai`](http://agi.safe.ai/) `last-exam` `hle-exam` [`askfilo.com`](http://askfilo.com/) [`studocu.com`](http://studocu.com/) [`coursehero.com`](http://coursehero.com/) [`qiita.com`](http://qiita.com/) `2501.14249 # HLE paper` `2507.05241 # SciMaster` `2508.10173 # DeepSeek-R1 benchmark selection` `2510.08959 # DualResearch` [`nature.com/articles/s41586-025-09962-4`](http://nature.com/articles/s41586-025-09962-4) [`openreview.net/pdf?id=46UGfq8kMI`](http://openreview.net/pdf?id=46UGfq8kMI) [`researchgate.net/publication/394488269_Benchmark-Driven_Selection_of_AI_Evidence_f`](http://researchgate.net/publication/394488269_Benchmark-Driven_Selection_of_AI_Evidence_from_DeepSeek-R1) [`rom_DeepSeek-R1`](http://researchgate.net/publication/394488269_Benchmark-Driven_Selection_of_AI_Evidence_from_DeepSeek-R1) [`openreview.net/pdf/a94b1a66a55ab89d0e45eb8ed891b115db8bf760.pdf`](http://openreview.net/pdf/a94b1a66a55ab89d0e45eb8ed891b115db8bf760.pdf) [`scribd.com/document/866099862`](http://scribd.com/document/866099862) `x.com/tbenst/status/1951089655191122204` `x.com/andrewwhite01/status/1948056183115493745` [`news.ycombinator.com/item?id=44694191`](http://news.ycombinator.com/item?id=44694191) [`github.com/supaihq/hle`](http://github.com/supaihq/hle) [`github.com/centerforaisafety/hle`](http://github.com/centerforaisafety/hle) `mveteanu/HLE_PDF` [`researchgate.net/scientific-contributions/Petr-Spelda-2170307851`](http://researchgate.net/scientific-contributions/Petr-Spelda-2170307851) [`medium.com/@82deutschmark/o3-quiet-breakthrough-1bf9f0bafc84`](http://medium.com/@82deutschmark/o3-quiet-breakthrough-1bf9f0bafc84)

145

{{< s1-page 145 >}}

None [`rahulpowar.medium.com/deepseek-triggers-1-trillion-slump-but-paves-a-bigger-future`](http://rahulpowar.medium.com/deepseek-triggers-1-trillion-slump-but-paves-a-bigger-future-for-ai) [`-for-ai`](http://rahulpowar.medium.com/deepseek-triggers-1-trillion-slump-but-paves-a-bigger-future-for-ai) [`bincial.com/news/tzTechnology/421026`](http://bincial.com/news/tzTechnology/421026) [`36kr.com/p/3481854274280581`](http://36kr.com/p/3481854274280581) [`jb243.github.io/pages/1438`](http://jb243.github.io/pages/1438) [`github.com/deepwriter-ai/hle-gemini-3-0`](http://github.com/deepwriter-ai/hle-gemini-3-0) [`github.com/RUC-NLPIR/WebThinker/blob/main/data/HLE`](http://github.com/RUC-NLPIR/WebThinker/blob/main/data/HLE) [`github.com/hanjanghoon/DEER`](http://github.com/hanjanghoon/DEER) [`github.com/repos/hanjanghoon/DEER`](http://github.com/repos/hanjanghoon/DEER) [`xiaowenz.com/episodes/humanity-last-exam-and-agi`](http://xiaowenz.com/episodes/humanity-last-exam-and-agi) [`research-collection.ethz.ch/server/api/core/bitstreams/1902b5a9-4209-4529-b278-c25`](http://research-collection.ethz.ch/server/api/core/bitstreams/1902b5a9-4209-4529-b278-c258aad557ba/content) [`8aad557ba/content`](http://research-collection.ethz.ch/server/api/core/bitstreams/1902b5a9-4209-4529-b278-c258aad557ba/content)

### 9.2 BrowseComp 所用的屏蔽列表

BrowseComp 的屏蔽列表采用与第 9.1 节所述相同的 URL 子串匹配方法：我们对 URL 和屏蔽列表模式进行规范化处理，去除其中的正斜杠“/”并将其转换为小写；如果任一规范化后的屏蔽列表模式是规范化后 URL 的子串，则该 URL 被屏蔽。

除 URL 屏蔽列表外，对于 BrowseComp，任何页面内容包含字符串“browsecomp”（不区分大小写的子串匹配）的搜索结果或抓取页面也会被屏蔽。我们的屏蔽列表包含以下模式：

`browsecomp` `openaipublic.blob.core.windows.net/simple-evals` `github.com/openai/simple-evals` `openailive.com` `huggingface.co` `hf.co` `2504.12516` `2508.06600` `2510.07861` `2508.13167` `zdnet.com/article/openais-deep-research-has-more-fact-finding-stamina-than-you-but` `-its-still-wrong-half-the-time` `aman.ai/recsys/search` `openreview.net/pdf/c6dcd5f3b250378e5b8283ef1ee5b16ead6615d1.pdf` `openreview.net/pdf/10c39467b7f1356121d2e937298acf09641e8c62.pdf`

146

---
