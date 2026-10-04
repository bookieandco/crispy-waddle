# Search Commerce operating cadence — 2026-10-03

## Purpose

Fold the user-supplied Etsy operating-habits transcript into the existing Search Commerce / Side Hustle architecture without treating creator claims about Etsy ranking behavior as platform truth.

This contract is intentionally reusable across:

- POD / Personalized Commerce;
- Commerce & Affiliate;
- Digital Products;
- Owned Media.

## Canonical cadence

### Daily

1. **Shop health** — inspect messages, orders, provider alerts, and listing-health exceptions.
2. **Customer service** — prioritize unresolved buyer issues and route responses through the owning customer-service boundary.
3. **Order operations** — reconcile new/in-flight orders, fulfillment, shipping risk, and provider exceptions.

### Weekly

1. **Listing inventory** — use demand evidence and seasonal runway to identify coverage gaps; listing count itself is not a success metric.
2. **Conversion experiments** — test one attributable variable at a time where practical, including thumbnail, title, offer, creative, or promotion.
3. **Market research** — refresh search demand, competitor, trend, seasonality, pricing, and buyer-intent evidence for Product Sniper.

### Monthly

1. **Shop audit** — inspect branding, listings, creative, pricing, policies, performance, and stale content from the buyer perspective.
2. **Operating plan** — turn demand windows, capacity, experiments, and seasonality into launch/listing/creative deadlines and publish-by targets.
3. **Financial review** — use realized economics: revenue minus product/provider costs, shipping, fees, refunds/reversals, and paid acquisition costs.

## Truth boundary

The transcript states or implies that daily shop activity, fresh listings, and frequent edits can improve Etsy search visibility. These are retained as source claims only.

They must not become ranking weights, automation triggers, or production claims until supported by either:

1. current official Etsy documentation applicable to the exact behavior; or
2. measured local experiments with preserved impressions, clicks, visits, conversion, and contribution evidence.

The cadence remains useful even if those algorithm claims prove false: customer service, order reconciliation, research, controlled experiments, audits, planning, and unit-economics review are operationally valuable on their own.

## Authority boundary

The operating cadence is planning/analytics only. It does not authorize:

- publishing;
- listing creation or edits on an external marketplace;
- customer messaging;
- promotions or ad spend;
- purchases;
- refunds;
- fulfillment actions;
- money movement.

Those actions remain with their owning governed provider boundaries and approval policies.

## Integration

The expected loop is:

`search/market evidence -> Product Sniper -> demand window -> product/listing/creative hypothesis -> bounded experiment -> traffic/conversion/order evidence -> realized economics -> weekly/monthly learning -> Product Sniper`.

This cadence complements, rather than replaces, the existing affiliate payout truth, affiliate compliance, POD fulfillment, Growth attribution, Director creative, and Side Hustle outcome-learning systems.
