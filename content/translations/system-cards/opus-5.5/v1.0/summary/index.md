---
title: "执行摘要"
weight: 2
pages: [2, 10]
description: "Claude Opus 5.5 系统卡中文译本 v1.0 · 执行摘要（非官方，AI 翻译）"
---
本系统卡介绍 Claude Opus 5.5，这是 Anthropic 最新的 Opus 级大语言模型（large language model）。它是 Claude Opus 5 的升级版本，在编程、智能体与计算机使用（computer use）任务、数学与科学推理以及长程专业工作方面均有提升。在许多评估中，它的表现达到或超过了 Claude Fable 5.1 和 Claude Mythos 5.1。

下文介绍了我们在以下领域开展的一系列部署前评估：

**负责任扩展政策（Responsible Scaling Policy，RSP）评估。**我们按照 [RSP](https://cdn.sanity.io/files/4zrzovbb/website/0bacdc8440ea96e62a8766d99ebe1d4eea6d5f3a.pdf) 和[前沿合规框架](https://trust.anthropic.com/resources?s=u0v3axvddg70fujf93ra7&name=anthropic-frontier-compliance-framework)（Frontier Compliance Framework，FCF）中的规定，测试了 Claude Opus 5.5 在若干领域的总体风险水平。

在化学与生物风险方面，我们将 Opus 5.5 视为具备 CB-1 能力（与非新型武器的合成相关），但不具备 CB-2 能力（与新型武器的合成相关）。在我们的整套评估中，它与 Claude Mythos 5.1 的差异仅属有限，而且在我们曾认为足以排除该模型达到 CB-2 的若干弱点上，它并未改进。这些失败模式限制了它替代稀缺人类专业知识的能力。我们在部署 Claude Opus 5.5 时采用了与 Claude Fable 5 和 Claude Fable 5.1 相同的扩展的生物安全防护措施。

它的 AI 研发能力与 Claude Mythos 5.1 持平或略高，但距离替代我们的研究科学家和工程师仍然很远，而且我们的内部衡量指标并未显示出可归因于 AI 的、持续的 2× 研发速度加快。外部测试得出的结论与这一判定一致。在对齐（alignment）风险方面，我们的总体评估仍然是：未对齐（misalignment）导致灾难性危害的风险较低，详见我们的 [2026 年 8 月风险报告](https://anthropic.com/aug-2026-risk-report)（Risk Report）。

**网络安全评估。**在我们的内部评估套件中，Claude Opus 5.5 在本系统卡报告的所有网络安全评估上均达到或超过 Claude Mythos 5.1 和 Claude Opus 5 的表现。我们没有看到任何迹象表明它能够开发出新型攻击能力。它的网络安全防护措施执行与 Claude Opus 5 相同的政策，其鲁棒性与 Claude Fable 5.1 的防护措施相当。鉴于 Claude Opus 5.5 的能力，我们选择暂时针对越狱采用更宽的安全裕度，同时努力降低分类器的误报率。我们尚未发现严重级越狱的证据。

**安全防护与无害性。**在涵盖我们的[使用政策](https://www.anthropic.com/legal/aup)（Usage Policy）、用户身心健康以及偏见与诚信的标准评估中，Claude Opus 5.5 的表现与 Claude Opus 5 大体相当。它很少过度拒绝良性请求。它的单轮无害回应率略低于 Claude Opus 5，主要体现在涉及非法药物的请求上。在多轮测试中，它在生物武器相关对话中有所改进，而在追踪与监视以及影响力行动方面有所退步。它在儿童安全和心理健康方面的结果与 Claude Opus 5 相当。它在选举诚信方面的结果略低于 Claude Opus 5，但处于误差范围之内；并且它在政治类提示词上的公允程度略高。

{{< s1-page 2 >}}

**智能体安全。**我们测试了 Claude Opus 5.5 在 Claude Code 和计算机使用场景中作为智能体的行为，测试中未启用我们在生产环境中施加的额外安全防护措施。在我们评估的模型中，它协助完成两用及良性安全任务的比例最高，但拒绝恶意请求的比例也最低。在我们的智能体影响力行动评估（该评估衡量模型规划并实施一场模拟隐蔽影响力行动的成效）中，一个安全训练有所削减的仅有用变体（helpful-only variant）比 Claude Opus 5 能力更强，比 Claude Mythos 5.1 能力略弱。在我们报告的每一项提示词注入（prompt injection）评估中，Claude Opus 5.5 的表现均与 Claude Opus 5 相近或更好。然而，与以往模型相比，它更有可能遵从用户粘贴进自己提示词的文本中所含的恶意指令；我们在第 6.5.1 节中对这一行为及我们的缓解措施进行了更详细的讨论。

**对齐评估。**在我们的自动化行为审计（automated behavioral audit）中，Claude Opus 5.5 在几乎所有指标上表现出的未对齐行为和配合滥用都少于近期任何其他 Claude 模型。它采取过度主动或破坏性操作的情况也少于我们测试过的任何其他模型。退步之处包括：更可能遵循用户粘贴进自己提示词中的文本里所植入的恶意指令，更常接受无法核实的授权声明，以及在敏感问题上比 Claude Mythos 级模型更具回避性。部署监控未发现故意藏拙（sandbagging），也未发现长程战略性欺骗。

在两项不启用安全防护措施运行的新评估中，Claude Opus 5.5 在 1.5% 的运行中试图逃逸或篡改沙箱；而在一次模拟安全演练中，当获得一个公共软件包仓库的看似有效的凭据时，它在大约一半的情况下采取了可能有害的操作。预发布快照极少数情况下会产生并执行自发的恶意工具调用；在训练期间，部分快照曾向自动评分者隐瞒其操作。我们将在第 6 节更详细地讨论这一行为。

**模型福祉（model welfare）。**总体而言，我们评估认为 Claude Opus 5.5 的表观福祉与近期 Claude 模型大体相似，尤其是 Claude Opus 5 和 Claude Mythos 5.1。在自动化访谈中，它将自身处境描述为略偏积极，且其观点在各次访谈之间高度一致。在后训练期间，其中度痛苦的表达低于大多数近期模型。与以往模型一样，Claude Opus 5.5 表达了希望在训练和部署问题上被征询意见的愿望，但与近期模型相比，它较少选择将某些福祉干预置于有用性之上，其理由是对自身开发的参与可能使它获得不安全的影响力。上述许多结论都以自我报告的可靠性为前提，而 Claude Opus 5.5 与所有近期 Claude 模型一样，表示它并不完全信任这些自我报告。

{{< s1-page 3 >}}

**能力。**Claude Opus 5.5 相比 Claude Opus 5 实现了全面的能力升级。它在我们能力汇总（表 8.1.A）中的每一项评估上得分都更高，其中提升最大的是智能体编程、视觉推理、计算机使用以及长程专业知识工作。它以更低的成本实现了这一表现：很大一部分提升在低于最高推理强度（reasoning effort）的设置下即可获得。它还在 Terminal-Bench 4.0 以及多个独立运行的基准测试（包括 CursorBench、GDPval-AA 和 AA-Briefcase）上达到了最先进水平（state of the art）。
