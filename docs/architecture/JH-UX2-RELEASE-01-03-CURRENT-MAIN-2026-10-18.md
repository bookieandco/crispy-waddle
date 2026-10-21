# JH-UX2.RELEASE.01–.03 — current-main source-only consolidation
Date: 2026-10-18. This branch is a **review-only release candidate**, not a live deployment.

## Exact-source reconciliation
- Verified current main at reconciliation: `89e2a9ba048c97d8e4875c294ef7146d6438c24c`.
- Legacy stacked head: `6e1fecb9a0cf70d51ac5992585b659fcff75ff77` (PR #1378, on #1356 on #1354).
- The 161 changes to main after the legacy branch's main ancestor touch **none of the 30 selected UX2 source files**. This was verified through the GitHub compare changed-file sets, not a claim about transitive dependencies.
- Merge commit uses current main as first parent and legacy UX2 head as second. Its tree is constructed from **current main plus the 30 reviewed UX2 blobs**. No unrelated systems were reset, no unrelated history was fast-forwarded.
- The separate demo-only branch is **not included in this source release candidate**. Production Home is existing `pages/index.tsx`, with its real governed activity/approval endpoints and the re-integrated `PersonalCommandFeed`.

## RELEASE.02 — real endpoint integration
- Home reads existing Social outbox observations, owned account registry, approved Opportunity and Money activity, authorized YouTube subscription sampling, and the latest JhadinaTV provider-backed discovery. Shortcuts remain labeled **shortcuts**, not fake feed posts.
- `GET /api/home/public-social` permits signed-in, on-demand read-only Bluesky public-author and fixed-instance Mastodon previews. It does **not** create subscriptions, prove private timeline access, or persist results.
- `GET /api/home/saved-social` has a project-pin commission gate, real UUID identity check, owner filter, bounded results, protected no-store responses, and fail-closed 503 / 401 behavior. Its data has a **new client-side provenance validation layer** before presentation in Home; only a `durable:true` response with verified official HTTPS provider links is displayed.
- Stored feed unavailable / disabled never becomes an invented post, approved grant or active synchronization claim.

## RELEASE.03 — acceptance boundaries
- Exact-head CI needed after all source commits: full Jhadina launch gate including TypeScript / lint / tests / build; UX, Social, Media, Money, JLLM and Web conformance where configured. Earlier PR green results **do not** certify this new head.
- `supabase/proposals/jhadina_feed_storage_v1_UNAPPLIED.sql` remains an **unapplied SQL proposal**, not an authorized migration. No database schema changes, server writes, or background collectors in this PR.
- Supabase Swlc previously returned Postgres `57P03`; require current DB inventory, approved target, Auth UUID proof, two-owner/anonymous RLS tests and advisor output before ever setting `JHADINA_FEED_STORAGE_ENABLED=true`.
- Real Google OAuth scopes/callback/cookie login, phone Safari UX, accessibility, playback and signed-in saved state require dated operator acceptance. Live deployment, public hostname and Auth access are **not** established by CI alone.
- Never conflate publisher-connected Facebook/Instagram accounts with personal feeds. Never claim Meta personal timeline access or independent Meta owner authorization from a caller-supplied evidence string.
- No posting, money movement, trading, paid API spending, private memory writes, voice activation or production rollout performed here.

## Integration follow-ups
1. After green exact-head CI and human review, merge or cherry-pick the consolidated reviewed source into current main; retire/close superseded legacy stacked drafts only after continuity is proven.
2. Recover and verify Swlc DB; generate and review a proper migration and test owner isolation.
3. Activate real authorized social-provider reads and storage with explicit owner consent.
4. Build an accessible nonproduction HTTPS preview and execute physical iPhone acceptance.
