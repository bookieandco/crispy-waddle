# PROCURE.NATIONAL.CONTINUE.25–.28 — prime/dealer classification, cash bridge and time-aware research queue

**2026-10-22.** Existing Jhadina branch `sam-procurement-partner-docket-2026-10-22`, draft PR #1478. This change is **read-only project research and contract diligence**. No email, vendor outreach, signed quote, supplier order, login bypass, financial transfer, accepted planholder terms, bid, merge, or production activation was performed.

## .25 — Real California contracting differences

The City of Oxnard `PW 25-96` water well and `PW 24-109` transit interior bid notices describe **California public works construction**, including Class A or Class B contractor license, DIR registration, prevailing wages, payment/performance bonds and retainage. They should run the construction-prime path.

Riverside Unified `2026/27-11` is a **Nutrition Services Vented Box Truck** RFQ. The buyer's public list does not provide the complete RFQ. This could involve manufacturer/dealer registration, authorized resale, vehicle modifications, delivery and/or installation. It cannot safely be assumed exempt from construction/public works requirements **or** forced into a Class A public-works prime gate on title alone. `national-procurement-working-capital.ts` therefore models `goods_with_possible_installation`, retains official-classification and installation/prevailing-wage blockers, and considers a separate manufacturer-authorized distributor channel pending evidence. Never waive statutory obligations based on title alone.

DIR confirms public works contractors and subcontractors must register and comply with prevailing wage, apprenticeship and certified payroll requirements where the project is covered: https://www.dir.ca.gov/public-works/contractors.html. Current registration status needs direct legal entity/registration verification, not historical bidder aliases.

The new `assessRegionalPrimeChannel` outputs scope-specific checklists for public-works construction, goods, services, potential-installation/mixed scopes and unknown solicitations. Even every documented role check passing produces **manual human-review readiness**, never delegated purchase/subcontract/bid authority.

## .26 — Real working capital and no invented profitability

A contract can show nominal positive gross contribution but still fail because it needs up-front labor/materials, delayed invoice payment, retainage and surety capacity.

Added `assessPublicContractCashBridge`: requires a documented, ascending buyer payment/outflow schedule, real retainage release terms and source-backed unrestricted committed funds. Computes cumulative cash deficit **by period**, peak bridge needed and uncovered funding gap. Refuses negative amounts, invalid duplicate periods, empty proof refs and partial schedules. No cash-gap amount is claimed for real Oxnard or Riverside cases because signed buyer payment terms, actual contractor quoted costs, project draws and an authorized available-funds record do not exist in this review.

Synthetic regression only: $120,000 modeled peak deficit with $90,000 confirmed unrestricted funds leaves $30,000 additional bridge. These numbers are **not** a price, need or projection for a real government opportunity. No loan application, bank access, bond purchase or spending is authorized.

## .27 — Read-only national research queue, priority and evidence

Existing national core now:
- Uses the buyer's real local timezone to compare listed deadlines; does not invent a fixed UTC offset for California across DST.
- Prioritizes future listed deadlines **after** publisher and source confidence instead of alphabetically.
- Keeps the official buyer URL and project title attached to each selected case.
- Defaults to **three** review leads (hard maximum ten), so new jurisdiction/bid source records cannot trigger mass collection, outreach or submission.
- Adds Riverside Unified `2026/27-09` Nutrition Services Roof Restoration (public list November 9, 2026 10:00 Pacific) and `2026/27-12` Chemawa and Rivera Public Address System Replacement (November 10, 2026 10:30 Pacific), **as research-only list observations**, alongside Riverside truck and Oxnard public notices.
- Public official district source: https://webapps.riversideunified.org/apps/planholdersregistration/BidsSelect.aspx ; Official Oxnard public projects: https://www.oxnard.gov/finance/purchasing/public-project-bidding . Current listing is not proof documents remain complete or a bid will be accepted. Always recheck deadline and addenda in the buyer portal.
- Owner-only `GET /api/opportunities/procurement/activate` now returns distinct bidder structure and blank, fail-closed cash bridge assessments for each pilot plus the urgency-sorted national review batch. The procurement page shows them on iPhone if the authenticated preview is current.

## .28 — Verified source state and test/preview gates

Last checked project Supabase:
- Oxnard official source shows registry public official access approved but generic HTML parser trial **403** and **0 records**. Source-specific parser `oxnard-public-project-bids-v1` has no three accepted live trials. Remains adapter required / uncertified.
- Casitas shows registry public official access approved but **200, parse_succeeded=false, 0 bids**. Do not turn empty/malformed response into fabricated open bids; create approved empty-source support only with structural proof and authorized access.
- Riverside Unified source degraded / access pending, not a certified feed, although its public list is visible to web search. Planholder RFQ form PDFs and source robot terms remain independently gated.

Real authenticated owner iPhone Face ID/session, last deployed exact branch Vercel build, and all final current-head CI are separate proofs. No statement of complete end-to-end live vendor or bid operation is authorized from passing unit tests. The protected existing branch alias is:

https://crispy-waddle-jhadina-web-git-sam-cf6308-bookieandcos-projects.vercel.app/opportunity/procurement

## Next commission blockers
1. Verify current exact GitHub head CI, deploy that SHA to protected Vercel preview (no added paid resources), then obtain owner Safari acceptance of navigation, session continuity, next-three queue, 403 evidence and cash warnings.
2. Obtain lawfully authorized source-access/robots and terms receipts; remediate Oxnard 403 without evasion and run three independent proper-parser captures. Handle Casitas no-bid semantics separately; do not activate inferences.
3. Obtain legitimate Oxnard PlanetBids and Riverside Unified full bid packet/addenda/technical schedules through human access; record file digests and buyer deadline clock.
4. Check CSLB/DIR license or verified supplier/dealer registration against the **specific legal entity** and actual solicitation, plus exclusions, surety, insurance, capacity and verified subcontract/reseller permission.
5. Receive actual written supplier/prime quotes and official cashflow terms, then rerun commercial/cash-bridge proofs. Only user approval can authorize vendor contact, bidding, signing, deployment promotion or purchases.

**No status escalation:** official publisher found ≠ active source ≠ complete bid set ≠ licensed consenting prime ≠ written quote ≠ funded positive margin ≠ approved submission.
