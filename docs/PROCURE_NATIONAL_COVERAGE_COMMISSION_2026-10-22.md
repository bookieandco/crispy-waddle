# PROCURE.NATIONAL — 50 states + DC coverage and safe procurement commissioning
Date: 2026-10-22. Existing branch sam-procurement-partner-docket-2026-10-22 and PR #1478.
Scope: extend canonical Jhadina Opportunity Core; do **not** create another procurement engine.

## Verified live inventory
Data from read-only queries of Jhadina's connected Supabase project:
- 80,742 jurisdiction records across 50 states and DC (mixed governmental and public-entity catalog).
- 51 states/DC, 3,144 county equivalents, 19,468 cities/municipalities, 13,350 school districts, 41,633 special districts, 1,952 public universities and 1,144 public hospitals. No authority records present in this snapshot.
- 26,586 procurement source records, of which 25,533 degraded, 554 adapter_required, 438 disabled, 61 marked active.
- 3,755 **distinct jurisdictions with any recorded source**, 3,686 jurisdictions with verified official source, **60 distinct jurisdictions with certified + access-reviewed active read-only source**, per the new security-invoker view.
- 77,328 blocked discovery jobs; 69,738 blocked specifically because neither official domains nor search provider were available. Of those, **77 jobs across 33 states** have newly matched official-domain evidence and no existing source references and are eligible for *careful*, bounded requeue after examination. NO bulk reset was executed.
- These are not apples-to-apples with the Census Bureau's 2025 figure **91,438 independent local governments**; Jhadina's catalog includes public universities/hospitals and combines disparate Census and supplemental lists, while its township, tribal, dependent and territorial coverage is not yet certified.

## Newly implemented
1. Shared types + 51-state, multi-level national coverage aggregation under packages/opportunity-core/src/domain/national-procurement-coverage.ts. Preserves separate inventory/source/verified/certified metrics, and never flags complete coverage or contracting authority.
2. Security-invoker Postgres view public.jhadina_procurement_national_coverage using existing jurisdiction/source/discovery/domain tables, installed through Supabase migration procurement_national_coverage_security_invoker_v1. Service role SELECT only; verified no direct SELECT for anon/authenticated. 354 state-by-level rows, exactly 80,742 inventoried jurisdictions in the live rollup.
3. GET /api/opportunities/procurement/coverage (optional state=CA) enforces owner identity before reading the service-role view. No public anonymous exposure, no procurement actions.
4. Responsive 51-state coverage dashboard in existing /opportunity/procurement UI, with summary metrics, exact states table, per-state selector and associated existing source-recovery queue. Reuses prior school truck and LA County no-send pilot cards.
5. OIDC-only exact-ID POST /api/internal/opportunities/public/national-recovery, with {state,jobIds[1..20],apply:false} for dry-run, and apply:true to reset *only* previously blocked official-domain-absent discovery jobs which have newly matched official domain evidence (score >= .86), no previous source refs and approved exact jurisdiction IDs. No websites fetched by this endpoint; any later discovery still runs existing governed pipeline and uses existing cost/robots/access boundaries.
6. Shared deterministic regression tests, included in Opportunity Core test script + Local Gov targeted CI.

## Explicit boundaries
- Nationwide inventory != nationwide bid feeds. Known-source != verified official buyer != certified active adapter != vendor eligibility != bid submitted.
- The view reports certified read-only sources only when adapter_status='active', certified_at populated and access reviewed. An active flag alone is not enough.
- A blocked job due to retry exhaustion, unknown/ambiguous domain, or historical sources must stay blocked. No mass recovery of 77k blocked jobs; use exact-ID review of the 77 newly domain-matched jobs only, with robots/access approval as appropriate.
- No new search subscription, paid SaaS, or other spending. Discovery remains no-cost dotgov-first when feasible. A search provider can later be configured explicitly if free sources are inadequate.
- No production merge/deployment, outreach, quote request, bid submission, signature, payment or wallet action authorized by this implementation. PR stays draft until exact-head CI + owner iPhone private acceptance.
- Official RUSD PDFs and LA County FASMA amendments still require authorized intake. The pilot remains no-send.

## Next safe national rollout
A. Confirm latest-head CI, test protected preview, and obtain owner iPhone login/navigation acceptance.
B. Audit official-source precision and actual procurement content of the 61 previously active records; do not automatically promote inaccurate source pages.
C. Resolve 77 domain-backed recovery candidates in **small exact-ID batches** with only officially corroborated .gov domains; inspect site access, parser accuracy, anti-SSRF, robots, repeat trials, duplicate external IDs and closed-bid handling.
D. Improve official free-source catalog using Census Government Organization 2025 public-use file, current gazetteers, .gov registry, and source-to-jurisdiction provenance. Add municipal townships and dependent systems as their own taxonomic families; identify which authorities are non-independent.
E. Build separate opt-in inventory for federally recognized tribal governments and U.S. territories (PR, GU, VI, AS, MP), because existing US_STATE_AND_DC_CODES is 50 states plus DC. Do not fabricate complete indigenous/territorial coverage. Federal procurement stays in existing SAM.gov adapter; USAspending supplements prior awards, not live local bid availability.
F. Rank source candidates by verified authority, real bid-list structure, recency, access legality, and stable external IDs. Gate actual bid documents, vendor compliance, all-in quote, margin and approval via the *same* canonical provider and no-send bid-packet code.
G. After source and owner acceptance, consider incremental scheduler canaries state by state with a strict per-run budget and error circuit breaker; no mass release.

## Authoritative references
- U.S. Census 2025 Government Organization summary: https://www.census.gov/library/publications/2026/econ/govtorg2225.html
- 2022 public Government Units Listing: https://www.census.gov/data/datasets/2022/econ/gus/public-use-files.html
- SAM.gov Get Opportunities Public API: https://open.gsa.gov/api/get-opportunities-public-api/
- USASpending API, awards (not solicitations): https://api.usaspending.gov/
