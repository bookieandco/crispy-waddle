# SOCIAL-PRESENCE.FOLD — Social marketing + durable AEO/AI discovery

Date: 2026-09-29

## Objective

Fold the current marketing discussion into the existing Social/Growth architecture so the same system can market:

- PupsonStuff;
- music and artist releases;
- merchandise;
- Director-made films and product-placement content;
- software/services;
- future commerce offers.

This is not a second marketing authority. Growth remains the strategy/experiment owner, Director remains the media-production owner, Social remains the governed publication/delivery owner, and Action/Security remain the consequential-action boundary.

## New canonical loop

```
SELLABLE OFFER(S)
-> evidence-backed campaign concept
-> cross-offer bridge
-> Content Project / Director production
-> platform-native Social distribution
-> durable Search Everywhere assets
-> machine-readable owned-web discovery
-> observations / attribution / commerce outcomes
-> Growth learning
-> next campaign
```

A campaign may deliberately connect multiple offers. Examples:

- song -> fictional-film short -> shirt/product placement -> stream + merch sale;
- PupsonStuff product -> difficult-photo challenge -> demo clips -> product page;
- music restoration software -> before/after restoration experiment -> artist lead;
- Director capability -> continuity experiment -> long-form breakdown -> software/service demand.

Raw views are not proof. Search/AI mentions are not conversions. Citations, traffic, streams, carts, purchases and signups remain distinct observations.

## Marketing-presence contract

`packages/growth-core/src/intelligence/marketing-presence.ts` adds:

- `SellableOffer` — the actual thing being marketed;
- `PresenceCampaignConcept` — story/challenge/experiment/meme/demo/launch mechanic;
- `CrossOfferBridge` — soundtrack, product placement, bundle, cross-promo, proof or shared story world;
- `DurablePresencePlan` — questions and surfaces that should outlive the social post;
- `PresenceObservation` + learning summary — keeps citations/mentions separate from business conversion.

Authority remains strategy-only. No publication, outreach, ad-spend or purchase authority is introduced.

## AEO / "King of AEO" lessons adopted

Adopt:

- clear entity/offer identity;
- consistent language across surfaces without blind duplicate posting;
- one real idea -> anchor asset -> derivatives;
- question ownership around the buyer problem, not only branded queries;
- experiments/challenges that generate both entertainment and verifiable evidence;
- durable pages/transcripts/FAQs after a social campaign;
- cross-platform reinforcement;
- explicit monitoring of mentions/citations separately from traffic and sales;
- learning which creative/evidence actually produces qualified outcomes.

Reject:

- fabricated endorsements, fake consensus, fake events or fake proof;
- scaled thin pages saying the same thing;
- treating a transient answer-engine mention as durable authority;
- claiming a special file or schema guarantees LLM citation/ranking.

## module-llms-txt reference fold

Reference: `angeo-dev/module-llms-txt` (MIT), supplied 2026-09-29.

Useful implementation patterns adopted conceptually:

- public `/llms.txt`;
- agent-facing `/agents.md`;
- dedicated AI/agent discovery sitemap;
- machine-readable content should point back to canonical live sources;
- product facts such as price/availability must be current, not guessed;
- generated discovery surfaces should be cacheable and validateable;
- markdown/machine-readable mirrors can be added later when stable public product/detail URLs exist;
- discovery files help ingestion but do not guarantee citation.

Not copied:

- Magento-specific PHP implementation;
- Magento Page Builder sanitization;
- Magento inventory/provider internals;
- claims that any specific LLM is obliged to consume these files.

## First owned-web implementation: PupsonStuff

PupsonStuff now gains code for:

- `/llms.txt`;
- `/agents.md`;
- `/sitemap_agentic_discovery.xml`.

The first version intentionally exposes only stable public discovery surfaces. It does not publish admin URLs, private state, or pretend dynamic catalog/product pages exist where the current app does not yet have stable public detail routes.

Next evolution after stable product URLs exist:

1. export current public product facts;
2. add per-product Markdown mirrors;
3. add `rel="alternate" type="text/markdown"` and `rel="describedby"` discovery;
4. add freshness/ETag evidence;
5. bind Search Everywhere observations to actual query/citation monitoring;
6. repeat the owned-web adapter pattern for music, Director and future storefronts.

## Acceptance doctrine

The addition is successful only if it improves the existing loop:

```
attention -> qualified discovery -> owned surface -> stream/lead/cart/sale -> evidence -> learning
```

AEO is a discovery layer inside Social/Growth, not a substitute for product quality, audience fit, creative quality, distribution, or conversion.
