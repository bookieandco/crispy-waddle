# SPORT-SIM.2F — causal sliders through PaperCore

## Objective

SPORT-SIM.2F upgrades the certified SPORT-PRED producer from a replayable probability
simulator into a causal, sport-state-aware simulation stack that can generate Bet
Alpha and automatically test eligible opportunities inside PaperCore.

It does **not** grant live sportsbook or prediction-market execution authority.

## 2A — Causal sliders

`sports-simulation-slider-engine.ts` resolves each slider from:

```text
observed value
+ evidence strength
+ learned baseline
+ optional stress-test override
```

The output is a versioned impact assessment containing:

- effective slider values;
- outcome logit shifts;
- volatility changes;
- real-vs-synthetic rule counts;
- calibration eligibility;
- evidence lineage.

Stress overrides are explicitly separated from learned operation and cannot be
counted as empirical calibration evidence.

## 2B — Sport-specific state transitions

`sports-simulation-state.ts` defines state transitions for:

- football;
- basketball;
- baseball;
- hockey;
- tennis;
- boxing;
- soccer.

The state layer tracks the sport-specific variables needed for live re-simulation,
including possession/clock/score, down-distance, inning/out state, strength state,
server/point state, round/damage/fatigue, substitutions/cards and related context.

These transition functions are deterministic state machinery. Their parameters and
probabilities still require real calibration.

## 2C — Correlated Monte Carlo

`sports-correlated-monte-carlo.ts` generates shared-path distributions for:

- home/away score;
- margin;
- total;
- player statistics;
- tail thresholds;
- standalone market legs;
- same-path joint probabilities.

Shared latent factors create correlation among team scores, player stats and market
legs. A configurable fat-tail regime prevents all paths from assuming one symmetric
Gaussian world.

Same-game parlay probability comes from:

```text
count(paths where every leg hit) / total paths
```

rather than multiplying standalone leg probabilities.

## 2D — Live re-simulation

`sports-live-resimulation.ts` compares a prior and next live simulation after
meaningful state/evidence changes.

Triggers include:

- score;
- clock;
- possession;
- lineup;
- injury;
- weather;
- player role;
- market movement;
- cards/fouls;
- manual stress testing.

The revision records probability deltas and driver attribution while preserving the
prior simulation.

## 2E — Calibration, sensitivity and ablation

`sports-simulation-calibration.ts` evaluates:

- market probabilities;
- tail probabilities;
- joint probabilities;
- Brier score;
- log loss;
- expected calibration error;
- slider ablation;
- slider sensitivity.

Synthetic evidence can exercise the machinery but produces `SOFTWARE_ONLY`, not
empirical edge certification.

A slider is considered helpful only when removing it worsens a real out-of-sample
metric in an appropriate cohort.

## 2F — Bet Alpha + PaperCore

`sports-sim-bet-alpha.ts` converts simulation probabilities and market prices into
rankable opportunities with:

- fair probability;
- implied probability;
- gross edge;
- estimated costs;
- uncertainty penalty;
- net edge;
- confidence;
- liquidity quality;
- expiry;
- evidence lineage.

Eligible sportsbook candidates can be automatically mirrored into
`SportsPaperWager` records under a bounded PaperCore policy.

The same Alpha can feed:

- cross-domain Money intelligence;
- prediction-market research;
- open-position re-underwriting.

Open positions use the existing:

```text
ADD
HOLD
TRIM
EXIT
HEDGE
ROTATE
```

decision path.

All outputs remain non-executable intelligence or paper simulation.

## Roboflow sports perception

`services/roboflow-sports-workflow-observer` adds an optional Roboflow Workflow
adapter with environment-only credentials:

```text
ROBOFLOW_API_KEY
ROBOFLOW_WORKSPACE_NAME
ROBOFLOW_WORKFLOW_ID
ROBOFLOW_CLASSES
```

The service returns `INFERRED_VISUAL_EVIDENCE_ONLY`.

`sports-vision-evidence.ts` maps admitted inference into a `CONTEXT_ONLY`
derived feature. It cannot directly become canonical Sports Reality or betting
authority.

A credential was exposed in chat during development and must be rotated before any
production use.

## Acceptance state

A passing software certification means:

```text
softwarePassed = true
causalSimulatorReady = true
liveResimulationReady = true
paperCoreAutomationReady = true
empiricalEdgeCertified = false
liveBettingEligible = false
```

Empirical edge remains dependent on REAL_AS_OF forward evidence.

## Certification

```bash
pnpm --filter @jhadina/money-core verify:sport-sim-2f
```

Dedicated CI:

```text
.github/workflows/sport-sim-2f-certification.yml
```

## External execution boundary

Kalshi/provider connectivity remains separately tracked under the Kalshi
audit/repair issue.

SPORT-SIM.2F does not add or commission:

- sportsbook credentials;
- sportsbook bet placement;
- Kalshi/Polymarket order placement;
- wallet signing;
- deposits/withdrawals;
- live financial execution.


## Basketball environment vs player tendencies

The NBA 2K25 slider discussion at \`https://youtu.be/frB2eQ-_Vrs\` is used as a
mechanics-taxonomy reference, not as real NBA evidence.

\`sports-basketball-mechanics.ts\` separates two layers:

1. **Environment** — pace, fast/slow player speed and acceleration, stamina/fatigue,
   contact sensitivity, pass speed, on-ball/help defense, defensive
   awareness/consistency, gather-vs-release contest impact, and foul environment.
2. **Player tendencies** — inside/close/mid/three/post shot mix, rim attack, post-up
   seeking, alley-oops, dunks, putbacks, backdoor cuts, transition attack and hustle.

The environment is frozen before player tendencies are layered. This prevents
roster-specific tuning from silently changing the global simulation physics.

The video's numeric examples remain \`VIDEO_GAME_REFERENCE\`:

\`\`\`text
realWorldTruth = false
calibrationEligible = false
authority = SIMULATION_INPUT_ONLY
\`\`\`

Real basketball effects must be learned from \`REAL_AS_OF\` historical/forward
cohorts. The video contributes structure and stress-test hypotheses only.
