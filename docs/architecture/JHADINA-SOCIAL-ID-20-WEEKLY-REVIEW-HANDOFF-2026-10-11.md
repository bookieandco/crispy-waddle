# SOCIAL-ID.20 — Verified Weekly Review Receipt + Non-Executable Child Plans

**Date:** 2026-10-11. **Stack:** #1213 → #1212 → #1210 → #1209 → #1208 → #1207 → #1206; source remains in draft unmerged PRs.

## Source changes
`apps/jhadina-web/src/lib/social/governed-weekly-review.ts` reuses the real `@jhadina/action-core` `ApprovalReceiptStore` contract. The service verifies current authenticated owner session, fetches a matching immutable packet from the owner-scoped repository, loads *current* effective social identities from a trusted repository, and compiles the whole packet + identity fingerprint.

`requestWeeklySocialReview({packetId})` creates a **pending** scoped `social.weekly.review` approval request. It never auto-approves. The existing account owner must approve using an authenticated Action/approval workflow.

`consumeWeeklyReviewIntoChildPlans({packetId, reviewedFingerprint, approvalReceiptId})` re-fetches current campaign and identity revisions, requires exact equality to the previously reviewed fingerprint, then calls the receipt store's atomic `consume`. If the owner session fails, packet becomes stale, receipt is pending/expired/reused, provider storage fails, or any scope mismatch occurs, the method fails closed. Only afterward does it return one immutable **non-executable** child review plan per original organic/comment/paid/Director action. No child is granted a publishing, messaging, paid or production permit; independent per-action Action/Security policy and approval are still required.

Tests use the real in-memory Action Core receipt implementation to verify pending-vs-approved behavior, single-use and replay denial, one revised identity invalidating packet, changed paid budget/comment/creative evidence, foreign owner/lost session, missing account identity, storage outage. All evidence is offline fixture data. No live provider or permission is invoked.

## Prerequisites for runtime integration
1. Durable, owner-scoped packet storage and immutable snapshot/read API; no such source is configured here. Never accept a client supplied packet or identity object.
2. Verified Action Core owner approval endpoint/UI with server-side receipt status; no direct calls to `store.approve` by background automation.
3. For each child, verify current packet+identity fingerprint again **at exact dispatch**, and obtain the corresponding actual Action/Security permit and provider auth. Parent consumption alone is NOT execution authority.
4. Persist receipt consumption and child plan outbox transition atomically or use idempotent recovery logic before enabling unattended weekly workers. An outage after consuming a parent receipt must not silently lose an operator-approved campaign.
5. Supply real multi-account/provider and durable backup/restore receipts, isolated database rehearsal, RLS grants and end-to-end production canaries. See [SOCIAL-ID.16 blocked audit/repair](https://github.com/bookieandco/crispy-waddle/issues/1211).

## Truth boundary
- **SOCIAL-ID.20 SOURCE ONLY**: no publishing, no comments, no spend, no production/Director invocation, no Supabase DDL.
- `SOCIAL-ID.16` stays **BLOCKED_FOR_AUDIT_REPAIR**, not production certified.
- Original Social Juggernaut #1136 remains open/diverged; only vetted weekly packet format was forward-ported. Main is unchanged.
