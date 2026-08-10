# @jhadina/delivery-compliance-gate

Deterministic pre-dispatch gate for regulated delivery workflows.

## Purpose

The gate prevents dispatch when the active jurisdiction policy is not satisfied. It is deliberately separate from Jhadina's reasoning layer: policy evaluation is deterministic and evidence-backed.

## Checks

- jurisdiction matches active policy
- delivery is enabled in the jurisdiction
- merchant license/eligibility
- delivery-zone authorization
- customer eligibility verification
- product eligibility
- courier authorization
- required handoff/delivery evidence policy

The exact legal requirements are supplied by the jurisdiction policy registry; this package does not invent or infer local law.

## Decision model

```text
Inputs + Active Policy
        |
        v
  Deterministic checks
        |
   +----+-----+
   |          |
 denied     allowed
   |
 review when non-critical errors require human/policy handling
```

Every evaluation records evidence and emits a compliance event. A denied result must stop dispatch; a review result should enter the configured manual-review workflow rather than being silently bypassed.
