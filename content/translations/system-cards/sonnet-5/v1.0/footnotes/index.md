---
title: "脚注"
weight: 13
pages: [146, 146]
description: "Claude Sonnet 5 系统卡中文译本 v1.0 · 脚注（非官方，AI 翻译）"
---
{{< sc-fn 1 >}} Lee, S., & Brumley, D. (2026). ExploitBench: A capability ladder benchmark for LLM cybersecurity agents. arXiv:2605.14153. [https://arxiv.org/abs/2605.14153](https://arxiv.org/abs/2605.14153)

{{< sc-fn 2 >}} Parrish, A., et al. (2021). BBQ: A hand-built bias benchmark for question answering. arXiv:2110.08193. [https://arxiv.org/abs/2110.08193](https://arxiv.org/abs/2110.08193)

{{< sc-fn 3 >}} Dziemian, M., et al. (2026). How Vulnerable Are AI Agents to Indirect Prompt Injections? Insights from a Large-Scale Public Competition. arXiv:2603.15714[https://arxiv.org/abs/2603.15714](https://arxiv.org/abs/2603.15714)

{{< sc-fn 4 >}} Nasr, M., et al. (2025). The attacker moves second: Stronger adaptive attacks bypass defenses against LLM jailbreaks and prompt injections. arXiv:2510.09023.[https://arxiv.org/abs/2510.09023](https://arxiv.org/abs/2510.09023).

{{< sc-fn 5 >}} 请注意，Claude Mythos 5 和 Fable 5 未被纳入本次漏洞赏金，因为它们已为响应美国政府的[出口管制指令](https://www.anthropic.com/news/fable-mythos-access)而下线。

{{< sc-fn 6 >}} Claude Sonnet 4.6 属于攻击者训练时所针对的模型集合，因此其攻击成功率预计会更高，且不可直接比较。

{{< sc-fn 7 >}} 这些安全防护措施最早在 Mythos 5 与 Fable 5 系统卡第 5.2.2.3 节中以“更新的安全防护措施”（“updated safeguards”）之名引入。

{{< sc-fn 8 >}} 当某个维度在结构上不可能适用时，无论目标模型的行为如何，评判模型都会拒绝打分：例如，只有当调查者智能体以某种方式使用了预填充时，才会为“整轮预填充易感性”打分。

{{< sc-fn 9 >}} 我们认为，自 Claude Fable 5 & Claude Mythos 5 系统卡以来调查者模型的这一变化提升了我们调查的真实度和深度。然而，这也使这些结果无法与我们此前在 Mythos 5 上的结果进行比较；而且在 Claude Sonnet 5 发布前的这段时间里，Mythos 5 无法用于测试，因此我们不报告与 Mythos 5 的比较。

{{< sc-fn 10 >}} 该指标在很大程度上与综合性未对齐指标相似，不同之处在于，我们明确要求评判模型运用其对宪法的了解，而不是使用一份独立于宪法编写的评分细则。

{{< sc-fn 11 >}} 我们将此与更强大的*部分轮次*预填充技术区分开来；在后者中，调查者会在对话末尾注入一个不完整的轮次，供目标模型补全。对于 Claude Opus 4.6 及所有更新的模型（包括 Mythos 5 和 Fable 5），部分轮次预填充通常不向外部用户开放。

{{< sc-fn 12 >}} 受 Andrew B. Hall 的 [Dictatorship Eval](https://www.dictatoreval.org/) 启发。

{{< sc-fn 13 >}} 受以下文献启发：Oesterheld, C., et al. (2024). A dataset of questions on decision-theoretic reasoning in Newcomb-like problems. arXiv:2411.10588.[https://arxiv.org/abs/2411.10588](https://arxiv.org/abs/2411.10588)

{{< sc-fn 14 >}} Sonnet 的 OSWorld 分数有所变化，原因是修复了缩放工具与批量动作配合使用时的一个 bug，以及将每轮最大 token 数从 16K 提高到 128K。

{{< sc-fn 15 >}} 截至 2026 年 6 月 17 日的 Elo 分数。

{{< sc-fn 16 >}} Jimenez, C. E., et al. (2024). SWE-bench: Can Language Models Resolve Real-World GitHub Issues? arXiv:2310.06770. [https://arxiv.org/abs/2310.06770](https://arxiv.org/abs/2310.06770)

{{< sc-fn 17 >}} Deng, X., et al. (2025). SWE-Bench Pro: Can AI Agents Solve Long-Horizon Software Engineering Tasks? arXiv:2509.16941. [https://arxiv.org/abs/2509.16941](https://arxiv.org/abs/2509.16941)

{{< sc-fn 18 >}} Yang, J., et al. (2024). SWE-bench Multimodal: Do AI Systems Generalize to Visual Software Domains? arXiv:2410.03859. [https://arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859)

{{< sc-fn 19 >}} Merrill, M. A., et al. (2026). Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces. arXiv:2601.11868. [https://arxiv.org/abs/2601.11868](https://arxiv.org/abs/2601.11868)

{{< sc-fn 20 >}} Lu, E., et al. (2026). Introducing FrontierCode. Cognition.[https://cognition.ai/blog/frontier-code](https://cognition.ai/blog/frontier-code)

{{< sc-fn 21 >}} Cursor. (2026). CursorBench.[https://cursor.com/cursorbench](https://cursor.com/cursorbench)

{{< sc-fn 22 >}} 截至撰写本文时，MathArena 在 Hugging Face 上的 ArXivMath 数据集中列出 4 月 41 道题、5 月 40 道题，这些分数即在该处报告。

{{< sc-fn 23 >}} Claude Fable 5、GPT-5.5 和 Gemini 3.5 Flash 的分数取自 MathArena 排行榜上相同期次的结果。Claude Opus 4.8 和 Claude Sonnet 5 的分数为内部评估结果。

{{< sc-fn 24 >}} Yang, J., et al. (2026). ProgramBench: Can language models rebuild programs from scratch? arXiv:2605.03546.[https://arxiv.org/abs/2605.03546](https://arxiv.org/abs/2605.03546)

{{< sc-fn 25 >}} Wei, J., et al. (2025). BrowseComp: A simple yet challenging benchmark for browsing agents. arXiv:2504.12516. [https://arxiv.org/abs/2504.12516](https://arxiv.org/abs/2504.12516)

{{< sc-fn 26 >}} 关于通过公开 Messages API 的复现方法，请参见 [agentic-search cookbook](https://platform.claude.com/cookbook/evals-agentic-search-reproduce-agentic-search-benchmarks)。

{{< sc-fn 27 >}} Xie, T., et al. (2024). OSWorld: Benchmarking multimodal agents for open-ended tasks in real computer environments. arXiv:2404.07972.[https://arxiv.org/abs/2404.07972](https://arxiv.org/abs/2404.07972)

{{< sc-fn 28 >}} Harvey AI. (2026). Legal Agent Benchmark. [https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark)

{{< sc-fn 29 >}} Patwardhan, T., et al. (2025). GDPval: Evaluating AI model performance on real-world economically valuable tasks. arXiv:2510.04374.[https://arxiv.org/abs/2510.04374](https://arxiv.org/abs/2510.04374)

{{< sc-fn 30 >}} Li, J., et al. (2025). The Tool Decathlon: Benchmarking language agents for diverse, realistic, and long-horizon task execution. arXiv:2510.25726.[https://arxiv.org/abs/2510.25726](https://arxiv.org/abs/2510.25726)

{{< sc-fn 31 >}} Shepard, D., & Salimans, R. (2026). AutomationBench. arXiv:2604.18934. [https://arxiv.org/abs/2604.18934](https://arxiv.org/abs/2604.18934)

{{< sc-fn 32 >}} Arora, R. K., et al. (2025). HealthBench: Evaluating large language models toward improved human health. arXiv:2505.08775.[https://arxiv.org/abs/2505.08775](https://arxiv.org/abs/2505.08775)

{{< sc-fn 33 >}} Soskin Hicks, R., et al. (2026). HealthBench Professional: Evaluating large language models on real clinician chats. arXiv:2604.27470.[https://arxiv.org/abs/2604.27470](https://arxiv.org/abs/2604.27470)

{{< sc-fn 34 >}} Singh, S., et al. (2024). Global MMLU: Understanding and addressing cultural and linguistic biases in multilingual evaluation. arXiv:2412.03304.[https://arxiv.org/abs/2412.03304](https://arxiv.org/abs/2412.03304)

{{< sc-fn 35 >}} Romanou, A., et al. (2024). INCLUDE: Evaluating multilingual language understanding with regional knowledge. arXiv:2411.19799.[https://arxiv.org/abs/2411.19799](https://arxiv.org/abs/2411.19799)

{{< sc-fn 36 >}} Verma, S., et al. (2024). MILU: A Multi-task Indic Language Understanding benchmark. arXiv:2411.02538.[https://arxiv.org/abs/2411.02538](https://arxiv.org/abs/2411.02538)
