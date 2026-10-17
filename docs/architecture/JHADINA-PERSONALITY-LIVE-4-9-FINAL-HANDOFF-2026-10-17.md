# JHADINA PERSONALITY LIVE.4–.9 → FINAL — bounded continuation and voice 02 revision

Date: 2026-10-17  
Parent: draft PR #1345 at `f228c99ed6801dc021b938b4fae9fffabcf152fc` (unmerged at branch creation)  
Branch: `feat/jhadina-personality-live-4-9-voice-v2-20261017`  
Source-only disposition: implementation and regression **proposed**; exact-head CI must confirm.  
Production FINAL: **BLOCKED / not commissioned**. Do not print a misleading FINAL success receipt.

## Creative anchor (user-approved direction, NOT speaker approval)

Original audible reference:
- Browser: `/jhadina-voice-audition.html` / `/jhadina-voice-audition/candidate-2.mp3`.
- Manifest ID: `jhadina-audition:1274`; original seed: `1274`.
- Original WAV SHA-256 (in manifest): `516181c853b1e8fc00c5e60975cd60c8ed7eea0142d732b6ec4d3508873d60ab`.
- Qwen3 VoiceDesign original run #14; `candidate_unapproved`, `qualityClaim=false`.
- The user wants MORE presence, non-stereotyped natural "hood" ease, restrained sultry texture, and only a dab of Spanish accent, without replacing the recognizable woman.

No one has yet authenticated a matching speaker fingerprint or approved a new voice. A text prompt cannot guarantee the same biometric speaker. The v2 VoiceDesign pack is **candidate-2-informed creative direction**, not a clone or verified same-speaker derivative.

## LIVE.4–.5 — session / bit / callback boundary

- Added `owned-personality-session.ts`, a versioned owner- and session-scoped, TTL-limited ephemeral reducer; auth must come from the server, not user-supplied IDs.
- Rejects foreign owner/session, stale revision, replay, expired session, invalid bit data and exhausted/revoked callback. User stop clears bit; legitimate topic shift allows new conversation without carrying uncomfortable banter.
- Snapshots cannot become durable Memory/Personality evidence. Replay ring is intentionally bounded; a production store needs atomic expectedRevision CAS, reliable single-use event IDs and TTL enforcement.
- Existing `composeLiveConversationCraft` optionally accepts a server-verified session snapshot for expression and callback fatigue without reinterpreting "lol" history as a started bit. Older recent-turn fallback remains for uncommissioned paths.
- Tests are synthetic source fixtures, NOT authenticated multiple-user or restart receipts.

## LIVE.6 — independence and evidence

- Added a read-only `readIndependentPersonalityView`: only a separately accepted, evidence-backed `opinion` or `taste` trait with at least three distinct immutable references can be surfaced as Jhadina's stance.
- Does not infer Jhadina's taste from the user's preference or invent a new opinion. No separate Personality engine.
- This does not establish actual rich autonomous opinion formation or human recognition. Real admissible experiences and successive revised decisions remain acceptance gates.

## LIVE.7 — real human quality

- New 30-case manifest at `docs/architecture/JHADINA-PERSONALITY-LIVE-7-EVAL-CASES-2026-10-17.json`; expected dimensions include evidence, pushback, restraint, callbacks, multilingual, taste, trust, isolation, provider/device parity.
- Actual 30+ turns, 3+ sessions, 2+ independent reviewers, reviewer authenticity and average naturalness >=0.8 require external observations, not synthetic fixtures.
- Reuse the hardened `certifyPersonalityLiveFinal` exact-deployment, independently verified receipt boundary from parent PR. No competing final certifier.

## LIVE.8 — durable learning

- Hardened production Personality provider so failed durable load cannot be interpreted as a new, writable profile. It refuses provisional Personality save on unknown durable state and reports `persistenceStatus` explicitly.
- Added regression with provider.load unavailable and an apparently eligible pattern; no save occurs, canonical empty state remains, and failure is visible.
- SWLC/Supabase recovery stack #1322 → #1323 remains outside this PR; no SQL or migrations, RLS, provider data movement or fake backup.
- Real owner-scoped save, reload, correction, forget, CAS conflict and restart/restore require recovered canonical storage.

## LIVE.9 — voice auditions / phone parity

- Four **unrendered** v2 Qwen VoiceDesign specifications at `docs/architecture/jhadina-candidate2-voice-v2-audition.json`:
  02A Presence; 02B Natural Ease; 02C Velvet Authority; 02D Bilingual Glow.
- Existing RunPod audition script accepts opt-in `JHADINA_VOICE_AUDITION_PACK=candidate2-v2`; original path unchanged, artifact state remains unapproved, strict SHA/response verification is retained.
- Workflow input `audition_pack` selects the pack ONLY through manually dispatched existing GPU creation, with the existing exact `CREATE_BILLABLE_JHADINA_VOICE_GPU` confirmation and hourly price cap. **No GPU creation, speech synthesis, spend or publication occurred during this repair**.
- Preview `/jhadina-voice-audition-v2.html` plays the old Candidate 2 and shows proposed v2 choices. It only enables v2 audio when actual published audio files exist; absent files are explicitly labeled pending.
- Qwen VoiceDesign creates new candidate voices; if the user requires the exact Candidate 2 speaker with changed pronunciation, plan an unapproved same-speaker reference-conditioned refinement path and compare ECAPA similarity against the original rather than assuming identical identity.
- Acoustic selection needs original WAV hash matching, real owner listening and explicit approval, independent ECAPA fingerprint, Qwen Base/VoxCPM2 same-speaker QC, fallback and latency/barge-in, phone/Ask/Director real audio, English/Spanish and sensitive-register auditions.

## FINAL — separate the three statuses

- Source: to be confirmed by exact-head CI against this stacked PR, not assumed because prior #1345 was green.
- Live text: NOT certified; no authenticated multi-session transcript/reviewer receipts.
- Production voice: NOT certified; v2 variations unrendered, no approved reference/fingerprint/real iPhone or cross-surface acceptance.
- Final status **BLOCKED_FOR_LIVE_EVIDENCE**, even when source CI is green.

## Smallest next coding / commissioning sequence

**JH-PERSONALITY-COMMISSION.01–.12**:
1. Reconcile/merge #1345 first, validate this stacked PR at exact SHA and selectively rebase if necessary.
2. Connect source-owned session snapshot to authenticated owner-specific TTL/CAS session repository; reject foreign-owner, replay and expired turns across reload.
3. Add callback revocation propagation from approved Memory/forget events and owner-discomfort across surfaces.
4. Reconcile canonical SWLC recovery #1322/#1323, verify two-owner RLS/anonymous denial, real backup and restore, no wrong-project substitution.
5. Prove approved evidence → governed taste/stance → correction/restart → changed future decision with no opinion fabrication.
6. Run 30-case human/multilingual evaluation; two genuine independent reviewers; record signed/provenanced no-quip and safety failures too.
7. Owner explicitly authorizes bounded audition GPU cost if needed; manually render v2 02A–02D; record WAV SHA/provider task/seed and stop Pod.
8. Publish only verified unapproved audition assets behind phone-first compare UI; conduct owner A/B listening. Do not autoapprove.
9. If favorite does not match Candidate 2 acoustically, build unapproved reference-conditioned refinement and ECAPA similarity harness before selection.
10. Owner explicitly approves ONE exact hash/fingerprint/reference; commission redundant providers only after approval, no fallback to new speaker.
11. Real iPhone English/Spanish, barge-in, interruption, no forced slang, serious-register, Ask/Director/TV/Music identity and provider-failover acceptance receipts.
12. Verify exact deployed SHA and independently authenticated CI, session, reviewer, fingerprint, timing, revocation and cross-surface receipts; only then issue `FINAL`.

### Commands / preflight

```sh
bash -n scripts/jhadina-voice-runpod-audition.sh
jq -e '.auditionOnly and (.variants|length)==4 and (.productionApproved|not)' docs/architecture/jhadina-candidate2-voice-v2-audition.json
pnpm --filter @jhadina/core-spine type-check
pnpm --filter @jhadina/core-spine test
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/jhadina-web test
```

No real voice generation, production activation, spending, deployment or storage repair is asserted by this document.
