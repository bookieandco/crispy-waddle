# JHADINA-SOCIAL-ID.10–.13 — Stacked integration handoff (2026-10-11)

Base: `feat/jhadina-social-id-05-09-20261011` (`3b9a1e28c50145719b157fd72a0950788dc095a7`), itself stacked on draft #1206. This source PR is not the live deployment, and changing its Git branch does not trigger provider actions.

## .10 Effective identity resolver
`packages/social-core/src/effective-identity.ts` checks exact authenticated owner, real connected account, versioned AccountIdentity, canonical brand/character reference, approved BrandVoiceProfile and ChannelVoiceProfile. An account-level overlay may adjust approved tone and point of view but cannot drop the brand's prohibited phrases, disclosure obligations or escalation rules. Canonical speaker ref cannot be changed. Pure deterministic equality fingerprint is **not** cryptographic signing or authorization. Enforce approved identity repository read/receipt at composition root in a subsequent runtime adapter.

## .11 Director bridge
`buildDirectorBriefFromSocial` optionally requires an authenticated `identityContext`; when present, the selected ContentProject character/brand/voice/speaker and asset platform must match the resolved account. It places the exact semantic identity lock into Director evidence and clear account-specific expression constraints into the intent.
`acceptDirectorAssetIntoSocial` rejects any identity-bound brief if its current identity context is absent or changed; the existing Director QC/receipt remains authoritative. Legacy projects without identity bindings retain existing behavior; they cannot claim versioned identity compliance. No live provider production was triggered.

## .12 Weekly approval compatibility
`packages/social-core/src/weekly-identity-lock.ts` freezes exact owner, week, action ID, normalized Social publication fingerprint and every target account's current effective identity fingerprint. `assertWeeklyIdentityLockUnchanged` requires reapproval on semantic change. This is **not** the full PR #1136 weekly campaign engine: it covers organic Social publication plans only and issues **zero** public, paid, outreach or Director action authority. On actual #1136 reconciliation, attach these account version/fingerprint checks to its immutable packet and delegated permit verification. Never silently overwrite #1136's existing action fingerprint.

## .13 Ask Social intelligence
`account_identity` routes owner-facing questions (e.g. "What has Atwood Bookie learned on TikTok?") through the existing authenticated Social account resolver. Explanations read only observations whose exact owner+brand+account+provider+providerProfile+platform match, and optionally read approved identity snapshots through a server-provided repository interface. If no durable reader or human-approved revision receipts exist, **report unverified**, not learned. Raw views/likes are not causal evidence, not identity authority, and not a new publishing route. Default production composition does not yet supply a durable identity repository.

## Gating and remaining commissioning
- Run exact head Social Core/Growth/Personality source suites, web integration/Ask/Director tests, Jhadina Launch Gate.
- Full #1136 reconciliation remains blocked by its divergent historical branch: forward-port or rebase with per-file review and exact-head CI; this PR makes its organic identity fingerprint adapter available but does not complete that merge.
- SWLC persistence repair and real authenticated identity repository/owner approval receipts are required before live growth is claimed.
- No Supabase migration, credential access, cloud billing, post publication, paid spend or automatic memory mutation occurred.

## Follow-on
`SOCIAL-ID.14` owner-phone Identity Studio, `.15` runtime/CI certification and integration migration, `.16` authenticated live canaries and data-plane evidence. Preserve separation: Jhadina PersonalityState != SocialCharacterProfile != AccountIdentity != creative experiment.
