# JH-SOCIAL-RELAY.01–.06 — source-only closeout and operator handoff

Date: 2026-10-19
Base main (at branch creation): 8dfd9a7964a771580f1c24e30bfd3f45f48da2b4
Feature branch: feat/jh-social-relay-01-06-20261019
Scope: independent ideas inspired by common creative-workflow patterns; no Relay Studio code, API or assets used.

## Existing canonical authority — audited, retained

- packages/social-core/src/brands.ts and types.ts own brand/account identity and exact destination targets.
- packages/social-core/src/content-projects.ts owns canonical creative project and asset/evidence lineage.
- apps/jhadina-web/src/lib/growth/trendScout.ts and social/trend-observation.ts own existing sourced trend research and the optional Social observation bridge.
- apps/jhadina-web/src/lib/social/growth-content-bridge.ts already makes Growth decisions into canonical Social content projects.
- packages/social-core/src/automation.ts accepts immutable *approved* exact-target proposals only.
- apps/jhadina-web/src/app/api/social/posts and social/profiles guard identity, publication and provider operations.
- apps/jhadina-web/src/lib/social/learning.ts already projects observed performance into Growth attribution.
- Existing Director integration handles rendered media; this workbench creates **storyboards**, not images/video.
- Draft #1328 (SOCIAL-FREE) has creator/UGC rights tooling, but is not assumed deployed or merged.

## Delivered source targets

| Target | Added or changed | What is genuinely proven by source |
| --- | --- | --- |
| .01 | relay-workbench.ts createRelayBrandBrief | Multi-brand owner-authored positioning, audience, offer, site URL and evidence. Does NOT crawl or inspect websites. |
| .02 | rankRelayTrends | Bounded topical/freshness source scoring, explicit URL/evidence and timestamp checks. No claim of viral ranking or direct TikTok/X/Meta access. |
| .03 | generateRelayDraftBatch | 1–30 deterministic caption/storyboard concepts in canonical ContentProject format. No model calls or rendered media. |
| .04 | reviewRelayDraft + /social/studio | Touch-swipe and accessible button accept/reject on iPhone-sized UI. Review is local to the browser session, not durable or publish permission. |
| .05 | planRelayCalendar + prepareRelayPublication | Plan slots for explicit owner-scoped connected SocialAccount, future time, canonical publish input only if a reviewed media-backed asset exists. All slots unqueued and publication approval is still required; no provider call or persistence. |
| .06 | evaluateRelayPerformance | Evidence-bound, platform/brand/content-filtered observational metrics. Null for missing denominator, latest per-account cumulative snapshot to avoid double-counting. Existing Growth attribution remains canonical. |

## Tests and CI

Added packages/social-core/src/relay-workbench.test.ts:
- owner provenance and unsafe URL rejection
- source-bounded trend fit and future-timestamp/duplicate rejection
- 30-draft limit, canonical project lineage and no generated-media false claim
- immutable owner review and refusal to automatically publish
- connected owner, brand and platform scope checks
- media readiness requirement before canonical publication input
- observational learning with null unknown rates, rejection of unrelated evidence, and cumulative snapshot guard

Expected PR-triggered workflow: .github/workflows/social-core-certification.yml, including Social/Growth core tests and tsc -p apps/jhadina-web/tsconfig.social.json.

This document is NOT a claim that CI, Vercel, live social provider connections, Supabase writes, on-device Safari gestures, actual posts, or learning outcomes have passed. Report their independent receipts later.

## Access and privacy model

- New route: /social/studio, linked from existing /social.
- /api/social/profiles GET now returns ownerUserId only after existing verifier succeeds.
- No unauthenticated data admission: UI refuses to generate without verified owner identity.
- Drafts/reviews/calendar live in ephemeral local React state. Refreshing the page loses drafts.
- Website and reference URLs are user-provided strings for evidence; they are not crawled.
- Consent, provider API credentials, content rights and platform-specific posting rules must be resolved separately.
- Review/plan do not create SocialPublicationProposal, approval receipt, outbox job, provider schedule, spend or external side effects.

## Operator-owned milestones for live use

1. Merge branch only after exact-head checks and review against current main.
2. Validate owner login, input, swipe direction, accessibility and account filtering on a real iPhone.
3. Decide whether to add RLS owner-scoped persistence with migration collision/recovery audit before any migration is applied. Do not piggyback on a broken SWLC connection.
4. Supply actual connected/scope-verified source feeds with provenance. Do not infer social access from a ChatGPT account connection.
5. Bind rendered, licensed/QC-accepted Director media; explicitly request each canonical publication approval with a real destination and future time. Test platform delivery separately.
6. Read back provider receipts and calibrated metrics; do not call zero/unknown conversions wins. Evaluate on stable cross-platform measurement definitions and evidence IDs.
7. Securely verify Relay Studio's current public product claims/terms before making external comparative marketing claims. No proprietary copying.

## Exact completion boundary

.01–.06 are implemented as **bounded source-code planning/review capabilities**. Production integration, persistence, provider calls, public posting, spending, deployment and phone evidence remain uncommissioned. No automatic use of subscriptions or vendor APIs.
