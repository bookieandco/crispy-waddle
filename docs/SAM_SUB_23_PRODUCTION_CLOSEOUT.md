# SAM-SUB.23 — SAM Subcontractor Production Closeout

Date: 2026-09-20  
Repository: `bookieandco/crispy-waddle`  
Canonical domain owner: `packages/opportunity-core`

## Architectural result

The SAM subcontractor path now converges on one canonical flow:

`SAM.gov → Opportunity → Requirement Set → Fulfillment Provider Evidence → Provider Match → Fulfillment Plan → Commercial Gate → Engagement Readiness → Governed Outreach → Engagement Ledger → Negotiation → Contract Readiness → Contract Draft/Redlines → Commercial Reconciliation → Governed Pursuit Snapshot`

The app layer is transport/composition only. Opportunity Core owns domain truth.

Hard invariant: no discovery, score, NAICS match, provider match, outreach draft, provider response, provisional term, contract draft, or persisted pursuit state independently authorizes bid submission, outbound communication, contract execution, signature, or payment.

## Phase ledger

| Phase | Canonical result |
| --- | --- |
| SAM-SUB.1 | Audited repo/handoffs/history; established Opportunity Core as canonical and separated source-provider registry from fulfillment providers. |
| SAM-SUB.2 | Added evidence-backed `FulfillmentProvider` aggregate and per-opportunity engagement lifecycle. |
| SAM-SUB.3 | Added provider evidence graph with claim/evidence relationship auditing. |
| SAM-SUB.4 | Decomposed SAM opportunities into explicit/inferred requirements with unresolved debt instead of guessing. |
| SAM-SUB.5 | Added evidence-first provider matching; NAICS remains ranking intelligence, never qualification proof. |
| SAM-SUB.6 | Added deterministic direct/team fulfillment planning and provider shortlists. |
| SAM-SUB.7 | Added economics/deal-structure gate with margin/profit/compliance blockers. |
| SAM-SUB.8 | Added solicitation-specific engagement readiness and explicit human approval boundary. |
| SAM-SUB.9 | Added draft-only provider outreach and negotiation packets. |
| SAM-SUB.10 | Added distinct send authorization receipts and append-only engagement ledger; domain does not call messaging connectors itself. |
| SAM-SUB.11 | Added provider-response/negotiation state; provider claims remain asserted until separately reviewed. |
| SAM-SUB.12 | Added contract/subcontract readiness checks; passing allows drafting only. |
| SAM-SUB.13 | Added versioned contract draft/redline state with explicit review receipts. |
| SAM-SUB.14 | Re-runs commercial economics after negotiated pricing/scope; scope drift blocks until fulfillment is rebuilt. |
| SAM-SUB.15 | Added provider evidence freshness/credential expiry/capacity recency checks. |
| SAM-SUB.16 | Added deterministic identity resolution and award-history binding; ambiguity stays unresolved. |
| SAM-SUB.17 | Fused existing Staffing Core Career Passport data for workforce fulfillment without creating a SAM worker database. |
| SAM-SUB.18 | Added one governed pursuit projection across requirements through contract drafting. |
| SAM-SUB.19 | Added canonical app boundary; legacy app-local ranking/economics/provider modules are no longer the new orchestration path. |
| SAM-SUB.20 | Hardened SAM API input/transport and removed caller-controlled identity/raw upstream response leakage. |
| SAM-SUB.21 | Added versioned checksum-protected persistence contract plus durable Supabase snapshot storage and recovery runtime. |
| SAM-SUB.22 | Added golden cases for direct fulfillment, complementary providers, set-asides, clearance gaps, stale evidence, destructive counteroffers, and no-provider outcomes. |
| SAM-SUB.23 | Production audit repaired barrel/lockfile integration, provider-team semantics, prime-only socioeconomic coverage, SAM field-level provenance, authenticated route actor, CI blind spots, and trusted snapshot persistence. |

## SAM-SUB.23 repairs found during closeout

1. Repaired malformed Opportunity Core barrel export newlines.
2. Synced `pnpm-lock.yaml` after Staffing Core became an Opportunity Core dependency.
3. Added field-level SAM claims for NAICS, set-aside, place of performance, notice type, and solicitation number.
4. Separated provider-addressable requirements from orchestration requirements so a response deadline cannot make every provider unmatchable.
5. Allowed evidence-backed partial providers to participate in complementary teams while keeping providers with no substantive required contribution blocked.
6. Pinned socioeconomic/set-aside satisfaction to the lead/prime assignment; a subcontractor cannot silently satisfy prime eligibility.
7. Unknown assigned-provider costs now block commercial viability instead of being treated as zero-cost viable economics.
8. Negotiated scope drift now blocks commercial reconciliation until the fulfillment plan is rebuilt.
9. SAM route identity is derived from authenticated Supabase claims; caller-provided identity is not accepted.
10. Added durable SAM pursuit snapshots with schema version, revision, checksum, opportunity-scope integrity, and recovery validation.
11. Snapshot reads are RLS-scoped; snapshot writes use a server-only service-role RPC bound to a verified session user ID. Browser-authenticated clients are not granted the write RPC.
12. Restored the focused Opportunity web TypeScript config on the stacked branch and extended Opportunity Core CI to include the live SAM route, SAM pursuit migration, canonical SAM tests, and snapshot persistence/recovery tests.

## Safety / authority boundaries

The following remain false by construction until a separate governed execution layer is explicitly invoked:

- provider match → no send authority
- fulfillment plan → `engagementAuthorized: false`
- outreach packet → `sendAuthorized: false`
- provisional negotiated terms → no contract/signature authority
- contract readiness → drafting only
- contract draft → `executionAuthorized: false`, `signatureAuthorized: false`
- governed pursuit snapshot → `executionAuthorized: false`
- Staffing Core fusion → `placementAuthorized: false`

Commercial/legal eligibility is never inferred solely from NAICS, keywords, past awards, or a provider's own assertion.

## Durable persistence boundary

Table: `public.jhadina_sam_pursuit_snapshots`

- primary scope: `(user_id, opportunity_id)`
- foreign-keyed to the canonical opportunity row
- RLS read policy for the authenticated owner
- no authenticated write policy
- trusted service-role RPC for writes
- optimistic expected-revision enforcement
- revision increments exactly by one
- schema version must be supported
- governed pursuit opportunity ID must match snapshot opportunity ID
- stored pursuit cannot assert execution authorization
- application recovery re-computes and verifies the snapshot checksum before use

## CI audit

The initial SAM-SUB.23 CI failures were caused by an outdated workspace lockfile; that was repaired.

After that repair, repository-wide launch jobs advanced past dependency installation. The observed launch failure was in `@jhadina/intelligence-core` communication tests, not Opportunity Core. Separate Agent Runtime and PupsonStuff jobs also reported their own pre-existing type failures. Vercel reported a build-rate-limit status.

A dedicated `Opportunity Core CI` workflow is included on the final closeout branch and now covers:

- Opportunity Core type-check/tests
- focused Opportunity web-boundary type-check
- canonical SAM workflow/input tests
- SAM pursuit Supabase repository tests
- SAM pursuit recovery runtime tests
- live SAM route path changes
- SAM pursuit migration changes

SAM-SUB.23 should be considered source-complete only when that dedicated workflow is green on the final closeout PR.

## Deployment prerequisites

These are deployment/environment requirements, not missing domain behavior:

- apply the new Supabase migration
- configure `SAM_GOV_API_KEY`
- configure Supabase server auth and `SUPABASE_SERVICE_ROLE_KEY`
- preserve human review for solicitation-specific set-aside, subcontracting, flow-down, licensing, insurance/bonding, and signature authority
- wire an external communications connector only through the separate send-authorization/receipt boundary when desired

## Intentional non-goals

- no automatic bid submission
- no automatic provider contracting
- no automatic signature
- no automatic outreach from Opportunity Core
- no assumption that referral/success-fee/percentage structures are legally permissible
- no SAM-specific duplicate worker database
- no replacement of canonical Opportunity persistence with an external reference repository
