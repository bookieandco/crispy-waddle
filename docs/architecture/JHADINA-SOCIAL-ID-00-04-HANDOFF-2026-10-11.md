# JHADINA-SOCIAL-ID.00–.04 — Source handoff (2026-10-11)

## Scope and verified baseline
Main starting commit: `b4209c5bd6ff62a88af87a514725eae4f5ecf8a2`.
Social Juggernaut PR #1136: `df425645b8e92e2d0dea1d045ef7cca91095f53f` at audit; open and diverged by **179 ahead, 213 behind** relative to main. Do not merge it blindly or certify its prior green CI as current-main proof.
Personality #1150, #1151, #1152, #1153, #1155 are already merged. Social #494 is merged; Growth/Director identity #608 is merged.
The Google Drive personality phone handoff dated October 8 predates #1151 merge. GitHub remains source of truth.

## Reconciliation disposition
- REUSE unchanged: Social account ownership/outbox/approvals, existing BrandVoiceProfile/ChannelVoiceProfile, Jhadina PersonalityState, RNC, Expression, MIMS, Hippocampus, Growth attribution.
- FORWARD-PORT selectively from PR #1136: first-class Truckeros profile and strict venture-brand/profile candidate construction. Existing #1136 includes broader venture portfolio, niche, weekly publishing and platform plans; this PR intentionally does not cherry-pick those unrelated changes.
- NEW, orthogonal: owner/brand/account/provider-scoped immutable SocialAccountIdentity projection; inert revision proposals and owner-review decision boundary; repository CAS contract.
- DEFER: full #1136 branch reconciliation/merge, weekly packet identity fingerprints, runtime persistence migrations, actual provider-learning admission, user dashboard, acoustic identity certification. These are follow-up milestones, NOT source-complete here.
- The branch #1136 currently uses a more permissive venture slug normalizer. This implementation rejects ambiguous noncanonical refs instead. Reconcile that difference before a future merge to avoid identity collisions.

## Invariants
1. Jhadina PersonalityState != public SocialCharacterProfile != brand voice != channel voice != account identity. Do not move Social observations into Personality eligibility implicitly.
2. SocialAccountIdentity is EXPRESSION_ONLY, cannot publish, spend, message or grant any authority; revision requires a verified owner receipt at the server boundary.
3. The pure revision decision is not authentication. Server must independently attest the approver, validate receipt, and persist compare-and-swap. No untrusted browser userId.
4. Strict scope key is ownerUserId+brandId+accountId+platform+provider+providerProfileId, never a public handle alone. Missing or mismatched scope fails closed.
5. Multiple reference IDs are a source-level minimum only, not proof of independent evidence. Durable acceptance must validate actual source independence/consent/rights.
6. Approved identity revision increments version; stale submissions fail. The repository interface requires atomic CAS, but no production implementation or migration is claimed.
7. Venture candidate factory never grants account ownership or activates a character. Production activation needs canonical owner/venture registration and review.
8. Existing Social observations are not yet an account identity memory store. #1136 niche learning must be scoped by owner and brand before cross-portfolio transfer.
9. Publications and paid actions remain behind Action/Security approval and immutable fingerprints.

## Exact acceptance
Run Social Core type-check/test, Growth type-check/test, Core Spine type-check/test, Social web integration type-check, and review exact-head GitHub CI. Run extra cross-owner, mixed-brand, account/voice mismatch, duplicate evidence and stale version tests.
All source-only work can happen without recovering Supabase. Do not migrate damaged SWLC until verified healthy. Google Drive is optional audited backup/handoff, never live memory.

## Next sequence
.05 strict observation identity learning admissions;
.06 owner+brand+niche scoped #1136 learning;
.07 proposed evidence-backed social identity evolution;
.08 drift/contradiction/retirement;
.09 approved cross-portfolio transferable creative mechanics;
.10–.13 Director / Ask / weekly packet identity fingerprints;
.14 phone Identity Studio;
.15–.16 source and live certification.
