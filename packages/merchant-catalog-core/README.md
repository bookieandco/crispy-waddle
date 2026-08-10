# @jhadina/merchant-catalog-core

Provider-neutral catalog normalization and marketplace synchronization for merchant locations.

## Boundary

The merchant remains the source of truth for its catalog and inventory. The marketplace maintains a normalized offer projection for search, comparison, checkout, and delivery discovery.

```text
Merchant POS / Catalog
        |
   CatalogAdapter
        |
        v
  CatalogNormalizer
        |
        +---- policy checks
        |
        v
 Marketplace Offer Projection
        |
        +---- search / price comparison
        +---- checkout
        +---- delivery-zone filtering
```

## Important distinction

Catalog synchronization does not grant the marketplace ownership of merchant inventory. Live reservation and inventory authority remain behind the InventoryAdapter contract. This layer only projects catalog/offer state.

## Multi-location marketplace

Each offer is scoped to a merchant location. That lets the marketplace compare equivalent products across multiple nearby dispensaries without collapsing their source identities.

## Compliance

A jurisdiction policy version is attached to each projected offer. Products that fail the active category or product-eligibility checks are hidden rather than silently offered for purchase.

## Idempotency

Sync requests carry an idempotency key and provider cursors. Production adapters should also persist source watermarks and reconcile deletions/hidden products so a stale source item cannot remain publicly searchable indefinitely.
