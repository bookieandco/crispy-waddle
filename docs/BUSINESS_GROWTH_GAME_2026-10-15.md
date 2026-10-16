# BUSINESS-GROWTH-GAME.01 — Evidence-first growth missions (2026-10-15)

## Source-derived ideas; not proof of vendor performance

The owner provided a critical BabyLoveGrowth/ChatSEO comparison and a Rebel Growth creator demonstration. They describe automated SEO onboarding, keyword/content planning, first-party Search Console analysis, competitor review, GEO audits, Reddit discovery, social adaptation, scheduling, long-form drafts, and reciprocal link networks. Product demonstrations and self-promotional alternatives are **claims**, not validated ranking/revenue outcomes. The Rebel Growth speaker states that it is their own product. No trial, subscription, or vendor connector has been authorized here.

Adopt these **mechanics**, not their brands, pricing, undisclosed promotional automation, backlink trading, or default article quotas. Google's guidance favors original people-first content and treats scaled low-value pages or link schemes as spam risks.

## Canonical placement

`Business Factory / Opportunity Core -> Business Growth Mission Planner -> VentureWorkItem (Marisa operations queue) -> Growth research/brief -> Director originals -> Social and CMS canonical approvals -> provider receipts -> Commerce/CRM settled outcomes -> learning`

- One business scope per venture. Do not duplicate Opportunity, Growth, Social, CRM, Director, Action or Commerce.
- The mission planner in `packages/opportunity-core/src/domain/business-growth-missions.ts` is deterministic, zero-spend, no-execution and evidence-gated. No DB schema or second queue.
- `buildBusinessGrowthMissionDeck` projects compatible canonical `VentureWorkItem` objects with `authorizationEffect: 'NONE'`. Previewing does not persist them; a separate explicit owner action may enqueue them.
- `/api/business-growth/missions` requires authenticated Jhadina session. It **downgrades all browser-provided observations to unverified manual evidence**. Browser data cannot authorize publications, award XP or appear as connector-certified Search Console results.
- `/api/business-growth/missions/commit` allows explicit authenticated insertion of review/blocked **planning-only** items into existing `jhadina_venture_work_items`, after verifying the owner owns the selected Venture. It uses stable content hashes, never overwrites existing work (including completed tasks), strips browser verification claims, and returns inserted/skipped counts.
- `/opportunity/growth-missions` is a manually entered preview with score, stage, evidence gaps, potential XP, optional owner-venture selector and explicit **Queue review missions** button. Preview business IDs are provisional; only actual owned ventures may receive persisted planning work.
- The Side Hustle Business Factory includes a link to this board.

## Game rules

1. **SCOUT:** Confirm site ownership, first-party search baseline, buyer demand, competitor relevance, and what already exists. The planner requests Search Console evidence when absent.
2. **FIX:** Prefer existing high-intent pages; technical issues need site-audit evidence, existing-page performance needs first-party analytics.
3. **CREATE:** Plan a new page only for transactional/commercial opportunity, or genuinely original informational value. No volume quota, fake citations, copied reviews or unverified claims.
4. **AMPLIFY:** Prepare branded, platform-native variants through existing Social/Director identities; no action here publishes. Reddit/community radar is research-only with human-approved genuine participation, disclosure where appropriate, no stealth bot replies.
5. **MEASURE:** Tie immutable asset/link/campaign/customer IDs to Analytics and Commerce settlement, refunds/fees/experiment costs and realized contribution. Clicks/impressions/AI mentions are diagnostic, **not settled revenue**.

Scores reflect **mission review priority**, not predicted rankings or ROI. Potential XP is never automatically earned. The standalone pure `scoreBusinessGrowthOutcome` function only calculates earned XP when a **trusted caller** has reconciled an actual commerce settlement. Its `providerVerified` argument is not a cryptographic validator and **must never** be passed straight from a browser or a model.

## Tests and evidence

- `packages/opportunity-core/src/domain/business-growth-missions.test.ts`: choose existing page before a new one, favor transaction intent, skip generic informational article churn, block absent/stale evidence, reject outside-page URLs, stop invalid/negative data and manual-verified spoofing, use Marisa's existing Venture work-item contract, reject reward without verified settled contribution.
- Test script for `@jhadina/opportunity-core` adds the new test.
- Live Google, CMS, social, Reddit, Shopify and commerce provider flows are **NOT commissioned** by this PR.
- No earned XP, new sales, ranking movement, verified traffic improvement, external execution or content publication is claimed. Persistence endpoint code has not been exercised against a live owner venture in this PR.

## Next engineering sequence (not yet implemented)

1. `BIZ-GROWTH.02`: authenticate owned Search Console properties; ingest query+page+device+date observations and property proof; exclude stale, cross-business and estimated measurements.
2. `BIZ-GROWTH.03`: owned-site crawl, canonical/indexability, sitemap, structured data, accessibility and conversion audits. Treat optional `llms.txt` as discovery, not a ranking guarantee.
3. `BIZ-GROWTH.04`: competitor identity validation, buyer-intent classification and dedupe against existing URLs; explain why refresh, repair or new page wins.
4. `BIZ-GROWTH.05`: generate original evidence-rich briefs and constrained content drafts within each brand voice; source checking, rights and owner approval.
5. `BIZ-GROWTH.06`: use canonical Social/Director/publishing approvals and existing schedulers for licensed media and platform-specific variants; community radar remains manual/approval-first.
6. `BIZ-GROWTH.07`: capture site/CMS/provider receipts and link to CRM leads, Shopify/Commerce settlements, refunds, expenses, and attribution windows before XP/learning.
7. `BIZ-GROWTH.08`: persisted 30-day experiments and business-level game UI; explicit baseline, cost, objective, guardrails, review checkpoints, escalation and kill criteria. Do not claim measured outcomes from simulated inputs.

## Commissioning blockers

Owner-authorized site/Google account connectivity; site property/venture association; real provider data and receipt provenance; per-business content rights/brand profiles; canonical Social and CMS provider approvals; authorized owned social accounts; live conversion and settlement reconciliation; CI and production deploy proof. Never resolve these by manufacturing sample metrics.
