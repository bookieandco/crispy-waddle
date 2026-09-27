# SPORT-PRED.FINAL — Forward Shadow Certification

## Objective

SPORT-PRED.FINAL closes the repository-side sports-prediction pipeline from
point-in-time sports reality through a replayable prediction envelope and into a
forward-shadow certification cohort.

It is intentionally **not** a claim that a sports model has a profitable real-world
edge. The software can be completed and certified immediately; statistical edge
requires real predictions issued before outcomes and enough elapsed forward
evidence.

## Final pipeline

```text
official / licensed sports observations
        ↓
SPORT-PRED.2 point-in-time SportsRealitySnapshot
        ↓
SPORT-PRED.3 cutoff-safe feature snapshot
        ↓
SPORT-PRED.4 replayable scenario simulation
        ↓
SPORT-PRED.5 frozen SPORT-PRED-01 producer
        ↓
SPORT-PRED.6 sport × market × model arena
        ↓
SPORT-PRED.7 immutable forward-shadow issuance
        ↓
resolved outcomes + closing prices
        ↓
SPORT-PRED.FINAL certification
        ↓
Money Core research ingress / Bet Alpha
```

No step grants betting or financial authority.

## SPORT-PRED.2 — point-in-time sports reality

`sports-prediction-reality.ts` provides canonical event snapshots with:

- sport and competition;
- scheduled start and event state;
- canonical participants;
- timestamped observations;
- source/evidence lineage;
- observation-time and availability-time separation;
- explicit future-observation exclusion.

An observation that becomes available after the prediction cutoff is recorded in
`excludedFutureObservationIds`; it cannot enter the as-of snapshot.

This supports pregame and live-game prediction without allowing post-event
information to leak into historical replay.

## SPORT-PRED.3 — feature factory

`sports-prediction-features.ts` converts reality observations into versioned,
cutoff-safe feature snapshots.

Feature families include:

- team/player strength;
- form;
- matchup;
- player role;
- availability;
- pace and efficiency;
- surface;
- weather;
- travel;
- home field;
- live game state;
- coaching/scheme;
- market context;
- narrative context.

Every feature preserves:

- event and subject;
- observed/available time;
- methodology version;
- source-observation IDs;
- evidence IDs;
- normalized value.

Narrative evidence is forced to `CONTEXT_ONLY`. It cannot silently become a
primary numerical model input.

## SPORT-PRED.4 — scenario simulation

`sports-prediction-simulation.ts` supplies deterministic/replayable scenario
simulation.

The scenario slider vocabulary includes:

- FORM
- MATCHUP
- HOT_STREAK
- FATIGUE
- INJURY_UNCERTAINTY
- PACE
- VENUE
- WEATHER
- PLAYER_NIGHT
- TACTICAL_ADJUSTMENT

A scenario stores explicit per-outcome logit shifts plus uncertainty. The simulation
is replayable from:

```text
feature snapshot
+ model ID/version
+ scenario
+ random seed
+ path count
```

The simulation emits a probability distribution and separate aleatoric /
epistemic / overall uncertainty. It cannot execute.

## SPORT-PRED.5 — frozen prediction producer

`sports-prediction-producer.ts` converts reality + features + simulation into the
existing canonical `SPORT-PRED-01` envelope consumed by Money Core.

A model specification must contain:

- model ID;
- model version;
- methodology version;
- feature-schema version;
- code revision;
- frozen timestamp;
- sport;
- market family.

The model must be frozen before the information cutoff. Calibration evidence must
also predate the cutoff.

The resulting envelope preserves:

- complete probability mass;
- feature-snapshot hash;
- input/evidence snapshot hashes;
- uncertainty;
- model/version/code identity;
- official resolution semantics;
- no betting or financial execution authority.

## SPORT-PRED.6 — Model Arena

`sports-prediction-model-arena.ts` evaluates models by:

```text
sport × market family × model × model version
```

It records:

- multiclass Brier score;
- log loss;
- top-pick accuracy;
- expected calibration error;
- optional shadow return;
- optional closing-line value;
- REAL_AS_OF vs SYNTHETIC_TEST source class.

A synthetic result never counts toward the real calibration sample.

Ensemble weights are based only on models that have enough REAL_AS_OF evidence in
the same sport and market family. There is no universal "best AI model" shortcut.

## SPORT-PRED.7 — immutable forward shadow

`sports-prediction-forward-shadow.ts` binds each prediction to:

- its exact `SPORT-PRED-01` envelope;
- event and market family;
- selected outcome;
- point-in-time sportsbook/prediction quote;
- quote availability before the information cutoff;
- fair and implied probability;
- entry edge;
- source class;
- evidence lineage.

Settlement records preserve:

- actual result;
- resolution time;
- hypothetical unit-stake return;
- closing-line value when a closing quote exists;
- arena/calibration observation;
- complete evidence lineage.

All records remain shadow/learning only.

## Anti-cherry-picking controls

A forward cohort has a separate issuance registry. The cohort builder requires:

```text
issuance registry IDs == supplied prediction IDs
```

If any issued prediction is missing, certification throws
`SPORT_PRED_SHADOW_SURVIVORSHIP_FILTER_DETECTED`.

A cohort must also contain exactly one model ID/version. A changed model/version is
a new experiment and must begin a new cohort. Mid-run mutation cannot rewrite the
old sample.

Open/unresolved predictions remain visible in
`unresolvedPredictionIds`; they are not silently discarded.

## Forward certification metrics

A real cohort can be evaluated against configured thresholds for:

- minimum resolved sample;
- minimum distinct events;
- minimum elapsed forward days;
- maximum mean Brier score;
- maximum expected calibration error;
- optional minimum closing-line value;
- optional minimum shadow return.

Certification states are:

```text
SOFTWARE_ONLY
INSUFFICIENT_FORWARD_EVIDENCE
REJECTED
FORWARD_SHADOW_CERTIFIED
```

`SYNTHETIC_TEST` or mixed evidence can exercise every code path, but can only
produce `SOFTWARE_ONLY`.

`FORWARD_SHADOW_CERTIFIED` requires a wholly `REAL_AS_OF` cohort.

Prediction-quality certification and economic-edge certification are separate.
A calibrated sports model is not automatically a profitable betting strategy.

## SPORT-PRED.FINAL software matrix

`sports-pred-final-certification.ts` requires all of these source invariants:

1. point-in-time reality;
2. future-observation exclusion;
3. cutoff-safe feature snapshot;
4. narrative context only;
5. replayable scenario simulation;
6. frozen model version;
7. valid `SPORT-PRED-01` envelope;
8. Money research-only boundary;
9. prediction issued before resolution;
10. quote available before information cutoff;
11. full issued history retained;
12. model mutation starts a new cohort;
13. sport/market-specific Model Arena;
14. synthetic evidence cannot certify edge;
15. no betting or financial authority.

A passing software report intentionally contains:

```text
softwarePassed = true
forwardShadowHarnessReady = true
statisticalEdgeCertified = false
liveBettingEligible = false
```

because source tests cannot manufacture a future empirical track record.

## Operational evidence still required for statistical certification

After merge, a real SPORT-PRED model can earn forward certification only with:

- immutable REAL_AS_OF predictions timestamped before resolution;
- complete issued-prediction registry including losses and unresolved predictions;
- fixed model/version per cohort;
- official result evidence;
- real closing odds/prices if economics are evaluated;
- sufficient resolved events and forward duration.

This is an evidence requirement, not missing software.

## Existing Money/Bet Alpha integration

SPORT-PRED.FINAL feeds the already-merged Money surfaces:

- `sports-intelligence-ingress.ts`
- `sports-paper-betting.ts`
- `sports-handicap-evidence.ts`
- `sports-prop-intelligence.ts`
- `sports-parlay-intelligence.ts`
- `prediction-cross-venue-intelligence.ts`
- `position-management.ts`
- `cross-domain-alpha-router.ts`

That means a certified prediction can inform props, sides, totals, parlays,
prediction markets and live position re-underwriting without giving Sports
Prediction execution authority.

## Certification command

```bash
pnpm --filter @jhadina/money-core verify:sport-pred-final
```

Dedicated CI:

```text
.github/workflows/sport-pred-final-certification.yml
```

## Acceptance interpretation

Repository/software completion is:

```text
SPORT-PRED.FINAL SOFTWARE COMPLETE
+ FORWARD SHADOW HARNESS READY
+ REAL STATISTICAL EDGE EVIDENCE REQUIRED
```

This is deliberate. The system fails closed rather than fabricating a profitable
sports-prediction history or upgrading a paper/shadow result into live betting
authority.


## Research-source enrichment — NFL props + soccer props

Two September 2026 YouTube sources were audited as research inputs:

- VSiN / John Hansen: *I Analyzed Every Falcons vs Packers Prop — Here’s 5 Props That I LOVE (as a Prop Betting Expert)*.
- Maikito: *5-1 PLAYER PROP DAY My Best FIFA/Soccer bets, player props, moneylines for today September 27th 9/27*.

The system does **not** import their picks or confidence as truth. It extracts reusable variables and decision mechanics that can be forward-tested.

### American-football matchup mechanics

The NFL source repeatedly uses:

- defensive coverage-shell rates such as two-high, single-high and Cover 3;
- player yards-per-route-run against specific coverage families;
- snap share and route participation;
- target/role concentration after injuries;
- opponent position-specific allowed production;
- offensive-line injuries;
- game-script reasoning for rush attempts versus rushing yards;
- line movement between an earlier number and the current number;
- receptions versus receiving-yard markets as different distributions;
- longest-reception / plus-money specials as tail events;
- public-handle splits as market context.

These are now supported through:

- `COVERAGE_SHELL`;
- `OPPORTUNITY_SHARE`;
- `GAME_SCRIPT`;
- `TAIL_EVENT_RATE`;
- `MARKET_CONTEXT`; and
- `AmericanFootballMatchupContext`.

A coverage profile must sum to 10000 bps and preserve source evidence. Coverage-specific efficiency is a feature, not a universal betting rule.

### Soccer role and opportunity mechanics

The soccer source repeatedly uses:

- expected possession;
- opponent possession conceded;
- player shots per 90;
- formation/role changes;
- injuries reallocating offensive responsibility;
- penalty/free-kick/set-piece duty;
- projected minutes;
- substitution risk;
- confirmed versus projected lineups;
- goalkeeper/pass-volume dependence on game state;
- player-fantasy composite scoring markets;
- line bumps between publication and later availability.

These are now supported through:

- `EXPECTED_POSSESSION`;
- `FORMATION_ROLE`;
- `SET_PIECE_ROLE`;
- `PROJECTED_MINUTES`;
- `SUBSTITUTION_RISK`;
- `LINEUP_STATUS`; and
- `SoccerPlayerRoleContext`.

A player marked OUT cannot carry nonzero projected minutes. Bench status cannot silently be modeled as a full 90-minute role.

### Exact market semantics

`sports-market-semantics.ts` distinguishes:

- count thresholds;
- yardage thresholds;
- longest-event thresholds;
- composite fantasy-score thresholds;
- binary events.

Composite markets must retain the exact provider scoring-rule version and per-stat weights. A generic expected fantasy score cannot substitute for the provider's actual scoring formula.

Longest-reception and other tail-event markets require a full distribution. A mean-only yardage projection cannot be used to justify a longest-play threshold.

Line/price movement is retained as:

```text
MARKET_OBSERVATION_ONLY
```

A move from 43.5 to 45.5, or a change from -110 to -125, may show the market became more expensive. It does not by itself prove sharp money, bookmaker intent or predictive correctness.

### Pre-lineup and post-lineup forecasts

`sports-prediction-revision-lineage.ts` preserves separate prediction envelopes when new information arrives.

Examples:

```text
early projected lineup prediction
    ↓ lineup confirmed / rotation discovered
new information cutoff
    ↓
new prediction envelope
```

The earlier envelope remains in history.

A revision requires:

- the same event and sport;
- a strictly later information cutoff;
- a strictly later issuance time;
- explicit reason codes;
- changed-evidence IDs;
- the same model ID/version.

A model-version change is not a revision. It starts a new experimental cohort.

This prevents late lineup knowledge from overwriting the actual prediction that existed earlier.

### Process quality does not rewrite results

The soccer source describes a losing under as a play that "should have gone under" because the decisive shots came late.

SPORT-PRED records that distinction without rewriting reality.

`sports-prediction-process-review.ts` can label a record as:

- GOOD_PROCESS_GOOD_RESULT;
- GOOD_PROCESS_BAD_RESULT;
- WEAK_PROCESS_GOOD_RESULT;
- WEAK_PROCESS_BAD_RESULT; or
- NON_DECISION_RESULT.

Process evidence can include positive entry edge and closing-line value.

But:

```text
nearMissCreditBps = 0
canRewriteOutcome = false
```

A loss remains a loss in calibration, P&L and certification regardless of how close the result was.

This lets Jhadina learn from process without introducing hindsight grading or creator-style "should have won" accounting.
