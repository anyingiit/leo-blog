---
title: "更新日志"
weight: 2
pages: [2, 2]
description: "Claude Opus 5 系统卡中文译本 v1.0 · 更新日志（非官方，AI 翻译）"
---
2026 年 8 月 19 日

- 在第 5.2.2.1 节中补充了提示词注入（prompt injection）的漏洞赏金结果。原版系统卡中有一条脚注说明这些结果将在之后补充。
- 更新了第 5.2.2.4 节中的 Cowork 评估结果。我们发现 Claude Opus 5 所用的运行框架（harness）与此前模型所用的运行框架不一致。所有其他模型的结果均已更新为使用与 Opus 5 相同的运行框架。我们还发现 Cowork 运行框架不支持“关闭思考”，因此我们删除了这部分结果，仅保留启用“扩展思考（extended thinking）”时的结果。
