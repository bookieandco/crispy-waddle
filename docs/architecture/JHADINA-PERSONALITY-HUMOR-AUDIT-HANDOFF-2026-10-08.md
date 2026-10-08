# JHADINA PERSONALITY + HUMOR — Canonical audit / handoff (2026-10-08)

Status: **P0 SOURCE REPAIR PROPOSED; live conversational certification outstanding.**
Do not create a second Personality, RNC, Pattern, Quip, Banter, Callback or Voice Core.

## Sources reconciled

1. Earlier humor design discussion (August 2026): comedy fingerprint, emotional timing, humor memory, mechanisms of observation → contrast → escalation → callback → return to reality; no canned puns or forced jokes.
2. Personality Core / Real Nigga Core (RNC) implementation: `packages/jhadina-core-spine/src/real-nigga-core.ts`, `behavioral-kernel.ts`, `personality-behavior-expression.ts`, and source certification through the Personality/Drift/MEMORY work.
3. The September 23 transcript provenance hierarchy: `JHADINA_PERSONALITY_REFERENCE_CORPUS_2026-09-23.md`. Conversations with J is the namesake/reference anchor; Solange, Erykah Badu, Tiffany Haddish, Clarissa Shields, Good Mythical Morning, Chappelle, Drink Champs/Black Star, Breakfast Club, investigative, clinical, mythic, vernacular and intimacy transcripts are mechanics-only references. Do not clone a real person's voice or persona.
4. `jhadina-expression-final.md` and `JHADINA_CANONICAL_PERSONALITY_VOICE_BUILD.md`.
5. Merged PRs: #496 drift, #655 Personality/Memory, #672 governed blend, #1012 humor/corpus/prosody, #1023–#1028 voice identity, streaming, integration, certification, native audition, and #1029 audition workflow registration repair. #1029 has since merged; its older handoff saying it was open is obsolete.
6. A personal voice-audition follow-up described four generated unapproved candidates; that is **not** evidence of a human-selected, fingerprint-admitted production voice.

## Stable identity contract

```
Experience → Hippocampus/Memory → Pattern + evidence → Personality eligibility
→ PersonalityState → RNC → Behavioral Kernel → Expression Kernel
→ governed model realization → optional canonical acoustic voice
```

- Personality determines durable behavioral tendencies. Session state affects this turn only.
- RNC must permit truthful disagreement, moral independence, social intelligence and culturally competent humor. It may not manufacture agreement or override policy.
- Expression selects the register, quip eligibility, profanity ceiling, sass ceiling, depth, cadence and pause budget. Serious/precision/distress/high-stakes contexts suppress performative humor.
- `MAKE IT MAKE SENSE` tests coherence, evidence, alternatives and confidence; coherence is **not** truth and a witty story is not proof.
- Reference transcripts inform mechanics, never identity/biography/voice imitation, quotes, unsupported facts or action authority.
- One shared `voice:jhadina:canonical:v1` speaker identity must be used across Ask/Director/Music/Social and future devices once approved.

## Confirmed implementation

- `quip-engine.ts` has a bounded 3-candidate selector, quality/risk penalties and explicit no-quip return.
- `banter-bit-engine.ts` supports notice → twist → escalate → peak → callback → exit; session bits remain non-durable.
- `callback-learning.ts` and callback provenance require independent evidence and support correction/forget retirement.
- `expression-kernel.ts` and `voice-runtime.ts` transport the bounded expression/prosody genome.
- `personality-drift.ts`, interaction-quality certification and several integration suites exist.
- `ask-expression.ts` and `jhadina-command.ts` obtain governed expression directives, and the model provider consumes them.

## Concrete gaps and limitations

**G1 — Live Quip generation is not wired.** Search of current default-branch call sites found `runQuipFastLane` defined but not called and `quipCandidates`/the complete `buildPersonalityBehaviorExpressionPlan` vertical slice used in Core Spine/test code, not production Ask composition. Model-authored prose can be colorful through allow flags, but that is not proof that the deterministic candidate selector, scoring or optional no-quip pathway is exercised live. Do not call the humor engine production-complete.

**G2 — Durable session lifecycle needs an actual Ask/voice turn canary.** Unit-tested banter and callback memory is not equivalent to evidence that a user's live follow-up deepens, exits or retires the right bit across reload/device.

**G3 — Humor quality is not certified from a corpus of real turns.** Add a source-neutral evaluation set covering emotional timing, naturally timed humor, no-joke decisions, cultural misfires, humor fatigue, hostile/roasting boundaries, task reentry, satire vs fact, RNC pushback and longitudinal consistency.

**G4 — The acoustic voice remains subject to explicit user listening/selection, exact SHA/fingerprint approval, speaker QC, native provider commissioning, and real Ask/Director/phone receipts.** Source certification and generated audition candidates cannot replace those steps.

## P0 repair in this branch

- `apps/jhadina-web/src/lib/context/context-builder.ts`: repair truncated-stem exact-boundary detection of inflected suicidal, hallucination, medication, diagnostic, psychiatric and symptom requests. These must enter high-stakes/serious posture before a playful register or quip is considered.
- `apps/jhadina-web/src/lib/context/personality-humor-safety.test.ts`: adversarial end-to-end high-stakes expression tests plus normal-playfulness control.
- `packages/jhadina-core-spine/src/personality-behavior-expression.ts`: refuse an already-selected upstream quip when current-turn posture has become serious or the user signals discomfort.
- `packages/jhadina-core-spine/src/conversation-craft.test.ts`: regression coverage for the preselected-quip bypass.

## Next build sequence: JHADINA-PERSONALITY.LIVE.1–.9

1. **.1 — Source certification.** Merge P0 only after exact-head Core Spine, Ask unit/integration, typecheck and build checks pass; preserve a failed receipt if any check is red.
2. **.2 — Candidate proposal interface.** Reuse `QuipCandidateGenerator` and the existing model/provider abstraction. Accept 0–3 proposed short quips for an already-decided semantic response; reject unsafe/untrusted candidate text and never modify the proposal's recommendation, evidence or action.
3. **.3 — Production composition.** Wire `runQuipFastLane` / `buildPersonalityBehaviorExpressionPlan` into the actual Ask production path. No second personality engine; do not call a billable provider merely to force a joke. Preserve an explicit no-quip decision.
4. **.4 — Governed live session.** Pass ephemeral `SessionExpressionState` and `BanterBitRuntime` across actual turns without admitting them as durable Memory or falsely extending a bit.
5. **.5 — Callback reconciliation.** Use immutable independent evidence and correction/forget, ensure callbacks do not appear on cold starts or after support expires.
6. **.6 — Surface parity.** Feed approved quips, callbacks and prosody into text and canonical audio (once voice approved), with fast-lane onset, barge-in and return-to-task.
7. **.7 — RNC humor evaluation.** Run >30 diverse turns, including joke/no-joke, conversational observation, playful disagreement, shared banter, satire, cultural language, distress, precision, clinical, finance, grief and emergency. Grade timing, relevance, cruelty, naturalness, semantics, serious suppression and humor fatigue. Report failures and false positives.
8. **.8 — Longitudinal certification.** Check drift, learning bounds, persona coherence, callback fatigue and memory revocation over multiple sessions and different surfaces.
9. **.9 — Real-world canary / FINAL.** Test native conversation with owner, collect approved evaluation receipts, then certify Personality `SOURCE`, `LIVE_TEXT` and `LIVE_VOICE` separately. Do not claim production certification with only source tests.

## Operational constraints

- Current phone/portable Homebase can remain the owner/control surface. No personality logic may depend on a billable RunPod GPU being continuously up.
- Use RunPod only as an optional bounded heavy-research/audio-training worker, not as the authority or memory owner.
- Reuse already-proven Supabase/Memory/Context and Voice contracts; recover unhealthy infrastructure before claiming end-to-end operation.
- An original speaker identity is mandatory; no real-person acoustic imitation.
