# OCE-AUTONOMY.LIVE.06–.10 — Implementation + commissioning gates
Date: 2026-10-22
Canonical: bookieandco/crispy-waddle
Base: PR #1472 exact SHA b613d3ded7b3c05443abacda9b1bfb35d7246053
Branch: feat/oce-autonomy-live-06-10-20261022

## Status vocabulary
- SOURCE_IMPLEMENTED: code/review fixtures exist; does not imply runtime/database deployed.
- CI_VERIFIED: only after an exact-head CI check reports success.
- PILOT_BLOCKED: requires user-provided real-world access, approval, customer or payment evidence.
- LIVE_CERTIFIED: independent runtime evidence passed; **not claimed by this branch**.

## .06 Merge and activate
- Confirmed PR #1472 draft/open/unmerged with passing exact-head CI (14 successful associated workflows at time of reconciliation).
- New implementation is stacked directly upon #1472's verified head to preserve all existing work and avoid a competing architecture.
- Merge **not performed**: main can trigger production deployment; prior explicit release-approval gate is preserved.
- Commissioning requires: reviewer approves #1472; merge with exact-head CI; separately approve private deployment; authenticated iPhone smoke for /opportunity and API auth; reload/restart persistence and RLS checks. Passing GitHub CI alone is not an iPhone/runtime certificate.

## .07 Real read-only discovery
- Existing Greenhouse and Lever published GET adapters reused.
- New bounded cycle supports 1–5 explicitly chosen board tokens, preview-only vs owner-triggered import, fixed upstream hosts, replay-safe canonical IDs, per-provider failure reporting.
- Authenticated route: POST /api/opportunities/discovery/jobs/batch. No unattended scheduler or hidden applications; platform terms, location eligibility and authorization to work as AI remain unverified.
- To commission: inspect provider terms, test real boards, verify source freshness and UI persistence. A user-scoped standing read mandate and rate limits must be separately evidenced before recurring calls.

## .08 Working source-bound internal services
- New source admission matches opportunity ID, canonical evidence ID, source URL, actual captured excerpt and owner review. Unsupported user assertions do not become canonical facts.
- Produces existing research report / qualified leads / SEO audit draft only after deterministic QA. It does not synthesize a client or claim factual verification from a URL alone.
- Authenticated internal-run route requires a stored owner-owned canonical Opportunity and matching source observations. Without genuine excerpts, admission blocks rather than creating invented evidence.
- The service does not provision a GPU, publish externally or change a customer's website.

## .09 Governed durable worker
- Reuses @jhadina/agent-runtime-core DurableAgentRuntime and the existing jhadina_agent_* Supabase persistence; no duplicate job queue, task scheduler or new tables.
- One low-consequence operation only: prepare_source_bound_pilot. The policy rejects all other operations and step consequences; stored checkpoints and optimistic versioning come from the existing Agent Runtime.
- Owner-scoped opaque run ID and authenticated GET status endpoint, no cross-owner status access.
- New routes require existing service-role proxy on the server. This code has not been tested against production with owner session; no production writes were attempted.
- The optional isolated pure lease/transition contract is a guardrail for future queued recovery; it is not presented as a second scheduler nor does it authorize unattended actions.

## .10 Real paid customer commissioning
- Read-only checklist inspects existing commercial work order + stored delivery/acceptance/outcomes, checks lineage and currency.
- The Money Core bridge remains the actual financial-truth authority; no arbitrary receipt may certify paid income. Endpoint always passes moneyVerifiedByIndependentRead:false until a **distinct authenticated Money Core provider reconciliation** exists.
- No synthetic customer, acceptance, payment, realized revenue or profit is written. Actual external engagement, pricing, payment and delivery remain Action Core/Commercial Runtime gated.
- Source module explicitly returns recognizedRevenue=0 and paymentRecorded=false even for apparently complete user-supplied evidence.

## Exact-head acceptance
1. CI typecheck and tests of Opportunity Core, Growth, Money and web; verify latest commit SHA, not a prior green job.
2. Private owner-authenticated iPhone canary after independent deployment approval: link navigation, 401 unauth, 1–5 source preview, owner import, refresh and persistence, cross-user isolation.
3. Real, owner-reviewed canonical source excerpts: research, leads and SEO drafts; durable agent checkpoint persistence and post-restart status under the approved account.
4. Separate authorized customer scope, actual accepted delivery, payment processor/bank reconciliation and positive/negative test evidence before any claimed earnings.
5. Preserve #977/#1313 and SAM #1449→#1452→#1454 as separate source recovery chains; do not silently cherry-pick or merge.

## No operations performed
No merge, production deploy, cron installation, bank/wallet signing, spending, application submission, customer contact, paid advertising, publishing, bid, schema mutation or fabricated transaction. This branch is intended to be reviewable and fail closed when any independent live gate is absent.
