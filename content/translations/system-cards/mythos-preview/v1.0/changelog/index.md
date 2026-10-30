---
title: "更新日志"
weight: 2
pages: [2, 2]
description: "Claude Mythos Preview 系统卡中文译本 v1.0 · 更新日志（非官方，AI 翻译）"
---
**2026 年 4 月 8 日**

- 更正了两处模型名称拼写错误。
- 删除了第 7.9 节中的一段引文，该引文被归于 Claude Mythos Preview，但实际上出自 Claude Opus 4.6。
- 修改了第 2.3.6 节中的命名，以区分 Anthropic 内部的 ECI 分支版本与公开排行榜。
- 更正了第 5.1.2 节和第 5.9 节中 Eleos AI Research 的研究发现，以反映其报告的最新版本。

**2026 年 4 月 14 日**

- 删除了第 2.3.6 节中关于 AI 赋能的加速的一条说明。先前版本认为，促成 Claude Mythos Preview 开发的 AI 赋能的加速反映的将是*更早*模型的能力，而非 Mythos Preview 本身的能力。尽管这一点是准确的，但其引用方式有误：它并不能作为 Mythos Preview 未达到我们第二个自主性阈值的论据。我们已在第 1.2.2 节和第 2.3.1 节中补充了相关表述，以澄清这一点。
- 略微调整了第 2.3.6 节中 AECI 的绝对值，以与 Epoch AI 的流程保持一致；这是对原始得分的仿射变换，不影响我们对斜率比的估计。
- Claude Opus 4.6 的 CharXiv Reasoning 得分已向上修正（无工具：61.5% → 69.1%；使用工具：78.9% → 84.7%）。此次修正是在修复了一个评估运行框架（harness）bug 之后做出的：该 bug 导致自动评分器将 Claude Opus 4.6 的一部分正确回答判为错误。该 bug 仅针对 Opus 4.6 和 CharXiv Reasoning，未影响其他模型或其他评估。模型行为没有变化，现有得分与此前在 [Claude Opus 4.6 系统卡](https://www-cdn.anthropic.com/6a5fa276ac68b9aeb0c8b6af5fa36326e0e166dd.pdf)中报告的得分一致。
- 调整了 Claude Opus 4.6 在 USAMO 2026 上的得分，改为报告不限思考预算下的得分（与我们评估 Mythos Preview 的方式一致）。这使该模型的表现从 42.3% 提升至 66.2%。
