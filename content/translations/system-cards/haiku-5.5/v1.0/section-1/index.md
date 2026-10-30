---
title: "1 引言"
weight: 3
pages: [8, 10]
description: "Claude Haiku 5.5 系统卡中文译本 v1.0 · 1 引言（非官方，AI 翻译）"
---
Claude Haiku 5.5 是 Anthropic 推出的一款新的大语言模型（large language model），已全面开放。在本系统卡（System Card）中，我们报告了七个领域的一系列部署前评估结果：负责任扩展政策（Responsible Scaling Policy）评估、网络安全、安全防护与无害性、智能体安全、对齐（alignment）、模型福祉（model welfare）以及能力。

### 1.1 训练数据与训练过程

Claude Haiku 5.5 的训练数据是一个专有的数据组合，包括来自互联网的公开信息、公开与非公开数据集、用户在反馈或错误报告中提供的或用户明确允许用于训练的用户数据，以及其他来源，例如由其他模型生成的合成数据。在训练过程中，我们使用了多种数据清洗和过滤方法，包括去重和分类。我们使用名为 ClaudeBot 的通用网络爬虫从公开网站获取训练数据。对于网站运营者用以表明是否允许抓取其网站内容的“robots.txt”指令，该爬虫遵循行业标准的最佳实践，并且其设计不会访问受密码保护的页面，或需要登录或 CAPTCHA 验证的页面。我们会对所使用的训练数据开展尽职调查。该爬虫以透明方式运行；网站运营者可以轻松识别它何时抓取过其网页，并向我们表明其偏好。

在预训练过程之后，Haiku 5.5 经过了严格的后训练和微调，目的是使其成为一个行为符合 [Claude 的](https://www.anthropic.com/constitution)[宪法](https://www.anthropic.com/constitution)（constitution）中所述价值观的助手。Claude 支持多种语言，通常会使用与用户输入相同的语言进行回应。输出质量因语言而异。该模型仅输出文本。

Haiku 5.5 的知识截止日期为 2026 年 6 月。

### 1.2 众包工作者

Anthropic 与数据工作平台合作，招募工作者通过偏好选择、安全评估和对抗性测试帮助改进我们的模型。Anthropic 只与认同我们关于向工作者提供公平且合乎道德的报酬这一理念的平台合作，并且这些平台须致力于无论身处何地都采用安全的工作场所实践，遵循我们在采购合同中详细规定的众包工作者福祉标准。

{{< s1-page 8 >}}

### 1.3 使用政策与支持

Anthropic 的[使用政策](https://www.anthropic.com/legal/aup)（Usage Policy）详细列出了我们模型的禁止用途，以及我们对高风险场景和其他特定场景中使用的要求。

对于受适用监管制度约束的模型，我们已在[前沿合规框架](https://trust.anthropic.com/resources?s=zgt6rgfecy1eo7vicr064b&name=anthropic-frontier-compliance-framework)（Frontier Compliance Framework，FCF）中正式规定了我们如何履行此类法规下的义务。FCF 记录了我们当前在各关键风险类别中开展系统性风险评估与缓解的技术和组织规程。FCF 是我们针对适用监管制度的合规框架，这些制度包括加利福尼亚州的《前沿人工智能透明度法案》（Transparency in Frontier AI Act，SB 53）以及《欧盟人工智能法案》（EU AI Act）的《通用人工智能行为准则》（General-Purpose AI Code of Practice）。

Anthropic Ireland, Limited 是 Anthropic 通用人工智能模型在欧洲经济区（European Economic Area）的提供者。

如需联系 Anthropic，请访问我们的[支持页面](https://support.claude.com/en/)。

### 1.4 模型评估

在训练过程的不同时间点，我们会获取 Claude Haiku 5.5 的不同“快照”。除非某一节另有说明，本系统卡中的评估均在 Claude Haiku 5.5 的最终快照上运行。部分章节改用较早的或替代的快照，或在关闭生产环境安全防护措施的情况下运行模型，以使结果反映底层模型而非已部署的系统。

### 1.5 安全防护措施

我们为全面开放使用的 Claude Haiku 5.5 所应用的安全防护措施如下：

- 针对化学和生物（CB）风险，我们部署了与我们部署 Claude Opus 5 和 Claude Sonnet 5 时相同的有害 CB 滥用分类器，而非 Claude Opus 5.5 所使用的范围更广的研究生物学分类器。这些分类器没有回退（fallback）模型。我们使用这些分类器的理由在第 2.2.4 节中讨论。
- 针对网络安全滥用，我们部署了以特定有害网络活动为目标的拦截分类器。这些分类器的范围明显窄于我们为能力更强的模型设置的网络安全防护措施。这些分类器没有回退模型。我们在第 3.2 节中进一步讨论这些安全防护措施。
- 正如我们在 [2026 年 8 月风险报告](https://anthropic.com/aug-2026-risk-report)（Risk Report）第 3 节中所讨论的，我们担忧加快模型开发整体步伐所带来的风险，以及递归自我改进（recursive self-improvement，RSI）可能带来的风险。我们已在 Claude Haiku 5.5 上针对与开发前沿大语言模型（LLM）相关的一小部分能力部署了安全防护措施，例如在某些机器学习加速器上进行内核开发，这与我们在以往模型上的相应安全防护措施类似。这些措施不会影响绝大多数传统 AI 或机器学习开发、研究或一般编程工作。
{{< s1-page 9 >}}
- 我们针对常规武器和高当量炸药研发活动的拦截分类器，其表现与以往模型（例如 Claude Opus 5.5）上的同类分类器相似。

与我们近期一些能力更强的模型不同，在我们的第一方产品和 API 上，这些安全防护措施触发拦截后不会回退到任何其他模型。通过其他平台和提供商访问我们模型的流量可能会出现不同的行为。

### 1.6 外部测试

Claude Haiku 5.5 的大多数评估是在 Anthropic 内部运行的。不过，我们感谢多位外部测试者对该模型开展评估并与我们分享结果。他们的具体贡献在本系统卡的相关章节中加以说明。
