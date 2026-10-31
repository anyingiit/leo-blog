---
title: "The Secretary Problem"
slug: lex-secretary-problem
date: 2026-10-31T12:00:10Z
tags: [Notes]
---

> **Ankur Moitra**: So the way that this works is it's an example of something called online algorithms. So you have a sequence of options coming. One through N. They come in each time step, and your goal is, you know, when someone comes along, you know their ranking relative to everyone else you've seen before, but you don't know their ranking relative to the people who are yet to come.
>
> And your goal is, you know, to make a decision when the person comes along, do you commit or do they move on, in such a way that you have a good chance of finding the absolute best candidate. And so the point is that you can actually get a constant competitive ratio algorithm that what you do, the best strategy is to wait some amount of the time, not make any decisions, don't accept anyone. And then once that probationary window has passed, you take the first person who's better than anyone you've seen thus far. And that'll give you a good competitive ratio in the sense that you can prove theorems. Assuming the inputs arrive in a uniformly random order, you're likely to do pretty well compared to as if you knew what that sequence of inputs was in advance.

From Lex Fridman Podcast #503 ([video, from 2:44:30](https://www.youtube.com/watch?v=ZAzWPE9CItg&t=9870s)); text from the [official transcript](https://lexfridman.com/math-ai-crisis-transcript#chapter10_can_ai_solve_p_vs_np_).

This is very useful for hiring, and it may be useful in some other situations too. It's a heuristic, so I'm writing it down for now. In the classic solution, that waiting window is about 37% (1/e) of all the candidates.

Turned around, it may also be useful for job seekers: a candidate should avoid being among the first 37% of applicants.
