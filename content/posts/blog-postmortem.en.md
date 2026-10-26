---
title: "66,000 Lines of Code, Only 2 Posts Published: A Postmortem of My Blog"
slug: blog-postmortem
date: 2026-09-24
draft: false
tags: ["Postmortem", "AI Development", "Agent", "Speckit", "Claude Code", "Codex", "OpenCode"]
summary: "One blog, a little over two weeks, 66,000 lines of code, 24,000 lines of docs, 92 architecture decisions — and in the end, just 2 posts online. The new blog went live on Hugo in two or three minutes. This post lays out exactly where things went wrong."
ShowToc: true
---

## Some embarrassing numbers

My previous blog took a little over two weeks of tinkering. Here is what it left behind:

- About **66,000 lines** of code
- About **24,000 lines** of documentation
- **92** architecture decisions
- Posts online: **2**

The blog you're reading now runs on Hugo with a popular theme, and it went live in about two or three minutes.

Both were "a blog you can publish posts on." One took over two weeks, two rewrites, and still wasn't really usable; the other took two or three minutes. This is the first post on the new blog, and I want to spell out exactly what went wrong in between — partly as a set of rules for myself.

## What I wanted in the first place

The old blog's architecture looked like this:

```
Browser
  │
  ▼
Cloudflare Worker ── exact-path + HTTP-method allowlist; anything unlisted gets 404/405
  ├─ static GET/HEAD ─────► Cloudflare Pages (Astro build output; every response checked against a manifest sha256)
  ├─ /media/* GET/HEAD ───► R2 (serves only objects listed in the media manifest whose hash verifies)
  └─ /api/public/comments* ► restricted Laravel API ──► PostgreSQL
                                                   └► Redis ──► Horizon (queues)
Admin (Filament + Livewire): reachable only over the Tailscale private network
Source of truth for content: a Git content repo; the database holds only rebuildable indexes, users, audit logs and workflows
```

That's what a personal blog turned into. At the time I had five goals:

1. Content that can move to a free static host at any moment (Markdown + frontmatter as the canonical source format)
2. Prove that "one person + weak agents" can build a SaaS efficiently
3. Showcase what an agent-driven development workflow can produce
4. Showcase my own technical skills
5. A full admin backend + AI-native capabilities (long term: agents operating the whole system through APIs, just like a human would)

Looking back, goal 2 is the root of every problem that followed.

## A chain of reasoning where every step seemed "reasonable"

Why would a blog end up with Laravel, Octane, queues and caching? It was derived one step at a time:

> To prove "weak agents can develop efficiently" → a batteries-included framework boosts efficiency → but Ruby on Rails has too much metaprogramming, so when a weak agent makes a mistake it won't know where; Python is too messy, and I won't be able to follow it when I need to check → PHP gives complete error output, no magic → pick the PHP stack → PHP performance is a concern → add a managed platform, database caching, queues, and the memory-resident Octane to optimize → unclear whether it helps → run experiments → performance turns out fine

Each step makes sense on its own, but the first step wasn't the only wrong one.

The starting point, "weak agents developing efficiently," doesn't hold up in the first place — more on that below. So "Rails metaprogramming leaves weak agents unable to find their mistakes" falls with it.

"Python is too messy for me to follow when I need to check" is a separate mistake: once the codebase reaches tens of thousands of lines, I'm never going to read it myself anyway. When something breaks, I have an agent read it and summarize. To an agent, code in any language is the same.

With those two premises gone, "PHP has no magic" means nothing, and there's no need to follow the rest of the chain.

## What actually happened

### First rewrite: OpenCode

The project started as experiments on OpenCode, checking whether this PHP stack could hit the performance I wanted. Back then I could burn through a billion tokens a day, mostly on experiments — some output, but not much. The conclusion was that it could work, but the experimental code couldn't be used directly, so I began the first rewrite.

On OpenCode I ran a workflow I'd written myself, deeply built around Superpowers, and explicitly required it to be used at every step:

1. Use brainstorming to explore ideas and define the spec, asking me a few questions along the way;
2. Use writing-plans to write the plan;
3. Use subagent-driven-development to execute, with a review after every task;
4. Finally, use verification-before-completion for a self-check, and then more or less ship.

The rule I added on top: review must be done by a model from **a different model family**. Each task got several "chances." Within one chance, implement first, then review; if there are problems, fix them and review again. If it still fails after two reviews, move to the next chance and hand it to a stronger model, such as Claude Opus or Sol. And rather than swapping in a different coding model, the reviewer got write access to fix things itself, followed by another review. The design was meant to be cost-effective.

The worst part: once a review found problems, who should fix them was never defined — it was left to the orchestrator. From what I observed, it usually went by difficulty: small fixes to a regular model, big problems to a strong one.

A fixed orchestration like this is wrong in itself. Sometimes, after two reviews, the problems are mostly solved and you should just move on; sometimes you should escalate right away; sometimes escalating creates new problems. Hard-coded rules can't decide which issues must be fixed and which can be left, and whatever isn't hard-coded depends entirely on the orchestrator's mood at that moment. The result: a single task would bounce between fixing and reviewing for many rounds before the next task could start, and the results still weren't good.

The first deliverable was a static page: no editing posts, no uploads, yet over ten thousand lines of code.

Thinking about it now, it's hard to believe. The process was that complex and that uncontrollable, and yet I used it with total confidence.

Beyond that, there were these problems:

- **No dynamic scheduling.** Start three tasks in a round; if one finishes and later tasks depend on it, they still have to wait for all three to finish. If a task fails, the orchestrator doesn't find out right away.
- **No visibility into real progress.** The plan had checkboxes, but nothing forced it to tick them. OpenCode's own to-do list was very coarse — "ship a version," "ship comments" — so you couldn't tell how far along it was.
- **Afraid to interrupt.** Interrupting scrambled the context.
- **Unreliable worktrees.** It wasn't locked into a working directory. It stayed put if it felt like listening to you, and wandered into other directories if it didn't.

I was on Claude's \$20 subscription at the time, and I even had it write a handoff prompt after planning, so I could execute in a new window instead of dragging the planning phase's 40% of context through every subsequent task. The trick helped a little, but it didn't fix the underlying problem.

Progress was too slow, and I had no real grasp of where development stood. I needed a tool that could schedule tasks dynamically, so I moved to Codex.

### Continuing on Codex, then running out of quota

Moving to Codex wasn't a rewrite; I kept building on what was there. I first used Superpowers to build the publishing pipeline. Then, to deal with concurrency and oversized task chunks, I started using Speckit: a spec with 68 tasks, tracked in Linear, with multiple subagents in parallel.

In one day it finished 40 tasks — and used up 80% of the \$200 plan's weekly quota.

With 20% left, I started rationing: forcing every subtask to run on Terra. One night burned 10% of the quota, and not a single Linear task got done.

For the last 10%, I switched the main model to Sol and tried Luna and DeepSeek as executors. Still not one task completed; Luna alone went through about 200 million tokens.

During this period I also wrote a lot of code that never really landed: backups, permissions, OneDrive sync… The whole project fell apart completely.

### Second rewrite: Claude Code

I didn't switch to Claude Code because I thought it was strong. I was forced to, because the Codex quota was gone. I remembered that a few months earlier Claude's \$20 plan had lasted me a long time, and after going through community threads, the common view was that medium-to-heavy users should go with Claude Code, since it can run longer and handle more tasks.

Only after using it did I realize it really is strong. If OpenCode is like an MVP — a plain loop patched together — and Codex is a product, then Claude Code is the first one that feels truly production-grade to me. I'll save the details for the next post.

On the evening of September 16, I opened a new session in Claude Code with Fable 5.1 at maximum reasoning effort, and my first message was: "Thoroughly purge this project."

It deleted a large amount of experimental code, distilled the lessons into documentation, wrote AGENTS.md, a constitution and architecture docs, and finally settled on a roadmap split into four specs, A, B, C and D:

- **A**: get the static site live
- **B**: clean up experimental artifacts that had already been deployed, plus backups of production data (including whether to upload them to Google Cloud)
- **C**: the admin backend
- **D**: never started. Once C was done, I stopped and began the overall postmortem

Looking back, that Fable step didn't move any tasks forward on its own, but it mattered: it showed me where the problems were.

Then I worked through them one by one on the clean repo. Every spec was drafted from scratch, then planned, broken into tasks and executed, and each took eight or nine hours.

By C, the admin backend existed. But it was little more than a mock: it couldn't actually publish a post, and the styling was rough.

When A and B were done, none of the admin pieces existed yet, and I was still hopeful — telling myself the most important features just hadn't landed yet. After all, many features had been prototyped before, and I assumed it would learn from the old code and simply rebuild them. It didn't at all; it was basically redone from scratch.

In the end I had Claude review the overall architecture once more, and only then did I see: even if the whole roadmap were finished, this thing still wouldn't be good enough to publish with.

So what was it for?

## Which premise collapsed first

### "SOTA plans, weak models execute" is a false premise

This was the biggest problem, and the one that cost the most time and energy.

The idea was straightforward: a SOTA model's output price is more than twenty times a weak model's (GPT-5.6 Sol costs \$30 per million output tokens; DeepSeek V4 Flash costs only \$1.32), so let the SOTA model plan and the weak model execute, and costs come down. The weak model I mainly used was DeepSeek V4 Flash. In practice:

**It actually takes more tokens.** For a weak model to execute, you first have to slice tasks very finely, and that alone eats a lot of SOTA tokens. The finer the slicing, the more complex the plan, and the more expensive a planning mistake becomes. To verify the weak model got it right, you also end up generating lots of redundant test code, and the whole system gets harder and harder to change. When a task fails, it's back to the SOTA model to re-plan. That last 10% of Codex quota is the example: 200 million tokens, and not one task completed.

**Weak models are especially token-hungry.** On Artificial Analysis, DeepSeek V4 Flash (0731) output 240 million tokens to run the full Intelligence Index suite, and V4.1 Flash output 250 million, while the median across all models is only 140 million. A per-token price that's twenty-odd times cheaper doesn't mean finishing a task is twenty-odd times cheaper.

**Leaderboard scores can mislead.** When choosing models I looked at benchmarks, and everyone scored about the same. Later, Artificial Analysis upgraded Terminal-Bench from 2.1 to 4.0 — measuring the same coding ability, just more strictly — and every model dropped sharply. Claude Fable 5.1, for example, went from 91.4% to 55.1%; drops of thirty or forty points were typical, which is normal. But some models, like Kimi K3, fell from 85% straight to 13%, which says they had been heavily optimized for that specific benchmark.

**Active parameters are relatively reliable.** Token prices and leaderboard scores can both mislead. My rule of thumb now is to look at active parameters and compare them with the API price. Active parameters roughly represent how much GPU time each token takes — that is, how much energy is being spent behind it. The larger the active parameters and the cheaper the price, the more likely it's good value. The DeepSeek V4 Flash I was using, for instance, has 284B total parameters but only 13B active; V4.1 Flash has 552B total and still only 16B active. The total looks huge, but very little actually participates in computing each token. Then look at what tasks it can actually complete, and keep an eye on shifts like the one on Artificial Analysis — that's how you catch problems.

**Subscription quota isn't API pricing.** I hit a similar trap on Codex: I assumed that since Terra is cheap on the API, it would also drain the subscription more slowly. But subscription quota is most likely charged by actual compute consumed, not by API price.

**Time is the real killer.** At first I thought that with parallel development, it didn't matter if weak models were a bit slower. But between repeated trial and error, redundant code and rework, the longer a task drags on, the more of my attention it takes. The time cost grows almost exponentially.

### Specs described "modules," not "outcomes"

The second premise: plan a big architecture first, then implement it module by module through specs.

The problem is that each spec defined its scope very narrowly — it only cared about its own piece, with no view of the whole. "Get the static site live" meant just going live, leaving nothing for what came next; "do backups" was overbuilt; "build an admin backend that can publish posts" quietly drifted during execution into "can simulate walking through the publishing flow," rather than actually publishing.

My understanding now: you can build it piece by piece, but **every piece must be genuinely acceptance-testable**. And the acceptance criterion is what the user can ultimately see.

Take comments. Instead of writing "ship a comments module, implement such-and-such endpoints, handle auth," you should write:

> Users can comment under a post, reply to other people's comments, like other people's comments, comment either logged in or anonymously, and retract what they've said.

That's the real scenario, the thing you actually want. Endpoints and auth are for the agent to figure out.

## The five goals, in hindsight

1. **Portable content**: this one was right. The old blog's 2 posts were already Markdown + frontmatter, so moving them to Hugo cost almost nothing. But I took too big a step and lost sight of priorities: publishing posts first matters far more than building a perfect project first.
2. **"One person + weak agents" building a SaaS**: a false premise, covered above.
3. **Showcasing the agent development workflow**: it needs showing, but not as "build something big, then show it" — rather "show each bit as soon as it exists." People don't need a perfect employee; they need to understand what you're thinking and what your potential is.
4. **Showcasing technical skills**: meaningful, but without even an MVP, there's nothing to show. Getting the blog up and publishing dev logs consistently is the most effective way to show technical skill.
5. **Full admin backend + AI-native**: meaningful, but not now.

## Five things I learned

**1. Human attention is the scarcest resource.** All planning should be built around the fact that human attention is limited. A process where you can't see progress, are afraid to interrupt, and keep redoing work is the most expensive process there is, no matter how cheap the tokens.

**2. Once you have something, ship it, show it and distribute it as soon as possible.** My problem wasn't shipping slowly — it was shipping without distributing. With crawl4ai-mcp, myanyagent and evidence-search, I thought I was a genius and that they were incredibly useful, so I published them right away — but I did no promotion and never looked at market feedback. You don't know what's actually useful until you put it out there.

**3. The blog is almost the only channel that carries my value.** GitHub matters just as much, but I don't yet have a high-star project that can convince people; X is a secondary channel. I need to tell a story and prove my potential. Seen that way, while the blog was offline, my value from the outside was actually eroding.

**4. Use SOTA for everything.** SOTA orchestration with weak-model execution is pointless. Today's SOTA models are efficient enough and cheap enough.

**5. Don't obsess over the tech stack, and don't give up an efficient stack to accommodate agents.** Retreating from Rails to PHP so weak agents could follow along, then bolting on a pile of optimizations for PHP performance, was putting the cart before the horse. Pin the stack down in the constitution (for V2 I'll restrict it to an efficient stack like Rust), then stop worrying about technical details. Write clearly in the spec what the end result should look like, and leave the rest entirely to the agent.

## How I'm doing it this time

The new blog comes in two steps:

**MVP, which is what you're looking at**: Hugo + PaperMod, only the most basic post publishing. Live in two or three minutes, old posts migrated as-is. It has exactly one goal: be able to publish posts without getting in the way of anything else that matters.

**V2, later**: spec-driven development with Speckit, the stack pinned down by a constitution, specs that describe only the end result, and SOTA models throughout. Each time a piece is done, I'll post a dev log here.

This time the order can't be backwards again.

## What I'll write next

- Why I gave up on OpenCode
- The migration history of my AI development workflow: Claude Code → OpenCode → Codex → back to Claude Code
- Three self-hosted projects that AI subscriptions "swallowed"

---

Those 66,000 lines of code weren't written for nothing — at the very least, they bought this post.

If you also have a blog that's "almost ready," my advice: grab any theme and get your first post out.
