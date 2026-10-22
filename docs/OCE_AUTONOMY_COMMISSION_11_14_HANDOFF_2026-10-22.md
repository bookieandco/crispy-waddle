# OCE-AUTONOMY.COMMISSION.11–.14 — reconciled implementation and evidence
As of 2026-10-22. Production activation deliberately NOT performed.

## Exact repository lineage — .11
- Original foundation PR #1472: draft/open/unmerged, head b613d3ded7b3c05443abacda9b1bfb35d7246053.
- Original LIVE PR #1474: draft/open/unmerged, head 9efa9ad564294ee07a303064a017e7cd11805f4e, stacked on #1472.
- New main SHA at reconciliation: f33cb98ccabef52bd8c1701b912ada92a1d9dc20 (18 commits ahead of old baseline, primarily login, navigation and private mobile smoke).
- Reviewed exact main divergence; no overlapping changed path with the 27-file combined Opportunity change set.
- Selectively transplanted **exact blobs of the 27 Opportunity files** onto new main using one committed Git tree; no force push, old PRs unchanged, no merge to production main.
- This branch then adds commissioning source changes and independent tests. Check latest exact SHA + pull request review before any production merge.
- Merge remains gated because main deployment may be automatic; independent owner release approval needed.

## .12 iPhone preview acceptance
- Added local Chromium mobile smoke script at 390px and 320px, reusing already installed CI browser driver and loopback-only smoke header.
- Checks the Opportunity Hub renders, filters exist, outbound controls default disabled, responsive overflow and unauthenticated API rejection.
- Added the script to .github/workflows/jhadina-mobile-browser-qa.yml in the existing local production build workflow.
- **This is not iOS Safari / real enrolled Face ID / a deployed private link test.** Final device check must be performed with authenticated owner session and separate deployment approval.

## .13 Bounded scheduled discovery admission
- New pure schedule policy: max five owner-approved public job boards, explicit nonblank consent receipt, provider-terms-review timestamp, approval expiry <=30 days, minimum 60-minute cadence, maximum 25 findings per cycle, pause and dedupe.
- Separate authenticated **preview-only** endpoint; no spoofable client receipt is accepted as actual scheduler authority.
- Existing bounded public-board importer remains explicitly owner-initiated, with source provenance and stable ID deduplication.
- Recurring cron enrollment is **not** performed: requires independent persisted owner authorization + provider terms and rate-limit durable lease. Plan is not an active scheduled search. No platform usage/AI eligibility guarantees were assumed.

## .14 Source-verified internal research worker
- Added exact-host allowlisted public HTTPS source recheck with redirect denial, 8s timeout, bounded 1MB streamed response, content-type validation and SHA-256 source hashes.
- Owner-supplied reviewed flag alone now cannot pass evidence; actual public HTML/text must include the canonical stored excerpt. The source receipt establishes content integrity, NOT factual validity, official endorsement, customer acceptance or money.
- A successful source-bound case flows through existing @jhadina/agent-runtime-core: durable run/checkpoints, owner-scoped retrieval, no external action or payment.
- Tests inject controlled public HTTP fixtures; they cannot substitute for a production source, browser session or database receipt.
- **Live read-only Supabase check:** project kqbkaozfjubkjevdfvic: 0 public.jhadina_opportunities, 0 with two evidence rows, 0 with two attributable excerpts as of this reconciliation. Therefore no genuine persisted commercial research case exists to certify right now. No synthetic seed data inserted.
- Also missing: approved real production research-host allowlist (OCE_RESEARCH_ALLOWED_HOSTS). Leave env unset/fail closed until the owner authorizes specific sites and provider terms.

## Mandatory next gates
1. Require clean exact-head CI for the fresh combined PR (Opportunity, Agent Runtime, web, mobile).
2. Independent reviewer signs off the new combined source and release authority; only then merge and approve private deployment.
3. Verify real owner iPhone auth and each Opportunity control. Unauthenticated request paths must fail closed.
4. Owner supplies approved public board token(s) and source permissions. Run first permitted board preview, import one real opportunity, verify canonical DB IDs, persisted triage and restart.
5. Collect at least two real source-attested excerpts from two approved hosts. Run one durable internal report with actual page hashes and restart recovery. Confirm independent factual QA separately.
6. Only then consider owner-approved recurring discovery with durable consent and lease/replay receipts. No spending, bids, employment applications, publishing, customer outreach or inferred earned income.

## No commercial claim
No real job applied to, no public job sourced into production, no customer agreement, no payment or revenue receipt. Money Core remains financial truth authority. No deploy, merge to main, database changes, auth bypass, activated schedule, provider contact, token read, wallet signing or spend in this coding sequence.
