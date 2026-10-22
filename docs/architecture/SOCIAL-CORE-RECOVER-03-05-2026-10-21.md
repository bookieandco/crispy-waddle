# SOCIAL-CORE.RECOVER.03–.05 — staged owner-only readiness, Studio storage and trend evidence

Date: 2026-10-21
Stacked parent: PR #1430 at `5b2d376aa78cf08c3beead1a5a49aba532707e1f`.
Main was independently at `bbf0df86c63a14eec7e9454307e20f84da150774` when this work began (unrelated sports commits).
No Supabase schema mutation, live OAuth, deployment, posting, messaging or spending performed.

## .03 Account connection truth and authorization

- `/api/social/connections/readiness` authenticates before querying the owner's existing Social account registry.
- It reports adapter runtime readiness for Hootsuite and Ayrshare without exposing secrets, tokens or provider profile IDs.
- No account is deemed live-verified or posting-commissioned based on an env key, account registry row, or advertised vendor API capabilities.
- Actual adapter methods are `profiles.discover`, `publish`, `deliveries.read`, and `delete`; the broader Ayrshare feature catalog is not represented as implemented.
- This is a read-only diagnostic only. Actual connection/registration remains gated by PR #1430's owner/provider verification and unapplied account-binding privilege cutover.
- Provider-specific OAuth and real iPhone verification remain external requirements.

## .04 Owner-persisted Social Studio working copies

- `packages/social-core/src/studio-workspace.ts` validates owner, brand, canonical ContentProject lineage, bounded review states, non-executable calendar slots, and exact owner-scoped destination accounts. It does NOT grant social publication or Director asset authority.
- `/api/social/studio/workspace` supports authenticated GET/PUT on an explicit brand, no-store headers, bounded body, revision-based conflict responses, error redaction, and no secret tokens.
- Storage adapter uses Supabase SSR authenticated session, exact owner+brand RLS and optimistic compare-and-swap `revision` on the **proposed** table `jhadina_social_studio_workspaces`. Initial duplicate inserts fail on unique owner+brand.
- iPhone Studio includes explicit Save and Restore controls with meaningful 503/409 states. Existing in-memory drafts stay available even when persistence is disabled.
- Default `JHADINA_SOCIAL_STUDIO_STORAGE_ENABLED=false`. `supabase/proposals/social_core_recover_04_studio_workspaces_UNAPPLIED.sql` is **NOT** a migration, NOT applied, and must not be enabled until separately approved and verified with two distinct owner sessions + anonymous.
- ContentProject snapshots are planning working copies. Future Director/approved publication must resolve canonical media and account bindings again, not blindly trust a saved snapshot.
- No automatic autosave, background work, or provider posting.

## .05 Trust-preserving observation bridge

- Pure `socialObservationsToRelayTrends` converts only owner+brand matching, evidenced, timestamp-valid Social `trend` observations to bounded Relay planning candidates.
- Provider-authenticated trust can be assigned ONLY if an external verified upstream process explicitly admits the observation ID; otherwise it is labeled `owner_submitted`, not falsely verified as a provider feed.
- No direct TikTok/Meta/X scraping, private feed reads, creator messages, paid intelligence purchases, account activation or causal virality claims.
- Social-Free #1328 and Social Juggernaut #1136 remain separate draft donors; this change does not cherry-pick their migrations or activate their outbound workflows.

## Security and production blockers remain

**P0 — privilege cutover incomplete.** Main/Jhadina database still exposes several authenticated SECURITY DEFINER publication, approval-receipt, messaging and outbox state-transition functions. PR #1430 stages only the account-registration RPC tightening. This branch is NOT security certification for production social actions. The complete receipt/outbox redesign must preserve atomic replay protection and Action Core's server-verified policy, and revoke authenticated EXECUTE only with a working privileged substitute and integration tests. No live publish/DM approval is granted.

Other pending:
1. Exact-head Social/Growth/UX/full Jhadina tests and lint.
2. Migration drift reconciliation and real SQL RLS/GRANT two-owner+anon tests on correct project.
3. Certified owner sign-in on Safari and OAuth credentials/permissions.
4. Live versioned Director media/copyright/rights checks; exact target approval; provider receipts.
5. Creator permissions, contact opt-outs and actual commercial evidence before publishing claims.

## Manual acceptance after approved rollout

- Sign in as owner A, save two draft revisions; reload on iPhone, restore exact brand; stale revision returns 409.
- Sign in as B and as anon, verify no visibility and no writable cross-owner objects.
- Delete provider access or mark the account revoked; saved calendar still cannot publish or become executable.
- Verify `/api/social/connections/readiness` reports no fake `verifiedLiveDelivery` or `postingCommissioned`.
- Feed a foreign/future/unsupported/unevidenced trend; it must not enter Relay planning.
- Do not merge child PR until #1430 is reconciled and the exact source checks pass.
