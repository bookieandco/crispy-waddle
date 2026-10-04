# Search Commerce storefront diagnostics and Etsy benchmark fold — 2026-10-03

## Sources folded

This increment incorporates two user-supplied Etsy/POD transcripts:

1. a shop-audit walkthrough of a low-sales, low-listing-count faith/apparel shop; and
2. a creator-reported study of 100 Etsy shops with at least 100,000 lifetime sales.

The sources are treated as research evidence, not platform authority.

## New diagnostic model

The storefront diagnostic separates observable funnel states:

- evidence insufficient;
- no observed discovery/impressions;
- impressions with zero visits;
- visits with zero orders;
- orders observed.

That creates a better repair path than assuming every low-sales shop has the same problem.

### Catalog facts

The diagnostic records:

- total listing count;
- number of observed product types;
- dominant product type;
- dominant product share;
- number of singleton product types.

The first transcript argues for focusing on one product type before broad diversification when a small catalog is spread thin. The system retains that as a **focus-first experiment candidate**, not a universal law.

This intentionally reconciles the apparent tension with the second transcript, where large successful shops commonly sell multiple product types. The architecture therefore models a lifecycle hypothesis:

`early evidence scarcity -> test concentration/focus -> identify winners -> expand only with evidence`

rather than either "always niche to one product" or "always diversify."

## Funnel-specific experiment candidates

- impressions = 0 -> investigate demand, discovery/indexing, niche fit, and catalog coverage;
- impressions > 0 and visits = 0 -> investigate thumbnail/primary image, title, query relevance, and offer presentation;
- visits > 0 and orders = 0 -> investigate product/offer fit, trust, price, shipping, information completeness, personalization, and creative;
- orders > 0 -> segment winners by product, query, creative, offer, and realized contribution before expansion.

These are diagnostic hypotheses, not automatic causal conclusions.

## 100k-seller source benchmark

The reported 100-shop study is retained as a descriptive benchmark snapshot. Examples include:

- 93% reportedly running a sale;
- 91% with professional mockups/product photography;
- 97% offering at least two product types;
- 74% with more than 500 listings;
- 60% with more than 1,000 listings;
- median listing count reported as 1,611;
- 96% using all 13 tags on the studied best-selling listing;
- 66% of studied best-sellers offering personalization/customization;
- 96% with thorough descriptions;
- 98% with organized shop sections;
- 97% with policies filled out.

The complete source-derived metric set is encoded in `ETSY_100K_SELLER_SOURCE_BENCHMARK`.

## Truth boundary

The benchmark is explicitly **descriptive only**.

It must not be used to conclude that:

- 500, 1,000, or 2,000 listings cause success;
- a 25%+ sale causes higher long-run profitability;
- charging shipping is inherently better than free shipping;
- title length or tag count mechanically causes ranking;
- adding product types is always better;
- personalization always improves conversion.

The study selects shops that already succeeded, so survivorship/selection bias is material. Platform-specific rules and thresholds must be checked against current official Etsy evidence before they become policy.

## Deceptive-pricing boundary

The source describes sellers using low-priced variants, blank products, digital-only options, or other low-price variants that can make a listing appear cheaper in search than the product a shopper may expect.

Search Commerce does **not** adopt deceptive bait pricing as a growth tactic. Pricing experiments must preserve clear variant identity, accurate representation, and applicable marketplace/consumer-protection rules.

## Integration

The storefront diagnostic feeds:

`monthly shop audit -> repair queue`

and

`weekly listing inventory / conversion experiments -> Product Sniper evidence -> measured outcome`.

It does not authorize listing edits, promotions, ads, publication, customer messages, fulfillment, or money movement.
