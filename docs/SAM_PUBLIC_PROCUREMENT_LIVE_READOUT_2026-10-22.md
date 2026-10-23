# SAM and Public Procurement Live Readout — 2026-10-22

**Evidence source:** read-only SQL queried directly against user-connected Supabase project **Jhadina** on October 22, 2026, after the initial procurement dossier was staged. All numbers are table row counts, **not** deduplicated bid counts, live eligibility certificates, provider consents, active procurements or awards obtained by Jhadina.

## Actual source registry / data shape

| Table | Row count | Latest observed |
|---|---:|---|
| `jhadina_sam_catalog` | 84,812 | 2026-10-22 12:35:12 UTC |
| `jhadina_sam_provider_candidates` | 40 | 2026-10-01 14:11 UTC |
| `jhadina_sam_pursuit_options` | 5 | 2026-10-01 22:41 UTC |
| `jhadina_public_opportunity_inbox` | 5,269 | 2026-10-22 12:39 UTC |
| `jhadina_public_procurement_sources` | 26,585 | 2026-10-22 14:20 UTC |
| `jhadina_public_awards` | 12 | 2026-10-21 17:56 UTC |
| `jhadina_public_prime_profiles` | 12 | 2026-10-22 14:22 UTC |
| `jhadina_public_work_packages` | 12 | 2026-10-22 14:22 UTC |
| `jhadina_public_package_provider_candidates` | 46 | 2026-10-22 14:25 UTC |

Filtered counts at read time:
- 16,198 catalog rows have `response_deadline >= '2026-10-22'` (text comparison on stored ISO response_deadline; **not** timezone-resolved or deduplicated).
- 3,152 of those have `notice_type = 'Solicitation'`.
- Public inbox: 5,257 active `open_solicitation` observations and 12 active `award` observations. **Not** independently reverified closing dates.
- Public inbox: 1,826 California `open_solicitation` records; 100 `open_solicitation` titles contain “school” or “district” across all states. Overlap and duplication not resolved.
- Every current SAM provider candidate (40) has `status='review_required'`; every public package candidate (46) has `assessment_status='review_required'`.
- All five stored `jhadina_sam_pursuit_options` are `blocked`; two past deadlines (Oct 5 and Oct 20), remaining three due Oct 30. All have `quote_targets=[]` and an unresolved requirement/provider coverage blocker. No bid-ready pursuit is established.

### Source adapter status (observed; verified domain != working scraper)

| Verification | Adapter | Sources |
|---|---|---:|
| official_owner_verified | degraded | 21,739 |
| official_portal_verified | degraded | 1,827 |
| candidate | degraded | 1,966 |
| official_owner_verified | adapter_required | 341 |
| official_portal_verified | adapter_required | 213 |
| official_portal_verified | active | 59 |
| official_owner_verified | active | 2 |
| rejected | disabled | 438 |

**Only 61 sources are marked active, while 25,532 sources are degraded.** Remaining 554 require adapters. The high row count alone is not evidence of broad live procurement coverage. Repair/commission targeted official sources for California schools and counties first, not broad scraping.

## SAM tracked examples (federal, no solicitation-specific firm partner verified)

1. `Defueled Ex-Long Beach (CGN 9) Transportation & Disposal`, Department of Defense / NAVSEA HQ, deadline Oct 30 2026 17:00 EDT: two separate catalog notice IDs and blocked pursuit plans; previously awarded naval contractors are review-only candidates, none currently covers evidenced requirements. Official SAM notice: https://sam.gov/workspace/contract/opp/638940335bff4fc1a31d8f5097f6863d/view
2. `PUMP UNIT,CENTRIFUG`, Defense Logistics Agency Aviation Philadelphia, deadline Oct 30 2026 16:30 EDT: blocked; candidate companies like CIRCOR Naval Solutions and RIX Industries are **not** verified capable bidders for the requirement. https://sam.gov/workspace/contract/opp/d16bb5490cf1462088a334d6c2af7a7d/view
3. `J079--PM&R Svc for Floor Cleaning Equipment`, VA / NCO22, stored deadline Oct 29 2026 13:00 MDT, no provider candidate currently found on the five existing pursuit plans. Requires bid package and eligible equipment service firm before any recommendation. https://sam.gov/workspace/contract/opp/89d63c291d0245fdaba7de46dcc02331/view
4. `Fairbanks Alaska CBOC Security Guard`, VA, stored deadline Oct 28 2026 17:00 PDT, is marked **SDVOSB set-aside**; cannot be satisfied by a nonqualified broker's subcontractor status, not in five pursuit plans. https://sam.gov/workspace/contract/opp/1be8ae57e49a475e8d961d93ddb076f5/view

These are **database observations**; validate against current SAM posting / amendments / documents, even when a date appears future. Older duplicated SAM notices and previous versions exist.

## Additional awards / prime discovery

The database has 12 Chandler, Arizona public award observations. Example: `Temporary Staffing Services` award identifies Marathon Staffing Resources Inc as prime and a review-only candidate QUATTRO CONSULTING LLC (score 45). This is **not** evidence that QUATTRO can subcontract, or that new work is open. Other weak matches and no-candidate rows indicate the award/prime matching scorer must not be interpreted as qualification. Sample official award index: https://www.chandleraz.gov/business/vendor-services/purchasing/award-recommendations

## Unresolved blockers and ordered execution

1. Verify current notices/addenda and actual procurement POC details from each original agency/SAM source. The public procurement docket has seven known agency contacts; SAM notices' raw POC field was not confirmed. Never fabricate missing contacts.
2. Target existing 61 active sources for read-only certification. Audit 25,532 degraded adapters (network, robots, parsing, freshness, throttling, false positives, canonical dedupe), prioritize RUSD, SBCUSD, LA County, LAUSD, MVUSD, USAC FY2027 and public works.
3. Deduplicate source URL variants/solicitation amendments while preserving immutable provenance and any deadline change.
4. For each evidence-backed requirement, verify contractor legal identity, service area, capabilities, capacity, needed industry/regulatory licenses, SAM eligibility/set-aside, DIR/prevailing wage/bond/insurance, quotes, and exclusions. Existing 40+46 candidates **cannot** skip review.
5. Propose prime, subcontract, disclosed team, or referral structures only where compliant; referral/percentage/margin claims must wait for counsel/procurement review and documented quotes.
6. Push only source-verified opportunities and qualification-backed partners through **existing** Opportunity Core, Provider Graph, CRM, SAM and local-award rails; no duplicate CRM, scheduler or unapproved network.
7. End with operator-review packet containing original posting, amendments, buyer contact, vendor contact, qualifications, price and margin **after costs are known**, suggested relationship route and approval receipts. External outreach, bid submission, contract signing and payments separately authorization-gated.

**No runtime changes or database writes were made in this audit.** 
