# Affiliate reference audit — OpenAffiliate / affiliate-skills / Clipcat / software-engineer hub

Date: 2026-10-03

References:
- Affitor/affiliate-skills
- Clipcat-ai/clipcat-skill
- digital-marketing-engineer/software-engineer-affiliate-program-hub
- Affitor/open-affiliate

## Executive disposition

These references strengthen the existing canonical Side Hustle / Commerce affiliate architecture. None should become a second Affiliate Core, a second Growth system, or a second publishing authority.

- **OpenAffiliate — HIGH VALUE program discovery / terms-intelligence provider.**
- **affiliate-skills — HIGH VALUE workflow/taxonomy reference; selectively harvest skill contracts and chain metadata.**
- **Clipcat — HIGH VALUE TikTok Shop intelligence + creative-generation provider candidate; keep publishing and paid generation behind Jhadina approval/governance.**
- **Software Engineer Affiliate Program Hub — RESEARCH SEED ONLY; useful niche/program candidate corpus, but individual program availability and terms require current verification.**

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

## Remaining production gap

OpenAffiliate closes a significant **program-discovery and structured-terms research** gap.

It does **not** close the production requirement for a real affiliate-network/provider connector that ingests provider-native:
- clicks;
- conversions;
- reversals;
- approved commissions;
- payouts.

The next live-commercial milestone remains binding one legitimate affiliate network/account to the existing durable event model and reconciling provider-native truth end to end.

## Recommended next sequence

1. `AFFILIATE-DISCOVERY.1` — expose OpenAffiliate search/get through the server-side Opportunity research runtime.
2. `AFFILIATE-TERMS.1` — official-source terms snapshot + drift/freshness checks.
3. `AFFILIATE-PORTFOLIO.1` — score expected EPC/LTV using observed terms and owned conversion evidence rather than commission percentage alone.
4. `AFFILIATE-CLIPCAT.1` — commission read-only TikTok commerce intelligence and provenance first.
5. `AFFILIATE-CLIPCAT.2` — bind generation through Director/Action Core with exact credit approval.
6. `AFFILIATE-CLIPCAT.3` — bind TikTok publishing only after account authorization and exact post approval.
7. `AFFILIATE-NETWORK-LIVE.1` — bind one real network/account conversion/payout feed.
8. `AFFILIATE-LIVE.FINAL` — prove attributable positive contribution after content/traffic costs, reversals, and payout reconciliation.
