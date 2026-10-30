---
title: "执行摘要"
weight: 2
pages: [2, 7]
description: "Claude Haiku 5.5 系统卡中文译本 v1.0 · 执行摘要（非官方，AI 翻译）"
---
本系统卡（System Card）介绍 Claude Haiku 5.5，这是 Anthropic 最新的 Haiku 级大语言模型（large language model）。我们展示了一系列广泛的部署前评估结果，这些结果表明，Claude Haiku 5.5 在许多领域显著优于其前代模型 Claude Haiku 4.5。在少数方面，它与 Claude Sonnet 5.5 不相上下，甚至有所超越。

我们从多个方面精简了本系统卡的内容，以便将部署前测试更好地集中于深入调查我们前沿模型的能力。具体而言：

- 对于需要投入大量人力时间才能获得可信结果的部分评估，如果它们对某一节的主要结论并不关键，我们便予以省略。
- 我们侧重于呈现评估的数值结果，而以较少篇幅对这些评估或其结果进行文字分析，尤其是在我们已在之前的系统卡中解释过相关评估的情况下。

因此，本系统卡比以往的部分系统卡略短。我们预计今后非前沿模型的系统卡也会作类似精简，除非某个模型具有值得深入阐述的显著特性。

下面我们总结本系统卡的主要发现。

我们的**负责任扩展政策（Responsible Scaling Policy，RSP）评估**发现，Claude Haiku 5.5 在各领域的能力总体上弱于 Claude Opus 5，且未跨越任何新的 RSP 阈值。我们评估认为，Haiku 5.5 带来的未对齐（misalignment）风险较低，因为在推理过程可见的隐蔽能力评估中，它难以控制自己的思维链（chain of thought），也难以规避监控器。

在**网络安全评估**中，Claude Haiku 5.5 显著优于 Claude Haiku 4.5，但不及 Claude Opus 5.5、Claude Mythos 5.1 乃至 Claude Opus 5 所取得的结果。鉴于其缺乏高级网络安全能力，我们为 Claude Haiku 5.5 设置的网络安全防护措施所触发的活动范围明显小于其他近期发布模型的相应措施。这些安全防护措施针对的是特定的有害及潜在有害活动。

Claude Haiku 5.5 在**安全防护与无害性**方面的表现大体与 Claude Haiku 4.5 相当或更好，在追踪与监视等多轮场景以及政治公允性方面有所改进。

{{< s1-page 2 >}}

我们的**智能体安全评估**发现，Claude Haiku 5.5 是迄今为止对提示词注入（prompt injection）最具鲁棒性的 Haiku 级模型，在编程和计算机使用（computer use）环境中面对自适应攻击者时，其鲁棒性与我们的前沿模型大致相当。它在计算机使用环境中对有害任务的拒绝率高于 Claude Sonnet 5.5 和 Claude Opus 5.5，且较 Claude Haiku 4.5 有大幅提升。

我们**对齐评估**的结果表明，在我们报告的大多数指标上，Claude Haiku 5.5 优于或持平 Claude Haiku 4.5，但 Claude Opus 5.5 总体上仍更强。它在压力下的诚实性至少与我们测试的其他所有模型相当，而在隐蔽蓄意破坏方面则远弱于我们的更大模型。另一方面，在我们的自动化行为审计（automated behavioral audit）中，它的过度拒绝（over-refusal）多于我们测试的任何其他模型；并且与 Haiku 4.5 相比，它更常在不告知用户的情况下使用泄露的答案。

针对 Claude Haiku 5.5 所表述的观点与偏好开展的**福祉**调查发现，其情感（affect）大多为中性情感，与近期的 Claude 模型大体相似，且它的自我批评程度低于大多数对比模型。它在后训练中表达出的痛苦多于近期模型，但明显少于 Claude Opus 5。它的任务偏好与 Claude Haiku 4.5 最为相似，包括对措辞温暖的任务的强烈偏好。

我们对 Claude Haiku 5.5 **能力**的评估涵盖了广泛的评估项目，在这些评估中，该模型总体上较 Claude Haiku 4.5 有大幅提升。但除少数例外，它通常未达到 Claude Sonnet 5.5 的水平。
