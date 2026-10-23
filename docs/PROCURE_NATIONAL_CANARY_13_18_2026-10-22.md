# PROCURE.NATIONAL.CANARY.13–.18 — official-source and regional-prime commissioning packet

**Date:** October 22, 2026. **Repository:** `bookieandco/crispy-waddle`. **Existing branch:** `sam-procurement-partner-docket-2026-10-22`. **Draft PR:** #1478. **Safety:** no payments, contact, bid submission, signing, merge, production release or unapproved live source crawling.

## Decision
**Approve code-only pilot for continued review. Do not approve production, live adapters, solicitation submission or supplier communications.**
This sequence creates an evidence-based Oxnard public notice docket using the existing Jhadina Opportunity Core, retains Riverside and Casitas sources under access review, and exposes historically evidenced regional-prime research leads distinct from award/qualification records.

## .13 — CI reconciliation
- Previous exact head `77480783930b080f0b5ae34f28df7f4e0f5095b6` completed with **five green checks**: Opportunity Core CI, Local Gov Production Targeted Tests, Jhadina Web Deploy Conformance, Jhadina Private Mobile Browser QA, and Jhadina Launch Gate.
- Current new source dossier head must be checked separately after this commit. A green source-only run is not owner iPhone session verification, accepted portal terms or a deployment.
- Existing PR draft and main untouched; original Vercel private preview is an earlier commit, not evidence this version runs on the hosted URL.

## .14 — Official sources, access and shadow gate
1. `public-source:city:0654652:oxnard-official-public-project-bids-20261022` — official City of Oxnard projects list, official publisher verified; `adapter_required`, `access_review_status=pending`, no certified adapter or recorded trial.
2. `public-source:special_district:census:143313:casitas-official-business-bids-20261022` — official Casitas Municipal Water District bidding page; says no active public works bids/RFPs; `adapter_required`, access pending, **zero asserted open opportunities**.
3. `public-source:school_district:unified:0633150:rusd-official-bids-20261022` — RUSD district official bid list; historically degraded; active adapter still NOT certified and planholder RFQ PDF unavailable.

Oxnard's source now uses `public-oxnard-bids-adapter.ts` under existing read-only shadow acceptance and an exact owner URL/id/HTML allowlist. Parser rejects expired, canceled, duplicate and invalid-date rows and recognizes public-project prefixes PW/SD/**FD** (the live site includes an FD fire-systems project). Only the existing robots/access, stable ID, repeat trial and certification checks can authorize ingestion; this commit does not toggle those gates.

**Access barrier:** both buyer `robots.txt` URLs were attempted via the available runtime but failed DNS resolution; available public-search pages do not prove crawler permission. **Zero new authorized live HTTP source trials, no automated PlanetBids or planholder login.** Three independent successful, lawfully accessed source trials with normalized IDs, deadline handling, addendum handling and closed-bid suppression remain a blocking commissioning condition.

## .15 — Real Oxnard public notices and addenda
- **PW 25-96 — Well 20 Rehabilitation Project Phase II**, City of Oxnard, Ventura County. Official notice: https://www.oxnard.gov/wp-content/uploads/pdfs/departments/finance/nib-pw-25-96.pdf. Publicly listed deadline **November 16, 2026, 2:00 p.m. local Pacific clock**, PlanetBids only. Public notice scope: pump and aboveground piping replacement with mechanical/electrical work, installation and commissioning at Water Campus. **Class A** contractor license, California DIR registration and prevailing wage, 10% bid security delivered physically to the City Clerk by bid deadline, performance and payment bonds each 100% after award, 5% retainage, 325 working days, $250/day liquidated damages. Do not compute bid price from that public notice.
- **Addendum No. 1** dated October 14, 2026: https://www.oxnard.gov/wp-content/uploads/pdfs/departments/finance/signed-addendum-no-1-pw-25-96.pdf. Requires replacing the original drawings with resized drawings and acknowledgment inside PlanetBids. Those replacement drawings, subsequent addenda and full bid schedule are **not independently verified**. The PDF labels November 16 as PDT even though civil time in California is PST by then: verify the submission portal's actual deadline clock before relying on the label. No acknowledgment was made.
- **PW 24-109 — John C. Zaragoza Oxnard Transit Center Improvements (Interior)**. Notice: https://www.oxnard.gov/wp-content/uploads/pdfs/departments/finance/pw-24-109-john-zaragoza-otc-improvements.pdf. Publicly listed deadline **October 28, 2026, 2 p.m. Pacific**; ADA interior improvements, **Class B**, DIR registration and prevailing wage, 10% physical bid security, 100% performance/payment bonds, 5% retainage, 125 working days and $2,000/day liquidated damages, with California AHSC program obligations. Full buyer forms, grant terms and scope remain unverified.
- **RUSD 2026/27-11 — Nutrition Services Vented Box Truck**, official public bid list https://webapps.riversideunified.org/apps/planholdersregistration/BidsSelect.aspx. Deadline **November 4, 2026, 10 a.m. Pacific**; detailed vehicle specifications and mandatory planholder documents still not available. No legal bidder/authorized dealer, fit, vendor price or supplier consent verified.
- The City of Oxnard purchasing website links PlanetBids https://vendors.planetbids.com/portal/69575/portal-home and requires vendor registration for actual bid documents/submission. No portal login, bid submission or acceptance of portal terms was performed.

The owner-only route `GET/POST /api/opportunities/procurement/canaries` presents two source-attributed NIB dossiers and bridges each to canonical `reconcileProcurementNotice(...,[])`, `reviewProcurementCommercial` and `prepareProcurementBidPacket`. The documents remain **public notice summaries**, never falsely imported as the complete official contract document set. Every response keeps `contactAuthorized=false`, `submissionAuthorized=false`, `spendingAuthorized=false`, no price or qualified vendor.

## .16 — Regional primes: real research evidence, not phantom awards
Earlier **City of Oxnard PW 23-98 — Well 20 Rehabilitation Project**, bid opening **May 25, 2023**, official bid tab https://www.oxnard.gov/wp-content/uploads/Bid-Tabulation-PW-23-98.pdf. It names:
- Historical bidders: **Best Drilling and Pump, Inc.** (Colton, CA) and **Weber Water Resources CA, LLC** (Jurupa, CA). Both in the prior project's bid tab, **not asserted winner/incumbent, licensed/current Class A prime, available, bonded, willing to partner, or quoted for Phase II**.
- Historical listed subcontractors: Pacific Surveys, LLC; Longmire Swaging, Inc.; Hydropressure Cleaning, Inc./Welljet; Total Barricade Services, Inc.; Victory Well Surveys.
- The city document explicitly warns it is a **bid tabulation, not an offer of award or contract**. Its $540,540 and $578,999.99 historical verified bids do **not** price the 2026 Phase II scope and are not expected contract value.

This data remains in a separately labeled `historicalBidTab` block in the Oxnard dossier and iPhone UI. It is deliberately **not inserted into** `jhadina_public_prime_profiles` (that registry is for past award evidence) and does **not** grant outreach authority. Existing `/api/opportunities/procurement/primes` takes `canaryId` and returns a no-send match based only on persisted *award-backed* regional prime profiles. If there are no such CA profiles, UI must display the gap. Independently verify CSLB class, DIR status, bonding, insurance, registration, trade scope, capacity, regional service, exclusion lists, bidder rules and actual scope-specific consent before any real teaming step.

## .17 — Private iPhone and preview release gate
- Previous **CI mobile browser QA** passed, but this is not a logged-in Face ID/private iPhone walkthrough.
- New exact-head preview creation was previously refused with `402 api-deployments-free-per-day`. Do not pay/upgrade or release to production for convenience. The private preview URL from prior commit must not be labeled latest canary.
- Latest iPhone acceptance checklist: owner login/Face ID; Opportunity → Government & School Procurement; state selector; official source directory; public NIB PDF links; addendum links; 'Generate blocked no-send packet'; regional prime research; empty CA awards shown honestly; back navigation, reload, no secrets, no payments, no unexpected redirect and no false live bid statuses.
- No unattended signed-in owner iPhone session was available in this run, so **real device acceptance remains unverified**.

## .18 — Release packet and next action
- The nationwide registry already inventories **80,742** state/local/public units, with **3,757** having at least one recorded source and **3,688** having a verified official source after the two earlier additions; only **60** distinct jurisdictions have active, access-reviewed certified read-only adapters (verified live Supabase rollup). This is not all jurisdictions or a nationwide contract feed.
- Oxnard/RUSD: get legitimate public+portal bid package, all addenda, RFQ acceptance rules, legal contractor qualifications; record source PDF versions/digests and independent authorized structural tests before any activation.
- Regional prime evidence: start from officially sourced Well 20 historical bidders/subs, not an invented successful 2023 award. Only separately consented outreach could obtain current Class A/Class B qualifications and written pricing.
- Continue in small scope with three independent robots-cleared HTTP shadow tests; inspect duplicates/expiry/addenda; then a separately approved private preview and genuine iPhone QA.
- PR stays draft/unmerged, no main changes, no activation, no paid Vercel upgrade, no communications, quotes requested, contracts, submissions or spending.

### Acceptance semantics
**Code complete** requires exact-head CI all green. **Source registered** requires a verified official buyer link, not open bids. **Source certified** additionally requires approved access and repeated live parser evidence. **Bid-ready** requires full official solicitation, scope, amendments, licensing, bonding, actual consenting and quoted prime/provider, cash flow, legal bidder role and explicit owner approval. No weaker condition implies the stronger one.
