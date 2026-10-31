---
title: "1 引言"
weight: 4
pages: [11, 12]
description: "Claude Opus 5 系统卡中文译本 v1.0 · 1 引言（非官方，AI 翻译）"
---
本系统卡（System Card）介绍 Claude Opus 5——Anthropic 最新的 Opus 级模型，并报告了针对其能力及安全特性的多种评估。

### 1.1 模型训练与特性

#### 1.1. 训练数据与流程

Claude Opus 5 的训练数据是一个专有的混合数据集，包括来自互联网的公开信息、公开及非公开数据集，以及由其他模型生成的合成数据。在训练过程中，我们使用了多种数据清洗和过滤方法，包括去重和分类。我们使用一个名为 ClaudeBot 的通用网络爬虫从公开网站获取训练数据。该爬虫遵循行业标准做法，遵守网站运营者设置的 “robots.txt” 指令，这些指令表明运营者是否允许爬取其网站内容。我们不会访问受密码保护的页面，也不会访问需要登录或 CAPTCHA 验证的页面。我们会对所使用的训练数据开展尽职调查。该爬虫以透明方式运行；网站运营者可以轻松识别它何时爬取了其网页，并向我们表明其偏好。

在预训练过程之后，Opus 5 经过了严格的后训练和微调，目的是使其成为一个行为符合 [Claude 的](https://www.anthropic.com/constitution)[宪法（constitution）](https://www.anthropic.com/constitution)中所述价值观的助手。Claude 支持多种语言，通常使用与用户输入相同的语言进行回应。输出质量因语言而异。该模型仅输出文本。

Claude Opus 5 的知识截止日期为 2026 年 5 月。

### 1.2 众包工作者

Anthropic 与数据工作平台合作，招募工作者通过偏好选择、安全评估和对抗性测试帮助改进我们的模型。Anthropic 只会与这样的平台合作：认同我们为工作者提供公平且合乎道德的报酬这一理念，并承诺无论在何地均践行安全的工作场所规范，遵循我们在采购合同中详细规定的众包工作者福祉标准。

### 1.3 使用政策与支持

Anthropic 的[使用政策](https://www.anthropic.com/legal/aup)（Usage Policy）详细规定了我们模型的禁止用途，以及我们对高风险场景和其他特定场景中使用的要求。

{{< s1-page 11 >}}

对于受适用监管制度约束的模型，我们已在[前沿合规框架](https://trust.anthropic.com/resources?s=zgt6rgfecy1eo7vicr064b&name=anthropic-frontier-compliance-framework)（Frontier Compliance Framework，“FCF”）中正式规定了我们如何履行此类法规下的义务。FCF 记录了我们当前在各主要风险类别上开展系统性风险评估与缓解的技术和组织规程。FCF 是我们针对适用监管制度的合规框架，适用制度包括加州的《前沿人工智能透明度法案》（Transparency in Frontier AI Act，TFAIA）以及《欧盟人工智能法案》（EU AI Act）下的通用人工智能行为准则（General-Purpose AI Code of Practice）。

Anthropic Ireland, Limited 是 Anthropic 通用人工智能模型在欧洲经济区（European Economic Area）的提供者。

如需联系 Anthropic，请访问我们的[支持页面](https://support.claude.com/en/)。

### 1.4 模型评估

在训练过程的不同时间点，我们会保存模型的不同“快照”。训练期间也存在模型的不同版本，包括一个不包含任何安全防护措施的“仅有用”（helpful-only）版本。除非另有说明，本系统卡中讨论的所有评估均基于模型的最终快照，且包含安全防护措施。

### 1.5 外部测试

Claude Opus 5 的大部分评估是在 Anthropic 内部进行的。不过，我们感谢多位外部测试方对该模型开展评估并与我们分享其结果。他们的具体贡献在本系统卡的相关章节中有所描述。
