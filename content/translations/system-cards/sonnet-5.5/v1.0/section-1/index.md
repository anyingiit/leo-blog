---
title: "1 引言"
weight: 3
pages: [9, 11]
description: "Claude Sonnet 5.5 系统卡中文译本 v1.0 · 1 引言（非官方，AI 翻译）"
---
Claude Sonnet 5.5 是 Anthropic 推出的一款新的大语言模型（large language model），以全面开放的方式发布。在本系统卡（System Card）中，我们报告了在七个领域开展的一系列部署前评估的结果：负责任扩展政策（Responsible Scaling Policy）评估、网络安全、安全防护与无害性、智能体安全、对齐（alignment）、模型福祉（model welfare）以及能力。

### 1.1 训练数据与过程

Claude Sonnet 5.5 的训练数据是一个专有的混合数据集，包括来自互联网的公开信息、公开和非公开数据集，以及其他来源（例如由其他模型生成的合成数据）。该混合数据还可能包括来自反馈或错误报告的用户数据，或用户明确允许用于训练的数据。在训练过程中，我们采用了多种数据清洗和过滤方法，包括去重和分类。我们使用一个名为 ClaudeBot 的通用网络爬虫从公开网站获取训练数据。该爬虫遵循业界标准的最佳实践，遵守网站运营者所设置的“robots.txt”指令，这些指令表明他们是否允许抓取其网站内容。我们不会访问受密码保护的页面，也不会访问需要登录或 CAPTCHA 验证的页面。我们会对所使用的训练数据开展尽职调查。该爬虫以透明方式运行；网站运营者可以轻松识别它何时抓取过其网页，并向我们表明其偏好。

在预训练过程之后，Sonnet 5.5 经过了严格的后训练和微调，旨在使其成为一个行为符合 [Claude](https://www.anthropic.com/constitution) [宪法](https://www.anthropic.com/constitution)（Claude’s constitution）中所述价值观的助手。Claude 支持多种语言，通常使用与用户输入相同的语言进行回复。输出质量因语言而异。该模型仅输出文本。

Sonnet 5.5 可靠的知识截止日期为 2026 年 6 月。

### 1.2 众包工作者

Anthropic 与数据工作平台合作，招募工作者通过偏好选择、安全评估和对抗性测试帮助改进我们的模型。Anthropic 只会与符合以下条件的平台合作：认同我们为工作者提供公平且合乎道德的报酬这一理念，并且无论身处何地，都致力于践行安全的工作场所规范，遵循我们在采购合同中详细规定的众包工作者福祉标准。

{{< s1-page 9 >}}

### 1.3 使用政策与支持

Anthropic 的[使用政策](https://www.anthropic.com/legal/aup)（Usage Policy）详细规定了我们模型的禁止用途，以及我们对高风险场景和其他特定场景中使用的要求。

对于受适用监管制度约束的模型，我们已在[前沿合规框架](https://trust.anthropic.com/resources?s=zgt6rgfecy1eo7vicr064b&name=anthropic-frontier-compliance-framework)（Frontier Compliance Framework，FCF）中正式规定了我们如何履行此类法规下的义务。FCF 记录了我们当前在各主要风险类别中开展系统性风险评估与缓解的技术和组织规程。FCF 是我们针对适用监管制度的合规框架，这些制度包括加利福尼亚州的《前沿人工智能透明度法案》（Transparency in Frontier AI Act，SB 53）以及《欧盟人工智能法案》（EU AI Act）下的《通用人工智能行为准则》（General-Purpose AI Code of Practice）。

Anthropic Ireland, Limited 是 Anthropic 通用人工智能模型在欧洲经济区（European Economic Area）的提供方。

如需联系 Anthropic，请访问我们的[支持页面](https://support.claude.com/en/)。

### 1.4 模型评估

在训练过程中的不同时间点，我们会为模型保存不同的“快照”。除非另有说明，本系统卡中的评估均在 Claude Sonnet 5.5 最终发布的快照上运行。

### 1.5 安全防护措施

我们为 Claude Sonnet 5.5 的全面开放使用所采用的安全防护措施如下：

- 对于化学和生物（CB）风险，我们部署了与部署 Claude Opus 5 时相同的有害 CB 滥用分类器。这些分类器没有回退（fallback）模型。我们使用这些分类器的理由在第 2.2.4 节中讨论。
- 对于网络安全滥用，我们部署了与 Opus 5 上类似的拦截分类器。这些分类器触发的拦截将回退至 Claude Sonnet 5。
- 正如我们[2026 年 8 月风险报告](https://anthropic.com/aug-2026-risk-report)第 3 节所讨论的，我们担忧加快模型开发整体步伐的风险，以及递归自我改进（recursive self-improvement，RSI）可能带来的风险。因此，我们已在 Sonnet 5.5 上针对与开发前沿大语言模型（LLM）相关的一小部分能力（例如在某些 ML 加速器上进行内核开发）部署了安全防护措施，与我们在 Claude Opus 5.5 上的相应安全防护措施类似。这些措施不会影响传统 AI 或 ML 开发、研究或一般编程中的绝大多数情形。这些分类器触发的拦截将回退至 Sonnet 5。
{{< s1-page 10 >}}
- 我们针对常规武器和高当量炸药研发的拦截分类器，其行为与 Claude Opus 5.5 等先前模型类似，且没有回退模型。
- 我们用于防止对我们的模型进行蒸馏（例如试图提取模型的隐藏推理）的分类器，将在 Sonnet 5.5 上直接拦截，且没有回退模型。

上述回退行为适用于我们的第一方产品，以及在我们的 API 上选择启用此类回退的开发者；通过其他平台和提供商使用我们模型的流量可能会出现不同的行为。我们所有的拦截类安全防护措施均以透明拦截方式运行，不会暗中更改模型的回复。

### 1.6 外部测试

Claude Sonnet 5.5 的大多数评估由 Anthropic 内部完成。不过，我们感谢多家外部测试方对该模型开展评估并与我们分享其结果。他们的具体贡献在本系统卡的相关章节中加以说明。
