# PURSE-LEARNING-MEMORY.FINAL

## Purpose

Jhadina's Purse must improve its capital-allocation decisions from experience instead of repeatedly evaluating every opportunity as if no prior decisions had occurred.

This milestone connects the Purse to:

- Money Core paper-trading learning;
- Sports paper/shadow outcome and process memory;
- SHARK post-exit trade learning;
- Jhadina's governed Personality state.

The learning layer changes future confidence, ranking, sizing discounts and cash patience. It never grants trading, betting, conversion, transfer, deposit, withdrawal, signing or broadcast authority.

## Feedback loop

```
paper/shadow/trade outcome
        |
        v
domain learning record
        |
        +---- Money paper StrategyLearningRecord
        +---- Sports SportsLearningEpisode
        +---- SHARK ClosedMemeTradeLearningRecord
        |
        v
PurseLearningEpisode
        |
        v
PurseStrategyLearningProfile
        |
        +---- return history
        +---- win/downside rate
        +---- process quality
        +---- execution quality
        +---- thesis support/invalidation
        +---- sizing mistakes
        +---- signal success/failure
        |
        v
PurseFinancialTemperament
(personality + learned history)
        |
        v
PurseLearningContext
        |
        v
allocatePurseCapital
        |
        v
PurseDecisionSet
```

## SHARK integration

SHARK already closes its own trade-learning loop when an `EXITED` event arrives.

Its `createPostExitLearningConsumer` accepts an `onLearning` callback.

Money Core now exports:

`createPurseSharkLearningCallback(runtime)`

That callback normalizes the SHARK learning record into Purse memory. It preserves:

- net return after costs;
- signals that worked;
- signals that failed;
- sizing diagnosis;
- modeled-vs-realized slippage;
- narrative confirmation/degradation;
- exit reasons;
- full evidence lineage.

SHARK remains intelligence/learning only and receives no Coffer authority.

## Money paper integration

Existing `StrategyLearningRecord` records are normalized with `purseLearningFromStrategyRecord`.

`PurseLearningRuntime.ingestPaper` appends the episode and recalibrates the affected strategy profile.

The runtime also exports `createPursePaperLearningCallback` for orchestration code.

Paper outcomes can improve future Purse decisions, but paper promotion still cannot authorize live execution.

## Sports integration

`SportsAutoLearningRuntime` now accepts an optional `purseLearningSink`.

After a Sports paper wager resolves and its `SportsLearningEpisode` is written to Sports learning memory, that same episode is forwarded to Purse memory before model feedback continues.

This means good-process/bad-outcome and bad-process/good-outcome distinctions survive into Jhadina's portfolio-level capital decisions.

## Strategy profiles

A Purse strategy profile aggregates longitudinal evidence per lane + strategy.

It records:

- sample size;
- mean return;
- win rate;
- downside rate;
- decision/process quality;
- execution quality;
- thesis support rate;
- thesis invalidation rate;
- evidence strength;
- durable lesson tags.

The profile produces two bounded adjustments:

### Confidence adjustment

Range: **-2500 to +1000 bps**.

Positive history may increase confidence modestly. Weak or bad history can reduce it substantially.

### Sizing multiplier

Range: **2500 to 10000 bps**.

Learning may reduce candidate size.

It can never increase an allocation above the original charter-bounded candidate.

A supported strategy can recover to 100% of the already-permitted candidate size; it does not create additional risk capacity.

## Financial temperament and Personality

The Purse accepts Jhadina's governed Personality state structurally.

Financial temperament derives:

- cash patience;
- evidence discipline;
- exploration tendency;
- loss sensitivity;
- independent-assessment requirement;
- explanation style.

Personality is not a substitute for evidence.

### Live rule

In `LIVE_GOVERNED_INTENTS` mode:

- personality-driven exploration is forced to zero;
- `livePersonalityRiskBoostAllowed=false`;
- personality cannot increase position size;
- personality cannot loosen the Treasury Charter;
- personality cannot alter owner payout controls;
- personality cannot grant financial authority.

### Paper / shadow rule

In paper or shadow mode, novelty/experimentation may permit limited exploration of under-sampled strategies so Jhadina can gather evidence.

Even there, the exploration adjustment is capped at the original base score/risk candidate and grants no live authority.

## Learned decision cycle

`runLearnedPurseDecisionCycle` is the canonical pre-allocation path.

It:

1. identifies strategies in the current opportunity set;
2. loads their latest durable Purse learning profiles;
3. derives the current financial temperament from Jhadina's Personality state plus historical outcomes;
4. creates a `PurseLearningContext`;
5. passes that context into `allocatePurseCapital`;
6. creates the final `PurseDecisionSet`.

Decision receipts preserve:

- source confidence;
- learned confidence;
- base score;
- learned score;
- learning profile ID;
- confidence delta;
- sizing multiplier;
- evidence lineage;
- the "why" behind the learned adjustment.

## Durable storage

Migration `029_purse_learning_memory_final.sql` adds append-only server-only evidence tables:

- `money_purse_learning_episodes`;
- `money_purse_learning_profiles`;
- `money_purse_financial_temperaments`.

They use FORCE RLS and revoke anon/authenticated access. Service role receives only `SELECT, INSERT`.

Database checks independently enforce:

- `financial_authority='NONE'`;
- `can_authorize_live=false`;
- `can_execute=false`;
- no personality live-risk boost;
- learning sizing multiplier never exceeds 10000 bps.

## What “better over time” means

The system does not equate a profitable outcome with a good decision.

It learns separately from:

- outcome;
- process;
- execution;
- sizing;
- thesis validity;
- signal reliability.

Examples:

- A profitable Sports bet produced by bad process can reduce future confidence.
- A losing Sports bet with strong process can remain informative rather than being treated as pure failure.
- A profitable SHARK trade with bad slippage can improve thesis confidence while reducing execution expectations.
- Repeated failed wallet-cluster or narrative signals can lower future SHARK-derived Purse scores.
- Repeated over-sizing becomes a durable lesson that reduces candidate size.
- Strong paper history can restore full chartered sizing but cannot enlarge the charter.

That is the intended learning loop: **Jhadina develops financial judgment, while constitutional money authority remains outside the learning system.**
