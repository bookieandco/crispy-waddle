# JH-UX2.STORAGE.01 → .03 — bounded persistence foundation (source only)

Date: 2026-10-17. Base: direct source draft PR #1356, itself stacked on #1354.
This work must not enable publishing, money, connected personal timelines, model memory or unconsented data collection.

## Database identity and recovery
- Jhadina Web `src/lib/supabase/public-config.ts` identifies Swlc as **canonical Auth/runtime fallback** project `kqbkaozfjubkjevdfvic` and the example environment points the Jhadina Memory Gateway there.
- Connected Supabase account reports Swlc ACTIVE_HEALTHY *at project-level*, but database operations (`list_tables`, `list_migrations`, `get_advisors`) failed `FATAL: 57P03, database system is not accepting connections; hot standby mode disabled` on 2026-10-17.
- Existing architecture also contains `supabase/migrations/20260822000000_create_jhadina_memory_core.sql`. This is supporting evidence of intended shared infrastructure, **not proof that the latest migrations are applied or that current RLS works**.
- Another connected project Pupsonstuff is unrelated. Do not send Jhadina user data to it.
- **No database DDL or DML was run.** Restart/recovery and verified SQL availability require infrastructure/operator action.

## Coding evidence
1. `src/lib/social/feed-storage-gate.ts`: rejects fake owner labels, requires valid Auth UUID and **two** opt-in environment flags: `JHADINA_FEED_STORAGE_ENABLED=true`, `JHADINA_FEED_STORAGE_PROJECT_REF=kqbkaozfjubkjevdfvic` (or exact approved alternate). Checks the runtime Supabase URL against the expected project; validates post owner, provider, provenance, trust, bounded count and official HTTPS host.
2. `GET /api/home/saved-social`: owner-authenticated, strictly read-only, 25-item cap, no-store, HTTP 401 for missing real identity and HTTP 503 for disabled/unavailable storage or mismatched owner. Does not fabricate posts, infer connection or grant writes.
3. `supabase/proposals/jhadina_feed_storage_v1_UNAPPLIED.sql`: **review-only schema proposal, not generated official migration**. Tables: scoped connections, items (30-day expiry by field, but deletion job not yet built), sync runs. Uniqueness/cascade tenant FK, indexes, RLS, no public client write grants; signed-in owner can SELECT only. No OAuth tokens stored.
4. Pure gate tests plus route tests cover disabled mode, wrong DB, fake identity, cross-owner responses, errors and success under simulated commissioned state. These are source-level tests only.

## Critical security/release checks before activating
- Recover Swlc Postgres, read-only inventory actual `public` table definitions and migration history. Identify Jhadina Auth session/UUID behavior and any existing feed tables first.
- Regenerate a legitimate migration filename using `supabase migration new jhadina_feed_storage_v1` once CLI/review is available. Adapt draft to existing schemas, run non-production local/branch tests, then apply to **only verified Jhadina project** after approvals.
- Create two separate test Auth users (A, B) and an anonymous client; verify owner-only SELECT for all three tables and denial of SELECT others and INSERT/UPDATE/DELETE for both A and B; test service-to-owner impersonation defenses. Test cross-owner FK and uniqueness, deletion cascade, provider-domain restrictions in repository, item retention cleanup, cursor atomicity and backoff. Re-run Supabase security advisors. Do not rely solely on documentation or a green TypeScript test.
- Permit server-side polling/ingest only with independently verified social-provider scopes, author or owned-account evidence, expiring/revocable grants and replay-safe workers. Service role bypasses RLS and must never be sent to the browser. Code to write verified rows is not commissioned here.
- Check deployment environment values, exact code SHA, route denial modes, and owner-specific data using a real phone.

## Preview sample disclaimer
The UI sample displayed in ChatGPT is static illustrative content, *not connected posts, not user account data, and not a deployed Jhadina service*. Current built-in Home already supports All/Social/Watch/Work and Latest/Balanced, with public author preview, YouTube consented sampling and existing Social, Money, Opportunity, TV adapters. The sample is a mobile layout direction, not evidence of real-time feed integration.

## Work still pending
- PR #1354 and #1356 still draft/unmerged at this checkpoint; this storage branch should remain a stacked draft.
- Swlc SQL recovery; reviewed migration; actual two-owner/anonymous RLS tests; authenticated provider credentials; persistence writer/sync scheduler; real device acceptance; production release.
