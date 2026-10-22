# SOCIAL-FREE-FINAL.01–.05 — October 21, 2026

## Reconciliation
Fresh branch `build/social-free-final-reconciled-20261021` starts from `main@04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61`.
Copied only owned Social-Free module source from #1328; preserved current main's Social command center, Growth exports, other workflows and unrelated subsystems. Do not merge superseded PRs #1310/#1328 independently; prefer this isolated PR.

## Database commissioning — Jhadina only
Verified owner project `kqbkaozfjubkjevdfvic` (Jhadina). Connected PostgreSQL 17.6. No pre-existing `jhadina_creator_campaign_records` table; two auth users available for isolation testing.
Applied:
- `jhadina_creator_campaign_records`: auth.users FK, per-owner uniqueness, zero money/external action flags, SELECT/INSERT/UPDATE owner RLS, FORCE RLS.
- `jhadina_creator_records_privileges_hardening`: explicit revoke all from public/anon/authenticated; grant only authenticated SELECT/INSERT/UPDATE. PostgreSQL default table privileges initially allowed authenticated DELETE — now revoked and verified false.

Live verification: table RLS enabled and forced; 3 owner policies; anon SELECT/INSERT false; authenticated SELECT/INSERT/UPDATE true, DELETE false. Within one rolled-back SQL transaction, real database role `authenticated` with scoped request JWT claims:
1. Existing owner A could insert/read and update a transient record.
2. Owner B could not read or update A's record.
3. Owner B could not insert with A's owner UUID.
4. Transaction ROLLBACK leaves no test records.
No actual user profile data was copied or exported. Temporary test owner IDs were not printed or saved.

## Application commissioning
`creator-persistence-boundary.ts` is a build-time constant enabling *draft-only* record operations. Auth comes exclusively from canonical `createRequestIdentityVerifier`; the write request requires same-origin JSON and is owner-scoped in DB through RLS. No service-role key is used on public routes. `GET`, `POST`, `PATCH` and manual import share the data boundary. Save screens support evidence-only statuses, not live outreach.
New tests verify authorized owner draft, unauthorized session, cross-origin, forged authority, secret fields, collaboration state, optimistic update, and immutable duplicate import behavior. Local portrait-browser fixture exercises enabled controls against a stubbed 503 API, but **this does not prove live iPhone login/record saves or signed creator agreements**.

## Release gates
1. Exact-head CI must pass on this branch and no new divergence from main; review all tests including Growth, Social, web production build and portrait QA.
2. Confirm two-owner RLS in production remains in force and run Supabase security advisor for creator-related findings; unrelated lints are separate projects.
3. **Do not merge or deploy to production as part of .01–.05.** Production release/mobile QA belongs to .06–.08. Until then the updated write code is only in an unmerged branch, while an existing older preview stays locked.
4. Need real authenticated iPhone Safari write/reload, response provenance and pilot owner approvals before declaring live end to end.

No creator contacts, products, shipments, paid platforms or ads are authorized by these steps.
