# SAM-PRIME-FINDER.RECOVER.01–.08 — source-only implementation and live acceptance handoff

Date: 2026-10-22 (America/Los_Angeles)
Repository: bookieandco/crispy-waddle
Base main at implementation start: f33cb98ccabef52bd8c1701b912ada92a1d9dc20
Branch: fix/sam-prime-finder-recover-01-08-20261022

## Purpose

Preserve the existing SAM / Opportunity Core / public-gov source / Provider Graph /
Relationship Core / Side Hustle procurement architecture and improve real prime
contractor discovery, work-package matching, commercial readiness, and evidence-only
certification. Never equate discovered firms or legacy awards with current invitations
to subcontract. Never infer eligibility from a NAICS hit, a state match or a historic win.

## Verified production baseline (read-only SQL, Oct 22, 2026)

- Connected Jhadina Postgres answered SQL and reported pg_is_in_recovery() = false.
- Federal SAM catalog: 84,812 stored notices; 39 scan runs.
- Latest six inspected federal backfill runs: failed while persisting catalog,
  error string `sam_runtime_gateway_failed`. The exact lower-level cause is NOT
  proven; the gateway's 5 MB request cap and 250-row raw notice writes expose a
  plausible payload-size failure mode.
- Local-government procurement source registry: 26,585 sources; 61 active,
  25,532 degraded, 554 adapter-required, 438 disabled. Certified-source and
  observed-prime coverage are not interchangeable.
- Public award ledger: 12 awards and 12 prime profiles, all from the Chandler,
  Arizona awards page. Awards are mainly dated 2023–2024 and have no recorded
  dollar values or verified awardee refs. One line names multiple vendors.
- Work packages: 12, all review_required for missing decomposition.
- Provider candidates: 46, all review_required, score 45; no verified availability.
- SBA SUBNet catalog: 0; scan receipts: 0.
- Relationship CRM: no persisted prime↔subcontractor edges or prime identities
  were found. Existing relationship entities and other pipeline records do exist.
- The public prime coverage snapshot reported PARTIAL.
- These counts are historical snapshots, NOT live pilot acceptance.

## Source changes per recovery target

### .01 — Federal gateway

- Keep the existing narrow GitHub OIDC SAM runtime gateway and Vercel upstream.
- Return bounded safe gateway error reasons in the client, not request payloads
  or secrets.
- Reuse one canonical notice persistence path for API and bulk scans.
- Partition catalog and version writes by UTF-8 byte size AND row count below
  the gateway hard limit. Reject a single oversize record explicitly rather than
  silently dropping or truncating official evidence.
- Add regression tests for multi-byte payloads and oversize records.
- Verification pending: a production GitHub Actions backfill that finishes and
  persists all attempted records with no 502, partial write or duplicate version.

### .02 — SBA SUBNet

- Preserve canonical SUBNet scraper, catalog, scan receipts and UI.
- Admit scoped production scheduler OIDC to the existing scan route while
  retaining the current protected cron secret path.
- Add scheduled 3-hour SUBNet scan `sam-prime-subnet-scan` to the existing
  Jhadina production scheduler; no separate paid crawler or new agent.
- Ensure the UI selects open deadlines before applying the result limit.
- Verification pending: one completed scan receipt, raw official SBA source links,
  non-expired listings, deduplication and a current deadline.

### .03 — Prime identity

- Correct previously malformed regular expressions: actual backspace characters
  in company suffix recognition and `/s+/g` collapsing literal s rather than
  whitespace.
- Defer synthetic prime ID creation when an awardee line contains distinct
  firms, unless an explicit trusted awardee ref disambiguates it.
- Add canonical identity and compound award regression tests.
- Existing ambiguous stored profiles have NOT been deleted or rewritten.
  They remain subjects for controlled reconciliation.

### .04 — Local/federal source coverage

- Keep existing state, county, city, school district, special district,
  university, hospital and authority coverage taxonomy.
- Prevent a FULL coverage assessment based merely on discovered verified
  sources/adapters: full observation also requires actual award and prime evidence.
- Explicitly report prime observation debt for each jurisdiction level.
- Exclude ambiguous name-only multiple-awardee rows from distinct-prime counts.
- Verification pending: prioritize known working official sources, commission
  representative school/local adapters and record fresh production scans.

### .05 — Qualification and matching

- Keep the canonical Broker provider scorer and existing geographic/freshness
  evidence contributions.
- A candidate cannot be promoted to `matched_candidate` just from a high
  aggregate score: require `capacity=available`, evidenced geographical overlap,
  unblocked scope, substantive Broker candidate status and score threshold.
- Regress unknown capacity and unavailable capacity. Current provider candidates
  have capacity=unknown and therefore must remain review-only.
- Verification pending: separately sourced, time-bounded provider availability
  and trade credential evidence. Do NOT write fake capacity to make the pilot green.

### .06 — Commercial pursuit readiness

- Compose existing canonical `evaluateCommercialDeal` and
  `evaluateSamSubcontractability`, rather than cloning fulfillment, economics
  or compliance engines.
- Require verified prime subcontracting invitation, work package, qualified
  provider, credential evidence, priced provider costs and legal/solicitation
  conditions before declaring ready_for_human_review.
- Unknown costs are NOT modeled as commercially viable.
- No automatic quote, bid, signature, payment or external contact permission.

### .07 — CRM / governed outreach

- Keep Relationship Core's existing prime and subcontractor lanes.
- Do not resolve a synthetic prime from an ambiguous multi-awardee company line.
- Do not move review-only primes into the qualified stage.
- Preserve analysis-only relationship edges and existing human-controlled outreach,
  response, quote and award lifecycle boundaries.
- Verification pending: real canonical external identities, three source-backed
  related prime/provider edge receipts and individually approved engagement actions.

### .08 — Pilot acceptance

- Add a pure fail-closed `certifyPrimeFinderPilot` contract and regression tests.
- Add authenticated, read-only
  `GET /api/opportunities/prime-finder/acceptance` with counts derived from the
  canonical SAM, SUBNet, local-source, prime and Relationship Core tables.
- Require latest successful SAM scan; nonempty SUBNet scan and listings;
  certified local adapter; 3 verified primes; 3 qualified packages/provider
  matches; 3 persisted CRM edges; 3 source-backed pilot pairs; one evidenced
  commercial outcome; and evidence of no unauthorized outreach.
- Unknown outbound audit and unobserved commercial economics remain blockers.
- Add GitHub source-only CI with procurement, identity, matching, CRM, SUBNet,
  gateway byte-limit and type checks. It performs no live scanning or outreach.

## Explicit outstanding acceptance gates

1. Source branch tests and type-check must execute green on the exact head.
2. Before any deployment, verify release/approval boundary and exact-head CI.
3. After separately approved deployment, read federal gateway diagnostics,
   rerun a bounded SAM backfill and reconcile scan receipts, byte size and counts.
4. Run SUBNet authenticated scanner, corroborate at least three official active
   entries and their deadlines. A published source does not equal an authorized
   business contact.
5. Verify named awardee identities and local/school buyer coverage before CRM
   promotions. Leave ambiguous legacy profiles pending review.
6. Obtain directly evidenced subcontractor service area, current capacity,
   credentials, pricing and prime invitation; rerun matching and commercial gate.
7. Record three real prime/work package/qualified provider relationships.
8. Perform only individually authorized contact/quote/contract actions; reconcile
   the actual outcome and audit no unauthorized actions before lifting pilot block.

## Safety and operating boundaries

This branch is source code only. No main merge, production deployment, live
database mutation, billable infrastructure, external contact, bid, signature,
wallet signing, purchase or money movement is authorized by this sequence.
CI is not a substitute for runtime evidence. User-facing labels should
distinguish OFFLINE_CODE_READY from LIVE_CERTIFIED and display blockers.

The existing official SBA SUBNet list is
https://legacy.sba.gov/federal-contracting/contracting-guide/prime-subcontracting/subcontracting-opportunities .
It offers time-sensitive public notices, including transportation, utilities
and Job Corps procurement; each posting requires individual source verification.

## Developer verification

- Run `pnpm install --frozen-lockfile`.
- Run the focused suite defined in
  `.github/workflows/sam-prime-finder-recovery-ci.yml`.
- Check exact branch SHA and PR CI before any merge.
- Check the authenticated read-only acceptance endpoint after any approved
  deployment. Its expected pre-certification result is BLOCKED until real
  conditions above are satisfied.
