# Jhadina Intelligence & Communications Loop

## Human architecture decision

JH-042, JH-012 and JH-013 are one program with separate governed capabilities, not one package or a new authority layer.

Canonical loop:

```
observe -> evidence -> governed context -> intelligence/strategy -> proposal
        -> policy/approval -> ActionExecutor -> capability -> outcome evidence
        -> activity/context
```

## Component boundaries

### INTCOM.1 — Operating/activity layer
Current main already satisfies this foundation through the reconciled JH-042 slice. JANET, DELIA and MARISA are roles inside the canonical spine, not independently executable agents. The durable Activity surface projects the existing SupabaseAuditLedger; it does not create an agent audit store.

### INTCOM.2 — Passive observation
JH-012 becomes the first observation-provider track. Shodan is an adapter behind a provider-neutral passive-observation contract. Observations are evidence, not conclusions. This track authorizes no active scanning, exploitation, mutation, or autonomous target selection.

### INTCOM.3 — Governed communications
JH-013 becomes a transport-neutral communications capability. Communication intent must pass identity, policy and approval before a transport adapter can send. Transports do not receive policy authority. Reticulum is one future adapter, not the communications architecture itself.

### INTCOM.4 — Evidence/activity fusion
Observation evidence, intelligence proposals, policy decisions, execution receipts and communication delivery receipts project into the existing durable activity/evidence path. No second event/audit authority.

### INTCOM.5 — Reticulum adapter
Implement only after the transport-neutral contracts and recipient/device identity boundaries are stable.

### INTCOM.6 — End-to-end governed loop
A passive observation may inform context and strategy; strategy may propose a communication; only canonical policy/approval and ActionExecutor may authorize the communication; the resulting receipt returns as durable evidence.

## Invariants

- OBSERVATION != CONCLUSION.
- INTELLIGENCE != EXECUTION.
- COMMUNICATION INTENT != SEND AUTHORITY.
- TRANSPORT != POLICY.
- READ != WRITE.
- External providers never receive Jhadina governance authority.
- Activity is a projection of canonical durable evidence, not a second ledger.
- The PersonalCommandFeed remains the canonical home surface.

## Build order

1. Reconcile JH-042 as the already-landed INTCOM.1 foundation.
2. Define provider-neutral passive-observation contracts before implementing Shodan.
3. Add the Shodan read-only adapter behind those contracts.
4. Define communication intent, recipient/device identity and transport contracts.
5. Add durable communication receipts to the canonical evidence/activity path.
6. Add Reticulum as an adapter.
7. Verify the full observe -> reason -> propose -> govern -> communicate -> evidence loop.
