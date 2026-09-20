# Jhadina Universal Approval Lifecycle Audit

## Goal
Give Approval Center one truthful lifecycle without creating a second source of authority.

Canonical UX target:

`requested -> approved -> executing -> verifying -> completed`

Exceptional:

`denied | failed | recovery_required -> reconciled -> recovered`

## Existing evidence sources

### Durable ActionAudit ledger
The shared `SupabaseAuditLedger` is already domain-scoped and actor-scoped. Current durable domains exposed by the system activity projection are intelligence, growth, commerce, and money.

It reliably supplies action identity, actor, capability/type, audit status, timestamp, and metadata.

Current status vocabulary is narrower than the target UX: `started | approval_required | completed | denied | failed`.

### Commerce approval receipts and proposals
Commerce has durable approval receipts and durable proposals. Proposal state currently includes `pending | approved | executed`, with receipt linkage. Approval receipts are single-use and consumed before execution.

This is real lifecycle evidence, but it is Commerce-specific and must not be presented as universal until a shared read projection exists.

### Connector execution + reconciliation ledger
The connector execution ledger carries execution/proposal/approval correlation fields including execution ID, approval ID, proposal ID/hash, idempotency key, connector, operation, actor/correlation IDs, state, and timestamps.

The reconciliation ledger records provider observations/evidence. This is the correct evidence family for ambiguous outcomes and recovery.

## Findings

1. There is no single universal approval-request/grant read model yet.
2. ActionAudit can truthfully render requested/started/completed/denied/failed, but cannot by itself prove every richer transition.
3. Commerce proves that proposal -> receipt -> execution linkage exists in at least one production domain, but its storage contract is not universal.
4. Connector execution/reconciliation evidence is richer than the current UI projection and should eventually drive recovery states.
5. A generic Approve button must not be added until a universal mutation boundary can verify the exact immutable proposal/actor/session/capability/target/parameters/risk/policy/correlation/expiry contract and consume a single-use grant.
6. The UI must never synthesize `approved`, `verifying`, `reconciled`, or `recovered` merely from elapsed time or neighboring events.

## Projection rule

The universal Approval Center should be an evidence join, not a new state store:

- ActionAudit: universal baseline and actor/domain timeline.
- Domain proposal/receipt stores: exact approval evidence where supported.
- Connector execution ledger: execution state and ambiguity.
- Reconciliation ledger: provider evidence and recovery outcome.

Every projected transition must carry its evidence source. Unknown remains unknown.

## AUDIT/REPAIR queue

- APPROVAL-02A: define a typed `ApprovalLifecycleProjection` contract with evidence provenance.
- APPROVAL-02B: add read-only server composition joining currently available durable evidence.
- APPROVAL-02C: expose that projection behind verified identity.
- APPROVAL-02D: migrate Approval Center from raw ActionAudit grouping to the projection.
- APPROVAL-02E: add connector recovery/reconciliation states only after actor-safe read access is verified.
- APPROVAL-02F: design universal approval mutation boundary; do not reuse subsystem-specific mutation endpoints as a generic facade.
- AUDIT/REPAIR: verify connector recovery lineage before exposing recovery retry controls. Provider execution must not occur before parent-lineage verification.
- AUDIT/REPAIR: Opportunity, Campaign, Social, Coding/Evolution and other domains need canonical durable proposal/approval evidence before joining this projection.

## Security invariant

Approval UI is not authority. It may request a decision, but the server must bind and verify the exact authorized proposal and consume approval once. UI state must never widen capability, alter parameters after authorization, bypass policy/Gateway, or call service-role recovery RPCs directly.
