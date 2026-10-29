---
title: "“Interleaved Thinking” in Anthropic’s Prospectus"
slug: anthropic-s1-interleaved-thinking
date: 2026-10-29T12:53:53Z
tags: [Notes]
---

> “interleaved thinking” refers to a capability whereby an AI model interposes discrete reasoning steps between successive tool calls within a single response, rather than confining its reasoning to a single planning phase at the outset.

In the prospectus: [Selected definitions: “interleaved thinking”](https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/anthropicpbc-sx1.htm#ica694c859b8e458dbf6a73f56dde9d42_179:~:text=refers%20to%20a%20capability%20whereby%20an%20AI%20model,phase%20at%20the%20outset) ([original filing on SEC EDGAR](https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/anthropicpbc-sx1.htm))

So that’s what it means. The phrase “rather than confining its reasoning to a single planning phase at the outset” reminded me of something I wrote in [an earlier post](/en/posts/blog-postmortem/#:~:text=No%20dynamic%20scheduling): that OpenCode couldn’t reason while its subagents were running. I think the two are related, even though they’re not talking about the same thing.

- One is whether the harness can collect the subagents’ problems while they run, hand them to the model to reason over, and produce new steps
- The other is whether the model is able to take in scattered information and make new judgments
