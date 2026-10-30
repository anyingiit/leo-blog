---
title: "1 引言"
weight: 3
pages: [11, 13]
description: "Claude Fable 5.1 与 Claude Mythos 5.1 系统卡中文译本 v1.0 · 1 引言（非官方，AI 翻译）"
---
Claude Fable 5.1 和 Claude Mythos 5.1 是 Anthropic 一款全新大语言模型（large language model）的两种配置，二者共享完全相同的模型权重。Fable 5.1 全面开放发布，并配有额外的安全防护措施，用于拦截高风险、两用知识领域中的任务。这些安全防护措施针对的是恶意行为者的滥用：例如，在生物学领域，利用该模型协助开发生物武器；或在网络安全领域，利用它破坏关键公共基础设施。Mythos 5.1 为经审核的个人和组织放宽了其中某些特定领域的安全防护措施：通过我们的生命科学验证计划（Life Sciences Verification Program）放宽生命科学安全防护措施，并在不久的将来通过我们的[网络安全验证计划](http://portal.anthropic.com/programs/cvp)（Cyber Verification Program）放宽网络安全防护措施。另外，[Claude Security](https://claude.com/product/claude-security) 是我们的一款产品，可扫描代码库以查找漏洞并提出补丁建议供人工审核；它面向所有 Claude Enterprise 客户开放，并由 Mythos 5.1 驱动。

在本系统卡（System Card）中，我们报告了七个领域的一系列部署前评估：[负责任扩展政策](https://www.anthropic.com/responsible-scaling-policy)（Responsible Scaling Policy）评估、网络安全、安全防护与无害性、智能体安全、对齐（alignment）、模型福祉（model welfare）以及能力。每一节都会说明其评估的是该模型的哪种配置。

### 1.1 训练数据与流程

Claude Fable 5.1 和 Claude Mythos 5.1 的训练数据是一种专有组合，包括来自互联网的公开信息、公开和非公开数据集，以及由其他模型生成的合成数据。在训练过程中，我们使用了多种数据清洗和过滤方法，包括去重和分类。我们使用名为 ClaudeBot 的通用网络爬虫从公开网站获取训练数据。对于网站运营者为表明是否允许爬取其网站内容而设置的 “robots.txt” 指令，该爬虫遵循行业标准做法。我们不会访问受密码保护的页面，也不会访问需要登录或 CAPTCHA 验证的页面。我们对所使用的训练数据进行尽职调查。该爬虫以透明方式运行；网站运营者可以轻松识别它何时爬取了其网页，并向我们表明其偏好。

在预训练过程之后，模型经历了严格的后训练和微调，目的是使其成为一个行为符合 [Claude](https://www.anthropic.com/constitution) [宪法](https://www.anthropic.com/constitution)（Claude’s constitution）中所述价值观的助手。Claude 支持多种语言，通常使用与用户输入相同的语言进行回应。输出质量因语言而异。Claude 仅输出文本。

Fable 5.1 和 Mythos 5.1 的知识截止日期为 2026 年 6 月。

{{< s1-page 11 >}}

### 1.2 众包工作者

Anthropic 与数据工作平台合作，聘用工作者通过偏好选择、安全评估和对抗性测试帮助改进我们的模型。Anthropic 只与符合以下条件的平台合作：认同我们关于向工作者提供公平且合乎道德的报酬的理念，并承诺无论身处何地都采取安全的工作场所做法，遵循我们采购合同中详细规定的众包工作者福祉标准。

### 1.3 使用政策与支持

Anthropic 的[使用政策](https://www.anthropic.com/legal/aup)（Usage Policy）详细规定了我们模型的禁止用途，以及在高风险和其他特定场景中使用的要求。

对于受适用监管制度约束的模型，我们已在[前沿合规框架](https://trust.anthropic.com/resources?s=u0v3axvddg70fujf93ra7&name=anthropic-frontier-compliance-framework)（Frontier Compliance Framework，FCF）中正式规定了我们如何履行此类法规下的义务。FCF 记录了我们当前针对关键风险类别开展系统性风险评估与缓解的技术和组织规程。它是我们适用于相关监管制度的合规框架，包括加利福尼亚州的《前沿人工智能透明度法案》（Transparency in Frontier AI Act，TFAIA）以及《欧盟人工智能法案》（EU AI Act）的通用人工智能行为准则（General-Purpose AI Code of Practice）。

Anthropic Ireland, Limited 是 Anthropic 通用人工智能模型在欧洲经济区（European Economic Area）的提供方。

如需联系 Anthropic，请访问我们的[支持页面](https://support.claude.com/en/)。

### 1.4 模型评估

在训练过程的不同阶段，我们会获取模型的不同“快照”。训练期间还存在模型的不同版本，包括不含任何安全防护措施的“仅有用（helpful-only）”版本。除非另有说明，本系统卡中的评估均基于 Claude Fable 5.1 或 Claude Mythos 5.1 的最终快照。

在本系统卡中，我们根据具体情况决定评估 Mythos 5.1（无安全防护措施，反映模型的底层能力）还是 Fable 5.1（具有安全防护措施，与普遍访问下的用户体验一致）。全文均明确标注了我们评估的是二者中的哪一个。其他开发者模型的数据通常取自这些开发者公布的结果或公开排行榜，不过在某些情况下，我们自行运行了这些评估。

{{< s1-page 12 >}}

### 1.5 外部测试

Claude Fable 5.1 和 Claude Mythos 5.1 的大部分评估是在 Anthropic 内部开展的。作为前沿合规框架的一部分，我们还聘请外部评估方测试模型的不同迭代版本，例如经过无害性训练的版本、未经过无害性训练的版本，或两者兼有。他们的意见有助于我们对系统性风险领域作出风险判定，并为我们的发布决策提供参考。有关我们如何根据 FCF 征求外部专家意见的更多信息，请参阅 [FCF 第 5 节](https://trust.anthropic.com/resources?s=u0v3axvddg70fujf93ra7&name=anthropic-frontier-compliance-framework)。

我们感谢所有外部测试方对模型开展评估并与我们分享结果。他们的具体贡献在本系统卡的相关章节中加以说明。
