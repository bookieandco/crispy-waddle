# @jhadina/marketplace-search-core

Location-aware marketplace search, filtering, delivered-price calculation, and ranking.

## Flow

```text
Customer location
      ↓
Jurisdiction + delivery zone
      ↓
Eligible marketplace offers
      ↓
Search/filter
      ↓
Delivered price
(item + tax + merchant fee + delivery fee)
      ↓
Ranking
      ↓
Marketplace results
```

## Safety boundary

Search only exposes offers that match the active jurisdiction policy, delivery zone, and availability requirements. Search does not reserve inventory or create an order.

## Price semantics

`deliveredPrice` is the currently known sum of item price, tax, merchant fee, and delivery fee. It is an estimate until checkout performs final pricing and reservation. The UI should never represent search pricing as a guaranteed checkout total.

## Architecture

The provider is abstracted behind `SearchProvider`, allowing the marketplace catalog to be backed by Postgres, a search index, or another implementation without coupling ranking logic to storage.
