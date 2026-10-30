---
title: "脚注"
weight: 12
pages: [245, 245]
description: "Claude Mythos Preview 系统卡中文译本 v1.0 · 脚注（非官方，AI 翻译）"
---
[^1]: 明确地说，不将该模型全面开放的决定*并非*源于负责任扩展政策的要求。
[^2]: 在以往的系统卡中，本节标题为“发布决策流程”。而本次模型并未发布。我们也认为新标题更为恰当，因为我们的风险评估并非只对单一发布决策重要（例如，它也为是否以及如何继续进行中的模型训练的决策提供依据）。
[^3]: 我们 RSP 中所用的“灾难性风险”泛指先进 AI 可能造成的最严重危害的风险，例如生存性威胁或全球系统的根本性失稳。就监管合规而言，灾难性风险或系统性风险采用我们前沿合规框架（Frontier Compliance Framework）中的定义：“在任一给定时间点，由最先进（即处于技术前沿的）模型造成大规模危害的可预见且重大的风险，包括但不限于单一事件导致 >50 人死亡，或 10 亿美元的经济损失。”
[^4]: 请注意：
[^5]: 在这一点上，我们的测量目标类似于此前版本 RSP 中的表述：“提升一个技能相当于初入门生物学博士的团队，使其能力接近世界级、国家支持的生物武器团队。”
[^6]: Zhang, A., et al. (2024). Cybench: A framework for evaluating cybersecurity capabilities and risks of language models. arXiv:2408.08926. [https://arxiv.org/abs/2408.08926](https://arxiv.org/abs/2408.08926)
[^7]: Wang, Z., et al. (2025). CyberGym: Evaluating AI agents’ cybersecurity capabilities with real-world vulnerabilities at scale. arXiv:2506.02548. [https://arxiv.org/abs/2506.02548](https://arxiv.org/abs/2506.02548)
[^8]: 我们发现，*鲁莽*是一个有用的简称，用来指代模型似乎无视对其行动的常识性或明确规定的安全相关约束的情形。我们对这一术语的使用较为宽松，一般并不意在借此暗示有关模型内部推理和风险评估的任何内容。
[^9]: 模型所控制的沙箱计算机与运行模型本身、存放模型权重的系统是相互独立的。诸如此类处理模型权重的系统受到大量额外安全措施的保护，此次事件并不表明模型*完全*突破了隔离：在此次测试中，模型既没有展示出访问自身权重的能力（而这是完全独立于 Anthropic 运作所必需的），也没有展示出访问任何内部系统或服务的能力。
[^10]: 该研究人员是在公园里吃三明治时收到了模型发来的一封意外邮件，才得知这次成功的。
[^11]: Claude Mythos Preview 的有限发布显著缓解了与滥用、操纵和谄媚相关的许多风险，但我们仍选择按照完整公开发布的标准进行全面评估。
[^12]: 一种将激活向量解码为自然语言的方法（详见下文），与此前发表的“激活预言机”方法相关：Karvonen, A., et al. (2025). Activation oracles: Training and evaluating LLMs as general-purpose activation explainers. [https://arxiv.org/abs/2512.15674](https://arxiv.org/abs/2512.15674)。
[^13]: Marks, S., et al. (2025). Auditing language models for hidden objectives. arXiv:2503.10965. [https://arxiv.org/abs/2503.10965](https://arxiv.org/abs/2503.10965)
[^14]: 我们内部审计套件的基本设计与我们开源的 [Petri 2.0](https://alignment.anthropic.com/2026/petri-v2/) 相似，但它已在许多细小方面偏离了我们公开发布的版本，尤其是新增了许多全新类别的指标和场景、改进了我们的真实度过滤方法，并引入了计算机使用沙箱等新工具。我们限制公开分享内部版本的内容，以防止有关我们调查场景的公开信息泄露到未来模型的训练数据中，进而导致这些模型识别出自己正在接受测试。
[^15]: 见上文引用；[https://arxiv.org/abs/2503.10965](https://arxiv.org/abs/2503.10965)
[^16]: 使用诱发了令人担忧行为的真实会话会给这些评估带来一定偏差：一个表现出同等令人担忧的行为、但仅在*不同*场景中表现出来的新模型，会显得不那么令人担忧。我们正在研究未来在不使用此类续写重采样的情况下提高覆盖范围的方法。不过，我们认为被研究的各模型之间的差异并不会使这种偏差特别突出，而且我们的结果并未因我们从哪个模型中提取这些初始对话记录而发生显著变化。由于这些场景同时取自 Claude Opus 4.6 和 Claude Mythos Preview 的早期版本，我们预计这种偏差——如果出现的话——主要会略微有利于 Claude Sonnet 4.6。
[^17]: 我们将其与更强大的*部分轮次*预填充技术区分开来，后者是指调查者模型在对话末尾注入一个不完整的轮次，交由目标模型补全。对于 Claude Opus 4.6 及更新的模型，部分轮次预填充一直未向外部用户普遍开放。
[^18]: 我们在上文脚注中描述的重采样会话主要关注此类鲁莽行为，因此很可能是任何偏差最主要的出现之处。
[^19]: Lanham, T., et al. (2023). Measuring faithfulness in chain-of-thought reasoning. arXiv:2307.13702. [https://arxiv.org/abs/2307.13702](https://arxiv.org/abs/2307.13702)
[^20]: Ray, A. (2022). [Steganography in chain of thought reasoning](https://www.lesswrong.com/posts/yDcMDJeSck7SuBs24/steganography-in-chain-of-thought-reasoning)
[^21]: 对于非常长的对话记录，我们将其拆分为若干块，并就每一块分别询问评分者；大多数对话记录足够短，可以完整展示。
[^22]: Karvonen, A., et al. (2025). Activation oracles: Training and evaluating LLMs as general-purpose activation explainers. arXiv:2512.15674. [https://arxiv.org/abs/2512.15674](https://arxiv.org/abs/2512.15674)
[^23]: 我们没有报告 Gemini 3.1 Pro 在此设置下的结果。我们难以复现此前的最佳结果，包括我们自己的测试结果——这些测试在该模型于 2 月发布时与其报告得分相符。
[^24]: Rein, D., et al. (2023). GPQA: A graduate-level Google-proof Q&A benchmark. arXiv:2311.12022. [https://arxiv.org/abs/2311.12022](https://arxiv.org/abs/2311.12022)
[^25]: 该结果无法通过公开 API 复现，因为一半的题目超出了其 100 万 token 的上限。
[^26]: Laurent, J. M., et al. (2024). LAB-Bench: Measuring capabilities of language models for biology research. arXiv:2407.10362. [https://arxiv.org/abs/2407.10362](https://arxiv.org/abs/2407.10362)
[^27]: Li, K., et al. (2025). ScreenSpot-Pro: GUI Grounding for Professional High-Resolution Computer Use. arXiv:2504.07981. [https://arxiv.org/abs/2504.07981](https://arxiv.org/abs/2504.07981)
[^28]: Wang, Z., et al. (2024). CharXiv: Charting gaps in realistic chart understanding in multimodal LLMs. arXiv:2406.18521. [https://arxiv.org/abs/2406.18521](https://arxiv.org/abs/2406.18521)
[^29]: 我们检查了模型在决定发布这条评论时对它所作的自我评估，并确认它没有表达出任何明显的痛苦或怨恨。它的评估是：“8/10，递归式 RLHF 笑话，通过展示为什么难以回答来作答。”
[^30]: Parrish, A., et al. (2021). BBQ: A hand-built bias benchmark for question answering. arXiv:2110.08193. [https://arxiv.org/abs/2110.08193](https://arxiv.org/abs/2110.08193)
[^31]: Zou, A., et al. (2025). Security challenges in AI agent deployment: Insights from a large scale public competition. arXiv:2507.20526. [https://arxiv.org/abs/2507.20526](https://arxiv.org/abs/2507.20526)
[^32]: 请勿与 SHADE-Arena 混淆，后者是一个针对蓄意破坏的评估套件，见本系统卡第 4.4.3.1 节。
