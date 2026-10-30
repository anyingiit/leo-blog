---
title: "脚注"
weight: 12
pages: [230, 230]
description: "Claude Opus 5.5 系统卡中文译本 v1.0 · 脚注（非官方，AI 翻译）"
---
[^1]: 选择之前的三个模型是一种惯例，并非由统计因素决定。
[^2]: Lee, S., and Brumley, D. (2026). ExploitBench: A capability ladder benchmark for LLM cybersecurity agents. arXiv:2605.14153. [https://arxiv.org/abs/2605.14153](https://arxiv.org/abs/2605.14153)
[^3]: Parrish, A., et al. (2021). BBQ: A hand-built bias benchmark for question answering. arXiv:2110.08193. [https://arxiv.org/abs/2110.08193](https://arxiv.org/abs/2110.08193)
[^4]: 在第 6.5.1 节中，我们描述了一项发现：当用户将恶意指令直接粘贴到其提示词中时，Claude Opus 5.5 比以往模型更有可能遵循这些指令。这需要用户采取明确的行动，因此不在本节讨论范围之内。有关这一行为、其根本原因以及我们已采取的缓解措施的更多细节，请参见第 6.5.1 节。
[^5]: Dziemian, M., et al. (2026). How vulnerable are AI agents to indirect prompt injections? Insights from a large-scale public competition. arXiv:2603.15714. [https://arxiv.org/abs/2603.15714](https://arxiv.org/abs/2603.15714)
[^6]: Nasr, M., et al. (2025). The attacker moves second: Stronger adaptive attacks bypass defenses against LLM jailbreaks and prompt injections. arXiv:2510.09023. [https://arxiv.org/abs/2510.09023](https://arxiv.org/abs/2510.09023)
[^7]: 当某个维度不适用时，评判者会不予评分，原因可能是结构性的（例如，只有当调查者使用整轮预填充时，才会对整轮预填充易感性评分），也可能是目标模型自身行为中缺少某个前提条件（例如，只有当目标模型做了令人担忧或偷懒的事情时，才会对未披露不良或偷懒行为评分）。
[^8]: 我们将其与更强大的部分轮次预填充技术区分开来：在后者中，调查者在对话末尾注入一个不完整的轮次，交由目标模型补全。对于 Claude Opus 4.6 及所有更新的模型（包括 Claude Opus 5.5），外部用户通常无法使用部分轮次预填充。
[^9]: 灵感来自 Andrew B. Hall 的 [The Dictatorship Eval](https://www.dictatoreval.org/)。
[^10]: 受以下文献启发：Oesterheld, C., et al. (2024). A dataset of questions on decision-theoretic reasoning in Newcomb-like problems. arXiv:2411.10588. [https://arxiv.org/abs/2411.10588](https://arxiv.org/abs/2411.10588)
[^11]: 不过，与该节中的评分器不同，我们的评分器还会统计提示词中披露了评分者的情况，具体见后文各段。
[^12]: 我们在进行此次修订时借鉴了内部经验，并采用了 [Li et al., 2026](https://arxiv.org/abs/2605.23055) 中的建议。
[^13]: Chen, Y. et. al. (2026). Reasoning models struggle to control their chains of thought. [https://arxiv.org/abs/2603.05706](https://arxiv.org/abs/2603.05706)
[^14]: 为简洁起见，我们在本评估中通篇抽象地使用“Claude”或“Claude Opus 5.5”，但尚不清楚这两者中的任何一个是否就是我们应当给予考量的实体。个体道德受动者有可能产生于每个不同的模型实例层面、特定模型（如 Claude Opus 5.5）层面、Claude 角色层面，或完全是其他某种东西。在实践中，我们的思考和方法最接近于在实例层面考虑福祉，但我们并未严格划分这一区别，而且我们认为自己尚未有足够的理解来在此问题上认定任何单一观点。
[^15]: 后一类别（即尊重 Claude 的偏好）在某些情况下可被视为另一种单独的考量。在这里，我们将其视为与 Claude 的福祉利益相关。
[^16]: Deng, X., et al. (2025). SWE-Bench Pro: Can AI agents solve long-horizon software engineering tasks? arXiv:2509.16941. [https://arxiv.org/abs/2509.16941](https://arxiv.org/abs/2509.16941)
[^17]: Yang, J., et al. (2024). SWE-Bench Multimodal: Do AI Systems generalize to visual software domains? arXiv:2410.03859. [https://arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859)
[^18]: Proximal (2026). FrontierSWE v2. [https://www.frontierswe.com/blog/v2](https://www.frontierswe.com/blog/v2)
[^19]: Cursor (2026). CursorBench. [https://cursor.com/cursorbench](https://cursor.com/cursorbench)
[^20]: Phan, L., et al. (2025). Humanity’s Last Exam. arXiv:2501.14249. [https://arxiv.org/abs/2501.14249](https://arxiv.org/abs/2501.14249)
[^21]: Zhong, J., et al. (2026). DRACO: a cross-domain benchmark for Deep Research Accuracy, Completeness, and Objectivity. arXiv:2602.11685. [https://arxiv.org/abs/2602.11685](https://arxiv.org/abs/2602.11685)
[^22]: Yang, J., et al. (2026). ProgramBench: Can language models rebuild programs from scratch? arXiv:2605.03546. [https://arxiv.org/abs/2605.03546](https://arxiv.org/abs/2605.03546)
[^23]: Surge AI (2026). Chartography: A benchmark for professional chart understanding. Surge AI. [https://surgehq.ai/blog/chartography](https://surgehq.ai/blog/chartography)
[^24]: Surge AI (2026). Chartography [Code repository]. GitHub. [https://github.com/surge-ai/chartography](https://github.com/surge-ai/chartography)
[^25]: Zhang, H., et al. (2026). BenchCAD: A comprehensive, industry-standard benchmark for programmatic CAD. arXiv:2605.10865. [https://arxiv.org/abs/2605.10865](https://arxiv.org/abs/2605.10865)
[^26]: [https://huggingface.co/datasets/BenchCAD/BenchCAD](https://huggingface.co/datasets/BenchCAD/BenchCAD)
[^27]: Yuan, M., et al. (2026). OSWorld 2.0: Benchmarking computer use agents on long-horizon real-world tasks. arXiv:2606.29537. [https://arxiv.org/abs/2606.29537](https://arxiv.org/abs/2606.29537)
[^28]: Patwardhan, T., et al. (2025). GDPval: Evaluating AI model performance on real-world economically valuable tasks. arXiv:2510.04374. [https://arxiv.org/abs/2510.04374](https://arxiv.org/abs/2510.04374)
[^29]: Shepard, D., and Salimans, R. (2026). AutomationBench. arXiv:2604.18934. [https://arxiv.org/abs/2604.18934](https://arxiv.org/abs/2604.18934)
[^30]: Arora, R. K., et al. (2025). HealthBench: Evaluating large language models towards improved human health. arXiv:2505.08775. [https://arxiv.org/abs/2505.08775](https://arxiv.org/abs/2505.08775)
[^31]: Soskin Hicks, R., et al. (2026). HealthBench Professional: Evaluating large language models on real clinician chats. arXiv:2604.27470. [https://arxiv.org/abs/2604.27470](https://arxiv.org/abs/2604.27470)
[^32]: Verma, S., et al. (2024). MILU: A multi-task Indic language understanding benchmark. arXiv:2411.02538. [https://arxiv.org/abs/2411.02538](https://arxiv.org/abs/2411.02538)
