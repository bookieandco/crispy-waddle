# SOCIAL-CORE.RECOVER.08 — current-main reconciliation and release gates

Date: 2026-10-21
Consolidated draft PR: #1440
Based on main at `8e3ffebfed8ad6dd1707436173c97b6e682ed480`
Original cumulative recovery head: `aa0324618b867649b95d489a6af2e0559f8072e3`
Two-parent integration commit: `06f9c913d9c94ed2ef34a6f92bd57cd3052d8a57`
Parent draft PRs: #1430 → #1436 → #1438 → #1439.

## Reconciliation complete as staging source

Compared all changed paths from the original recovery ancestor
`b1b9c277748f5f88f8dd6df50d6cbeeb6c7902b8` to the current main and
cumulative recovery head. Main changed 28 Sports Lab paths; recovery changed
32 Social paths. **0 overlapping paths.** The current-main integration
tree overlays the exact 32 cumulative recovery blob SHAs onto main's tree,
preserving both histories and not altering main. It creates one draft
review target instead of merging four stale branches directly.

Do not confuse a source reconciliation commit with a production merge,
migration, OAuth grant, deployed app, working account login, or live post.

## Security discovery — Social audit ledger is not authoritative yet

Read-only inspection of live project `kqbkaozfjubkjevdfvic` found the
public `append_jhadina_audit_event(text,text,uuid,text,text,text,text,
timestamptz,jsonb)` SECURITY DEFINER function executable by
`authenticated`, with only `auth.uid()=p_actor_id` enforced on ordinary
clients. An authenticated owner could therefore append their own
`domain='social', decision='allow', status='completed'` audit event
without a verified Social service decision. A hash-chain proves
append-only integrity, **not trustworthy provenance**.

Implemented in source:
- `apps/jhadina-web/src/lib/social/durable-audit-ledger.ts` refuses Social
  appends when the same protected RPC commissioning flag is false, verifies
  exact request identity and actor ID, and invokes audit writes only with a
  privileged runtime client. Owner-scoped list calls continue with ordinary
  session credentials.
- `supabase/proposals/social_core_recover_08_audit_domain_UNAPPLIED.sql`
  stages a narrowly scoped live-function override: only `domain='social'`
  requires service-role claims. Other domains retain existing semantics.
  The proposal is guarded against the **exact read-only live function checksum**
  `148e77452cbab6a05e6bc8479a1f3d64`. A changed definition fails closed
  instead of overwriting unreviewed SQL. **Not applied; not a migration.**
- `durable-audit-ledger.test.ts` and `social-audit-authority-contract.py`
  cover fail-closed, actor mismatch, service-only writes, source/SQL guard
  parity and metadata redaction.

Additional isolated audit acceptance is staged in
`scripts/social-audit-postgres-accept.sh` and
`.github/workflows/social-audit-disposable-postgres.yml`. It reconstructs
the live inspected function on disposable PostgreSQL with synthetic ledger
tables and roles, confirms the pre-cutover self-authored Social event path,
applies the Social-only proposal in that disposable fixture, then asserts:
authenticated Social forgery denied, unrelated Growth append retained,
service_role Social append accepted, head hash length and event-count
continuity, and no real network/provider calls. The script adjusts the
checksum only in an ephemeral local SQL copy to account for PG function
format differences; **the GitHub proposal retains the pinned real
production checksum and is not executed on the live project**.

The SQL privilege boundary is **not live** and audit ledger trust remains
a blocking issue until the staging SQL is tested on isolated Postgres and
the live exact project after approval. Never interpret existing,
client-writable Social audit events as proof of owner consent.

## Outstanding database migration mismatch (no ledger edits)

Live `supabase_migrations.schema_migrations` previously confirmed:
- Applied `20260921215150` Social reconciliation; repo has
  `20260921223500_social_prod_schema_reconciliation.sql`.
- Applied `20260929015104` transcript-fold runtime; repo's base canary
  definition comes from `20260929014500_transcript_fold_runtime_1.sql`.

Do not manually rewrite schema migration rows. Diff `pg_get_functiondef`,
table RLS, grants, indexes, triggers and source migrations on the exact
project first. Production table/functions may differ despite a passing
isolated test built from repository migrations.

## Release candidate readiness

Code-provable gates:
1. Exact-head #1440: Social CI including static RPC and audit contracts, all
   new Social unit tests, application type-check/lint/test/build and UX cert.
2. Disposable PostgreSQL real migrations and RPC receipt/outbox acceptance.
3. Review source diff between main and #1440 for unintended path changes.

Operator/live gates — **not satisfied by source CI**:
1. Reconcile version drift and generate unique canonical CLI migration.
2. Audit the live service_role/OIDC proxy and SQL function admission with
   two real owner sessions and anonymous; prove no client-role bypass.
3. Test Social-domain audit server-only SQL in isolated Postgres, including
   unchanged hash-chain, other domains and rollback.
4. Prove approved media lineage, current owner account OAuth scopes,
   provider receipts, receipt replay/ambiguous reconciliation, contact
   suppression and iPhone Safari sign-in.
5. Plan synchronized code+SQL cutover and rollback, get explicit owner
   approval before changing Supabase, deploying, changing flags, connecting
   accounts, posting or sending any direct messages.

## Decision

**Draft release candidate; no production activation.** Prefer #1440 as the
single current-main review entry; keep parent PRs as read-only provenance
until the combined candidate is accepted. No publish/spend/DM authorization
is given by this document.
