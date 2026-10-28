---
title: "Who Controls Anthropic"
slug: who-controls-anthropic
date: 2026-10-27T12:00:00Z
tags: [Notes, AI]
film: anthropic-money-power
minutes: 15
filmLang: zh
aliases: [/en/films/anthropic-money-power/]
---

No single party controls Anthropic: the founders control the shareholder vote, the Long-Term Benefit Trust (LTBT) elects a majority of the board, and employees settle disputes over one key board seat. The film and the transcript below take the prospectus apart in an order engineers will recognise: data structure, permission table, board, checks and balances, and how it changes over time.

<!--more-->

{{< film name="anthropic-money-power" >}}

Based on the sections of Anthropic's S-1 prospectus on its governance structure and objectives, description of capital stock, management and related risk factors. Not investment advice; the prospectus is the authority. Translated from the Chinese original.

## Transcript {#transcript}

### 01 Two questions

Anthropic's IPO prospectus (its S-1) names five share classes in one breath: A, N, T, F and E, plus a trust (the LTBT) and a limited liability company made up of the founders (the Founder LLC).

It reads as a tangle because the same passage answers two different questions at once: who gets the money, and who gets the power?

In an ordinary company the two answers are basically the same: whoever holds more shares gets more of the money and more of the say. Anthropic deliberately makes the two answers differ.

We'll take it apart in an order engineers know: first the data structure, then the permission table, the board, the checks and balances, and finally how it changes over time.

### 02 Two fields in one share

In an ordinary company, one share carries two fields at once: economic rights (dividends, a cut when the company is sold) and voting rights (votes at the shareholder meeting).

Shareholders elect the board; the board appoints, removes and oversees the CEO; the CEO runs the business day to day with management.

So the real “control plane” is the board. Asking “who controls the company” really means asking: who can decide a majority of the board seats?

Anthropic's core move is to split these two fields: classes A and N have the money; classes T, F and E have special powers but receive no money at all.

### 03 Layer one: a public benefit corporation (PBC)

The bottom layer is the company's legal form. Anthropic is incorporated as a Delaware public benefit corporation, or PBC. An ordinary company's board aims, roughly, to maximize shareholder value.

A PBC changes the objective function into a balance of three things: shareholders' pecuniary interests, the best interests of those materially affected by the company's conduct, and the public benefit purpose written in its charter.

The purpose reads: to responsibly develop and maintain advanced AI for the long-term benefit of humanity. In its decisions the board is allowed, and required, to weigh all three.

But this function has no objective scorer. The prospectus says no third-party standard is used; the board sets its own measures, mostly qualitative, and by law reports to shareholders at least every two years.

So the PBC only changes “what to optimize.” Who carries it out, and whether they can be trusted, is left to the share and board design that follows.

### 04 The permission table of five share classes

Think of the five classes as five kinds of token and look at each one's permission bits.

| Class | Held by | Economic rights | Votes |
|---|---|---|---|
| A | The public, after the IPO | Yes | One vote per share on general matters; cannot convert into another class |
| N | Mainly strategic business partners | Same as A | None; generally converts to Class A when sold to an unaffiliated third party |
| T | The Long-Term Benefit Trust (LTBT); a single share | None | No vote on general matters; elects and removes the Class T directors, who are a majority of the board |
| F | The Founder LLC of seven co-founders; a single share | None | Always 50.1% of the total voting power in general shareholder votes |
| E | Employees other than the co-founders | None | Votes on only a few matters, which happen to be the “arbitration” link in the chain of checks |

Class N lets a large partner hold a big economic stake without gaining voting control from it.

Now look down the economic-rights column: the three “power shares,” T, F and E, are all zero. The channel to control and the channel to money are kept apart on purpose.

### 05 The board: how the 7 seats split

Now the control plane itself. When the IPO closes, the board has 7 authorized seats.

Four of them are Class T directors, elected and removed by the LTBT. Four to three: just over half.

The other 3 seats are elected by Class A and Class F voting together. Because Class F always holds 50.1% of the vote, these 3 seats are in practice decided by the founders.

The initial slate: the Class T seats are Hastings, Narasimhan and Liddell, plus one vacancy; the other 3 seats are Dario Amodei, Daniela Amodei and Razavi.

Liddell's seat is the “designated Class T director.” Appointing or removing it takes an extra procedure, the cleverest part of the whole design, covered in chapter 08.

Note that the LTBT itself does not run day-to-day operations or set strategy; its job is to pick directors who can balance the three objectives. But major events such as a merger or a sale of substantially all assets need the board's approval, and it chooses the board's majority.

### 06 The shareholder meeting: the 50.1% share

At the shareholder meeting, on general matters other than electing Class T directors, Class A and Class F vote together as one class.

The votes of that one Class F share are not a fixed number but a proportion: always 50.1% of the total. However many Class A shares are issued, they split only the remaining 49.9%.

Class N has no vote, and Classes T and E don't take part in general votes. So general matters, including electing the 3 non-T directors, are decided by the founders.

On the other side, because the LTBT elects a majority of the board, the company is a “controlled company” under Nasdaq rules and may skip some governance requirements; the company says it uses this exemption only for the nominating and corporate governance committee (NGC).

For an investor buying Class A: what you get is the economic interest, with quite limited influence over the board and general votes. The prospectus lists this as a risk.

### 07 Who checks whom

Draw all the parties on one diagram. Through the Class T share, the LTBT elects and removes 4 of the board's 7 seats.

The Founder LLC and Class A holders vote together to elect and remove the other 3; because of the 50.1%, the founders decide in practice.

In the middle sits a key node: the nominating and corporate governance committee (NGC), made up of 1 Class T director and 2 non-T directors. Whenever the LTBT or the founders want to nominate or remove a director, or the LTBT wants to appoint or remove a trustee, they must give the NGC 30 days' notice.

When the NGC disagrees with what the LTBT wants to do with the “designated Class T director,” the dispute goes to an employee vote. The next chapter looks at that process.

Who oversees the LTBT itself? Trustees are elected by the sitting trustees for one-year terms. If a trustee engages in disqualifying conduct and removal best serves the trust's purpose, the Delaware Court of Chancery can order the removal.

There is one more path: any Class T director can be removed “for cause” without the NGC or the employees agreeing; but the LTBT and the Founder LLC have agreed to give each other and the NGC 30 days' notice before removing any director for cause.

Overall: every party's key moves are visible to another party, and each has a step where another party can take over.

### 08 The designated Class T director: employees as referee

Start where the process starts: if the LTBT wants to nominate, remove or replace the “designated Class T director,” it must give the NGC 30 days' notice.

If the NGC agrees, it takes effect.

If the NGC has not agreed within 15 days, the matter goes to the Class E holders, that is, an employee vote.

If more than half of the outstanding Class E shares take part and more than half of the votes cast are in favor, the LTBT's proposal takes effect; otherwise it doesn't.

The LTBT can also withdraw its proposal at any time before the employees vote.

A code-review analogy: the LTBT submits a change and the NGC reviews it, and 2 of the NGC's 3 members are non-T directors chosen by the founders' side. When the review fails, all employees act as the final arbiter.

Where do employees' votes come from? One Class E share for every full 6 months of service, and one more for every Class A share pledged through the company's donation matching program. After leaving, half are redeemed each year; joining a direct competitor redeems them all. So long-serving employees who give more have more say.

### 09 Changing the LTBT's rules = a multisig

If someone wants to change the LTBT's rules, or simply redeem the Class T share and take the LTBT out, they must meet the so-called “trust amendment threshold.” It works like a multi-signature.

Path one: the trustees themselves agree. Then it takes 80% of the board quorum plus 80% of the sitting trustees.

Path two: the trustees disagree but Class F still exists. Then founders, employees and public shareholders must all agree. Before the third anniversary of the IPO, that can be the founders unanimously plus a majority each of employees and Class A holders.

At any time, it can also be two-thirds of the founders, 75% of employees and a majority of Class A holders. Here the employees' bar is actually higher.

Path three: the trustees disagree and Class F no longer exists. Then it takes 85% of outstanding Class A shares, a very high bar.

Conclusion: when the trustees disagree, the founders cannot remove the LTBT on their own, and neither can investors or employees. Changing the rules needs several parties to sign at once.

### 10 The founders' kill switch

The founders' 50.1% is not permanent. The Class F share is held by the Founder LLC, whose initial members are the 7 co-founders; a majority of members decides how that vote is cast.

Members leave in these cases: resignation, death or incapacity, removal for cause, approved leave, and one interesting condition: holding less than 2% of the Class A shares they held at the IPO.

The 2% rule means the founders may give away most of their personal stock (they have pledged to give away 80%), but must keep some real economic interest or lose their vote.

If fewer than 3 founders remain…

…and that lasts 90 days in a row, a 450-day transition period begins. When it ends, the Class F and Class E shares are both redeemed for nothing, and the founders' special voting power is over.

Once Class F is gone, the special procedure for the “designated Class T director” goes too. The employees' role as referee was always meant for disagreements between the LTBT and the founders' side, which helps explain why Class E comes and goes with Class F.

Before then, until the 10th anniversary of the IPO, a successor can be admitted when a founder dies or becomes incapacitated; members can also be added during the transition period, but that cannot stop or extend it.

### 11 Seeing it as a state machine

Finally, treat the whole structure as a state machine. Current state: Class T and Class F both exist, which is everything covered so far.

If the founders' side sunsets first: Classes F and E are redeemed; the LTBT still elects the board majority, Class A holders elect the other directors and decide general matters; the board moves to three staggered classes.

If the LTBT's side sunsets first: Classes A and F vote together to elect every director, and the founders' 50.1% gives them control.

Once both have sunset, it is close to an ordinary listed company: Class A, one share one vote.

The two triggers are very asymmetric: the F sunset can fire automatically as numbers shrink; the T sunset never happens just because time passes and needs the multisig threshold from the previous chapter. And every transition is one-way: once triggered it cannot be extended, postponed or waived.

### 12 Summary: six design points

Back to the opening question. In engineering terms, the structure has six design points:

1. Separation of concerns: money and power are split. Classes T, F and E have power but no money; Class N has money but no vote.
2. The majority is sharded: the board majority belongs to the LTBT, the shareholder-meeting majority to the founders, and nobody has all of it.
3. There is an arbiter: for the “designated Class T director” seat, when the LTBT and the NGC disagree, employees vote to decide.
4. Multisig: when the trustees disagree, changing the LTBT's rules needs founders, employees and public shareholders to agree at once.
5. A kill switch: the founders' special powers end once fewer than 3 of them remain.
6. The costs are written in the prospectus too: Class A holders have limited influence, the LTBT's interests may differ from shareholders', and public-benefit performance has no objective metric to test it against.

In one sentence: the founders run the shareholder meeting, the LTBT runs the board majority, employees decide the key disputes, and no one can change the rules alone.
