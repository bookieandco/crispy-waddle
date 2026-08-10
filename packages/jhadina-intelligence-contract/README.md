# @jhadina/intelligence-contract

Jhadina Intelligence Contract (JIC) v1.0.

## Boundary

The contract is the interface between an application/platform and Jhadina's intelligence layer.

- The platform is the system of record.
- Jhadina receives read-only events and scoped context packets.
- Jhadina produces evidence-backed observations, forecasts, recommendations, and command proposals.
- Jhadina cannot directly mutate application state.
- Proposed commands must pass the platform's Policy Core and Action Executor.
- Regulatory constraints override optimization.
- Every recommendation carries evidence, rationale, confidence, risk, and approval requirements.

## Flow

```text
Platform Events
      -> Intelligence Gateway
      -> Jhadina Context Builder / Reasoning
      -> Recommendation
      -> Approval (when required)
      -> Policy Core
      -> Action Executor
      -> Platform Event Ledger
```

## Security boundary

Raw identity documents, payment credentials, and other restricted fields are not part of the default context contract. The gateway should expose the minimum data needed for the mission and enforce field-level classification before a packet reaches Jhadina.

## Versioning

The wire contract is identified as `JIC-1.0`. Additive changes should preserve compatibility; breaking changes require a new contract version.
