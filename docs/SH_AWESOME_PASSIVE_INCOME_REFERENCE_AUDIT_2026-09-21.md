# SH reference audit — awesome-passive-income

Date: 2026-09-21
Reference: yourincomehome/awesome-passive-income
Disposition: REFERENCE_ONLY

## Why it is useful

The repository is a curated 2020 directory rather than an executable provider integration. It is useful as a taxonomy and discovery seed, not as current provider truth. Every named external platform must be independently revalidated before Jhadina marks it adapter-ready or live.

The useful architectural signal is that passive-income opportunities are better modeled by both a vertical/execution owner and a monetization model. Jhadina should not create one execution subsystem per list category.

## Mapping to current Jhadina owners

| Reference category | Existing Jhadina fit | Disposition |
| --- | --- | --- |
| Affiliate marketing | Opportunity -> Growth/Commerce | Existing lane; use reference for feed/provider candidates only |
| Dropshipping | Opportunity -> Commerce | SH-RECON active |
| Print on demand | Opportunity -> PupsonStuff / General AI POD | Existing lane |
| Freelancing | Opportunity -> Placement | Existing lane |
| Social/video | Opportunity -> Growth/DirectorOS | Existing creator lane |
| Development assets | Opportunity -> Commerce digital products/services | Existing lane |
| Finance: stocks/forex/crypto | Money Core | Do not duplicate in Side Hustle execution |
| Real estate | Opportunity Assets | Keep separate from Commerce |
| Blogging/SEO | Opportunity -> Growth/DirectorOS -> Affiliate/ads | Add as creator monetization strategy, not a new core |
| Book publishing | Opportunity -> DirectorOS/Media -> Commerce | Useful missing provider lane; contract-only until current publishing APIs are verified |
| E-learning/courses | Opportunity -> DirectorOS -> Commerce | Useful missing digital-product strategy |
| Newsletter | Opportunity -> Growth/DirectorOS -> Commerce | Useful creator subscription/sponsor strategy |
| Audio/music/beat licensing | Opportunity -> Media/DirectorOS -> Commerce | Useful missing royalty/licensing strategy |
| Stock photo/media | Opportunity -> Media/DirectorOS -> Commerce | Useful missing asset-licensing strategy |
| Podcasting | Opportunity -> Growth/DirectorOS | Useful creator strategy |
| Amazon FBA | Opportunity -> Commerce | Distinct fulfillment strategy from dropshipping because inventory is owned/warehoused |
| Surveys/microtasks | Opportunity -> Placement/Earn | Low-complexity earning lane; should remain evidence- and terms-aware |
| CRM | Shared connector/infrastructure | Not a side hustle |
| Ecommerce storefront platforms | Commerce adapters/channels | Not side hustles themselves |

## Monetization model vocabulary worth adopting later

- affiliate_commission
- fulfillment_margin
- inventory_resale_margin
- print_on_demand_margin
- advertising_revenue
- sponsorship
- subscription
- membership
- royalty
- license_fee
- digital_download_sale
- course_sale
- marketplace_asset_sale
- service_fee
- freelance_fee
- rental_income
- survey_or_microtask_reward

This vocabulary should be metadata/classification, not another authority layer.

## Provider-readiness rule

A provider name discovered in this reference must enter Jhadina as reference_only or contract_only until current evidence proves:
1. the provider still operates;
2. terms permit the intended use;
3. authentication/API or other legitimate integration surface exists;
4. the connector can normalize evidence without granting execution authority;
5. consequential actions still pass Jhadina identity, policy, approval, Action Core, audit, and owning-domain gates.

## Impact on SH-RECON

The reference strengthens the current SH-RECON architecture rather than replacing it:

discovery/reference source
-> Opportunity evidence
-> vertical + monetization classification
-> research/economics/risk
-> owning subsystem
-> policy + approval
-> Action Core
-> provider adapter
-> Money actuals
-> Opportunity outcome learning

For SH-RECON.10 specifically, the dropshipping category adds candidate research sources and reinforces the separation of product-research tools, storefront channels, supplier sources, fulfillment systems, and ad/competitive-intelligence tools. None of those should be conflated into the supplier procurement authority.
