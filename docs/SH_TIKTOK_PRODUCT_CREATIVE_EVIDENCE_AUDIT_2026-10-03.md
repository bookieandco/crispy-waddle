# TikTok Shop product-selection + creative-evidence fold

Date: 2026-10-03

## Source material disposition

Two additional user-supplied TikTok Shop references were reviewed:

1. Product-selection workflow using TikTok Best Sellers, trained FYP observation, and ShopShark-style analytics.
2. Seven-day content experiment comparing faceless product footage, AI slideshow/video, AI influencer, and on-camera content.

The useful contribution is not the earnings claims. The useful contribution is a set of evidence signals that fit the existing canonical Side Hustle / Growth / Commerce architecture.

## Canonical placement

```text
TikTok Shop / licensed provider observations
    -> Growth product intelligence
    -> Opportunity / Make-It-Make-Sense
    -> seller_acquisition OR affiliate_commission lane
    -> Director creative experiment
    -> governed publication
    -> clicks / orders / commissions / reversals / payout
    -> Attribution + Money
    -> outcome learning
```

No reference becomes a second Growth, Director, Social, Commerce, or publishing authority.

## Product-selection signals added

The seller reference contributes:

- platform best-seller presence as a discovery signal;
- review velocity as an observation, not automatic proof of demand quality;
- recurrence across multiple creators;
- weekly GMV growth / momentum;
- creator concentration as a false-positive check;
- creator commission observations;
- live-sales observations;
- economics that differ between inventory-owning sellers and affiliates.

### Creator concentration

A product with high aggregate GMV can still be fragile if one creator accounts for most measured sales.

Growth Core now supports a provider-neutral creator-contribution distribution calculation:
- top creator share;
- HHI concentration;
- diversified / mixed / creator-concentrated / unknown classification;
- configurable thresholds.

This is downstream analysis over preserved source observations. It is not stored as an observed source fact.

## Provider-estimate boundary

Third-party analytics may expose estimated GMV, commission, and other inferred performance values.

The new contracts therefore require metric provenance:
- observed;
- provider_reported;
- provider_estimated;
- user_reported.

An estimated provider value is never silently upgraded to verified TikTok order truth.

## Dual commerce lane

The previous TikTok Shop fold now has an explicit economics boundary:

### seller_acquisition

Used when inventory is owned.

Primary decision inputs:
- landed unit cost;
- price;
- creator commission;
- platform fees;
- return reserve;
- contribution margin;
- bundle / repeat-purchase / downstream LTV evidence.

### affiliate_commission

Used when inventory is not owned.

Primary decision inputs:
- commission rate / commission per order;
- attributed clicks and orders;
- reversal-adjusted commission;
- payout evidence;
- content production cost.

This prevents the seller playbook from incorrectly imposing inventory-margin rules on a faceless affiliate business, and prevents the affiliate playbook from ignoring seller inventory risk.

## Creative experiment learning

The seven-day reference is useful precisely because its result was weak: several pieces of content generated only one reported sale.

Jhadina should not treat:
- views,
- novelty,
- realism,
- "viral-looking" creative,
as economic success.

Growth Core now supports creative commerce observations by format:
- faceless product demo;
- AI slideshow;
- AI video;
- AI influencer;
- on-camera;
- LIVE;
- other.

Derived metrics include:
- product-click rate;
- order conversion rate;
- orders per thousand views;
- commission per thousand views;
- contribution after content cost.

The learning loop should allocate future production using commerce outcomes, not raw views alone.

## Synthetic UGC truth boundary

The AI-influencer reference included a synthetic creator speaking as though she had personally used a product.

That pattern is rejected.

Director UGC now supports explicit `firstPersonExperienceClaimRefs`. If the selected creator is synthetic and such refs are present, generation readiness fails with:

`DIRECTOR_UGC_SYNTHETIC_EXPERIENCE_CLAIM_PROHIBITED`

Synthetic UGC may communicate evidence-backed product facts and clearly framed hypotheses. It may not fabricate real personal use, ownership, lived experience, or achieved results.

The existing Director controls remain:
- Product Bible identity;
- approved claim refs;
- prohibited claim refs;
- claim evidence;
- creator rights;
- synthetic disclosure;
- exact upstream approvals before generation.

## Current TikTok policy notes

Current US TikTok Shop policy should be treated as live configuration/evidence, not permanent constants.

As of this audit:
- eligible US accounts may publish up to 30 shoppable short videos/day;
- Affiliate Creator Pilot accounts may have tighter limits such as 3 shoppable videos/day;
- AIGC must accurately represent the real product;
- materially AI-generated/edited content requires appropriate disclosure;
- AI cannot fabricate or exaggerate product characteristics, results, or identity/endorsement claims.

Account-specific eligibility and health should therefore control publishing capacity.

## Implemented branch

`feat/affiliate-tiktok-product-intelligence-20261003`

Implemented:
- `TikTokShopProductObservation`;
- metric provenance;
- trend classification;
- creator-concentration analysis;
- seller vs affiliate lane classification;
- creative-commerce observations and metrics;
- tests for product evidence and creative economics;
- Director synthetic first-person experience-claim prohibition;
- test covering the synthetic testimonial gate.

## Remaining TikTok sequence

1. TikTok/authorized provider adapter -> `TikTokShopProductObservation`.
2. Account capability + posting quota reader.
3. Product Truth Lock for visual invariants.
4. GMV Max / ad-support evidence separated from assumption.
5. publication + product-link authorization gate.
6. durable order/commission/reversal/payout ingestion.
7. Product Sniper ranking using realized economics.
8. empirical certification over a controlled product cohort.


## Q4 / seasonal campaign fold

A later Q4 reference adds useful strategy mechanics without making its earnings claims canonical:

- treat platform campaign dates as region-specific observations, never hard-coded universal dates;
- pre-produce campaign-relevant creative ahead of the campaign using a configurable preheat window;
- preserve top / middle / bottom funnel intent in the creative brief;
- treat older converting creative as a reusable portfolio asset rather than assuming only new posts matter;
- compare VIDEO and LIVE as separate commerce surfaces;
- measure LIVE using basket clicks, orders, revenue/commission per live hour and watch behavior rather than hours streamed alone.

Growth Core now adds:
- `TikTokShopCapabilityObservation`;
- fail-closed publishing allowance based on the observed account quota;
- `TikTokCampaignWindowObservation` with configurable preheat classification;
- TikTok-specific commerce funnel stage;
- `TikTokGmvMaxEvidenceObservation`;
- `TikTokLiveCommerceObservation` and derived commerce metrics.

This intentionally rejects fixed advice such as "post 20-25 per day." Current account capability evidence controls allowed shoppable volume.

## Agentic short-form generation fold

The later AI-automation reference demonstrates a useful production pattern:

`reference mechanics -> reusable character/style constraints -> product image -> batch generation -> QC -> post-production text/audio -> governed publication`

The canonical implementation is provider-neutral. Claude, Niche, Kling, RunPod, ComfyUI or another provider may satisfy generation work, but none becomes Director authority.

Director now adds `CommercialBatchGenerationPlan`:
- multiple product items per batch;
- Product Truth Lock required per product item;
- reference/rights evidence;
- reusable abstract creative mechanics rather than frame-for-frame copying;
- configurable provider batch capacity;
- explicit estimated credit ceiling;
- silent/generated/post-added audio mode;
- no publication authority.

This means Jhadina can economically batch cheap short-form generation while publication remains a separately governed action.

## Rejected reference tactics

The source references also recommend or discuss behaviors that are not adopted:

- purchasing pre-qualified/regional accounts;
- operating accounts as a way around geographic eligibility;
- bypassing commercial-music restrictions;
- hiding or evading AI disclosure;
- treating third-party GMV estimates as verified payouts;
- assuming visible ad markers prove a seller's total budget;
- cloning another creator's video expression rather than extracting abstract mechanics.

Current TikTok guidance instead requires commercial-content disclosure, recommends Commercial Music Library or separately licensed music for commercial posts, and requires accurate/non-misleading AIGC.

## Updated remaining sequence

1. Authorized TikTok / provider adapter -> product, campaign, account-capability and GMV-Max observations.
2. Bind Product Truth Lock into commercial generation submission/QC.
3. Add provider adapter for batch short-form generation, with RunPod-first/local fallback economics where practical.
4. Add governed post-production for licensed audio + current truthful offer text.
5. Add durable order / commission / reversal / payout ingestion.
6. Add Product Sniper scoring using saturation, momentum, creator concentration and realized contribution.
7. Add campaign portfolio reactivation using actual historic conversion evidence.
8. Certify VIDEO and LIVE loops separately before autonomous scaling.
