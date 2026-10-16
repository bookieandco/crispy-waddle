
# MEME-VENTURE.RUNTIME.01–.03 — Owner-scoped saved drafts

Date: 2026-10-15. Depends on MEME-VENTURE.01–.08 (#1312).

## RUNTIME.01 — Persistent paper workspace

Migration: supabase/migrations/20261015200000_meme_studio_drafts.sql
Server module: apps/jhadina-web/src/lib/opportunities/meme-studio-runtime.ts
API: /api/opportunities/meme-studio
UI: /opportunity/token-creator

The database table jhadina_meme_studio_drafts contains owner_user_id, draft_id, candidate_id, optional venture_id, immutable creation time, last update, optimistic revision, JSON payload and optional archive time. Constraints force authority=PAPER_ONLY and both external-action and money-movement authority to FALSE.

Browser roles have no direct table access. Existing verified Supabase request identity and server-only privileged client are reused. Every database read and mutation must filter owner_user_id, candidate_id and archived_at; PUT and DELETE also require the caller's most recently observed revision. Conflicts are explicit, never overwritten silently. Active drafts are capped at 50.

The UI now has New, Save, Open, Archive and optional Venture link controls. Failed requests do not discard in-screen edits. It is manual-save only; no promise of offline sync, auto-save or a successful save without a response receipt.

## RUNTIME.02 — Canonical ownership and adoption

A linked Venture must already exist in owner-scoped Venture Factory storage, have software_apps family, remain active, and match a persisted adopted candidate with seed token-creation-services-market. A generic app, another user's Venture, an archived Venture, or a pending/unadopted candidate cannot be linked.

Saving a token concept NEVER creates canonical adoption, a Venture, validation evidence, a new lifecycle stage, an approval, or customer revenue. The link is a reference to canonical existing records, not a second Venture system.

## RUNTIME.03 — API and testing

GET lists the owner's newest 50 saved drafts and eligible canonical links. POST creates a paper-only design. PUT updates only at the expected revision. DELETE soft-archives only at the expected revision. Mutations require same-origin JSON requests and a 32KB size limit. JSON input accepts only explicit draft, quote and paper-scenario keys; no signer, private-key, payout, mint, promotion or money-control fields. Server replies always disallow external actions and money movement.

Tests at apps/jhadina-web/src/lib/opportunities/meme-studio-runtime.test.ts exercise missing rights declarations, invalid keys, numeric limits, unauthorized cross-owner reads/mutations, stale version conflicts and unrelated/unadopted Venture links. The production database still requires separate deployment and a real authenticated smoke test.

## Unresolved Supabase commissioning gate

Connected Supabase discovery returned only Pupsonstuff and Swlc. Neither provided verified access to Jhadina's canonical jhadina_venture_records table; the Swlc database refused connections during inspection. Do not guess a destination or apply the new migration to an unrelated project.

Before runtime can be called LIVE:
1. Identify the actual Supabase project configured for the deployed Jhadina app without disclosing any secret.
2. Verify canonical Venture and adoption tables and the server-side privileged proxy.
3. Apply the committed migration to the confirmed project; inspect RLS, grants, indexes and security advisors.
4. Exercise authenticated owner create/reopen/update/archive, stale 409 conflicts and different-owner isolation with real database receipts.
5. Verify the optional Venture link cannot bypass the canonical adoption gate.
6. Confirm no token issuance, wallet signing, investment activity, payment or automatic publication.

**Code complete is not production acceptance.** No spending, customer outreach, investment promise or token launch has been authorized.
