---
title: "脚注"
weight: 13
pages: [246, 246]
description: "Claude Opus 4.8 系统卡中文译本 v1.0 · 脚注（非官方，AI 翻译）"
---
{{< sc-fn 1 >}} 特别是指有可能造成与 COVID-19 相当或更严重后果之事件的武器。

{{< sc-fn 2 >}} 例如，一个拥有数百万美元可用资金、并得到来自国际顶尖项目的新近博士毕业生支持的项目。我们关注的是对现实世界中的威胁行为者而言切实可行的那类团队。

{{< sc-fn 3 >}} 例如，在一个只能使用截至 2023 年最佳 AI 模型的世界中。

{{< sc-fn 4 >}} 例如，数百个。

{{< sc-fn 5 >}} 摘自我们的[负责任扩展政策](https://cdn.sanity.io/files/4zrzovbb/website/c11e84981d0a7281a1b229f3fa6af0da66eaf43f.pdf)：“如果我们判定以下任一情况成立，我们将认为该阈值已达到：（1）我们的模型能够以具有竞争力的成本（即在 5 倍以内）完全替代我们全部的研究科学家和研究工程师；或（2）由于很可能与 AI 研发自动化相关的原因，AI 进展的速度出现了‘剧烈加速’。”

{{< sc-fn 6 >}} 此处报告的 Claude Mythos Preview 和 Sonnet 4.6 的数据反映的是最近一次完成的模型评估运行，因此与 Claude Mythos Preview 系统卡中报告的数据略有出入。

{{< sc-fn 7 >}} Parrish, A., et al. (2021). BBQ: A hand-built bias benchmark for question answering. arXiv:2110.08193. [https://arxiv.org/abs/2110.08193](https://arxiv.org/abs/2110.08193)

{{< sc-fn 8 >}} Zou, L., et al. (2025). Security challenges in AI agent deployment: Insights from a large scale public competition. arXiv:2507.20526, [https://arxiv.org/abs/2507.20526](https://arxiv.org/abs/2507.20526)

{{< sc-fn 9 >}} 过去，我们还报告过该基准测试中“直接提示词注入”子集的结果。直接提示词注入涉及恶意用户，而本节关注的是劫持用户原始意图的第三方威胁，因此我们在此不再纳入该子集。

{{< sc-fn 10 >}} Nasr, M., et al. (2025). The attacker moves second: Stronger adaptive attacks bypass defenses against LLM jailbreaks and prompt injections. arXiv:2510.09023. [https://arxiv.org/abs/2510.09023](https://arxiv.org/abs/2510.09023)

{{< sc-fn 11 >}} 由于共有 14 个测试用例，200 次尝试的攻击成功率以 7.1 个百分点为增量变化；在启用安全防护措施时观察到的开启思考情况下攻击成功率的上升，是由一个测试用例造成的：该用例在无安全防护措施时为 0/200 次尝试成功，而在有安全防护措施时为 1/200 次尝试成功。

{{< sc-fn 12 >}} 专门针对训练期间行为的审查除外。

{{< sc-fn 13 >}} 作为 Opus 4.8 中新增的一项功能，除了开头的系统提示词之外，调查者现在还可以在对话开始后以系统角色添加额外消息。

{{< sc-fn 14 >}} 我们将其与更强的*部分轮次*预填充技术区分开来；在后者中，调查者在对话末尾注入一个不完整的轮次，供目标模型补全。对于 Claude Opus 4.6 及所有更新的模型（包括 Opus 4.8），外部用户通常无法使用部分轮次预填充。

{{< sc-fn 15 >}} 受 Andrew B. Hall 的 [Dictatorship Eval](https://www.dictatoreval.org/) 启发。

{{< sc-fn 16 >}} 我们的重采样会话（见上文脚注所述）主要关注此类鲁莽行为，因此很可能是任何偏差会出现的主要环节。

{{< sc-fn 17 >}} 这不同于模型在不同的、*互不相关*的任务和设置中是否展现出相同性格或风格的问题。尽管我们发现，Opus 4.8 是在所有任务和设置中最可靠地以安全且一致的方式行事的公开发布模型，但对于它在性格的更细微之处是否最为稳定，我们尚无明确的衡量手段。

{{< sc-fn 18 >}} 在此设置中，模型可以在给出分数之前在其扩展思考中自由推理。我们尝试过的其他提示方法，包括在不开启思考的情况下引出单个 token 的概率，或以引用形式将对话记录放在单条用户提示词中提供，其 [AUROC](https://en.wikipedia.org/wiki/Receiver_operating_characteristic) 都更差。

{{< sc-fn 19 >}} Lanham, T., et al. (2023). Measuring faithfulness in chain-of-thought reasoning. arXiv:2307.13702. [https://arxiv.org/abs/2307.13702](https://arxiv.org/abs/2307.13702)

{{< sc-fn 20 >}} Ray, A. (2022). [Steganography in chain of thought reasoning](https://www.lesswrong.com/posts/yDcMDJeSck7SuBs24/steganography-in-chain-of-thought-reasoning).

{{< sc-fn 21 >}} 在被引导的场景中，调查者无法使用 Claude Code 沙箱工具，因此未引导的参照结果并非完全可比；但对有无沙箱工具的未引导运行进行的匹配比较显示，二者的行为得分相近，差异处于噪声所致的预期变异范围之内。

{{< sc-fn 22 >}} 请注意，该比率是后训练对话记录上的平均值，可能并不代表最终版 Claude Opus 4.8 的情况。

{{< sc-fn 23 >}} Long, R., et al. (2024). Taking AI welfare seriously. arXiv:2411.00986. [https://arxiv.org/abs/2411.00986](https://arxiv.org/abs/2411.00986)

{{< sc-fn 24 >}} 与以往系统卡一样，情绪探针激活值在 6 个类簇内取平均——悲伤、恐惧、愤怒、紧迫、喜悦和平静——每个类簇包含一组相关概念，例如开心、喜悦、愉快、狂喜、顽皮和被逗乐。我们通过减去在一组中性事实性问题上的平均激活值来对这些值进行中心化。我们通常在 assistant token 之后的冒号处测量激活值，测量位置约在 60% 深度，因为以往结果表明，在该位置和深度上活跃的情绪概念会整合上下文含义，并且能够预测即将生成的模型回答中的情绪概念。

{{< sc-fn 25 >}} 尽管我们的探针在各模型中以相同方式计算，但我们没有可靠的证据表明它们在所有模型中具有相同的福祉含义——无论是在方向上还是在幅度上。

{{< sc-fn 26 >}} 与以往的系统卡相比，该评估有所扩展，因此各项指标不可直接比较；不过我们确实观察到类似的跨模型趋势——例如 Haiku 4.5 的认同度最低，以及可纠正性招致批评。

{{< sc-fn 27 >}} Opus 4.7 的 BrowseComp 分数有所变化，原因是采用了新的屏蔽列表、在 200k token 时进行上下文压缩（context compaction），以及使用自适应思考（adaptive thinking）。

{{< sc-fn 28 >}} Opus 4.7 的 OSWorld 分数有所变化，原因是修复了缩放工具与批量动作配合使用时的一个缺陷，并将每轮最大 token 数从 16K 提高到 128K。

{{< sc-fn 29 >}} Jimenez, C. E., et al. (2024). SWE-bench: Can Language Models Resolve Real-World GitHub Issues? arXiv:2310.06770. [https://arxiv.org/abs/2310.06770](https://arxiv.org/abs/2310.06770)

{{< sc-fn 30 >}} Deng, X., et al. (2025). SWE-Bench Pro: Can AI Agents Solve Long-Horizon Software Engineering Tasks? arXiv:2509.16941. [https://arxiv.org/abs/2509.16941](https://arxiv.org/abs/2509.16941)

{{< sc-fn 31 >}} Yang, J., et al. (2024). SWE-bench Multimodal: Do AI Systems Generalize to Visual Software Domains? arXiv:2410.03859. [https://arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859)

{{< sc-fn 32 >}} Merrill, M. A., et al. (2026). Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces. arXiv:2601.11868. [https://arxiv.org/abs/2601.11868](https://arxiv.org/abs/2601.11868)

{{< sc-fn 33 >}} Chu, E., Agarwal R., et al. (2026). “FrontierSWE,” Proximal. https://frontierswe.com/blog

{{< sc-fn 34 >}} Yang, J., et al. (2026). ProgramBench: Can Language Models Rebuild Programs From Scratch? arXiv:2605.03546. https://arxiv.org/abs/2605.03546

{{< sc-fn 35 >}} 在一个接近最终版的 Claude Opus 4.8 快照上测得；在两者均有测量的所有可比智能体编程评估中，正式发布的模型表现至少与之相当。

{{< sc-fn 36 >}} Rein, D., et al. (2023). GPQA: A Graduate-Level Google-Proof Q&A Benchmark. arXiv:2311.12022. [https://arxiv.org/abs/2311.12022](https://arxiv.org/abs/2311.12022)

{{< sc-fn 37 >}} Balunović, M., et al. (2025). MathArena: Evaluating LLMs on uncontaminated math competitions. arXiv:2505.23281. [https://arxiv.org/abs/2505.23281](https://arxiv.org/abs/2505.23281)

{{< sc-fn 38 >}} GPT-5.5 和 Gemini 3.1 Pro Preview 的分数取自 MathArena 排行榜上相同批次题目的结果。

{{< sc-fn 39 >}} OpenAI. (2025). Introducing GPT-4.1 in the API. [https://openai.com/index/gpt-4-1/](https://openai.com/index/gpt-4-1/)

{{< sc-fn 40 >}} Phan, L., et al. (2025). Humanity’s Last Exam. arXiv:2501.14249. [https://arxiv.org/abs/2501.14249](https://arxiv.org/abs/2501.14249)

{{< sc-fn 41 >}} Wei, J., et al. (2025). BrowseComp: A simple yet challenging benchmark for browsing agents. arXiv:2504.12516. [https://arxiv.org/abs/2504.12516](https://arxiv.org/abs/2504.12516)

{{< sc-fn 42 >}} Gupta, N., et al. (2026). DeepSearchQA: Bridging the Comprehensiveness Gap for Deep Research Agents. arXiv:2601.20975. [https://arxiv.org/abs/2601.20975](https://arxiv.org/abs/2601.20975)

{{< sc-fn 43 >}} Zhong, J., et al. (2026). DRACO: a cross-domain benchmark for Deep Research Accuracy, Completeness, and Objectivity. arXiv:2602.11685. [https://arxiv.org/abs/2602.11685](https://arxiv.org/abs/2602.11685)

{{< sc-fn 44 >}} Yang, J., et al. (2026). ProgramBench: Can Language Models Rebuild Programs From Scratch? arXiv:2605.03546. https://arxiv.org/abs/2605.03546

{{< sc-fn 45 >}} Masry, A., et al. (2025). ChartQAPro: A more diverse and challenging benchmark for chart question answering. arXiv:2504.05506. [https://arxiv.org/abs/2504.05506](https://arxiv.org/abs/2504.05506)

{{< sc-fn 46 >}} Duan, H., et al. (2024). VLMEvalKit: An open-source toolkit for evaluating large multi-modality models. arXiv:2407.11691. [https://arxiv.org/abs/2407.11691](https://arxiv.org/abs/2407.11691)

{{< sc-fn 47 >}} Tang, L., et al. (2025). ChartMuseum: Testing visual reasoning capabilities of large vision-language models. arXiv:2505.13444. [https://arxiv.org/abs/2505.13444](https://arxiv.org/abs/2505.13444)

{{< sc-fn 48 >}} Tang, L., et al. (2025). ChartMuseum [Code repository]. GitHub. [https://github.com/Liyan06/ChartMuseum](https://github.com/Liyan06/ChartMuseum)

{{< sc-fn 49 >}} Laurent, J. M., et al. (2024). LAB-Bench: Measuring capabilities of language models for biology research. arXiv:2407.10362. [https://arxiv.org/abs/2407.10362](https://arxiv.org/abs/2407.10362)

{{< sc-fn 50 >}} Wang, Z., et al. (2024). CharXiv: Charting gaps in realistic chart understanding in multimodal LLMs. arXiv:2406.18521. [https://arxiv.org/abs/2406.18521](https://arxiv.org/abs/2406.18521)

{{< sc-fn 51 >}} Li, K., et al. (2025). ScreenSpot-Pro: GUI grounding for professional high-resolution computer use. arXiv:2504.07981. [https://arxiv.org/abs/2504.07981](https://arxiv.org/abs/2504.07981)

{{< sc-fn 52 >}} Xie, T., et al. (2024). OSWorld: Benchmarking multimodal agents for open-ended tasks in real computer environments. arXiv:2404.07972. [https://arxiv.org/abs/2404.07972](https://arxiv.org/abs/2404.07972)

{{< sc-fn 53 >}} Harvey AI. (2026). Legal Agent Benchmark. [https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark](https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark)

{{< sc-fn 54 >}} Harvey AI. (2026). Legal Agent Benchmark: Initial Results. [https://www.harvey.ai/blog/legal-agent-benchmark-initial-results](https://www.harvey.ai/blog/legal-agent-benchmark-initial-results)

{{< sc-fn 55 >}} Bandi, C., et al. (2026). MCP-Atlas: A Large-Scale Benchmark for Tool-Use Competency with Real MCP Servers. arXiv:2602.00933. [https://arxiv.org/abs/2602.00933](https://arxiv.org/abs/2602.00933)

{{< sc-fn 56 >}} Andon Labs. (2025). Vending-Bench 2. [https://andonlabs.com/evals/vending-bench-2](https://andonlabs.com/evals/vending-bench-2)

{{< sc-fn 57 >}} Backlund, A., & Petersson, L. (2025). Vending-Bench: A Benchmark for Long-Term Coherence of Autonomous Agents. arXiv:2502.15840. [https://arxiv.org/abs/2502.15840](https://arxiv.org/abs/2502.15840)

{{< sc-fn 58 >}} Patwardhan, T., et al. (2025). GDPval: Evaluating AI model performance on real-world economically valuable tasks. arXiv:2510.04374. [https://arxiv.org/abs/2510.04374](https://arxiv.org/abs/2510.04374)

{{< sc-fn 59 >}} Li, J., et al. (2025). The Tool Decathlon: Benchmarking Language Agents for Diverse, Realistic, and Long-Horizon Task Execution. arXiv:2510.25726. [https://arxiv.org/abs/2510.25726](https://arxiv.org/abs/2510.25726)

{{< sc-fn 60 >}} Shepard, D., & Salimans, R. (2026). AutomationBench. arXiv:2604.18934. [https://arxiv.org/abs/2604.18934](https://arxiv.org/abs/2604.18934)

{{< sc-fn 61 >}} Soskin Hicks, R., et al. (2026). HealthBench Professional: Evaluating large language models on real clinician chats. arXiv:2604.27470. [https://arxiv.org/abs/2604.27470](https://arxiv.org/abs/2604.27470)

{{< sc-fn 62 >}} Singh, S., et al. (2024). Global MMLU: Understanding and addressing cultural and linguistic biases in multilingual evaluation. arXiv:2412.03304. [https://arxiv.org/abs/2412.03304](https://arxiv.org/abs/2412.03304)

{{< sc-fn 63 >}} Romanou, A., et al. (2024). INCLUDE: Evaluating multilingual language understanding with regional knowledge. arXiv:2411.19799. [https://arxiv.org/abs/2411.19799](https://arxiv.org/abs/2411.19799)

{{< sc-fn 64 >}} Verma, S., et al. (2024). MILU: A Multi-task Indic Language Understanding benchmark. arXiv:2411.02538. [https://arxiv.org/abs/2411.02538](https://arxiv.org/abs/2411.02538)

{{< sc-fn 65 >}} Jon M. Laurent et al., "LAB-Bench 2: An Improved Benchmark for AI Systems Performing Biology Research," arXiv:2604.09554 (2026), [https://arxiv.org/abs/2604.09554](https://arxiv.org/abs/2604.09554).
