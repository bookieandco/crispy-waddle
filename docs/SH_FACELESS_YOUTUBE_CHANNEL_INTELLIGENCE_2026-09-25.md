# Faceless YouTube / Owned-Media Intelligence Audit — 2026-09-25

## Scope

This pass reconciles the supplied faceless-YouTube creator workflows with the existing Jhadina Side Hustle, Shotlist/Growth, and Director systems.

The supplied sources are treated as workflow evidence, not as platform authority. Creator revenue screenshots, niche claims, RPM claims, account-age claims, and threshold heuristics are not promoted into platform facts without first-party evidence.

## Existing ownership preserved

- Opportunity Core already owns the `owned_media` and `creator_monetization` Side Hustle families and the `audience_monetization` experiment archetype.
- Shotlist Core already owns channels, video plans, visual beats, channel assets, and channel monetization plans.
- Director owns media production/generation.
- Growth owns distribution/measurement/evidence.
- No second Side Hustle engine or second Director production spine is introduced.

## New canonical layer

Added `packages/shotlist-core/src/youtube-channel-intelligence.ts`.

### Niche intelligence

A faceless/owned-media niche is evaluated on:

- repeatability: can the concept plausibly support ~100 videos;
- observed demand: comparable videos/channels with measurable views, VPH or outlier evidence;
- new-channel proof: evidence that relatively new/small channels can still earn disproportionate attention;
- monetization clarity: explicit ads/affiliate/sponsor/product/service/membership/licensing rails;
- originality safety: original > transformative > reused-heavy;
- automation fit.

High views alone do not erase reused-content/originality risk.

### Topic intelligence

The creator-supplied outlier/VPH thresholds are encoded only as `SOURCE_HEURISTIC` defaults:

- outlier >= 20;
- strong outlier >= 50;
- recent-window VPH >= 100;
- evergreen-window VPH >= 20.

They are not YouTube platform rules and are expected to be replaced by first-party channel baselines as data accumulates.

### Performance diagnosis

Video diagnosis uses the channel's own baseline for:

- CTR / packaging;
- average percent viewed / retention;
- subscribers per 1,000 views / audience conversion.

This avoids hard-coding universal CTR or retention targets.

### Production archetypes

Recipes now distinguish:

- storytelling/documentary;
- ranking/product-review;
- screen-recording/tutorial;
- AI music;
- compilation;
- generic/other.

The AI-music recipe explicitly supports:

- themed track sets with commercial-rights provenance;
- static or seamless first-frame=last-frame visual loops;
- optional multi-loop rotation;
- track overlaps/crossfades;
- long-form assembly;
- loop/crossfade QC.

Compilation is intentionally marked high reused-content risk and requires rights/originality review.

## Monetization rails

The existing channel model now includes `membership` and `licensing` in addition to ads, affiliate, sponsor, product and service.

Opportunity Core remains the business-model authority. These channel rails are execution-level metadata and map upward to existing Side Hustle monetization models such as advertising revenue, affiliate commission, membership and license fee.

## Claims deliberately not canonicalized

### Aged-account advantage

One source asserts that older YouTube accounts receive more trust/impressions. The supplied material does not establish causality or a platform rule. No account-age optimization, account purchasing, or trust boost is encoded.

### Revenue / RPM guarantees

Creator revenue examples and claims that particular audience demographics or geographies necessarily create a given RPM are retained as research hypotheses only. Channel-owned revenue analytics must become the authority.

### "Best" niche claims

Claims that history or AI music are categorically the best/fastest niches are not encoded. The system compares observed evidence per niche/sub-niche instead.

### AI disclosure / monetization policy

The sources make current-policy claims about altered/synthetic content and AI monetization. Those are not frozen into this module; any publish-time compliance decision must use current platform policy evidence.

## Source-derived workflow principles retained

- niche before channel branding;
- topic choice before expensive production;
- outline-first / section-by-section long-form scripting;
- narration-first assembly for documentaries;
- asset collection mapped to script beats;
- separate packaging (title/thumbnail) from content production;
- diagnose low CTR as a packaging signal and low watch/AVD as a retention/script signal, relative to first-party baselines;
- preserve commercial-rights and provenance for audio/visual assets;
- prioritize original/transformative value over clip aggregation.

## Certification scope

This branch adds contracts/tests only. It does not claim a live YouTube analytics connector, VidIQ connector, automated publishing permission, or current YouTube policy certification.

The next runtime step after merge is to feed real YouTube/channel analytics into these contracts and emit existing Growth/Opportunity evidence receipts.
