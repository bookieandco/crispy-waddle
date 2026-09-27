# SPORT-BET.FINAL — Live Canary + Shadow Certification

## Objective

SPORT-BET.FINAL closes the repository-side boundary between sports prediction,
continuous shadow wagering, and a deliberately tiny live sportsbook canary.

It does **not** convert Sports Prediction into an execution authority.

The authority split remains:

```text
Sports perception / SPORT-PRED
        ↓ intelligence only
Money Core sports evaluation
        ↓
continuous SHADOW decisions (automatic, zero funds)
        ↓
operational shadow certification
        ↓
explicit HUMAN live-canary trigger
        ↓
tiny provider-bound wager
        ↓
provider receipts + settlement + reconciliation + failure drills
        ↓
live-canary certification
```

Production autonomous sports betting remains disabled by this milestone.

## What is now implemented

### 1. Shadow runtime

`sports-bet-shadow-runtime.ts` converts a canonical
`SportsForwardShadowPrediction` into one of two immutable outcomes:

- `SHADOW_WAGER`
- `NO_BET`

A shadow decision cannot execute. It retains:

- prediction/event/market/selection lineage;
- point-in-time quote lineage;
- quote age;
- entry edge;
- decision time;
- evidence IDs;
- explicit `bettingAuthority: NONE`;
- explicit `financialAuthority: NONE`;
- `canExecute: false`.

The runtime rejects future quotes. Stale quotes and below-threshold edges become
`NO_BET`, not fabricated opportunities.

### 2. Operational shadow soak

A shadow soak records:

- all decisions;
- all shadow wagers;
- resolved wagers;
- unresolved prediction IDs;
- stale-quote count;
- duplicate-decision count;
- future-leak count;
- settlement mismatches;
- authority escalations;
- evidence lineage;
- elapsed forward time.

Certification states are:

```text
SOFTWARE_ONLY
INSUFFICIENT_FORWARD_EVIDENCE
REJECTED
SHADOW_CERTIFIED
```

Only `REAL_AS_OF` evidence can produce `SHADOW_CERTIFIED`.

Synthetic fixtures can exercise the complete software path, but they remain
`SOFTWARE_ONLY`.

Operational shadow certification is intentionally separate from predictive or
economic edge. A technically clean live shadow loop is not proof that a betting
strategy is profitable.

### 3. Tiny live-canary contract

`sports-bet-live-canary.ts` introduces a sportsbook canary adapter boundary.

A canary cannot run unless all of the following hold:

- the adapter reports `environment: LIVE`;
- provider and account exactly match the canary policy;
- the request is bound to the exact event, market, selection, quote and stake;
- jurisdiction status is `ALLOWED`;
- age eligibility has been verified;
- live provider credentials have been verified;
- the betting kill switch is not active;
- no unresolved provider execution exceeds the allowed unknown-execution boundary;
- per-wager stake is below the tiny-canary limit;
- daily wager count, stake and loss limits are respected;
- the quote is fresh;
- a request-specific approval exists and is unexpired;
- the exact user performs an `EXPLICIT_HUMAN_EXECUTE` action;
- an idempotency key has never been used before.

The live adapter cannot be invoked by the prediction model or the shadow runtime.

### 4. Replay and unknown-state protection

Each canary is bound to:

```text
approval ID
+ exact request fingerprint
+ explicit human trigger
+ idempotency key
+ execution ID
```

A duplicate execution is blocked.

An `UNKNOWN` provider state is not treated as a loss, fill, rejection, or retry
signal. It must be reconciled before the runtime may exceed its unknown-execution
policy.

### 5. Live certification evidence

A live canary certificate requires all of the following real evidence:

- LIVE provider/account identity;
- exact request, approval and trigger lineage;
- tiny stake within the configured canary maximum;
- provider acknowledgement plus a terminal provider state;
- provider receipts;
- settlement evidence;
- account/wager reconciliation with `MATCH`;
- credential-verification evidence;
- jurisdiction evidence;
- age-eligibility evidence;
- duplicate-submission drill;
- unknown-execution blocking drill;
- betting kill-switch drill.

Certification states are:

```text
SOFTWARE_ONLY
REJECTED
LIVE_CANARY_CERTIFIED
```

Only `REAL_AS_OF` evidence can produce `LIVE_CANARY_CERTIFIED`.

A live canary certificate has:

```text
scope = TINY_MANUAL_CANARY_ONLY
canIncreaseLimits = false
autonomousBettingEnabled = false
```

A successful canary therefore does not authorize the system to raise its own
limits or begin autonomous wagering.

## SPORT-BET.FINAL software matrix

The dedicated source certification requires all of these cases:

1. prediction authority remains isolated;
2. shadow decisions never execute;
3. quote freshness is enforced;
4. future quotes are blocked;
5. explicit human live trigger is required;
6. canary stake is capped;
7. jurisdiction and age eligibility are gated;
8. credential verification is required;
9. idempotency replay is blocked;
10. unresolved/unknown executions block unsafe continuation;
11. settlement reconciliation is required;
12. the betting kill switch is required;
13. synthetic evidence cannot certify live operation.

## Final report states

```text
BLOCKED_SOFTWARE
SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED
SHADOW_CERTIFIED_LIVE_CANARY_REQUIRED
LIVE_CANARY_AND_SHADOW_CERTIFIED
```

A source-only CI run should finish at:

```text
softwarePassed = true
shadowOperationallyCertified = false
liveCanaryCertified = false
status = SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED
productionAutonomousBettingEnabled = false
canIncreaseCanaryLimits = false
```

That is a successful software result, not a failed build.

## Relationship to SPORT-PRED.FINAL

SPORT-PRED.FINAL remains responsible for:

- point-in-time sports reality;
- cutoff-safe features;
- scenario simulation and sliders;
- frozen model/version lineage;
- immutable forward predictions;
- calibration and forward-shadow model evidence.

SPORT-BET.FINAL consumes those artifacts but never edits them and never grants
them betting authority.

## Relationship to Money production commissioning

The existing `SPORTS_BETTING` production lane still requires:

- SOFTWARE_CERTIFICATION;
- a passing shadow soak;
- sportsbook provider configuration;
- sportsbook credential verification;
- a tiny LIVE_CANARY;
- wager/settlement reconciliation;
- betting kill-switch evidence.

SPORT-BET.FINAL now supplies the missing runtime and evidence contract for those
sports-specific gates. It does not fabricate the external provider receipts.

## Current external blocker

At the time this milestone was created, the repository did not contain a
commissioned executable sportsbook adapter or live sportsbook credentials.
Kalshi remained a prediction-market research/integration target rather than a
certified sportsbook execution provider.

Therefore the repository can truthfully certify the software and synthetic
failure paths now, while real shadow and live-canary certification remain
evidence-driven commissioning tasks.

## Certification command

```bash
pnpm --filter @jhadina/money-core verify:sport-bet-final
```

Dedicated CI:

```text
.github/workflows/sport-bet-final-certification.yml
```

## Acceptance interpretation

Repository completion is:

```text
SPORT-BET.FINAL SOFTWARE COMPLETE
+ SHADOW RUNTIME COMPLETE
+ LIVE CANARY BOUNDARY COMPLETE
+ SYNTHETIC FAILURE DRILLS COMPLETE
+ REAL-AS-OF SHADOW EVIDENCE REQUIRED FOR SHADOW_CERTIFIED
+ REAL PROVIDER CANARY EVIDENCE REQUIRED FOR LIVE_CANARY_CERTIFIED
+ NO AUTONOMOUS SPORTS BETTING AUTHORITY
```
