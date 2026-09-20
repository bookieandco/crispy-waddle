# OPP-AUDIT Production Acceptance Receipt

## Scope

This receipt records the production acceptance work performed after PR #316 merged. No external Opportunity execution was triggered. All runtime tests were database-only and transactional.

## Production schema reconciliation

The connected Supabase project contained an older, incompatible `public.jhadina_opportunities` schema. It was verified to contain zero rows and to have no inbound foreign keys or non-internal triggers.

The empty legacy table was archived as:

`public.jhadina_opportunities_legacy_20260828`

Client-role privileges were revoked from the archive. The canonical Opportunity table was then created from the PR #310 schema and the OPP-AUDIT forward migration was applied.

Production migration history is aligned to:

- `20260920030000_jhadina_canonical_opportunities`
- `20260920033000_opportunity_pursuit_outcome`
- `20260920133625_reconcile_legacy_opportunity_table`
- `20260920134244_fix_opportunity_outcome_type_column`

## Runtime issue found and repaired

Transactional runtime acceptance found that both outcome RPCs referenced `v_existing.type`, while the canonical table column is `opportunity_type`.

The source migration was corrected and production received the forward patch `20260920134244_fix_opportunity_outcome_type_column`.

## Runtime acceptance

### Authenticated lifecycle

Passed:

`ingest → triage → start research → complete all required evidence tasks → promote ready → record user outcome`

Verified:

- canonical status closed as `won`
- research case remained evidence-complete
- all required employment research tasks completed
- one outcome receipt persisted inside the test transaction
- expected outbox lineage was created
- caller-supplied forged learning payload was ignored
- realized profit and derived learning were generated from validated receipt data

### Recovery lifecycle

Passed:

`ingest recovery → research → complete recovery tasks → public ready blocked → trusted verification → service-only ready → trusted OverageOS outcome`

Verified:

- general authenticated ready promotion was rejected for recovery
- verification decision was bound to the exact canonical Opportunity ID
- source record, property reference, claimant identity, and entitlement checks were all required with evidence
- trusted ready promotion succeeded only through the service-role RPC
- trusted outcome source owner remained `overageos`
- caller-supplied learning payload was ignored

### Cross-user isolation

Passed:

- user B could not see user A's Opportunity through RLS
- user B could not mutate user A's Opportunity through the authenticated `SECURITY DEFINER` RPC boundary

All synthetic auth users and test rows were rolled back. Post-test counts confirmed zero synthetic auth users and zero smoke Opportunity rows.

## Access-control verification

Live verification confirmed:

- RLS enabled on all canonical Opportunity tables
- `anon`: no table access, no Opportunity RPC execution
- `authenticated`: SELECT-only table access
- `authenticated`: execute only on the six intended user RPCs
- `service_role`: trusted recovery/outcome RPC execution
- direct authenticated INSERT/UPDATE/DELETE blocked
- archived legacy table unavailable to anon/authenticated

Supabase Security Advisor reports the six authenticated write RPCs as `SECURITY DEFINER` warnings. This is intentional for the current architecture because they are narrow validated mutation boundaries behind explicit execute grants and `auth.uid()` ownership checks. A future redesign may move mutation behind a non-exposed service boundary.

## External security finding

Outside Opportunity scope, Supabase Security Advisor reports that:

`public.jhadina_research_source_performance_policy`

has RLS disabled. This should be handled by the owning subsystem after its intended read/write policy is defined; enabling RLS without the matching policies could break existing access.

## Result

OPP-AUDIT.1–6 is production-applied and runtime-accepted. Remaining Opportunity follow-ons are external-provider integrations and future hardening, not canonical architecture or persistence blockers.
