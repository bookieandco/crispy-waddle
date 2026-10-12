# JHADINA SOCIAL-ID.15–.16 — Durable identity source / commissioning handoff (2026-10-11)

## Source commits and intent
Stacked on `feat/jhadina-social-id-14-phone-studio-20261011` at `2c793dd382cc370bddfa706737476e28d125eaa5`. Prior drafts: #1206 -> #1207 -> #1208 -> #1209. PR #1136 Social Juggernaut is still divergent, OPEN and NOT merged. Do not claim branch reconciliation complete.

## Implemented source contracts
1. `packages/social-core/src/identity-commit.ts`: authenticated-owner account binding, exact versioned identity scope, inert proposal, one-time exact fingerprint/receipt attestation, strict expiry, approve-only identity revision and atomic CAS+append-only audit store API. Initialization also requires owner receipt and version zero.
2. `apps/jhadina-web/src/lib/social/supabase-identity-repository.ts`: RLS/JWT-backed `load` with strict schema/owner/provider-profile and version decoder; separate privileged writer using one service-only RPC. The writer is NOT exposed as a public API. Server MUST supply authenticated owner+approved receipt verifier; the DB RPC atomically consumes the receipt.
3. `ops/sql/SOCIAL-ID-15-account-identity-STAGED-NOT-APPLIED.sql`: post-recovery DDL blueprint for current snapshot, immutable revision journal, owner RLS SELECT-only, revoked public writes and service-only invoker RPC with DB scope, CAS, approved receipt and single-use checks.
4. Optional `JHADINA_SOCIAL_IDENTITY_READ_ENABLED=true` switches phone Identity Studio from **no reader configured** to an authenticated read-only snapshot reader. Default off; enable only after schema, RLS and live DB health proven.
5. `apps/jhadina-web/src/lib/social/identity-canary.ts`: deterministic OFFLINE_SIMULATION_ONLY receipt proving test-local CAS, replay rejection, version transitions and simulated serialization restore. It MUST NEVER be used to claim provider-backed outcomes or real backup restore.

## REAL infrastructure probe (2026-10-11)
Supabase list_projects reported SWLC `kqbkaozfjubkjevdfvic` as ACTIVE_HEALTHY; however actual read-only SQL SELECT, `list_tables`, and `list_migrations` all returned ECONNREFUSED against database port 5432 (IPv6). These failures mean **DB connectivity is NOT verified**, current live schema is UNKNOWN and original prior storage/disk problems cannot be pronounced fixed. No DDL/migration/backup/restore executed. The Supabase CLI was absent; the SQL was intentionally committed to ops/sql as STAGED, not fabricated as a migration with history. Don't push it to production.

## Mandatory commissioning checklist (blocking FINAL)
- Inspect current SWLC storage/disk/connection routing and successfully run read-only SQL + migration list + schema/RLS inventory.
- Verify two independent backup receipts, and isolated backup restoration before any production DDL. Confirm genuine original data; never use synthetic receipt as proof.
- On controlled isolated clone, install the current Supabase CLI, use `supabase migration new jhadina_social_account_identity_v1` to generate official migration filename, review staged SQL, execute and inspect grants, RLS policy/exploit checks, service-role RPC grant, no anonymous writes.
- Migrate with recorded version and verify atomic 0->1,1->2, concurrent stale-version/receipt replay and owner/brand/provider isolation. Verify actual Action Core identity approval lifecycle can issue `social.identity.modify` receipts with exact `social-identity:<account-uuid>:<proposal-id>` action IDs and matching fingerprint.
- Enable identity reader ONLY once live schema exists; commission server-bound approval endpoints and persistence adapter with account enrollment and revision UI, including rollback as newly reviewed revision.
- Reconcile PR #1136 against current main by individual forward-port review. Join scoped niche-learning and weekly identity locks with the authoritative weekly Action Core packet; no silent merge of 179 divergent commits.
- Test authenticated owner-phone sessions, separate tenants, provider observations, revoked account, loss of authorization, repeated sessions and reboot, production backup/restore, Jhadina PersonalityState isolation, actual publish permit semantics. Distinguish real outcome learning from fabricated canary data.
- Only after these pass issue SOCIAL-ID.16 FINAL with exact deployed SHA, RLS/receipt/restore evidence and provider canary links.

## Safety baseline
No password/secret, service_role key, paid cloud project/branch, automatic publishing, external outreach, spend, direct production SQL, Supabase DDL, or production environment changes were triggered during this source milestone. The UI remains expression-only and read-only until a verified reviewer flow is commissioned.

## Unfinished
`.15` SOURCE IMPLEMENTATION and deterministic source test gates may pass; `.15` LIVE PERSISTENCE is BLOCKED. `.16` OFFLINE CANARY is executable/testable; `.16` REAL MULTI-ACCOUNT CANARY/FINAL remains BLOCKED by database connectivity and provider/operator proof. Not production certified.
