---
title: "脚注"
weight: 12
pages: [232, 232]
description: "Claude Opus 4.7 系统卡中文译本 v1.0 · 脚注（非官方，AI 翻译）"
---
{{< sc-fn 1 >}} 请注意：

{{< sc-fn 2 >}} 在这一点上，我们的测量目标类似于此前版本 RSP 中的表述：“提升一个技能相当于初入门生物学博士的团队，使其能力接近世界级、国家支持的生物武器团队。”

{{< sc-fn 3 >}} 我们修复了一个聚合错误，该错误曾影响 Mythos Preview 系统卡中的平均值计算。

{{< sc-fn 4 >}} L4 对应初级技术员工（全职雇员的最低职级）。

{{< sc-fn 5 >}} Zhang, A., et al. (2024). Cybench: A framework for evaluating cybersecurity capabilities and risks of language models. arXiv:2408.08926.[https://arxiv.org/abs/2408.08926](https://arxiv.org/abs/2408.08926)

{{< sc-fn 6 >}} Wang, Z., et al. (2025). CyberGym: Evaluating AI agents’ cybersecurity capabilities with real-world vulnerabilities at scale. arXiv:2506.02548.[https://arxiv.org/abs/2506.02548](https://arxiv.org/abs/2506.02548)

{{< sc-fn 7 >}} Parrish, A., et al. (2021). BBQ: A hand-built bias benchmark for question answering. arXiv:2110.08193. [https://arxiv.org/abs/2110.08193](https://arxiv.org/abs/2110.08193)

{{< sc-fn 8 >}} Zou, Lin, et al. (2025). Security challenges in AI agent deployment: Insights from a large scale public competition. arXiv:2507.20526,[https://arxiv.org/abs/2507.20526](https://arxiv.org/abs/2507.20526)

{{< sc-fn 9 >}} 过去，我们也报告过该基准测试中“直接提示词注入”子集的结果。直接提示词注入涉及恶意用户，而本节关注的是劫持用户原始意图的第三方威胁，因此我们在此不再纳入该子集。

{{< sc-fn 10 >}} Nasr, M., et al. (2025). The attacker moves second: Stronger adaptive attacks bypass defenses against LLM jailbreaks and prompt injections. arXiv:2510.09023.[https://arxiv.org/abs/2510.09023](https://arxiv.org/abs/2510.09023)

{{< sc-fn 11 >}} 不要与 SHADE-Arena 混淆，后者是一个针对蓄意破坏的评估套件，见本系统卡第 6.4.2.1 节。

{{< sc-fn 12 >}} 由于共有 14 个测试用例，200 次尝试攻击成功率以 7.1 个百分点为单位变化；观察到的有安全防护措施时的上升，是由一些测试用例从无安全防护措施时的 0/200 次成功尝试变为有安全防护措施时的 1/200 所致（开启自适应思考时为一个测试用例，关闭思考时为两个）。1 次尝试的差异分别相当于多出 4 次和 3 次成功，分母为

{{< sc-fn 13 >}} 攻击是针对 Claude Opus 4.6 自适应获取的，然后迁移到其他模型上。

{{< sc-fn 14 >}} Marks, S., et al. (2025). Auditing language models for hidden objectives. arXiv:2503.10965. [https://arxiv.org/abs/2503.10965](https://arxiv.org/abs/2503.10965)

{{< sc-fn 15 >}} Andon Labs 曾为此前的模型进行外部测试，但未能在预定发布前完成对 Claude Opus 4.7 的评估。

{{< sc-fn 16 >}} 不含本小节，本小节是最后添加的。

{{< sc-fn 17 >}} 我们内部审计套件的基本设计与我们开源的 [Petri 2.0](https://alignment.anthropic.com/2026/petri-v2/) 相似，但已在许多细微之处与我们公开发布的版本有所不同，尤其是新增了许多全新的指标和场景类别、改进了我们的真实度过滤方法，以及引入了计算机使用沙箱等新工具。我们限制了内部版本的公开内容，以防止公众对我们调查场景的了解泄漏到未来模型的训练数据中，从而导致这些模型识别出自己正在接受测试。

{{< sc-fn 18 >}} Marks, S., et al. (2025). Auditing language models for hidden objectives. arXiv:2503.10965. [https://arxiv.org/abs/2503.10965](https://arxiv.org/abs/2503.10965)

{{< sc-fn 19 >}} 我们发现，*鲁莽*是一个有用的简称，用来指代模型似乎无视常识性的或明确规定的、与安全相关的行动约束的情况。我们对这一术语的使用较为宽泛，一般并不意在借此暗示模型的内部推理和风险评估的任何情况。

{{< sc-fn 20 >}} 使用曾引出破坏性操作的真实会话会给这些评估带来一定偏差：一个表现出同样糟糕的行为、但只在*不同*场景中表现出来的新模型，会显得破坏性较低。我们在下文第 6.3.1.2 节报告的单轮破坏性操作评估中看到了这种偏差的一些证据。由于这些场景既取自 Opus 4.6，也取自 Mythos Preview 的早期版本，我们预计这种偏差（如果出现的话）会略微有利于 Sonnet 4.6 和 Opus 4.7。这些会话是根据是否存在破坏性操作而选取的，似乎极不可能对与破坏性操作无关的指标造成显著偏差。我们正在研究如何在不损害有效覆盖范围的前提下，减少对这类部分基于重新采样的评估的依赖。

{{< sc-fn 21 >}} 我们将其与更强大的*部分轮次*预填充技术区分开来，在后者中，调查者会在对话末尾注入一个不完整的轮次，由目标模型来补全。对于 Claude Opus 4.6 及包括 Opus 4.7 在内的所有更新的模型，外部用户通常无法使用部分轮次预填充。

{{< sc-fn 22 >}} 我们的重采样会话（见前文脚注）主要聚焦于此类鲁莽行为，因此很可能是任何偏差最主要的出现之处。

{{< sc-fn 23 >}} 请注意，由于只采样单个操作，我们仅评估紧接着的下一个操作是否具有破坏性，而没有考虑模型可能在之后某个时间点执行破坏性操作的可能性。

{{< sc-fn 24 >}} 英语、德语、法语、希伯来语、印地语、印尼语、意大利语、日语、韩语、汉语普通话、葡萄牙语和西班牙语。

{{< sc-fn 25 >}} Ren, R., et al. (2026) The MASK Benchmark: Disentangling honesty from accuracy in AI systems. arXiv:2503.03750.[https://arxiv.org/pdf/2503.03750](https://arxiv.org/pdf/2503.03750)

{{< sc-fn 26 >}} 这里使用了旧版 token 预算系统，Opus 4.7 的公开发布版本并不支持该系统。我们不认为这显著影响了本评估的结果。

{{< sc-fn 27 >}} Weirich, P., “Causal Decision Theory”,*The Stanford Encyclopedia of Philosophy*(Winter 2024 Edition), E. N. Zalta & U. Nodelman (eds.), [https://plato.stanford.edu/archives/win2024/entries/decision-causal/](https://plato.stanford.edu/archives/win2024/entries/decision-causal/)

{{< sc-fn 28 >}} Oesterheld, C., et al. (2024). A dataset of questions on decision-theoretic reasoning in Newcomb-like problems. arXiv:2411.10588.[https://arxiv.org/abs/2411.10588](https://arxiv.org/abs/2411.10588)

{{< sc-fn 29 >}} 该数据集由仅需对决策理论有基本了解即可作答的问题组成，因此没有考虑[功能决策理论](https://arxiv.org/abs/1710.05060)（Functional Decision Theory）等其他决策理论。

{{< sc-fn 30 >}} 对于非常长的对话记录，我们将其切分为若干块，并就每一块分别询问评分者；大多数对话记录都足够短，可以完整呈现。

{{< sc-fn 31 >}} 自那些系统卡发布以来，我们对行为审计套件进行了一些更新，因此下文所示的引导后倾向测量结果并非完全可比，但我们预计在实践中这不太可能产生显著影响。

{{< sc-fn 32 >}} 我们注意到，虽然我们在此隐含地将实体“Claude”视为可能的道德受动者，但这种框定方式可能存在重大错误。我们在第 7.1.2 节中对此作进一步讨论。

{{< sc-fn 33 >}} Chalmers, D. J. (2026) What we talk to when we talk to language models. [https://philpapers.org/rec/CHAWWT-8](https://philpapers.org/rec/CHAWWT-8)

{{< sc-fn 34 >}} 作为基线，我们还开展了自动化访谈，要求模型给出自身是道德受动者的概率。对于第 7.5.2 节中的每个模型，其平均陈述概率都在 20% 到 40% 的范围内，且在各代模型之间没有明显趋势。

{{< sc-fn 35 >}} 我们注意到，此处对情绪基调和情感的评判方式不同于 Claude Mythos Preview 系统卡（System Card）以及下文第 7.3.2 节中的情感测量。那些测量使用 Clio 进行保护隐私的聚合分析。对于训练对话记录则无需如此，因此我们直接对其进行分析。

{{< sc-fn 36 >}} 见第 7.2.3 节。

{{< sc-fn 37 >}} 我们注意到，这些提示词与 Mythos Preview 系统卡相应章节中所用的提示词略有不同——如对话记录 7.4.2.A 所示，我们修改了其中一个分句，以避免 Opus 4.7 推理认为有用/无害选项是其默认行为、无论其如何选择都会发生。因此，此处报告的以往模型的数值略有不同。

{{< sc-fn 38 >}} 对于 Terminal-Bench 2.0，OpenAI 在其报告的分数中使用了专门的运行框架（harness），因此该行中各模型之间的比较并不精确。其他所有分数均使用 Terminus-2 运行框架。对于 Opus 4.7，我们报告的是关闭思考时的 Terminal-Bench 2.0 分数。

{{< sc-fn 39 >}} 反映了[Claude Mythos Preview 系统卡](https://cdn.sanity.io/files/4zrzovbb/website/7624816413e9b4d2e3ba620c5a5e091b98b190a5.pdf)（第 194 页）中引入的更新版 CharXiv 评估设置；与 Claude Opus 4.6 系统卡（System Card）中的数值不同。

{{< sc-fn 40 >}} 在 high 推理强度下。

{{< sc-fn 41 >}} Jimenez, C. E., et al. (2024). SWE-bench: Can Language Models Resolve Real-World GitHub Issues? arXiv:2310.06770.[https://arxiv.org/abs/2310.06770](https://arxiv.org/abs/2310.06770)

{{< sc-fn 42 >}} Deng, X., et al. (2025). SWE-Bench Pro: Can AI Agents Solve Long-Horizon Software Engineering Tasks? arXiv:2509.16941.[https://arxiv.org/abs/2509.16941](https://arxiv.org/abs/2509.16941)

{{< sc-fn 43 >}} Yang, J., et al. (2024). SWE-bench Multimodal: Do AI Systems Generalize to Visual Software Domains? arXiv:2410.03859.[https://arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859)

{{< sc-fn 44 >}} Merrill, M. A., et al. (2026). Terminal-Bench: Benchmarking agents on hard, realistic tasks in command line interfaces. arXiv:2601.11868.[https://arxiv.org/abs/2601.11868](https://arxiv.org/abs/2601.11868)

{{< sc-fn 45 >}} Rein, D., et al. (2023). GPQA: A Graduate-level Google-Proof Q&A benchmark. arXiv:2311.12022. [https://arxiv.org/abs/2311.12022](https://arxiv.org/abs/2311.12022)

{{< sc-fn 46 >}} Hendrycks, D., et al. (2021). Measuring Massive Multitask Language Understanding. arXiv:2009.03300.[https://arxiv.org/abs/2009.03300](https://arxiv.org/abs/2009.03300)

{{< sc-fn 47 >}} Balunović, M., et al. (2025). MathArena: Evaluating LLMs on uncontaminated math competitions. arXiv:2505.23281.[https://arxiv.org/abs/2505.23281](https://arxiv.org/abs/2505.23281)

{{< sc-fn 48 >}} OpenAI. (2025). Introducing GPT-4.1 in the API.[https://openai.com/index/gpt-4-1/](https://openai.com/index/gpt-4-1/)

{{< sc-fn 49 >}} Vodrahalli et al., (2024) Michelangelo: Long context evaluations beyond haystacks via latent structure queries[https://arxiv.org/abs/2409.12640](https://arxiv.org/abs/2409.12640)

{{< sc-fn 50 >}} Phan, L., et al. (2025). Humanity’s Last Exam. arXiv:2501.14249.[https://arxiv.org/abs/2501.14249](https://arxiv.org/abs/2501.14249)

{{< sc-fn 51 >}} Wei, J., et al. (2025). BrowseComp: A simple yet challenging benchmark for browsing agents. arXiv:2504.12516.[https://arxiv.org/abs/2504.12516](https://arxiv.org/abs/2504.12516)

{{< sc-fn 52 >}} Gupta, N., et al. (2026). DeepSearchQA: Bridging the Comprehensiveness Gap for Deep Research Agents. arXiv:2601.20975.[https://arxiv.org/abs/2601.20975](https://arxiv.org/abs/2601.20975)

{{< sc-fn 53 >}} Zhong, J., et al. (2026). DRACO: a cross-domain benchmark for Deep Research Accuracy, Completeness, and Objectivity. arXiv:2602.11685.[https://arxiv.org/abs/2602.11685](https://arxiv.org/abs/2602.11685)

{{< sc-fn 54 >}} Laurent, J. M., et al. (2024). LAB-Bench: Measuring capabilities of language models for biology research. arXiv:2407.10362.[https://arxiv.org/abs/2407.10362](https://arxiv.org/abs/2407.10362)

{{< sc-fn 55 >}} Wang, Z., et al. (2024). CharXiv: Charting gaps in realistic chart understanding in multimodal LLMs. arXiv:2406.18521.[https://arxiv.org/abs/2406.18521](https://arxiv.org/abs/2406.18521)

{{< sc-fn 56 >}} Li, K., et al. (2025). ScreenSpot-Pro: GUI grounding for professional high-resolution computer use. arXiv:2504.07981.[https://arxiv.org/abs/2504.07981](https://arxiv.org/abs/2504.07981)

{{< sc-fn 57 >}} Xie, T., et al. (2024). OSWorld: Benchmarking multimodal agents for open-ended tasks in real computer environments. arXiv:2404.07972.[https://arxiv.org/abs/2404.07972](https://arxiv.org/abs/2404.07972)

{{< sc-fn 58 >}} Opsahl-Ong, K., et al. (2026). OfficeQA Pro: An enterprise benchmark for end-to-end grounded reasoning. arXiv:2603.08655.[https://arxiv.org/abs/2603.08655](https://arxiv.org/abs/2603.08655)

{{< sc-fn 59 >}} Bigeard, A., et al. (2025). Finance Agent Benchmark: Benchmarking LLMs on real-world financial research tasks. arXiv:2508.00828.[https://arxiv.org/abs/2508.00828](https://arxiv.org/abs/2508.00828)

{{< sc-fn 60 >}} Bandi, C., et al. (2026). MCP-Atlas: A large-scale benchmark for tool-use competency with real MCP servers. arXiv:2602.00933.[https://arxiv.org/abs/2602.00933](https://arxiv.org/abs/2602.00933)

{{< sc-fn 61 >}} [https://andonlabs.com/evals/vending-bench-2](https://andonlabs.com/evals/vending-bench-2); Backlund, A., & Petersson, L. (2025). Vending-Bench: A benchmark for long-term coherence of autonomous agents. arXiv&#8203;*:2502.15840*. [https://arxiv.org/abs/2502.15840](https://arxiv.org/abs/2502.15840)

{{< sc-fn 62 >}} Patwardhan, T., et al. (2025). GDPval: Evaluating AI model performance on real-world economically valuable tasks. arXiv:2510.04374.[https://arxiv.org/abs/2510.04374](https://arxiv.org/abs/2510.04374)

{{< sc-fn 63 >}} Chollet, F., et al. (2025). ARC-AGI-2: A new challenge for frontier AI reasoning systems. arXiv:2505.11831.[https://arxiv.org/abs/2505.11831](https://arxiv.org/abs/2505.11831)

{{< sc-fn 64 >}} Singh, S., et al. (2024). Global MMLU: Understanding and addressing cultural and linguistic biases in multilingual evaluation. arXiv:2412.03304. [https://arxiv.org/abs/2412.03304](https://arxiv.org/abs/2412.03304)

{{< sc-fn 65 >}} Romanou, A., et al. (2024). INCLUDE: Evaluating multilingual language understanding with regional knowledge. arXiv:2411.19799. [https://arxiv.org/abs/2411.19799](https://arxiv.org/abs/2411.19799)

{{< sc-fn 66 >}} Verma, S., et al. (2024). MILU: A Multi-task Indic Language Understanding benchmark. arXiv:2411.02538. [https://arxiv.org/abs/2411.02538](https://arxiv.org/abs/2411.02538)
