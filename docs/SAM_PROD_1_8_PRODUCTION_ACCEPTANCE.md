# SAM-PROD.1–8 Production Acceptance

Date: 2026-09-20

## Result

SAM-SUB.1–23 is the canonical domain foundation. SAM-PROD.1–8 moves that foundation through convergence, durable deployment, live-source readiness, drill certification, provider discovery, operator controls, communications isolation, and production acceptance.

The system remains decision-support plus governed preparation. It does not automatically contact providers, submit bids, sign contracts, or spend money.

## SAM-PROD.1 — Merge/convergence audit

PASS.

- `@jhadina/opportunity-core` remains the domain owner.
- The authenticated SAM route on current main canonicalizes and persists SAM results rather than returning upstream data as the domain model.
- Legacy app modules are explicitly catalogued by `LEGACY_SAM_MODULES`; they are not the new domain owner.
- The final SAM-SUB verification gate passed Opportunity Core CI before production activation work began.

## SAM-PROD.2 — Database deployment verification

PASS on the connected Jhadina/SWLC Supabase project.

Applied:
- `sam_pursuit_snapshots`
- `harden_sam_pursuit_snapshot_rpc`
- `harden_sam_pursuit_snapshot_table_privileges`

Verified:
- snapshot table exists with RLS enabled;
- authenticated read policy is owner-scoped with `auth.uid() = user_id`;
- authenticated/anon direct INSERT/UPDATE/DELETE privileges are revoked;
- trusted save RPC is not executable by anon or authenticated;
- service role alone has trusted RPC execution;
- optimistic revisions and contract-opportunity foreign-key scope remain enforced;
- stored pursuit state cannot assert execution authorization.

The Supabase security advisor no longer reports the SAM trusted RPC as anon/authenticated executable. Remaining advisor findings belong to other repository subsystems.

## SAM-PROD.3 — Live SAM.gov ingestion readiness

PASS for production binding; environment-dependent live call remains deployment-observed.

The live route:
- derives actor identity from verified Supabase claims;
- accepts only the allowlisted SAM search parameters;
- bounds limit/offset;
- validates SAM date/token inputs;
- keeps the API key server-side;
- disables caching;
- maps upstream failures to a generic public error;
- canonicalizes upstream records before persistence.

A real SAM request requires the deployed `SAM_GOV_API_KEY`; source code and CI do not expose or fabricate it.

## SAM-PROD.4 — End-to-end drill

PASS in non-destructive certification.

The SAM golden/integration suite exercises:
- direct fulfillment;
- complementary-provider fulfillment;
- set-aside/prime eligibility;
- clearance gaps;
- stale evidence;
- commercially destructive counteroffers;
- no-provider outcomes;
- pursuit snapshot recovery/tamper rejection.

No real provider communication or bid submission is part of the drill.

## SAM-PROD.5 — Provider discovery adapters

PASS.

Added canonical `ProviderDiscoveryAdapter` and `ProviderDiscoveryObservation` contracts for:
- entity directory;
- award history;
- workforce;
- local business;
- web search;
- manual evidence.

Discovery output is deliberately `DISCOVERY_ONLY`, creates unverified providers, binds observations to evidence, fails soft per source, and cannot authorize engagement. Identity resolution, verification, freshness, matching and human gates remain downstream.

## SAM-PROD.6 — Human-control UI

PASS at the existing Opportunity Command Center boundary.

The Opportunity UI already states that research approval never applies for a job, spends money, contacts a claimant, submits a bid, or publishes a listing. SAM pursuit state is represented by the canonical governed pursuit projection with explicit blockers, stage status and remaining human gates.

Production rule: UI actions may request governed transitions; UI state is never authority by itself.

## SAM-PROD.7 — Communications execution boundary

PASS as a governed boundary; no transport connector is intentionally activated.

Existing engagement ledger requires:
- a draft-only outreach packet;
- a distinct send approval from draft approval;
- provider/opportunity/packet binding;
- destination/channel/approver references;
- optional expiry;
- recorded authorization before a send receipt;
- single-send consumption;
- external message receipt before a provider response can be attached.

`contractAuthority` remains false. Opportunity Core itself does not send email/SMS/portal messages.

## SAM-PROD.8 — Production acceptance

PASS WITH DEPLOYMENT OBSERVABILITY REQUIREMENTS.

Acceptance invariants:
- discovery != verification;
- NAICS similarity != eligibility;
- provider assertion != verified evidence;
- team coverage cannot move prime-only eligibility to a subcontractor;
- unknown provider cost blocks commercial viability;
- stale/expired evidence blocks contracting where required;
- scope drift requires fulfillment/commercial reconciliation;
- outreach drafting != send authorization;
- send authorization != contract authority;
- contract readiness != signature authority;
- persisted pursuit state cannot assert execution authority.

### Production environment requirements

The deployed Jhadina environment must provide:
- `SAM_GOV_API_KEY`;
- Supabase server auth configuration;
- `SUPABASE_SERVICE_ROLE_KEY` on server only.

Live operational monitoring should alert on:
- SAM upstream failures/rate limiting;
- snapshot revision conflicts;
- checksum/integrity failures;
- stale provider evidence;
- blocked commercial/compliance gates;
- attempted use of expired/revoked send authorization.

## Final production boundary

Canonical path:

`SAM.gov → canonical Opportunity → requirements → provider discovery/evidence → identity/awards/freshness → matching → fulfillment → economics → compliance → human approval → draft outreach → separate send authorization/receipt → negotiation → contract readiness/draft → reconciliation → governed pursuit snapshot`

The terminal authority state remains human-controlled. SAM-PROD.8 does not add automatic bid submission, provider contracting, signature, payment, or outbound messaging.
