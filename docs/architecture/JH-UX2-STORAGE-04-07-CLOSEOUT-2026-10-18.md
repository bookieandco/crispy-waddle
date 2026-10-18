# JH-UX2.STORAGE.04–.07 — verified state and commissioning gate
Date: 2026-10-18 • scope: Jhadina personal Home feed, **no live persistence authorization**

## .04 Swlc recovery and actual database inventory — BLOCKED EXTERNALLY
- Jhadina Web public Supabase config identifies Swlc `kqbkaozfjubkjevdfvic` as its canonical Auth/runtime fallback. This is shared infrastructure; **never reset, restore or migrate it merely on Jhadina's behalf**.
- Supabase Management API reports project `ACTIVE_HEALTHY`, Postgres 17, ca-central-1; this is a **project-level indicator**.
- Actual `list_tables(public)` and `list_migrations` on 2026-10-18 both return `FATAL 57P03: the database system is not accepting connections; hot standby mode is disabled`. These are **not successful inventory checks**, and the project-level health marker cannot override that fact.
- Logs were queried read-only; log-source metadata exists but **no verified server-side repair or independent Postgres connection succeeded**. No pause/restore action was attempted; no unrelated project was modified.
- Operator recovery needs actual Swlc SQL read success, confirmed migration-table history, exact owner Auth UUID semantics, an inventory of existing `jhadina_feed_*` tables/policies/grants, and read-only security advisors. Preserve any already-deployed compatible schema and data. Use a reviewed non-production recovery plan for 57P03; do not wipe or replace a shared DB.

## .05 PostgreSQL 17 RLS certification — SOURCE-ONLY
- Original draft stays `supabase/proposals/jhadina_feed_storage_v1_UNAPPLIED.sql`. This is deliberately **not** an applied Supabase migration. CLI-generated migration must be created and reconciled against real schema after .04 recovery.
- Isolated fixture `supabase/tests/jhadina_feed_storage_ephemeral_bootstrap.sql` constructs mock `auth.users`, `auth.uid()`, and Supabase-like roles in fresh throwaway PostgreSQL 17 CI only.
- `supabase/tests/jhadina_feed_storage_rls_acceptance.sql` checks three-table RLS, signed-in owner A vs B visibility, no anonymous exposure, denied client writes, cross-tenant FK, and duplicate source identity. This is **not** a substitute for running the same tests against actual Supabase session semantics.
- `.github/workflows/jh-ux2-feed-storage-rls.yml` runs only on pull request and manual dispatch; uses ephemeral PostgreSQL service and no real Supabase credentials, database URL or service-role key.

## .06 Bounded opt-in sync planner — SOURCE-ONLY, NO WRITES
- `src/lib/social/feed-sync-plan.ts` requires an explicitly commissioned exact-project pin, real owner UUID, explicit consent, verified provider response, healthy source, independently verified owner grant (when provider requires it), approved source and trust match.
- It normalizes and allowlists item URLs, limits batches to 25, deduplicates owner/provider/external_id candidates, plans a 30-day expiry and rejects stale DB cursors. Retries are bounded and never advance a failed cursor.
- This module is intentionally **pure and unreachable from an external sync route**. No provider scraper, cron, secret, service-role client, SQL writer or OAuth grant is created. Code that performs atomic CAS/upsert, retention deletion, revocation and recovery is **not commissioned**. Do not label plans as persisted activity.
- Commissioning requires a reviewed transaction-bound writer with source-specific lock / compare-and-swap update, actual grants, replay tests and a safe manual first sync; never implement a write path that infers grants from caller-provided metadata.

## .07 Acceptance and release verdict
| Check | What code can prove | Live evidence verdict |
|---|---|---|
| PostgreSQL availability | Dedicated read probe attempted | BLOCKED: 57P03 |
| Existing schema/migrations | Current repo SQL inspected | NOT VERIFIED LIVE |
| Two-owner + anonymous isolation | Isolated PG17 test in CI | NOT VERIFIED IN SWLC |
| Source authenticity | Verified provider contract tests | REAL GRANTS NOT VERIFIED |
| Cursor and retry safety | Pure deterministic tests | NO DURABLE WORKER |
| Retention | `expires_at` field and planned expiry | NO DELETION JOB |
| Saved Home integration | Source code reads gated endpoint | LIVE OWNER FEED NOT VERIFIED |
| Deployment and phone | Not part of this PR | NOT VERIFIED |

**Switches remain unset/disabled**: `JHADINA_FEED_STORAGE_ENABLED` and `JHADINA_FEED_STORAGE_PROJECT_REF`. Do not set or claim readiness from a successful CI build. PR remains draft. No Supabase schema writes, token extraction, publishing, spending or other real-world side effects.

## Precise live commissioning sequence once Swlc works
1. Verify exact Swlc project URL and identity; read inventory, migration versions, policies, table ownership, grants, security advisors, and unrelated consumers. Confirm approved change window and backup/restore evidence.
2. Generate migration with current Supabase CLI; reconcile the reviewed draft with existing DB, run on isolated/branch data first, and secure explicit migration approval. No duplicate migrations.
3. For two temporary authorized test users, use **actual Supabase client sessions** A/B and an anonymous client to test SELECT isolation and denial of INSERT/UPDATE/DELETE, and verify no bypass through views/functions. Also test service boundary, revoked grant, and cross-tenant replay. Remove test data safely.
4. Apply verified migration to approved target only, rerun advisors/DB acceptance, commission transactional worker and cleanup separately after scoped approval, and retain exact SHA and dated operator evidence.
5. Prove owner sign-in and sign-out on physical iPhone Safari, connectivity, source freshness, no fictional posts or duplicate entries, retention, revocation and reconnect, then consider staged release.
