# PERSONALITY-DRIFT.10 — Behavioral Drift Certification

Status: **implementation complete; CI proof pending on this branch/PR**.

## Scope

PERSONALITY-DRIFT.1–.10 adds an observation-only evaluator around the already-certified Personality V2 runtime. It does not introduce a new personality authority or mutation path.

```text
PersonalityState
  → Real Nigga Core expected posture
  → Behavioral Kernel
  → Expression Kernel
  → model realization
  → ObservedBehavior
  → Personality drift evaluator
  → DriftAssessment receipt
```

## Gates

| Gate | Result |
| --- | --- |
| DRIFT.1 contracts | COMPLETE — ExpectedBehavior, ObservedBehavior, DriftAssessment |
| DRIFT.2 expected projector | COMPLETE — derives measurable vector from governed BehavioralDecision/ExpressionPlan |
| DRIFT.3 observation contract | COMPLETE — realized behavior enters only as ObservedBehavior |
| DRIFT.4 evaluator | COMPLETE — expected/observed comparison |
| DRIFT.5 scoring | COMPLETE — per-dimension + aggregate score and severity |
| DRIFT.6 context normalization | COMPLETE — expectation is derived after serious/precision context is applied |
| DRIFT.7 attribution | COMPLETE — personality/model/runtime/prompt/expression-kernel versions are compared, without claiming causation |
| DRIFT.8 receipts | COMPLETE — deterministic evidence payload with sample lineage |
| DRIFT.9 adversarial/regression | COMPLETE — stable behavior, sustained drift, context override, lineage mismatch, invalid observations, no Personality mutation |
| DRIFT.10 certification | SOURCE COMPLETE — dedicated CI includes the certification test; runtime CI proof remains required |

## Authority invariants

- The evaluator is observation-only.
- A drift score cannot mutate PersonalityState.
- A drift score cannot change Values, Policy, Identity, authorization, or execution permissions.
- Model/runtime attribution differences are correlation metadata, not causal claims.
- Legitimate context changes are normalized by deriving expected behavior from the already-governed posture.
- Durable personality evolution still travels through Experience → Hippocampus → Pattern → Bayesian belief → explicit eligibility → PersonalityState.

## Scoring

The evaluator measures bounded numeric posture dimensions and expression-plan mismatches. A single response cannot create sustained drift. Default sustained drift requires at least five samples and at least 60% of samples at or above the watch threshold.

Thresholds are policy values, not learned personality values, and changing them does not change PersonalityState.

## Certification rule

DRIFT.10 becomes **CERTIFIED** only when the dedicated Jhadina Personality Core CI passes on the exact reconciled head containing this implementation. Until that receipt exists, source completion must not be represented as production certification.
