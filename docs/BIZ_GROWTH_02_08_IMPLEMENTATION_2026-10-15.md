# BIZ-GROWTH.02–.08 — Business Pipeline growth operating loop

**Date:** 2026-10-15
**Parent:** PR #1304 (`feat/business-growth-missions-20261015`)
**Stacked PR:** #1305 (`feat/biz-growth-02-08-evidence-loop-20261015`)

## Truth boundary

This PR implements provider-neutral and read-only Google Search Console adapter logic, deterministic SEO decisions, governed creative proposals, attribution accounting, and a 30-day Business Pipeline planning cadence. It **does not** install Google OAuth, establish business property ownership, run a site crawler, publish content, post on Reddit, negotiate backlinks, authorize ads/spend, connect a real store, or prove actual sales. Sample transactions and test fixtures are not production results.

The system adopts research lessons from the user's BabyLoveGrowth / ChatSEO / Rebel Growth comparisons: improve real pages before churning articles, analyze buyer intent rather than clicks alone, use first-party data where authorized, keep brand-specific content originality, and measure realized commercial contribution. Video claims about tool speed, link quality, traffic, word counts, ranking or revenue are not independent verification.

## Source of truth, paths, authority

```text
Google read-only OAuth (not commissioned)
 -> verified Google property/site access (not a substitute for owned business registry)
 -> bounded GSC query+page observations (partial by nature)
 -> existing Opportunity Core business growth mission planner
 -> canonical Marisa VentureWorkItem review/blocked queue

Trusted owned-site crawl observations (not commissioned)
 -> owned-url guard + technical diagnostics
 -> Growth buyer-intent and optimize-vs-new-page selection
 -> existing Growth Search Everywhere core answers
 -> source/rights-bound draft and platform-native translation proposals
 -> existing Social/Director review and provider approvals (not bypassed)
 -> immutable delivery analytics + CRM + Commerce settlements (not commissioned)
 -> settlement-gated contribution and provisional lesson
 -> 30-day evidence/kill criteria and bounded next cycle
```

No separate CRM, Social scheduler, CMS publisher, attribution database, payment path, or task queue is introduced.

## Coding targets

| Target | Implemented code | Missing live admission |
| --- | --- | --- |
| `BIZ-GROWTH.02` | `business-growth-gsc.ts`: fixed Google API host, read-only site-list and Search Analytics POST, permission check, URL/property isolation, response validation, bounded rows, final-data preference. `gsc-mission-runtime.ts`: owner-scoped Venture read with service-side property/token contract. | Authorized Google OAuth with `webmasters.readonly`; server-secret storage; owner-verified property/venture association; actual fetch and provider receipt |
| `BIZ-GROWTH.03` | `inspectOwnedWebsite`: audit observed site pages for HTTP errors, indexability, title/meta, canonical and Product schema evidence; no guessed ranking changes. | Authorized owned-site crawler/provider scans, robots/respect rate limits, verified post-deployment audit |
| `BIZ-GROWTH.04` | `rankBusinessSearchWork`: use GSC observed owned pages, prioritize fixes/revisions before new pages, distinguish high-intent offers, return competitor records as **unverified review candidates**. | Real competitor identity/market research and query/offer conversions |
| `BIZ-GROWTH.05` | `prepareGrowthContentBrief`: buyer question, offer, CTA, claim-source, original media-rights evidence, draft-only. | Research facts, originals, human content review, exact canonical draft approval |
| `BIZ-GROWTH.06` | `prepareGrowthDistribution`: reuse existing Growth Search Everywhere `createCoreAnswer`/`createSurfaceTranslation`; produce Social-bound channel drafts; Reddit research not auto replies. | Content Project / Director assets, canonical Social account approvals, CMS provider publish and provider receipts |
| `BIZ-GROWTH.07` | `reconcileGrowthContribution`: enforce exact business/experiment/mission/order lineage and complete settled revenue, refund, fulfillment, fee, acquisition cost fields; per-order duplicate defense; zero XP without positive reconciled contribution. | Trusted canonical Commerce reconciler output, order-level delivery/reversal receipts, persistent idempotency index and learning gate |
| `BIZ-GROWTH.08` | `createBusinessGrowthExperiment`, `assessBusinessGrowthExperiment`: 9 checkpoints over 30 calendar days, zero approved spend, approval/kill gates, duration/receipt fail-closed, explicit INCOMPLETE result. Authenticated web preview and opt-in insert-only Venture ledger planning tasks. | Provider/owner checkpoint receipts, live scheduling host and webhook ingestion, real month-long data, ongoing evaluation and owner approval to expand |

## Surfaces

- `/opportunity/growth-missions` in the existing Side Hustle Business Factory now has a 30-day plan option with a proposed hypothesis and nine dated review milestones.
- `POST /api/business-growth/experiment/plan` requires a user session; creates a **non-persistent** preview, with placeholder venture ID. It creates no schedules, no fake receipt and no external action.
- `POST /api/business-growth/experiment/commit` requires an authenticated owner, a real active canonical Venture and server-only Supabase access; inserts only new tasks into existing `jhadina_venture_work_items`, respecting existing/completed work. Later checkpoints stay **blocked**, not executable. Writes use insert-only conflict prevention.
- `apps/jhadina-web/src/lib/business-growth/gsc-mission-runtime.ts` is **server-only adapter code** not invoked by a public POST accepting Google tokens. An approved OAuth source and registered-owned-site association are necessary before it can run.

## Hard rules

- Do not pass untrusted page scans as verified. No browser-provided `verified` value may be promoted by the API.
- GSC property access alone does not prove which Jhadina venture owns a given domain. Assert owner+venture+verified registered site independently.
- Search Console returns *top rows* subject to API limits, not necessarily every search query. Never claim complete keyword coverage or conversion data from GSC.
- Never interpret Google impressions, AI citations, raw video views, draft scores or alleged backlink value as earned money.
- Never generate thin page quotas, fake endorsements, forum astroturfing, automated backlink exchanges, unlicensed images or unsupported claims.
- `reconcileGrowthContribution` is a **pure function for trusted server callers**; its source marker is not a signature. It must never be exposed to raw browser/user data as a verification mechanism. Persist canonical source receipts and dedupe order IDs before XP can be committed.
- Approval of a document/content draft never authorizes a provider send. Canonical Social/CMS execution authority and exact approval receipt remain required.
- `blocked` planning checkpoints are not hidden background automations. No live worker or money movement is installed.

## CI and test evidence

New `business-growth-operating-cycle.test.ts` covers property access, Google API method/path, foreign result rejection, invalid metrics/time, site audit boundaries, existing-page-first ranking, competitor uncertainty, source/rights review, Reddit nonposting, missing/duplicate settlement, loss outcomes, 30-day checkpoint gating, and predated receipt rejection.

Run:
```bash
pnpm --filter @jhadina/growth-core type-check
pnpm --filter @jhadina/growth-core test
pnpm --filter @jhadina/opportunity-core type-check
pnpm --filter @jhadina/opportunity-core test
pnpm --filter jhadina-web type-check
```

Do not mark as deployed until the final PR head is green and production acceptance is proven. No Supabase DDL/migration was needed for this sequence.

## Next live commissioning (blocked until authorized sources exist)

1. Acquire consent-bound Google Search Console read-only OAuth and verify owned property + venture mapping (no token in browser or source control).
2. Bind authenticated server retrieval on one site; store source provenance/freshness; compare with existing pages and product offers; record incomplete-data caveats.
3. Certify an owned-site inspection adapter and source-checked content/rights brief.
4. Perform one owner-reviewed, provider-receipted publish through canonical Social/CMS; verify rollback and no duplicate sends.
5. Reconcile a genuine Shopify/Commerce order to campaign and exact asset, including refunds/fees/COGS/attribution cost; record no outcome if absent.
6. Complete the 30-day checkpoints and score settled contribution, then admit only evidence-backed lessons to Growth/Opportunity memory. Approval required for any spend or expansion.
