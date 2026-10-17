# JH-UX2.04–.08 | Direct social and media feed handoff
Date: 2026-10-17
Parent draft: PR #1354 (base main); follow-up draft: PR #1356 (base JH-UX2 feed foundation).

## Product principle
Jhadina owns the user experience, ranking, identity, learning gates, Action/Social Core approvals and memory. Read-only provider APIs provide attributed content. Do not invent personal timelines, copy cookies into unofficial SDKs, buy subscriptions prematurely, duplicate the Social Core or grant publishing/spending capabilities.

## What is implemented in source
- JH-UX2.04: Typed feed connection states (unconfigured, consent needed, registered but unverified, healthy, stale, reconnect, provider error, disabled), scopes/freshness/provenance contract and Connections UI.
- JH-UX2.05: Provider-candidate normalization, bounded timestamps, HTTPS URLs and source metadata. **The durable ingester, tenant RLS migration, cursor/backoff and replay ledger are NOT implemented.** This portion remains blocked on selecting Jhadina's canonical database and proving owner isolation.
- JH-UX2.06: Read-only Meta Page/Instagram Professional response normalizers, requiring a caller-provided Graph owner evidence marker. This is not independently authenticated provider access: a production caller must verify token/scopes and Page/IG ownership before invoking.
- JH-UX2.07: Public Bluesky AT Protocol author-feed and fixed-host Mastodon author-preview adapters; authenticated preview endpoint, no arbitrary private account access.
- JH-UX2.08: Latest-first and balanced-source ordering chosen by the user. Deterministic; no implicit preference profiling.

## Supplied references
The GitHub REST meta endpoint describes GitHub infrastructure metadata, not the Meta/Facebook Graph API. The unofficial Meta AI cookie/browser wrapper is for Meta AI chat and images, not an authorized Facebook/Instagram feed connector. Neither is used for Jhadina account access.

## Next smallest ordered closeout
1. **JH-UX2.CLOSE.01 / PR #1354:** reconcile exact-base against current main, inspect any failing/merge conflict status, run exact-head Jhadina Web TS/lint/tests/build and UX truthfulness; do not assume passing old SHA certifies the merge. Preserve Home, Ask, Activity, Worlds and mini-player. Merge only if safe.
2. **JH-UX2.CLOSE.02 / PR #1356:** after #1354 is merged, rebase or retarget the child PR to main. Review the direct-source changes, repair exact-head CI and verify read-only preview permissions. Keep draft if unverified.
3. **JH-UX2.STORAGE.01–.03:** identify the **actual** Jhadina Supabase project (previous connected list showed only PupsonStuff and Swlc, not independently identified as Jhadina). Design/land migration for owner-keyed feed_connections, feed_items, sync_runs with provider+external_id uniqueness, backoff and scoped RLS. Test two distinct owners + anonymous denial and read/write boundaries before any ingestion goes live.
4. **JH-UX2.AUTH.01–.03:** configure the existing Google OAuth app/redirect and get owner consent for YouTube; prove live subscribed uploads, expiry/refresh, revoke/disconnect, unavailable/quota state. Obtain Meta app review and permissions for eligible owned Pages and Instagram Professional media; do not promise personal friends/following feeds.
5. **JH-UX2.FEEDS.01–.03:** add opted-in public account follow/save + bounded polling/cursors, provenance and freshness; verify Bluesky/Mastodon public-only boundary and legitimate provider use. No automatic Memory/personality admission.
6. **JH-UX2.UX-FINAL.01–.04:** one clean scroll with All/Social/Watch/Work, on-demand platform filters, accessible media cards; one real iPhone Safari walkthrough with the correct signed-in owner, mini-player continuity, auth/privacy and stale/error acceptance; exact deployment SHA and evidence receipts.

## Verification and blockers
Two source PRs are **not merged**, and product is **not live**. Passing CI checks on old commits prove only those exact trees. Database selection, consent, real provider data, two-owner database isolation and iPhone acceptance are still external. Publication, outreach, ads, trades, money movement, passive personality learning and access to other users' personal content remain disabled unless explicitly and separately authorized.

## Sourcing priorities
- First: existing YouTube read OAuth; public Bluesky/Mastodon preview (free first).
- Second: reviewed, authorized Meta Graph Page/IG Professional owned media.
- Third: approved TikTok creator reads, Reddit permitted API sources, additional networks if license and useful data warrant integration.

No optional workflow bridge is required or in scope.
