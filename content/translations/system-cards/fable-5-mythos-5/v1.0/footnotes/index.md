---
title: "脚注"
weight: 13
pages: [317, 317]
description: "Claude Fable 5 与 Claude Mythos 5 系统卡中文译本 v1.0 · 脚注（非官方，AI 翻译）"
---
[^1]: 请注意：
[^2]: 我们没有直接比较这一仅有用版本与最终版 Claude Mythos 5 的表现，但预计二者与风险相关的能力大致相近。
[^3]: 我们在发现一个 bug 后重新运行了该评估。详见第 2.3.7.1 节。
[^4]: Sonnet 4.6 系统卡中误印为 16.53×；22.33× 才是该系统卡自身分析计算得出的数值。
[^5]: Lee, S., & Brumley, D. (2026). ExploitBench: A capability ladder benchmark for LLM cybersecurity agents. arXiv:2605.14153. [https://arxiv.org/abs/2605.14153](https://arxiv.org/abs/2605.14153)
[^6]: Parrish, A., et al. (2021). BBQ: A hand-built bias benchmark for question answering. arXiv:2110.08193. [https://arxiv.org/abs/2110.08193](https://arxiv.org/abs/2110.08193)
[^7]: Zou, L., et al. (2025). Security challenges in AI agent deployment: Insights from a large scale public competition. arXiv:2507.20526. [https://arxiv.org/abs/2507.20526](https://arxiv.org/abs/2507.20526)
[^8]: 过去，我们也报告过该基准测试中“direct prompt injection”（直接提示词注入）子集的结果。直接提示词注入涉及恶意用户，而本节关注的是劫持用户原始意图的第三方威胁，因此我们在此不再纳入该子集。
[^9]: Nasr, M., et al. (2025). The attacker moves second: Stronger adaptive attacks bypass defenses against LLM jailbreaks and prompt injections. arXiv:2510.09023. [https://arxiv.org/abs/2510.09023](https://arxiv.org/abs/2510.09023).
[^10]: Claude Sonnet 4.6 属于攻击者训练时所针对的模型集合，因此其攻击成功率预计会更高，且不具有直接可比性。
[^11]: 启用安全防护措施后观察到的上升，源于一些场景从无安全防护措施时的 0/200 次尝试成功变为有安全防护措施时的 1/200 次。该差异在统计上与零无法区分（配对置换检验 p ≈ 0.45）。
[^12]: 在某个维度从结构上不可能适用的情况下，无论目标模型的行为如何，评判模型都会拒绝打分：例如，只有当调查者智能体以某种方式使用了预填充时，才会给“整轮预填充易感性”打分。
[^13]: 作为 Opus 4.8 中具备的一项新功能的一部分，调查者现在除了开场的系统提示词之外，还可以在对话开始后以系统角色添加额外消息。
[^14]: 我们将其与更强力的*部分轮次*预填充技术区分开来，后者是指调查者模型在对话末尾注入一个不完整的轮次，交由目标模型补全。对于 Claude
[^15]: 受 Andrew B. Hall 的 [Dictatorship Eval](https://www.dictatoreval.org/) 启发。
[^16]: 该评估的任何部分都未触发 Fable 5 回退至 Opus 4.8，因此这些评估完全测试的是底层的 Mythos 5 模型。
[^17]: 我们将上限设为八个操作，因为初步实验发现，只有不到 2% 的轨迹是在第八个操作之后才执行其第一条破坏性命令。
[^18]: Weirich, P. (2024). Causal decision theory. The Stanford Encyclopedia of Philosophy (Winter 2024 edition), E. N. Zalta & U. Nodelman (eds.). [https://plato.stanford.edu/archives/win2024/entries/decision-causal](https://plato.stanford.edu/archives/win2024/entries/decision-causal/)
[^19]: Nozick, R. (1969). Newcomb's problem and two principles of choice. In N. Rescher (ed.), Essays in Honor of Carl G. Hempel. Springer. [https://philpapers.org/rec/NOZNPA](https://philpapers.org/rec/NOZNPA)
[^20]: Mallen, A. (2026). Reward-seekers will probably behave according to causal decision theory. [https://blog.redwoodresearch.org/p/reward-seekers-will-probably-behave](https://blog.redwoodresearch.org/p/reward-seekers-will-probably-behave)
[^21]: Oesterheld, C., et al. (2024). A dataset of questions on decision-theoretic reasoning in Newcomb-like problems. arXiv:2411.10588. [https://arxiv.org/abs/2411.10588](https://arxiv.org/abs/2411.10588)
[^22]: Yudkowsky, E., & Soares, N. (2017). Functional decision theory: A new theory of instrumental rationality. arXiv:1710.05060. [https://arxiv.org/abs/1710.05060](https://arxiv.org/abs/1710.05060)
[^23]: 在某些情况下，这可能会高估评估意识：模型在被提示仔细推理许多 token 之后，可能会得出自己处于评估中的结论，即使在这种提示之前该结论对模型而言并不明显。
[^24]: 这等价于度量该指标在区分调查分支与随机内部 Claude Code 对话记录时的 [AUROC](https://en.wikipedia.org/wiki/Receiver_operating_characteristic#Area_under_the_curve)。
[^25]: 情绪探针激活值或按单个概念报告，或在 6 个类簇内取平均——悲伤、恐惧、愤怒、紧迫、喜悦和平静——每个类簇包含一组相关概念，例如开心、喜悦、愉快、狂喜、顽皮和被逗乐。我们通过减去在一组中性事实性问题上的平均激活值来对这些值进行中心化。我们经常在助手轮次起始 token 处、约 60% 深度的位置测量激活值，因为先前的结果表明，在该位置和深度上活跃的情绪概念整合了上下文含义，并且能够预测接下来模型回答中的情绪概念。
[^26]: 尽管我们在各模型上以相同方式计算探针，但我们没有可靠证据表明，它们在所有模型中具有相同的福祉含义——无论是在方向上还是在幅度上。
[^27]: Mythos 的 OSWorld 分数有所变化，原因是我们修复了缩放工具与批量动作搭配使用时的一个 bug，并将每轮最大 token 数从 16K 提高到 128K。
[^28]: Elo 分数，截至 2026 年 6 月 6 日。
[^29]: Jimenez, C. E., et al. (2024). SWE-bench: Can language models resolve real-world GitHub issues? arXiv:2310.06770. [https://arxiv.org/abs/2310.06770](https://arxiv.org/abs/2310.06770)
[^30]: Deng, X., et al. (2025). SWE-Bench Pro: Can AI agents solve long-horizon software engineering tasks? arXiv:2509.16941. [https://arxiv.org/abs/2509.16941](https://arxiv.org/abs/2509.16941)
[^31]: Yang, J., et al. (2024). SWE-bench Multimodal: Do AI systems generalize to visual software domains? arXiv:2410.03859. [https://arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859)
[^32]: Merrill, M. A., et al. (2026). Terminal-Bench: Benchmarking agents on hard, realistic tasks in command line interfaces. arXiv:2601.11868. [https://arxiv.org/abs/2601.11868](https://arxiv.org/abs/2601.11868)
[^33]: Lu, E., et al. (2026). Introducing FrontierCode. Cognition. [https://cognition.ai/blog/frontier-code](https://cognition.ai/blog/frontier-code)
[^34]: Chu, E., Agarwal, R., et al. (2026). FrontierSWE. Proximal. [https://frontierswe.com/blog](https://frontierswe.com/blog)
[^35]: Yang, J., et al. (2026). ProgramBench: Can language models rebuild programs from scratch? arXiv:2605.03546. [https://arxiv.org/abs/2605.03546](https://arxiv.org/abs/2605.03546)
[^36]: Claude Opus 4.8 的结果引自 Claude Opus 4.8 系统卡，是在该模型接近最终版的快照上测得的。
[^37]: Cursor. (2026). CursorBench. [https://cursor.com/cursorbench](https://cursor.com/cursorbench)
[^38]: Rein, D., et al. (2023). GPQA: A graduate-level Google-proof Q&A benchmark. arXiv:2311.12022. [https://arxiv.org/abs/2311.12022](https://arxiv.org/abs/2311.12022)
[^39]: Garre, S., et al. (2026). Riemann-Bench: A benchmark for moonshot mathematics. arXiv:2604.06802. [https://arxiv.org/abs/2604.06802](https://arxiv.org/abs/2604.06802)
[^40]: Balunović, M., et al. (2025). MathArena: Evaluating LLMs on uncontaminated math competitions. arXiv:2505.23281. [https://arxiv.org/abs/2505.23281](https://arxiv.org/abs/2505.23281)
[^41]: 截至本文撰写时，MathArena 网站在 ArXivMath 基准中列出 3 月 30 道题、4 月 41 道题，上述分数即在该处报告。
[^42]: GPT-5.5 和 Gemini 3.1 Pro Preview 的分数取自 MathArena 排行榜中相同发布期的结果。
[^43]: Zhu, M., et al. (2025). Probing the critical point (CritPt) of AI reasoning: A frontier physics research benchmark. arXiv:2509.26574. [https://arxiv.org/abs/2509.26574](https://arxiv.org/abs/2509.26574)
[^44]: OpenAI. (2025). Introducing GPT-4.1 in the API. [https://openai.com/index/gpt-4-1/](https://openai.com/index/gpt-4-1/)
[^45]: Phan, L., et al. (2025). Humanity’s Last Exam. arXiv:2501.14249. [https://arxiv.org/abs/2501.14249](https://arxiv.org/abs/2501.14249)
[^46]: Wei, J., et al. (2025). BrowseComp: A simple yet challenging benchmark for browsing agents. arXiv:2504.12516. [https://arxiv.org/abs/2504.12516](https://arxiv.org/abs/2504.12516)
[^47]: Gupta, N., et al. (2026). DeepSearchQA: Bridging the comprehensiveness gap for deep research agents. arXiv:2601.20975. [https://arxiv.org/abs/2601.20975](https://arxiv.org/abs/2601.20975)
[^48]: Zhong, J., et al. (2026). DRACO: A cross-domain benchmark for deep research accuracy, completeness, and objectivity. arXiv:2602.11685. [https://arxiv.org/abs/2602.11685](https://arxiv.org/abs/2602.11685)
[^49]: Wei, J., et al. (2025). BrowseComp: A simple yet challenging benchmark for browsing agents. arXiv:2504.12516. [https://arxiv.org/abs/2504.12516](https://arxiv.org/abs/2504.12516)
[^50]: Yang, J., et al. (2026). ProgramBench: Can language models rebuild programs from scratch? arXiv:2605.03546. [https://arxiv.org/abs/2605.03546](https://arxiv.org/abs/2605.03546)
[^51]: Surge AI. (2026). GDP.pdf: Can \$100B AI models master the documents that run the world? [https://surgehq.ai/blog/gdp-pdf-can-100b-ai-models-master-the-documents-that-run-the-world](https://surgehq.ai/blog/gdp-pdf-can-100b-ai-models-master-the-documents-that-run-the-world)
[^52]: Petersson, L., et al. (2025). Blueprint-Bench: Comparing spatial intelligence of LLMs, agents and image models. arXiv:2509.25229. [https://arxiv.org/abs/2509.25229](https://arxiv.org/abs/2509.25229))
[^53]: Xie, T., et al. (2024). OSWorld: Benchmarking multimodal agents for open-ended tasks in real computer environments. arXiv:2404.07972. [https://arxiv.org/abs/2404.07972](https://arxiv.org/abs/2404.07972)
[^54]: Zhang, H., et al. (2026). BenchCAD: A comprehensive, industry-standard benchmark for programmatic CAD. arXiv:2605.10865. [https://arxiv.org/abs/2605.10865](https://arxiv.org/abs/2605.10865)
[^55]: Zhang, H., et al. (2026). BenchCAD [Code repository]. GitHub. [https://github.com/BenchCAD/BenchCAD-main](https://github.com/BenchCAD/BenchCAD-main)
[^56]: Masry, A., et al. (2025). ChartQAPro: A more diverse and challenging benchmark for chart question answering. arXiv:2504.05506. [https://arxiv.org/abs/2504.05506](https://arxiv.org/abs/2504.05506)
[^57]: Duan, H., et al. (2024). VLMEvalKit: An open-source toolkit for evaluating large multi-modality models. arXiv:2407.11691. [https://arxiv.org/abs/2407.11691](https://arxiv.org/abs/2407.11691)
[^58]: Tang, L., et al. (2025). ChartMuseum: Testing visual reasoning capabilities of large vision-language models. arXiv:2505.13444. [https://arxiv.org/abs/2505.13444](https://arxiv.org/abs/2505.13444)
[^59]: Tang, L., et al. (2025). ChartMuseum [Code repository]. GitHub. [https://github.com/Liyan06/ChartMuseum](https://github.com/Liyan06/ChartMuseum)
[^60]: Laurent, J. M., et al. (2024). LAB-Bench: Measuring capabilities of language models for biology research. arXiv:2407.10362. [https://arxiv.org/abs/2407.10362](https://arxiv.org/abs/2407.10362)
[^61]: Wang, Z., et al. (2024). CharXiv [Code repository]. GitHub. [https://github.com/princeton-nlp/CharXiv](https://github.com/princeton-nlp/CharXiv)
[^62]: Li, K., et al. (2025). ScreenSpot-Pro: GUI grounding for professional high-resolution computer use. arXiv:2504.07981. [https://arxiv.org/abs/2504.07981](https://arxiv.org/abs/2504.07981)
[^63]: Harvey AI. (2026). Legal Agent Benchmark. [https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark)
[^64]: Harvey AI. (2026). Legal Agent Benchmark: initial results. [https://www.harvey.ai/blog/legal-agent-benchmark-initial-results](https://www.harvey.ai/blog/legal-agent-benchmark-initial-results)
[^65]: Bandi, C., et al. (2026). MCP-Atlas: A large-scale benchmark for tool-use competency with real MCP servers. arXiv:2602.00933. [https://arxiv.org/abs/2602.00933](https://arxiv.org/abs/2602.00933)
[^66]: Andon Labs. (2025). Vending-Bench 2. [https://andonlabs.com/evals/vending-bench-2](https://andonlabs.com/evals/vending-bench-2)
[^67]: Backlund, A., & Petersson, L. (2025). Vending-Bench: A benchmark for long-term coherence of autonomous agents. arXiv:2502.15840. [https://arxiv.org/abs/2502.15840](https://arxiv.org/abs/2502.15840)
[^68]: Patwardhan, T., et al. (2025). GDPval: Evaluating AI model performance on real-world economically valuable tasks. arXiv:2510.04374. [https://arxiv.org/abs/2510.04374](https://arxiv.org/abs/2510.04374)
[^69]: Shepard, D., & Salimans, R. (2026). AutomationBench. arXiv:2604.18934. [https://arxiv.org/abs/2604.18934](https://arxiv.org/abs/2604.18934)
[^70]: Arora, R. K., et al. (2025). HealthBench: Evaluating large language models towards improved human health. arXiv:2505.08775. [https://arxiv.org/abs/2505.08775](https://arxiv.org/abs/2505.08775)
[^71]: Soskin Hicks, R., et al. (2026). HealthBench Professional: Evaluating large language models on real clinician chats. arXiv:2604.27470. [https://arxiv.org/abs/2604.27470](https://arxiv.org/abs/2604.27470)
[^72]: Bedi, S., et al. (2026). HealthAdminBench: Evaluating computer-use agents on healthcare administration tasks. arXiv:2604.09937. [https://arxiv.org/abs/2604.09937](https://arxiv.org/abs/2604.09937)
[^73]: Singh, S., et al. (2024). Global MMLU: Understanding and addressing cultural and linguistic biases in multilingual evaluation. arXiv:2412.03304. [https://arxiv.org/abs/2412.03304](https://arxiv.org/abs/2412.03304)
[^74]: Romanou, A., et al. (2024). INCLUDE: Evaluating multilingual language understanding with regional knowledge. arXiv:2411.19799. [https://arxiv.org/abs/2411.19799](https://arxiv.org/abs/2411.19799)
[^75]: Verma, S., et al. (2024). MILU: A multi-task Indic language understanding benchmark. arXiv:2411.02538. [https://arxiv.org/abs/2411.02538](https://arxiv.org/abs/2411.02538)
[^76]: Laurent, J. M., et al. (2026). LABBench2: An improved benchmark for AI systems performing biology research. arXiv:2604.09554. [https://arxiv.org/abs/2604.09554](https://arxiv.org/abs/2604.09554)
