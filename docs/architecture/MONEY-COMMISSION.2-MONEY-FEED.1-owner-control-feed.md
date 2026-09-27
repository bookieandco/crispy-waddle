# MONEY-COMMISSION.2 + MONEY-FEED.1 — Owner control center and cross-feed bridge

## Outcome

This phase turns the prior Money commissioning substrate into an owner-configurable control surface and gives Money/Sports a canonical, evidence-backed path into Jhadina Home.

It does **not** commission an external bank, broker, sportsbook, forex venue, DEX signer, or transfer provider.

## Owner Control Center

Route:

`/money/commissioning`

The owner can configure:

- Coffer principal target;
- hard-stop, survival, and defensive floors;
- maximum deployable percentage above the defensive floor;
- realized-profit sweep threshold;
- retained profit;
- planning reserve;
- per-lane budgets for:
  - meme coins;
  - crypto;
  - sports;
  - stocks;
  - forex;
  - prediction markets;
  - metals.

Configuration has:

- `canFund=false`;
- `canTrade=false`.

A newly configured Coffer is created as `RECAPITALIZATION_REQUIRED`. Typed numbers never become evidence that money exists.

If a Coffer already has a real state, configuration preserves that state rather than inventing a funding transition.

### Exposure-preserving edits

Budget edits preserve existing:

- reserved capital;
- spent capital;
- evidence history.

A new allocation or hard cap is rejected if it would fall below already reserved + spent exposure. Editing a policy can therefore never erase historical spend to manufacture new budget capacity.

## Operational visibility

The Money workspace read model now includes:

- Coffer policy and max deployable percentage;
- profit-sweep policy;
- strategy budgets and their states;
- wallet connections;
- bounded signer leases;
- Plaid/provider sync checkpoints and re-auth state;
- stock/forex/DEX connector admission state.

No raw signer tokens, wallet keys, seed phrases, Plaid access tokens, or broker credentials are exposed.

## Money feed contract

`MoneyFeedEvent` is evidence-only and has `canExecute=false`.

Commitment states:

- `WATCHING`
- `SUGGESTED`
- `COMMITTED`
- `CLOSED`
- `ACCOUNTING`
- `RISK`

Only `COMMITTED` and `CLOSED` events may carry `fundedAmountMinor`.

A funded amount is forbidden on watching, suggested, accounting, or risk events in both TypeScript validation and the database constraint.

This prevents a recommendation, risk alert, or accounting proposal from rendering as though real money is committed.

## Home feed

Jhadina Home already supported `Money` and `Sports` filters. MONEY-FEED.1 replaces the Money-side static-only gap with owner-scoped feed reads from:

`GET /api/money/feed`

The feed renders:

- event status;
- lane;
- explicit **Money committed: Yes / No**;
- committed amount only when evidence permits it;
- materiality;
- evidence count;
- deep link back to Money or Sports.

Events below materiality 50 remain out of the main feed to reduce noise.

## Real Money producers

### Funding proposals

Creating an Add Funds / Cash Out / Transfer proposal publishes an `ACCOUNTING` feed event that explicitly states:

> No money has moved yet.

A feed failure cannot roll back or corrupt the financial proposal.

### Broker/provider execution evidence

The durable provider-event processor accepts an optional Money feed sink.

Only after provider execution evidence has entered the canonical reconciliation pipeline can it project to a feed event.

- ACKNOWLEDGED / PARTIALLY_FILLED / FILLED -> `COMMITTED`
- UNKNOWN / REJECTED / CANCELLED -> risk/attention state
- UNKNOWN never asserts a funded position.

The amount shown for acknowledged/fill execution evidence is the permit-bound order notional. The copy explicitly states that final settlement and canonical portfolio state remain separately reconciled.

The certified MONEY-060 live-canary wrapper now accepts this feed sink.

## Sports bridge

### Paper/model recommendation

A `SportsPaperWager` can project to:

- source: Sports;
- commitment: `SUGGESTED`;
- funded amount: none;
- authority: evidence only;
- body explicitly states no money is committed.

The projection carries fair probability, implied probability, and estimated edge in human-readable form.

### Tiny live sportsbook canary

The SPORT-BET live canary accepts the same optional feed sink.

- sportsbook ACKNOWLEDGED -> `COMMITTED` with the real canary stake;
- sportsbook REJECTED -> `RISK`, no funded position assertion;
- sportsbook UNKNOWN -> `RISK`, no funded position assertion and reconciliation warning.

Feed publishing is downstream of sportsbook execution and cannot change execution truth.

Production autonomous sports betting remains disabled by the existing SPORT-BET.FINAL boundary.

## Durable schema

This phase adds:

- `money_coffers.max_deployable_bps`;
- `money_feed_events`.

`money_feed_events` is service-role-only, owner-scoped by `user_id`, materiality-ranked, and carries evidence IDs.

## CI

Money certification now includes the Home feed component and its story types/catalog.

Sports certification workflows now include `sports-feed-projection.ts`, so future Sports feed changes cannot bypass SPORT-BET / SPORT-PRED gates.

## Remaining external commissioning

Still external and fail-closed:

- transfer-capable bank rail;
- verified cash-out destination and standing mandate;
- funded Coffer reconciliation;
- stock provider promotion beyond its certified current state;
- forex execution provider;
- DEX signer/router;
- real sportsbook credentials/jurisdiction/age evidence beyond the certified tiny-canary process.

Those are commissioning facts, not UI flags.
