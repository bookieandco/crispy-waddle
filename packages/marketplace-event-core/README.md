# @jhadina/marketplace-event-core

Shared event contract and append-only audit ledger for the regulated marketplace.

## Event envelope

Every event carries an event ID, type/version, timestamp, actor, correlation/causation identifiers, aggregate identity, and—when applicable—the jurisdiction and policy version that governed the decision.

## Audit boundary

`AuditedEventBus` writes the event to the audit ledger before dispatching it to subscribers. The in-memory ledger chains records with SHA-256 hashes per aggregate so tampering or reordering can be detected.

A production implementation should use an append-only durable store, transactional outbox, replay controls, key management, retention policies, and independent audit access controls.

## Jhadina boundary

Jhadina should consume marketplace events through a read-only subscription. It can derive patterns and recommendations from the event stream, but event publication and state-changing commands remain owned by the Commerce OS/action boundary.

## Example flow

```text
Inventory Reserved
       ↓
Checkout Created
       ↓
Payment Captured
       ↓
Order Created
       ↓
Compliance Checked
       ↓
Delivery Allowed
       ↓
Courier Dispatched
       ↓
Custody Transferred
       ↓
Delivery Completed
       ↓
Payout / Reconciliation
```
