# Search Commerce -> Side Hustle Business Pipeline integration — 2026-10-03

## Decision

Search Commerce is not a standalone task manager or parallel business operating system.

Canonical ownership remains:

`Opportunity Core -> Side Hustle Business Factory -> Venture/Agent work ledger -> owning execution domain -> governed action -> realized outcome -> learning`.

Search Commerce contributes evidence, diagnostics, recurring operating routines, and due work to that pipeline.

## Flow

`market/shop evidence`
-> `Search Commerce storefront diagnostic`
-> `daily / weekly / monthly due-task queue`
-> `Business Factory VentureWorkItem`
-> `Marisa operations queue / Venture HQ`
-> `owning domain proposal`
-> `Action/Safeguard approval when consequential`
-> `execution receipt`
-> `orders / conversions / payouts / realized contribution`
-> `Side Hustle outcome learning / Product Sniper`.

## Work projection

Each due Search Commerce routine becomes one idempotent Business Factory work item for the associated venture.

Ready work:
- status = `queued`

Missing-evidence work:
- status = `blocked`

All generated work:
- agent = `marisa:operations`
- spend = `0` at planning time
- authorizationEffect = `NONE`

The stable identity includes venture + routine + business date, so regenerating the same day's queue updates the same work item rather than multiplying duplicate tasks.

## Existing pipeline reuse

Work is persisted into the existing `jhadina_venture_work_items` ledger.

That means it is automatically visible to existing:
- Side Hustle Lab portfolio projections;
- Marisa operations projection;
- Venture supervisor;
- Venture HQ work ledger;
- queue-pressure/staleness supervision.

No new task database or duplicate business authority is introduced.

## Business Factory UI

The Side Hustle family API now returns a `businessPipeline` projection containing:
- ventures in the selected family;
- durable work items for those ventures;
- the invariant `externalActionAuthorized=false`.

The family page exposes those work items under **Business pipeline / Agent work**.

Relationship lanes remain Relationship Core projections and are not overloaded with shop-maintenance tasks.

## Authority boundary

A queued Business Factory item means the work is ready to be coordinated.

It does not itself authorize:
- Etsy/Pinterest marketplace edits;
- publishing;
- customer messaging;
- promotion/ad spend;
- supplier orders or fulfillment;
- refunds;
- payments or money movement.

Consequential execution remains downstream with the owning provider/domain and Action/Safeguard policy.
