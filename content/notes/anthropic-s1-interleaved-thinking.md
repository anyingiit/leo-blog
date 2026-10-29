---
title: "Anthropic招股书中的“交错思考”"
slug: anthropic-s1-interleaved-thinking
date: 2026-10-29T12:53:53Z
tags: [随笔]
---

> “交错思考”指AI模型在单次回复中于连续的工具调用之间插入离散推理步骤的能力，而非将其推理局限于开始时的单一规划阶段。

招股书原文：[部分术语释义：“交错思考”](/translations/anthropic-s1/v1.1/selected-definitions/#ica694c859b8e458dbf6a73f56dde9d42_179:~:text=%E6%8C%87AI%E6%A8%A1%E5%9E%8B%E5%9C%A8%E5%8D%95%E6%AC%A1%E5%9B%9E%E5%A4%8D%E4%B8%AD,%E5%8D%95%E4%B8%80%E8%A7%84%E5%88%92%E9%98%B6%E6%AE%B5)（[非官方中文译本](/translations/anthropic-s1/v1.1/)）

原来是这个意思，“而非将其推理局限于开始时的单一规划阶段。”这句话和[我之前的文章](/posts/blog-postmortem/#:~:text=%E6%B2%A1%E6%9C%89%E5%8A%A8%E6%80%81%E8%B0%83%E5%BA%A6)中有提到OpenCode的子代理运行时无法推理，我觉得具有相关性，尽管这两者说的不是一件事。

- 一个是harness是否能够在子代理运行时收集他们的问题，交给模型推理并产生新的步骤
- 一个是模型是否有能力接受零散信息并且做出新的判断
