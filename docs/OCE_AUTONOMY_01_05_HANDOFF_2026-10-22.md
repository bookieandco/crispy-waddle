# OCE-AUTONOMY.01–.05 — source implementation and evidence-gated handoff
Date: 2026-10-22 (America/Los_Angeles)
Canonical repository: bookieandco/crispy-waddle
Baseline main: 04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61
Branch: feat/oce-autonomy-01-05-20261022
Scope: source-only; deployment, new credentials, Supabase mutations, outreach, job applications, publishing, commercial commitments and payments are not part of this PR.

## .01 Reconciling existing work

| PR | Exact observed head | Current conclusion |
|---|---|---|
| #977 Opportunity Factory FINAL | 53b8760772b964ef60713f5ad080284c00ba1cd2 | Open; source-derived live collector, not to be duplicated |
| #1313 Side Hustle Portfolio FINAL | 67a017371b82dc4910617fafac4799bd7b7b6599 | Open/nonmergeable; independent audit/receipt chain should be selectively recovered later |
| #1449 SAM Recovery 01 | b2cbc3e32ac0419365432c4b6b6a49f74a54f866 | Open draft; bounded gateway write batches |
| #1452 SAM Recovery 02 | 5a36732f37b19274bcb963ef3e2a0f22809d3e86 | Open draft stacked on #1449; version/history repair |
| #1454 SAM Recovery 03 | 48df6db83838679861643508f2bfe6c46900d126 | Open draft stacked on #1452; attachment provenance |

This branch does not cherry-pick or merge the above changes; their external acceptance is distinct. Validate exact-head CI, rebase or selectively recover without a competing Opportunity/SAM authority.

## .02 Canonical intake
- Existing POST /api/opportunities, canonical queue and owner-authenticated Supabase repository are preserved.
- Existing production RPC public.jhadina_opportunity_ingest was inspected read-only: it binds auth.uid, stable (user_id,id), requires status=discovered/source provenance, preserves previous lifecycle/triage and strips caller-supplied verification authority.
- New public-board API upserts source-backed jobs via that exact existing canonical repository and exposes IDs through the existing Opportunity UI after refresh.
- No migration or new table. Owner-triggered and at most 25 jobs per request. Production upsert + restart persistence is NOT newly canary-tested.

## .03 Public discovery
- Greenhouse Job Board API GET: documented unauthenticated public listing endpoint.
- Lever Postings API GET: documented public published listing endpoint.
- Fixed provider hosts, strict company board token, GET-only, no redirects, bounded list, HTTPS outbound listing URL validation, explicit source/time and stable external IDs.
- Uses the existing provider:placement-jobs normalization boundary, retains contract_only readiness pending real provider acceptance.
- Other client-demand prospecting remains in existing Growth/Prospects, public procurement, SAM/SUBNet and Venture lanes. No claim this PR commissioned live independent client discovery or any application/submission.
- No automated search or employer-eligibility certification. Remote detection is title/location inference, not legal work eligibility.

## .04 Capability truth
- New evidence-gated assessAutonomyCapability requires actual tested executor evidence, allowed provider terms and attributable source references for an internal-draft-ready decision.
- Job applications and external deliveries always require separate policy/Action Core approval and are never authorized by a classification.
- Existing web-facing ai_can_do_it display labels are conservatively downgraded to ai_plus_user absent independent runtime certification. Underlying proposals remain preserved in canonical metadata.

## .05 Three internal service pilots
- Research report -> existing research_services template.
- Qualified leads -> existing lead_generation_growth template.
- SEO/site audit -> existing ai_discovery_seo template.
- Authenticated UI/API previews supply attributed observations, structured document, existing scope and acceptance checklist, deterministic QA checks and source links.
- Result is deliberately NOT a commercial delivery, customer acceptance, work order or payment. Actual client engagements remain owned by the existing side-hustle-commercial-runtime with customer, price, evidence, work order and governed delivery receipts. No manufactured customer or revenue.
- Current phase prepares pilots for owner inspection; durable versioned client deliverables and real acceptance are external future certification, not represented as done.

## Tests / acceptance
- Domain regression: autonomous authority denial, prohibited use, missing evidence, three draft QA paths, duplicates, unsafe URLs, future evidence.
- Web regression: two documented public feed formats, canonical IDs, provenance, input validation, SSRF rejection, provider errors and oversize-response declaration.
- Test commands added to existing @jhadina/opportunity-core test and Opportunity Core CI web boundary suite.
- CI is only verified by its exact PR HEAD results; never by file creation or unrelated green checks.

## Next operational gates
1. Exact-head CI/typecheck and independent review. Preserve prior unmerged PRs.
2. Owner-authenticated iPhone canary using a real authorized public board token; verify ingestion receipts, deduplication, re-query and restart persistence without changing triage.
3. Confirm real provider usage conditions and job location eligibility. Never submit applications as AI without employer authorization.
4. Use actual sourced observations for each of three pilot drafts; separately validate the governing commercial delivery runtime before claims of paid autonomy.
5. Reconcile SAM gateway history/document repair chain under separate approval and live scan admission.
