# SOCIAL-MKT.FINAL — Social Media Marketing Beast Audit and Automation Handoff

Date: 2026-09-22
Branch: `feat/social-marketing-beast-automation`
Base: `main@3205174dc6c34a1728d9363a53d20b4ca1885797`

## Executive conclusion

Jhadina Social is no longer a direct-posting helper. The canonical architecture is:

```
Evidence / audience / community / search / commerce
-> Growth intelligence
-> Big Idea / offer / creative family
-> Content Project
-> platform-native variants
-> exact Social publication proposal
-> Security Core / Action Core approval
-> durable outbox
-> provider transport
-> provider receipt / reconciliation
-> Social observations
-> Growth attribution / creative learning
-> Money economics
```

The system must optimize qualified business outcomes, not raw posting volume or vanity engagement.

Automated posting is admitted only after the exact content, media, destination account, and schedule are bound to an approval receipt. AI may discover, research, draft, repurpose, schedule, analyze, and propose continuously. It may not silently mint publication authority for newly generated content.

## Reconciled production lineage

### SOCIAL.1-SOCIAL.10 — merged
PR #494 established:
- authenticated server identity;
- durable user/brand/provider/profile account bindings;
- exact publication targets;
- `public.publish` approval receipts;
- durable per-target outbox;
- idempotency;
- ambiguous-result reconciliation;
- Social observation plane;
- creative-learning projection;
- unified Social Hub;
- scoped Social CI.

The old client self-approval/direct-Hootsuite pattern is obsolete.

### GROWTH-PROD — merged
PR #504 established:
- customer/event graph;
- audience registry;
- purchase-intent/lookalike intelligence with sensitive-targeting rejection;
- paid-media control plane;
- Meta/Google/TikTok/LinkedIn/Reddit/etc. channel contract;
- contribution economics;
- approval-bound paid campaign creation;
- Markifact provider boundary;
- durable attribution observations.

### Creator outreach — merged
PR #511 established:
- creator evidence and fit;
- brand/channel voice profiles;
- exact outreach-touch fingerprint;
- stop/suppression state;
- `consequential.outreach` approval;
- durable message outbox;
- ambiguous-send reconciliation.

Provider execution remains fail-closed until an authorized messaging provider is bound.

### Cross-surface creative intelligence — open dependency
PR #589 contains the latest Growth-side intelligence from the recent transcript batch:
- evidence-ranked Big Ideas;
- competitor/viral observations as hypotheses;
- Meta/TikTok diagnostics;
- Reddit community/keyword intent;
- AI product-video formula factory;
- Search Everywhere;
- human/brand POV requirement;
- storytelling assessment;
- social-commerce opportunity states.

This Social automation branch is intentionally orthogonal to #589 and should be mergeable independently. The combined target is #589 intelligence + this branch execution/automation.

## Transcript synthesis

### Meta
Canonical:
- simpler/broad structures as experiments;
- creative supplies relevance signals but does not literally replace targeting;
- Big Idea extraction and creative genealogy;
- native/casual creative as a testable format;
- Pixel + CAPI + first-party reconciliation;
- prospecting vs retargeting experiments;
- value steering only from real LTV/margin evidence;
- funnel diagnostics;
- contribution ROAS/CAC/MER/LTV over vanity metrics.

Rejected as hard rules:
- fixed CTR/hold-rate/CPA thresholds;
- universal campaign duplication/scaling rules;
- unverified claims about platform favoritism.

### TikTok paid
Canonical:
- Campaign -> Ad Group -> Ad compiler;
- Smart+ as a strategy experiment;
- Pixel + Events API + dedup;
- native creative diagnostics;
- Spark/organic-to-paid authorization;
- Shop/catalog integration;
- contribution-based scaling governor.

Rejected:
- fixed 70%/33%/1%/2% thresholds;
- unauthorized reuse of other creators' videos;
- fake purchases counted as production outcomes;
- fixed duplication/doubling schedules.

### TikTok Shop / creator commerce
Canonical:
- shop catalog truth;
- product-demand observations;
- organic shoppable content;
- creator affiliate fit;
- samples as a governed product-evaluation funnel;
- product-question -> educational answer -> demo -> purchase path;
- creative concept refinement;
- product adjacency/bundle ladder;
- creator economics;
- brand relationship state;
- GMV Max measurement separated from independently reconciled incrementality.

Critical measurement rule:
TikTok provider-attributed GMV must not automatically be treated as incremental paid revenue where provider attribution can include organic/affiliate orders.

### Reddit paid
Canonical:
- community + keyword/context intent;
- conversational native creative;
- Reddit campaign compiler;
- Pixel/CAPI signal adapter;
- Reddit Max as experiment;
- digital-product funnels;
- promotion offers represented as time-bound provider metadata, not permanent platform rules.

### Community-led growth
Canonical:
- community graph;
- community rules/norm profile;
- pain/language mining;
- keyword alerts;
- useful value artifacts;
- comment-first validation;
- moderator/permission evidence;
- community -> product feedback;
- attribution to activation/revenue.

No mass unsolicited automated commenting.

### Influence / authority / human-origin content
Canonical:
- audience-fit over raw views;
- verifiable proof and demonstrated usefulness;
- useful watch depth/repeat consumption;
- Short -> Long -> Live format journeys measured empirically;
- authority position -> 3-5 pillars -> Big Ideas -> anchor assets -> derivatives;
- AI scales a real POV; it does not fabricate identity;
- one underlying idea is the unit, not one post;
- market-size-normalized performance;
- search/AI visibility as observation, not a guaranteed ranking formula.

### LinkedIn
Canonical:
- professional ICP compiler;
- current Campaign -> Ad Set -> Ad model;
- title/function/seniority/company audience hypotheses;
- Lead Gen Forms;
- Insight Tag/CAPI;
- thought-leader amplification;
- engagement retargeting;
- lead magnet -> qualification -> meeting -> opportunity -> customer;
- qualified-pipeline economics, not CPL;
- placement/expansion/predictive audiences as experiments.

Rejected as hard rules:
- always disable Audience Network;
- always disable expansion;
- always use single-image;
- never use blue;
- fixed 50k-500k audience size;
- fixed pain-vs-desire rules.

### Etsy / marketplace
Canonical:
- listing truth/SEO/creative quality;
- Etsy Marketplace Insights;
- Etsy Ads auction/reporting;
- search-term intelligence;
- Offsite Ads separated from CPC Etsy Ads;
- clicked listing vs purchased listing;
- SKU contribution economics;
- TACoS as shop-management ratio, not causal proof of organic lift;
- official Etsy API/Insights first.

Scraper repositories remain research references unless platform authorization permits their use.

## GitHub reference disposition

### High-value / implementation patterns
- `ayrshare/social-media-api` — MIT package; multi-platform provider candidate.
- `ZJU-REAL/Easel` — Apache-2.0; Discover -> Plan -> Create -> Publish -> Attribute architecture and persistent account/content projects.
- `thegauravmahto/recast` — creative-pattern extraction/reference; direct reuse requires final license verification because the connector found MIT labeling in README but no separate LICENSE file.
- `moiz-za/etsy-seller-seo-system` — Etsy SEO workflow reference.
- `abutun/etsy-seo-optimizer` — Etsy API/OAuth/preview-before-write reference.
- `devonjhills/etsy-digital-mockup-tools` — POD/listing creative pipeline reference.

### Architecture reference only
- `brightbeanxyz/brightbean-studio` — excellent multi-workspace/approval/inbox/analytics patterns, but AGPL-3.0; do not copy code into the monorepo without intentionally accepting AGPL obligations.
- `adjagbafortune/rapport-interpretation-kpi-oif` — KPI presentation/report ideas only.

### Blocked from production execution
- `EseToni/open-linkedin-api` — unofficial LinkedIn interface; repository itself warns use may violate LinkedIn Terms.
- Etsy screen-scraper repos — not a canonical production connector.
- anti-detection/human-mimic outreach automation;
- unauthorized copyrighted creative reuse;
- unverified scraped contact databases.

## New implementation in this branch

### Multi-provider Social transport
Added provider capability registry and Ayrshare provider adapter.

Canonical provider path:
```
Social proposal
-> approval receipt
-> outbox
-> SocialProvider factory
   -> Hootsuite
   -> Ayrshare
-> receipt
-> reconciliation
```

Ayrshare binding secrets remain server-side. Database/provider IDs are aliases, not Profile-Key secrets.

Required server configuration for Ayrshare:
- `AYRSHARE_API_KEY`
- `AYRSHARE_OWNER_USER_ID`
- `AYRSHARE_PROFILE_BINDINGS_JSON`

Example shape:
```json
[
  {
    "id": "linkedin-main",
    "profileKey": "<server secret>",
    "platform": "linkedin",
    "name": "Main LinkedIn",
    "handle": "optional-handle"
  }
]
```

### Automated posting
The Social console now supports a future `scheduledAt`.

Flow:
```
draft
-> exact account selection
-> optional future time
-> approval request
-> approve once
-> provider receives immutable scheduled post
-> provider publishes automatically at approved time
```

No second manual publish click is required at the scheduled time.

The new automation manifest contract accepts only:
- approved/queued proposals;
- an approval receipt;
- an immutable request fingerprint;
- one exact target;
- a future schedule.

It rejects dynamic/unapproved content.

### Content Project / repurposing lineage
Added a first-class Content Project contract:
- authority-position reference;
- content pillar;
- Big Idea;
- content job;
- human/research/evidence origin;
- anchor asset;
- derivative asset lineage;
- evidence references.

This is the bridge needed for the transcript-driven:
```
one real idea
-> anchor video/live/article
-> Shorts/Reels/TikTok
-> text
-> thread
-> newsletter
-> ad creative
-> performance learning
```

## Production target

The Social marketing system should converge on:

```
LISTEN
community / comments / search / trends / reviews / creator evidence
  ->
UNDERSTAND
audience, problem, language, offer, economics
  ->
IDEATE
authority position / pillar / Big Idea
  ->
CREATE
human-origin/evidence-backed anchor + platform derivatives
  ->
QUALITY GATE
claims / rights / brand voice / platform policy
  ->
APPROVE
exact consequential action
  ->
AUTOMATE
schedule / publish / reconcile
  ->
ENGAGE
comments / creator outreach / inbox proposals
  ->
MEASURE
reach -> qualified engagement -> lead -> order/opportunity -> contribution
  ->
LEARN
creative genealogy / audience / offer / product / channel
```

## Remaining production work after this branch

1. Merge/reconcile PR #589 so the newest Growth intelligence and this execution layer are on one lineage.
2. Configure at least one authorized Social provider in production and run a controlled scheduled-post canary.
3. Add provider-native analytics ingestion for Ayrshare so post/account analytics flow directly into `SocialPerformanceObservation`.
4. Bind an authorized messaging provider to the already-governed Social message outbox.
5. Add durable Content Project persistence/calendar UI rather than keeping the new contract package-only.
6. Add engagement inbox ingestion + triage/assignment; replies remain consequential actions.
7. Add platform-specific content overrides so one Big Idea can publish native variants rather than one identical caption to every account.
8. Add webhook-driven delivery/analytics reconciliation where provider support exists.
9. Certify rate limits, provider outages, scheduled-post failures, duplicate requests, token revocation, and reconciliation in production.
10. Keep paid media under the separate `paid-ad.publish` Growth boundary; Social organic automation must never inherit spend authority.

## Acceptance doctrine

A "social media marketing beast" means:
- high-volume without generic filler;
- automated without unbounded external authority;
- platform-native rather than blind cross-posting;
- evidence-backed rather than tutorial-rule driven;
- audience/product/offer aware;
- organic + creator + paid + marketplace connected;
- contribution/economic outcomes over vanity metrics;
- durable lineage so every result teaches the next campaign.


## Source certification receipt

Certified branch head:
- `ec26f73e2a38e6061c92601d3e553bde5baab454`
- PR #592 is open and mergeable.

Green executable evidence:
- Social Core Certification #100 — run `35754992412` — SUCCESS
  - frozen install
  - Social Core type-check
  - Social Core tests
  - Growth Core type-check
  - Growth Core tests
  - Social/Growth web integration type-check
  - Social web integration tests
- Jhadina Web Deploy Conformance #399 — SUCCESS
- Growth Vercel Prebuilt Preview #89 — SUCCESS
- UX Final Certification #163 — SUCCESS
- Media Production Certification #296 — SUCCESS
- Director Targeted Tests #648 — SUCCESS
- Spatial Conformance #1362 — SUCCESS
- Staffing Postgres Integration #2360 — SUCCESS

The broad Jhadina Launch Gate #3975 is not green, but its failures are outside this Social change:
- `packages/director-core/src/studio-governed-action.test.ts` cannot resolve `@jhadina/action-core`;
- `packages/director-core/src/ffmpeg-cancellation.test.ts` timed out at 5 seconds.

The same Launch Gate run shows Social Core type-check and the new Social test files passing. This branch does not alter Director Core, so the launch-gate failure is recorded as unrelated monorepo debt rather than a Social certification failure.

## Readiness verdict

**SOURCE_CERTIFIED / RUNTIME_PROVIDER_CONFIGURATION_REQUIRED**

What is ready now:
- governed multi-provider publishing contract;
- Hootsuite + Ayrshare runtime selection;
- exact-account provider binding;
- immutable scheduled publishing after approval;
- content-project lineage and evidence gates;
- existing Social observation -> Growth learning path.

What still requires live operational evidence:
- real production provider credentials/account binding;
- a controlled scheduled publish canary;
- provider-rate-limit / revoked-token / outage drills;
- Ayrshare analytics ingestion and webhook reconciliation;
- final convergence with open Growth intelligence PR #589.
