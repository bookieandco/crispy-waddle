# HCI foundations for Jhadina's UX decisions

Internal notes distilled from a classic HCI reference, for anyone working on
Jhadina's interfaces (command centers, the JANET approval flow, "Ask
Jhadina," navigation). These are paraphrased summaries and short citations
of the concepts, not a reproduction of the source text — the book itself is
under standard copyright and is intentionally **not** included in this
repository. If you want the primary source, get your own copy (library,
purchase, or institutional access).

**Source:** Helander, M. G., Landauer, T. K., & Prabhu, P. V. (Eds.).
(1997). *Handbook of Human-Computer Interaction* (2nd, completely revised
ed.). Elsevier Science. Concepts below draw on:
- Ch. 1, Nickerson, R. S. & Landauer, T. K., "Human-Computer Interaction:
  Background and Issues"
- Ch. 3, Allen, R. B., "Mental Models and User Models"

## 1. Users over-attribute intelligence to systems that seem clever

Nickerson & Landauer describe a recurring finding from early conversational
systems (their example is Weizenbaum's ELIZA, 1966): as soon as a system
shows *any* sign of understanding, people tend to credit it with far more
capability and comprehension than it actually has. The richer and more
fluent the interface, the more this gap between the user's model and
reality can grow (§1.5.5, "Users' Conceptions of the Systems They Use").

**Why it matters here:** this is close to the exact failure mode JANET's
architecture is built to prevent. An LLM that phrases things naturally will
get more benefit of the doubt from users than it's earned — including about
what it remembers, what it has "decided," or what happens when they type
something. That's the argument, in HCI terms, for why:
- the Memory flow never lets a conversational reply silently become a
  stored fact — every candidate is inert until an explicit approval action,
  and the UI should say so plainly rather than implying the assistant
  "just knows" things;
- the Timeline/audit trail exists at all — it gives the user a way to check
  their mental model of "what Jhadina has stored" against what's actually
  true, rather than trusting an impression formed from conversation alone;
- status and copy across the command centers (Money, Growth, Opportunity)
  should keep saying, out loud, where the system is only proposing versus
  where the user has actually decided something. It's not decoration — it's
  correcting for a documented bias.

## 2. Function allocation is a design decision, not a technical inevitability

Nickerson & Landauer are explicit that "what tasks should be assigned to
computers" is a real, contestable design question, separate from what a
computer is merely *capable* of doing (§1.5.3, "Function Allocation";
§1.3–1.4 more broadly on what's worth automating and how to find out).
Just because a model *can* take an action doesn't settle whether it
*should*, unsupervised.

**Why it matters here:** this is the design rationale behind Jhadina's
Enforcement Boundary — LLMs are advisory, deterministic code owns
authorization. Every new feature that lets Jhadina act on a user's behalf
(the Opportunity Command Center's Approve action, Growth's draft
scheduling, anything future) should make this allocation an explicit,
visible choice: what the system proposes, what requires a human decision,
and what it's never allowed to do at all (apply for a job, spend money,
publish something) regardless of confidence.

## 3. Usefulness and usability are twins, and neither excuses the other

"First and foremost a system must do something that is helpful... it is
not enough that a system does something that is novel, clever or
impressive" — but a genuinely useful function still fails if it's hard to
invoke, verify, or undo (§1.5.6). The chapter's broader argument (§1.3.3)
is that most real-world productivity gains from software come from cheap,
iterative, empirical testing with real users on real tasks — not from
first-draft design, however well-reasoned.

**Why it matters here:** a plausible-sounding feature (an opportunity feed,
a financial snapshot, a growth draft) is only half the job. The other half
is making the decision it's asking for genuinely checkable: can the user
tell at a glance why this was surfaced, what it will and won't do, and how
to undo or dismiss it cheaply if it's wrong. When in doubt, that's worth
testing against a real user session rather than settling from a design
review alone.

## 4. Mental models are built from metaphors, and bad metaphors misfire

Allen (Ch. 3) distinguishes a user's *mental model* (in their head, shaped
indirectly) from a *user model* (the system's model of the user, editable
directly), and walks through how conceptual models get built — most
relevantly, via **metaphor**: mapping a new concept onto something the user
already understands (his example: a filing-cabinet icon for a file system).
Metaphors are powerful specifically because they transfer expectations, but
that cuts both ways — an imperfect metaphor imports wrong expectations
along with the useful ones, and users trained toward a coherent conceptual
model consistently outperform users trained by rote steps once a task goes
off the beaten path (§3.2.1, §3.2.2, citing Halasz & Moran 1983 and
Borgman 1986 on conceptual-model vs. task-based training).

**Why it matters here:** Jhadina leans on metaphor constantly — "Command
Center," "Worlds," a queue you "Approve/Save/Dismiss," a "Timeline." Those
names are doing real cognitive work, not just branding. Two concrete
implications:
- keep the vocabulary consistent across surfaces (an "Approve" in the
  Opportunity Command Center should mean the same *kind* of commitment as
  an "Approve" in the Memory queue — same gate, same irreversibility,
  same audit trail), since inconsistent use of the same word across
  screens is exactly the kind of mismatch that produces a wrong mental
  model;
- when introducing a new metaphor (e.g., "Worlds" for the app-switcher),
  it's worth asking what expectations it imports that might *not* hold —
  a filing cabinet implies things are still there until you move them;
  does "Worlds" imply isolation between them that isn't actually true?

## Where to go from here

This file only reflects three chapters of one (older, but still
foundational) reference. If a specific design decision needs deeper
backing — supervisory control and levels of automation, usability
evaluation methods, natural-language interface design — those are
individually well-covered topics in the broader HCI literature and worth a
targeted look rather than assuming this note covers them.
