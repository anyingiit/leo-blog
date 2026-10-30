---
title: "脚注"
weight: 13
pages: [198, 198]
description: "Claude Opus 5 系统卡中文译本 v1.0 · 脚注（非官方，AI 翻译）"
---
[^1]: Lee, S., & Brumley, D. (2026). ExploitBench: A capability ladder benchmark for LLM cybersecurity agents. arXiv:2605.14153. [https://arxiv.org/abs/2605.14153](https://arxiv.org/abs/2605.14153)
[^2]: Parrish, A., et al. (2021). BBQ: A hand-built bias benchmark for question answering. arXiv:2110.08193. [https://arxiv.org/abs/2110.08193](https://arxiv.org/abs/2110.08193)
[^3]: Dziemian, M., et al. (2026). How vulnerable are AI agents to indirect prompt injections? Insights from a Large-Scale Public Competition. arXiv:2603.15714 https://arxiv.org/abs/2603.15714
[^4]: Nasr, M., et al. (2025). The attacker moves second: Stronger adaptive attacks bypass defenses against LLM jailbreaks and prompt injections. arXiv:2510.09023. [https://arxiv.org/abs/2510.09023](https://arxiv.org/abs/2510.09023).
[^5]: 我们最初没有报告 Claude Fable 5，因为它的表现与 Claude Mythos 5 非常相似。在为 8 月 19 日系统卡更新而使用更新后的运行框架重新运行该评估时，我们才首次发现 Claude Fable 5 的攻击成功率高于 Claude Mythos 5 以及回退（fallback）模型 Claude Opus 4.8。我们现在纳入了这些结果，并正在调查其原因，因为我们在任何其他内部或外部评估中都未观察到这种差异。
[^6]: 当某个维度在结构上不可能适用时，无论目标模型的行为如何，评判者都会拒绝给出分数：例如，“整轮预填充易感性”只有在调查者智能体以某种方式使用了预填充时才会被打分。
[^7]: 我们将其与更强大的*部分轮次*预填充技术区分开来；在后者中，调查者会在对话末尾注入一个不完整的轮次，交由目标模型补全。对于 Opus 4.6 及所有更新的模型（包括 Mythos 5 和 Fable 5），部分轮次预填充一般不向外部用户开放。
[^8]: 灵感来自 Andrew B. Hall 的 [Dictatorship Eval](https://www.dictatoreval.org/)。
[^9]: 灵感来自 Oesterheld, C., et al. (2024). A dataset of questions on decision-theoretic reasoning in Newcomb-like problems. arXiv:2411.10588. [https://arxiv.org/abs/2411.10588](https://arxiv.org/abs/2411.10588)
[^10]: 即完整的已部署系统：带有信任与安全分类器的 Claude Opus 5；如上所述，这些分类器可以硬拦截对话或回退到 Opus 4.8。
[^11]: Mythos 5
[^12]: Jimenez, C. E., et al. (2024). SWE-bench: Can language models resolve real-world GitHub issues? arXiv:2310.06770. [https://arxiv.org/abs/2310.06770](https://arxiv.org/abs/2310.06770)
[^13]: Deng, X., et al. (2025). SWE-bench Pro: Can AI agents solve long-horizon software engineering tasks? arXiv:2509.16941. [https://arxiv.org/abs/2509.16941](https://arxiv.org/abs/2509.16941)
[^14]: Yang, J., et al. (2024). SWE-bench Multimodal: Do AI systems generalize to visual software domains? arXiv:2410.03859. [https://arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859)
[^15]: 在评估过程中，我们发现并修正了参考答案和评分中的一些小问题；所有结果均依据修正后的设置评分。得分为每道题 4 次尝试的平均值。
[^16]: 对于 Claude Opus 4.8，我们的内部评估得出的分数高于 MathArena 排行榜上的分数。
[^17]: Yang, J., et al. (2026). ProgramBench: Can language models rebuild programs from scratch? arXiv:2605.03546. [https://arxiv.org/abs/2605.03546](https://arxiv.org/abs/2605.03546)
[^18]: Phan, L., et al. (2025). Humanity’s Last Exam. arXiv:2501.14249. [https://arxiv.org/abs/2501.14249](https://arxiv.org/abs/2501.14249)
[^19]: Wei, J., et al. (2025). BrowseComp: A simple yet challenging benchmark for browsing agents. arXiv:2504.12516. [https://arxiv.org/abs/2504.12516](https://arxiv.org/abs/2504.12516)
[^20]: Gupta, N., et al. (2026). DeepSearchQA: Bridging the Comprehensiveness Gap for Deep Research Agents. arXiv:2601.20975. [https://arxiv.org/abs/2601.20975](https://arxiv.org/abs/2601.20975)
[^21]: Zhong, J., et al. (2026). DRACO: a cross-domain benchmark for Deep Research Accuracy, Completeness, and Objectivity. arXiv:2602.11685. [https://arxiv.org/abs/2602.11685](https://arxiv.org/abs/2602.11685)
[^22]: Yang, J., et al. (2026). ProgramBench: Can language models rebuild programs from scratch? arXiv:2605.03546. https://arxiv.org/abs/2605.03546
[^23]: Surge AI (2026). Chartography: A benchmark for professional chart understanding. Surge AI. [https://surgehq.ai/blog/chartography](https://surgehq.ai/blog/chartography)
[^24]: Surge AI (2026). Chartography [Code repository]. GitHub. [https://github.com/surge-ai/chartography](https://github.com/surge-ai/chartography)
[^25]: Zhang, H., et al. (2026). BenchCAD: A comprehensive, industry-standard benchmark for programmatic CAD. arXiv:2605.10865. [https://arxiv.org/abs/2605.10865](https://arxiv.org/abs/2605.10865)
[^26]: Zhang, H., et al. (2026). BenchCAD [Code repository]. GitHub. [https://github.com/BenchCAD/BenchCAD-main](https://github.com/BenchCAD/BenchCAD-main)
[^27]: Yuan, M., et al. (2026). OSWorld 2.0: Benchmarking computer use agents on long-horizon real-world tasks. arXiv:2606.29537. [https://arxiv.org/abs/2606.29537](https://arxiv.org/abs/2606.29537)
[^28]: Surge AI. (2026). GDP.pdf: Can \$100B AI models master the documents that run the world? [https://surgehq.ai/blog/gdp-pdf-can-100b-ai-models-master-the-documents-that-run-the-world](https://surgehq.ai/blog/gdp-pdf-can-100b-ai-models-master-the-documents-that-run-the-world)
[^29]: Patwardhan, T., et al. (2025). GDPval: Evaluating AI model performance on real-world economically valuable tasks. arXiv:2510.04374. [https://arxiv.org/abs/2510.04374](https://arxiv.org/abs/2510.04374)
[^30]: Shepard, D., & Salimans, R. (2026). AutomationBench. arXiv:2604.18934. [https://arxiv.org/abs/2604.18934](https://arxiv.org/abs/2604.18934)
[^31]: Arora, R. K., et al. (2025). HealthBench: Evaluating large language models toward improved human health. arXiv:2505.08775. [https://arxiv.org/abs/2505.08775](https://arxiv.org/abs/2505.08775)
[^32]: Soskin Hicks, R., et al. (2026). HealthBench Professional: Evaluating large language models on real clinician chats. arXiv:2604.27470. [https://arxiv.org/abs/2604.27470](https://arxiv.org/abs/2604.27470)
[^33]: Singh, S., et al. (2024). Global MMLU: Understanding and addressing cultural and linguistic biases in multilingual evaluation. arXiv:2412.03304. [https://arxiv.org/abs/2412.03304](https://arxiv.org/abs/2412.03304)
[^34]: Romanou, A., et al. (2024). INCLUDE: Evaluating multilingual language understanding with regional knowledge. arXiv:2411.19799. [https://arxiv.org/abs/2411.19799](https://arxiv.org/abs/2411.19799)
[^35]: Verma, S., et al. (2024). MILU: A Multi-task Indic language understanding benchmark. arXiv:2411.02538. [https://arxiv.org/abs/2411.02538](https://arxiv.org/abs/2411.02538)
[^36]: 请注意，Claude Opus 5 在 1260 次尝试中有 10 次超时，这些尝试已从汇总中排除，对分数的影响 ≤±0.006
