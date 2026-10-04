# Affiliate reference audit — OpenAffiliate / affiliate-skills / Clipcat / software-engineer hub

Date: 2026-10-03

References:
- Affitor/affiliate-skills
- Clipcat-ai/clipcat-skill
- digital-marketing-engineer/software-engineer-affiliate-program-hub
- Affitor/open-affiliate
- api-evangelist/partnerize
- api-evangelist/cj-affiliate
- ZAK123DSFDF/refearnapp

## Executive disposition

These references strengthen the existing canonical Side Hustle / Commerce affiliate architecture. None should become a second Affiliate Core, a second Growth system, or a second publishing authority.

- **OpenAffiliate — HIGH VALUE program discovery / terms-intelligence provider.**
- **affiliate-skills — HIGH VALUE workflow/taxonomy reference; selectively harvest skill contracts and chain metadata.**
- **Clipcat — HIGH VALUE TikTok Shop intelligence + creative-generation provider candidate; keep publishing and paid generation behind Jhadina approval/governance.**
- **Software Engineer Affiliate Program Hub — RESEARCH SEED ONLY; useful niche/program candidate corpus, but individual program availability and terms require current verification.**
- **Partnerize — HIGH VALUE read-only network truth provider candidate; partner reporting exposes click/conversion and payment-status evidence behind account credentials.**
- **CJ Affiliate — HIGH VALUE read-only network truth provider candidate; current GraphQL surfaces expose publisher commission records and watermark pagination behind a PAT/account binding.**
- **RefEarnApp — HIGH VALUE owned-program architecture reference only; AGPL-3.0 means Jhadina should not copy/vendor its implementation into the proprietary runtime.**

Canonical authority remains:

`Opportunity Core -> Side Hustle Business Factory -> Growth/Commerce -> governed publishing/action -> attribution -> realized outcome learning`.

## 1. OpenAffiliate

OpenAffiliate is an open, machine-readable affiliate-program registry with:
- program identity and category;
- commission type/rate/mode/value;
- cookie/attribution fields;
- payout terms;
- approval mode;
- restrictions;
- network identity;
- signup URL;
- agent recommendation metadata;
- verification/freshness fields;
- public CLI, SDK, REST API, and MCP surfaces.

### Important verification boundary

OpenAffiliate's public verifier crawls program/signup pages and scores affiliate/referral signals, signup-form indicators, closure indicators, and related keywords.

Therefore:

`verified=true` is useful evidence that the affiliate-program surface appears to exist.

It is **not sufficient proof** that every economic or policy field is currently exact.

Jhadina must not translate OpenAffiliate verification into:
- guaranteed commission rate;
- guaranteed cookie duration;
- guaranteed payout timing;
- guaranteed acceptance;
- guaranteed channel permissions;
- guaranteed program continuity.

Terms that can affect publishing, economics, or compliance still require official merchant/network source verification and a freshness timestamp.

### Implemented fold

`@jhadina/commerce-adapters` now gains:
- `AffiliateProgramObservation`;
- `AffiliateProgramDiscoveryAdapter`;
- validation preserving evidence/freshness;
- `OpenAffiliateProgramDiscoveryAdapter`;
- normalization that labels OpenAffiliate verification scope explicitly as `affiliate_program_page_signal`.

This is research/discovery only. It does not create referral links, enroll accounts, publish affiliate content, move money, or ingest provider-native conversions/payouts.

## 2. affiliate-skills

The repository defines a broad affiliate flywheel across:
- program/niche research;
- trend/competitor scouting;
- content research;
- social/blog/script production;
- landing pages;
- email/distribution;
- conversion tracking and testing;
- automation;
- compliance;
- retrospectives/self-improvement.

Useful concepts to fold:
- typed skill inputs/outputs;
- `chain_metadata` / suggested-next semantics;
- explicit research-before-content behavior;
- closed-loop analytics feeding research;
- compliance as a cross-cutting gate;
- separation of program search, content intelligence, creation, distribution, and measurement.

Do not import the skill pack wholesale as canonical authority. Jhadina already has Opportunity, Growth, Director, Social, Commerce, SEO/AEO, CRM, Action Core, and outcome learning. The useful work is to map skill semantics to those owning systems.

Claims of "live" social/traffic data depend on companion providers. A Markdown skill alone is not evidence that a measurement occurred.

Recommended mapping:
- affiliate-program-search -> OpenAffiliate adapter + official-source Terms Watch;
- trending-content-scout / competitor-spy -> Growth/Social intelligence;
- content skills -> Director/Growth;
- landing/deployment -> Builder/owned web;
- conversion tracker -> Growth attribution + Commerce affiliate events;
- compliance checker -> Social/Commerce policy gates;
- self-improver -> Opportunity outcome learning.

## 3. Clipcat

Clipcat exposes a CLI/skill for:
- TikTok Shop product/shop/creator/video/live intelligence;
- video and review/comment analysis;
- high-GMV selling-video/prompt discovery;
- product-to-video generation;
- reusable characters;
- image generation;
- TikTok publishing;
- video download.

High-value placement:

`TikTok commerce observations -> Product Radar / Opportunity evidence -> Director creative brief -> governed generation -> Social approval/publish -> Growth attribution -> Affiliate/Commerce outcome`.

### Strong safety/operational patterns worth preserving

Clipcat itself uses two-step confirmation before paid generation and before publishing. Jhadina should preserve or strengthen that behavior through Action Core rather than bypass it.

Its skill also says product-specific claims from a reference video must not automatically transfer to the user's product. Keep that rule.

### Originality boundary

Clipcat's "replicate" feature can preserve motion/cuts/script structures from an existing video. Jhadina should use references for abstract creative mechanics, not default to near-copying another creator's protected expression.

Preferred transformation:
- hook class;
- pacing;
- camera language;
- shot count;
- product-demonstration pattern;
- CTA structure;
- objection handling.

Then Director produces a materially original execution with rights/provenance evidence.

### Provider status

Clipcat is a provider candidate, not a canonical Social or Director replacement. Live adoption still needs:
- API credential commissioning;
- provider terms review;
- data provenance validation for claimed GMV/sales metrics;
- cost/credit observation;
- generated-asset rights/provenance;
- approval-bound publish integration;
- one controlled commercial evidence cycle.

## 4. Software Engineer Affiliate Program Hub

This is a large curated niche list plus guides for software-engineer-oriented affiliate programs.

Useful:
- developer/engineering niche taxonomy;
- candidate merchant names;
- category ideas;
- audience/product fit hypotheses;
- content-topic seeds.

Do not treat it as a current terms registry. The README itself includes examples where affiliate availability is unclear or links have changed.

Correct flow:

`hub candidate -> OpenAffiliate/official search -> current program verification -> terms snapshot -> opportunity scoring`.

No program should be admitted solely because it appears in this repository.

## Canonical affiliate topology after this fold

```text
candidate niches / static reference corpora
        |
        v
OpenAffiliate program discovery
        |
        v
official merchant/network terms verification
        |
        v
Opportunity evidence + Make-It-Make-Sense
        |
        +--> Search Commerce
        +--> Social Commerce / Clipcat intelligence
        +--> Recurring SaaS Commerce
        |
        v
Director / Growth / owned web
        |
        v
approval-bound disclosure + publication
        |
        v
click -> conversion -> reversal -> payout
        |
        v
Commerce durable affiliate events
        |
        v
contribution / portfolio / outcome learning
```

## 5. Partnerize / CJ Affiliate / RefEarnApp

### Partnerize

The API Evangelist repository is an independent documentation profile, not a Partnerize SDK. It confirms a public Partner API surface for reporting, campaign/terms, commission and payment-related resources.

Implemented fold:
- server-side HTTP Basic credential binding;
- read-only partner click reporting;
- read-only partner conversion reporting;
- offset/limit pagination using total-result count;
- provider status -> canonical economic-state normalization;
- no inference that an approved conversion is cash paid.

Live commissioning requires:
- `PARTNERIZE_APPLICATION_KEY`;
- `PARTNERIZE_USER_API_KEY`;
- `PARTNERIZE_PUBLISHER_ID`.

### CJ Affiliate

The API Evangelist repository is likewise an independent API profile, not a CJ SDK. Its captured GraphQL schema documents the current Commission Detail model and `maxCommissionId` watermark pattern.

Implemented fold:
- server-side Bearer PAT binding;
- read-only publisher commission ingestion;
- watermark pagination;
- original/corrected commission lineage;
- negative/declined corrections normalized as reversals;
- `NEW/EXTENDED` treated as pending and `LOCKED/CLOSED` as approved, never automatically as paid.

Live commissioning requires:
- `CJ_PERSONAL_ACCESS_TOKEN`;
- `CJ_PUBLISHER_ID`.

### RefEarnApp

RefEarnApp demonstrates useful owned-program mechanics:
- referral link/cookie capture;
- signup attribution;
- affiliate portal;
- commission engine;
- payout administration;
- edge tracking.

Its source is AGPL-3.0. Jhadina may learn architectural patterns from it, but this branch does not copy or vendor RefEarnApp code. If Jhadina later launches affiliate programs for its own products, build that capability as an original implementation or run a separately compliant AGPL deployment.

## Remaining production gap

The code gap for external network ingestion is now materially smaller: Partnerize and CJ have provider-neutral read-only adapters, server-side credential bindings, durable canonical affiliate-event ingestion, economic-state preservation, and multi-page sync.

What remains is **commissioning evidence**, not pretending the adapters are live:
- configure one legitimate Partnerize or CJ account;
- run a controlled read-only sync;
- verify clicks/conversions/corrections against the provider dashboard;
- add explicit payout truth from a provider endpoint that actually proves payment;
- reconcile commissions to realized cash;
- prove positive contribution after content/traffic costs and reversals.

Until that evidence exists, provider status is `adapter_ready`, not `live_proven`.

## Recommended next sequence

1. `AFFILIATE-DISCOVERY.1` — expose OpenAffiliate search/get through the server-side Opportunity research runtime.
2. `AFFILIATE-TERMS.1` — official-source terms snapshot + drift/freshness checks.
3. `AFFILIATE-PORTFOLIO.1` — score expected EPC/LTV using observed terms and owned conversion evidence rather than commission percentage alone.
4. `AFFILIATE-CLIPCAT.1` — commission read-only TikTok commerce intelligence and provenance first.
5. `AFFILIATE-CLIPCAT.2` — bind generation through Director/Action Core with exact credit approval.
6. `AFFILIATE-CLIPCAT.3` — bind TikTok publishing only after account authorization and exact post approval.
7. `AFFILIATE-NETWORK-LIVE.1` — configure Partnerize or CJ credentials and run one controlled provider sync.
8. `AFFILIATE-NETWORK-LIVE.2` — reconcile provider dashboard totals, corrections and payout evidence against durable Jhadina events.
9. `AFFILIATE-OWNED-PROGRAM.1` — if useful, build an original RefEarn-inspired owned referral-program runtime without copying AGPL implementation.
10. `AFFILIATE-LIVE.FINAL` — prove attributable positive contribution after content/traffic costs, reversals, and payout reconciliation.
