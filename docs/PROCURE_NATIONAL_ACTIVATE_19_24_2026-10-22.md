# PROCURE.NATIONAL.ACTIVATE.19–.24 — controlled national commissioning

**Date:** October 22, 2026. **Repo:** `bookieandco/crispy-waddle`, existing draft PR #1478, branch `sam-procurement-partner-docket-2026-10-22`. Reuses canonical procurement, award history, prime/sub research, security and approval systems. **This is an evidence-bound release packet—not a declaration of nationwide active contracting.**

## Decision and approval boundaries

**Accept code-only commissioning and private owner review. Do NOT certify Oxnard, Casitas or Riverside as a live source, promote production, reset discovery jobs, automate planholder login, contact contractors or buyers, register a vendor, submit a bid, sign, trade or spend.** All release gates are independent.

## .19 — Preview and CI

- Pre-sequence branch head `5c8df4b44b700e5d96b45bea4a8e9349b3715eb3` completed all five GitHub checks with SUCCESS: Opportunity Core CI, Local Government Targeted Tests, Web Deploy Conformance, Private Mobile Browser QA, Jhadina Launch Gate.
- Existing private Vercel deployment `dpl_E3ify57pfMCiabSR4i278sR2qD8x` is READY at `7197377059759f89c48742507c26e682b2ab732d`; it **predates the exact latest procurement/activation changes**. Its stable branch address is `https://crispy-waddle-jhadina-web-git-sam-cf6308-bookieandcos-projects.vercel.app/opportunity/procurement`.
- The protected endpoint, when fetched **without** the verified owner's browser session, returns Jhadina login and preserves the `/opportunity/procurement` path with query parameters. Vercel project SSO protection is separately enabled; do not expose anonymous development bypasses.
- The authenticated **iPhone Safari / Face ID / click-through acceptance remains NOT VERIFIED**. CI mobile Chromium checks and protected login fallback alone are not a real owner-device receipt.
- A new preview is required at the **exact latest head** before marking the activation UI live. No merge to `main`, no production alias change.

## .20 — Actual agency access receipts / no false source certification

Read-only query of the connected Supabase project `kqbkaozfjubkjevdfvic` and the `jhadina_public_adapter_trials` records:

| Buyer | Registry access | Last actual trial | Exact-parser success | Certification |
|---|---|---|---|---|
| Oxnard | `approved_public_official` (registry) | `2026-10-22T19:56:45Z`, generic HTML table v1, **HTTP 403**; 0 records | 0; source-specific `oxnard-public-project-bids-v1` was **not** used in that trial | **Blocked** |
| Casitas Municipal Water | `approved_public_official` | Same instant, generic HTML table v1, **HTTP 200, parse_succeeded=false, 0 records** | 0 | **Blocked**; public page reports no open projects |
| Riverside Unified | `pending`, `degraded` | Prior timestamp `2026-10-22T16:58Z` | No qualifying independent success in the checked three-source records | **Blocked** |

Registry's `approved_public_official` status is **not** a screenshot of buyer authorization, complete robots/terms approval or evidence that the source will return 200 to the worker. Read-only web tools could inspect official pages, but direct `robots.txt` retrieval returned inaccessible results, so do not manufacture an access receipt or bypass HTTP 403.

Implemented `national-procurement-activation.ts` exact-parser source assessment: three distinct successful HTTP 200 read-only captures with provenance, stable IDs, no duplicate external IDs and confirmed lawful access evidence; return hard blockers on 403/missing documents/unknown provenance. This code *does not* write adapter state, certify a source or authorize fetches. New private `GET /api/opportunities/procurement/activate` reads current Supabase source and trial rows and surfaces actual status to owner UI.

**Next source sequence:** explicit official access/robots/terms review from the authorized buyer; repair worker access without evasion, then conduct three separated read-only trial captures of the **exact source-specific parser**. For Casitas' empty page, require an empty-state-aware structural adapter; **zero notices must not be labeled parse success or active opportunity**. Riverside planholder login remains human-run, not automated.

## .21 — Official solicitation manifest / outstanding evidence

- City of Oxnard official public-project page `https://www.oxnard.gov/finance/purchasing/public-project-bidding` (verified browser public list dated October 22, 2026) lists `PW 25-96` Well 20 Phase II with November 16, 2026 public listed date and **Addendum 1**, plus `PW 24-109` Transit Center Interior with October 28, 2026 date. PlanetBids registration is required to obtain full bid documents and submit. The public list is **not** the legally complete solicitation.
- Existing source-backed dossier has official Notice Inviting Bids links for each, a Well 20 Addendum No.1 PDF reference, requirements for Class A or B prime, California DIR, prevailing wages, 10% bid security, post-award 100% performance & payment bonds and 5% retention. Do not compute an enforceable bid cutoff from a text-labeled PDT/PST mismatch for November 16; reconfirm exact clock in the PlanetBids owner account.
- Oxnard PDFs, revised drawings and every addendum were **not retrievable during this turn's web open**. Do not invent PDF SHA256 digests, drawing quantities, signed acknowledgments or permit scopes. Before paper bidding: capture original source URL, authenticated portal download, fetched timestamp, immutable byte digest, revision number, changed drawings, all amendments, buyer required forms and portal deadline.
- RUSD official live public list `https://webapps.riversideunified.org/apps/planholdersregistration/BidsSelect.aspx` visibly lists **BidID 626, RFQ 2026/27-11 Nutrition Services Vented Box Truck, November 4, 2026 10 a.m.** and several other projects. Detailed truck specifications are behind authentic buyer planholder enrollment and unavailable. Do not invent truck supplier prices or dealer approval. Other listed bids may be past due while status remains `Accepting Bids`; trust parsed dates and manual buyer reconfirmation, not a status label alone.
- Existing owner-only `GET/POST /api/opportunities/procurement/canaries` preserves no-send canonical packet behavior, requiring the full official docs and all 22 diligence gates.

## .22 — Regional prime qualification (source-aware, not forced)

Official portals for lawful **manual** research:
- CSLB current California contractor class/licensing lookup: https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx
- DIR active Public Works contractor registration search: https://www.dir.ca.gov/public-works/contractors.html
- Federal entity information/exclusions: https://sam.gov/entity-information

Existing Oxnard `PW 23-98` public bid tab contains **Best Drilling and Pump, Inc.** and **Weber Water Resources CA, LLC** as prior *bidders*, not presumed awarded incumbents. Historic listed specialty subs are separately noted. The current case requires Class A and subject-specific scope capacity, surety/insurance, subcontract structure, DIR, exclusions, project-specific written quote and explicit consent. No contractor license number or active DIR record was recovered and identity matched to the exact legal company during this turn. None were qualified, contacted, engaged, or added as confirmed current awardees.

Implemented 12-source-evidence qualification gates: legal identity, CSLB class/current license, DIR registration, exclusions, required trade scope, bonding, insurance/workers compensation, prevailing wages, capacity/geography, lawful prime/sub structure, signed current teaming consent and written scope-specific quote. Even 12/12 is a **human review** condition, not automatic partner onboarding or signing permission.

## .23 — Cost evidence, bonds, retention and cash

Implemented a 13-category evidence-only economics engine in Opportunity Core (direct labor, subcontract, materials/equipment, freight, tax/permits, insurance, performance/payment bond **premiums**, other bid fees, overhead, contingency, warranty, working-capital financing). Each requires nonnegative amounts plus actual valid evidence refs. No invented numbers are used for the real three pilot opportunities.

- **Bid security face** (e.g. 10% on Oxnard) is NOT the cash paid for the bid bond.
- **Performance and payment bond 100% face** is NOT the contractor's bond premium.
- **5% retainage** is cash paid later, NOT an expense subtracted twice from revenue.
- Gross contribution/margin remain `null` if any cost, firm quote, scope/amendment or owner cash bridge is missing. Even complete economics never authorizes bid/submission/spend.
- `GET /api/opportunities/procurement/activate` displays the unpriced and unqualified cases and links to manual agency checks. Review status is controlled by real records and is no-send.

## .24 — Bounded national batch rollout

Implemented `prioritizeNationalProcurementBatch` and deterministic tests. A 1–10 entry manual review batch defaults to **three**, sorting only documented official buyer notices by source/eligibility evidence and deadline state in the buyer's **local timezone** (prevents Nov PST/PDT hour mistakes). Selected items are research leads, not active feeders or bid-ready contracts. Batch returns `sourceJobsActivated=0`, no auto crawler, no outreach, no bid, no spending.

The first three research threads are:
1. Oxnard Well 20 Phase II — first Class A regional-prime and multidisciplinary scope/cost pilot, currently public-notice only.
2. Riverside Unified Vented Box Truck — supplier/dealer/upfitter and legitimate RFQ document eligibility pilot, currently public-list only.
3. Oxnard Transit Center Interior — time-constrained Class B / ADA public-works assessment, currently public-notice only.

Do not indiscriminately activate the whole `80,742` jurisdiction inventory; each source must pass a separate official ownership, access, parser, full bid packet and qualification gate. Review nationwide rollout as successive, source-provenanced small batches.

## Acceptance and preservation

**Code:** new pure source, provider, cost and batch modules and tests; protected live-record read-only route; clickable owner UI acceptance section. Registered in existing Opportunity Core test script, TypeScript exports and Local Gov targeted CI. **Do not assume CI success for any new commit until GitHub exact-head workflows finish.**

**Outside required evidence:** signed-in iPhone / Face ID taps; exact-head private preview; legal robots/access proof; three successful exact-parser worker trials; complete Oxnard/RUSD planholder docs/addenda with SHA256; legal entity-specific current license/DIR/exclusion matching; consenting primes/supplier written quotes; costed cash bridge; explicit human approval before any external contracting or spend.

**Unchanged:** existing repo architecture, canonical 22 bid diligence gates, owner authentication, private Vercel SSO, source licensing/activation controls, no-send commercial packet, Money Core, SHARK, wallet signing policy, production.
