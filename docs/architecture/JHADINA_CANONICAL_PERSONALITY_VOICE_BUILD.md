# JHADINA Canonical Personality + Voice Build

Status: **INTEGRATED BUILD SEQUENCE**

This is the canonical continuation path for the personality/reference work and the
native Jhadina voice work. The voice must not be certified independently of the
conversation-craft layer: a stable acoustic identity that cannot realize Jhadina's
humor, callbacks, banter, reflection, pushback, and relationship history is incomplete.

## Architectural target

```text
Experience / Memory / Hippocampus
        |
Pattern + Personality eligibility
        |
PersonalityState
        |
Real Nigga Core
        |
Behavioral Kernel
        |
Conversation Craft
  - Quip Engine
  - Banter Bit Engine
  - Callback Learning
        |
Expression Kernel
        |
Expression / Prosody Genome
        |
Canonical Jhadina Speaker Identity
        |
TTS provider
        |
Voice / Director / Phone / Desktop / Ask Jhadina
```

The layers have separate authority:

- Memory supplies evidence and relationship history.
- Personality supplies durable tendencies.
- Real Nigga Core supplies authentic behavioral posture.
- Behavioral Kernel chooses the behavioral action.
- Conversation Craft decides whether and how a joke/bit/callback structure may run.
- Expression Kernel produces bounded presentation instructions.
- Voice realizes those instructions while preserving one canonical speaker identity.

None of these layers may grant permissions, alter factual conclusions, or override
Values/Policy.

## Reuse the Bonez voice stack

Jhadina must reuse and generalize the production voice-identity machinery already built
for Bonez instead of creating a parallel identity system.

The Bonez path already provides reusable primitives for:

- `director_voice_identities`;
- `director_voice_reference_samples`;
- `director_voice_provider_bindings`;
- `director_voice_language_variants`;
- provider-independent ECAPA speaker-fingerprint receipts;
- exact candidate/reference SHA-256 binding;
- explicit human voice-identity approval receipts;
- minimum speaker-similarity thresholds;
- provider/model/runtime provenance;
- production live-take QC receipts;
- forced-failure + localized-repair receipts;
- RunPod speaker-QC runtime bootstrap.

Bonez remains a separate identity (`voice:bonez:canonical:v1`). Jhadina must receive
her own identity (for example `voice:jhadina:canonical:v1`) and her own reference /
fingerprint / approval records. Reuse the machinery, never Bonez's acoustic identity.

The Director tables and QC contracts should be extracted/generalized behind a shared
voice-identity service so Director, Ask Jhadina, desktop, phone, and future embodied
surfaces all resolve the same admitted Jhadina identity.

## JHADINA-VOICE.1 — Namesake and personality corpus

Source:

- `docs/architecture/JHADINA_PERSONALITY_REFERENCE_CORPUS_2026-09-23.md`
- `docs/architecture/jhadina-expression-final.md`

Requirements:

- Conversations with J remains the namesake/foundation expression reference.
- Secondary transcript/personality references contribute mechanics only.
- Duplicate source material is deduplicated.
- Technical production tutorials remain outside Personality.
- Reference identities never become runtime impersonation instructions.

Exit gate:

- corpus and provenance are explicit;
- source-personality names cannot leak into runtime strategy objects.

## JHADINA-VOICE.2 — Jhadina Quip Engine

Restore the fast-lane behavior designed in the earlier personality/quip work.

Target flow:

```text
event / statement
  -> quip eligibility gate
  -> notice a usable contrast
  -> produce 1-3 tiny candidate structures
  -> rank
  -> emit best candidate intent or emit none
  -> continue the actual task
```

Candidate ranking must consider:

- naturalness
- timing
- context fit
- relationship fit
- Jhadina personality fit
- truth/evidence compatibility
- repetition/callback fatigue
- cruelty/discomfort risk
- task interruption cost

Hard rule: **do not force a joke**. A low-quality quip decision yields no quip.

The engine must preserve the earlier humor grammar where appropriate:

```text
reality
  -> contrast
  -> escalation
  -> optional self-implication
  -> callback/punchline
  -> truth reconnect
```

Serious, precision-sensitive, high-stakes, or distress contexts bypass the engine.

The Quip Engine does not become a canned phrase database. It emits governed structure
and bounded candidate material for realization.

## JHADINA-VOICE.3 — Banter Bit Engine

Implement the missing stateful bit grammar on top of existing
`SessionExpressionState`.

Target state machine:

```text
NOTICE
  -> TWIST
  -> ESCALATE
  -> PEAK
  -> CALLBACK
  -> EXIT / RETURN TO TASK
```

Rules:

- ordinary depth should remain short;
- deeper escalation requires the user to actively build the bit;
- discomfort immediately terminates the bit;
- task competence wins over banter;
- repeated premises decay to avoid running jokes into the ground;
- a bit is session-ephemeral by default;
- the engine must know how to exit cleanly and resume the real task.

Existing `bitDepth`, `conversationTemperature`, `userBuildingBit`,
`activeStoryAnchor`, `activeTangents`, and `discomfortDetected` become inputs to
this engine rather than the entirety of the engine.

## JHADINA-VOICE.4 — Callback Learning Engine

Close the current gap between ephemeral session bits and proven relationship callbacks.

Target flow:

```text
shared moment / joke
  -> SessionBit
  -> positive/repeated natural reuse
  -> Hippocampal evidence
  -> callback candidate
  -> independent recurrence / provenance check
  -> RelationshipState.recurringCallbacks
  -> eligible for selectEvidenceBackedCallback()
```

Three memory timescales remain distinct:

1. turn context — immediate referents;
2. session-bit memory — temporary shared riff, `durable: false`;
3. relationship callback memory — durable only after evidence/provenance admission.

Personality remains a fourth, higher-order layer and must not be used as a callback
store.

Requirements:

- no fabricated "remember when" behavior;
- duplicate evidence cannot promote a callback;
- one successful joke cannot become relationship lore;
- correction/forgetting/revocation must invalidate callback support;
- recurring callbacks need fatigue/recency controls so familiarity does not become
  repetitive fan service.

## JHADINA-VOICE.5 — Full Expression / Prosody Genome

Expand the provider-neutral delivery contract beyond rate and pause scale.

The semantic expression plan should be able to project bounded controls such as:

- cadence
- micro-pause density
- thought-pause duration
- speaking rate
- pitch range
- pitch contour target
- energy
- warmth
- grounded confidence
- conversationality
- intimacy/distance
- breathiness target
- emphasis
- sentence finality
- spontaneity
- reaction intensity
- playfulness
- operational sass
- absurd escalation
- poetic compression
- storytelling intensity

These are delivery controls, not emotion diagnoses.

The same woman/speaker identity must remain stable when expression changes.

## JHADINA-VOICE.2-.5 source implementation receipt

Source implementation now exists for the immediate conversation-craft sequence:

- `packages/jhadina-core-spine/src/quip-engine.ts`
  - provider-neutral three-candidate fast lane;
  - deterministic ranking;
  - explicit no-quip outcome;
  - truth compatibility / cruelty / repetition / interruption penalties.
- `packages/jhadina-core-spine/src/banter-bit-engine.ts`
  - ephemeral notice -> twist -> escalate -> peak -> callback -> exit state machine;
  - user-building-bit depth control;
  - discomfort and zero-depth immediate exit.
- `packages/jhadina-core-spine/src/callback-learning.ts`
  - independent immutable evidence assessment;
  - duplicate evidence collapse;
  - separate admission and retirement;
  - relationship callback promotion without using Personality as a joke store.
- `packages/jhadina-core-spine/src/callback-provenance.ts`
  - recent-use fatigue suppression for already-admitted callbacks.
- `packages/jhadina-core-spine/src/expression-kernel.ts`
  - governed quip/banter transport;
  - full provider-neutral prosody genome;
  - serious/posture suppression remains authoritative.
- `packages/jhadina-core-spine/src/personality-behavior-expression.ts`
  - conversation craft is now part of the Personality -> RNC -> Behavioral -> Expression vertical slice.
- `packages/jhadina-core-spine/src/voice-runtime.ts`
  - prosody genome transported into TTS delivery.
- `services/jhadina-voice/app.py`
  - bounded HTTP validation/transport for the expanded delivery genome.
- `packages/jhadina-intelligence-core/src/expression-realization.ts`
  - quips remain separate governed render segments;
  - banter/prosody fields survive the Intelligence presentation boundary.

Regression coverage includes forced-joke suppression, serious/discomfort suppression,
short ordinary bits, duplicate callback evidence, callback fatigue/retirement,
vertical-slice integration, prosody-to-TTS transport, and governed Intelligence
serialization.

Status: **SOURCE IMPLEMENTED — exact-head CI receipt required before certification.**

## JHADINA-VOICE.6 — Canonical Original Speaker Identity

Create an original, versioned Jhadina acoustic identity by generalizing the Bonez
admission path.

Required reuse:

- create a Jhadina record through the same governed voice-identity model used by Bonez;
- admit exact reference samples with SHA-256 and rights/provenance;
- generate a provider-independent ECAPA speaker fingerprint through the pinned
  speaker-QC runtime;
- bind an explicit approval receipt to the exact reference SHA + fingerprint;
- define and enforce a minimum speaker-similarity floor;
- bind provider/model/runtime provenance without letting the provider own identity.

Required identity metadata exposed to the Jhadina voice runtime:

- `voiceProfileId`
- `voiceIdentityId`
- `voiceIdentityVersion`
- `speakerReferenceId`
- `speakerFingerprintReceiptId`
- `speakerFingerprintRef`
- `speakerEmbeddingHash` or fingerprint digest
- `minimumSpeakerSimilarity`
- `calibrationCorpusVersion`

The namesake and reference corpus may influence performance mechanics but do not
authorize biometric cloning of a real person's voice. Any external voice reference
must remain rights/consent-governed.

## JHADINA-VOICE.6 source implementation receipt

The shared identity/QC contract is now source-implemented.

Implemented:

- `voice:jhadina:canonical:v1` is the permanent Jhadina acoustic-identity target.
- Jhadina is modeled as an `assistant` subject, never as a fake Director character.
- Candidate / approved / retired identity states are explicit.
- Exact reference-sample SHA-256, rights provenance, provider/model bindings,
  language variants, ECAPA-style fingerprint receipts, explicit approval receipts,
  similarity floors and generated-audio QC are provider-neutral Core Spine contracts.
- The existing Bonez / Director identity, fingerprint and approval structures map
  into the shared contract through a compatibility adapter.
- Bonez remains `voice:bonez:canonical:v1`; no Bonez acoustic sample, embedding or
  provider voice reference becomes Jhadina input.
- The native Jhadina voice boundary now carries both
  `voiceProfileId=jhadina:canonical` and
  `voiceIdentityId=voice:jhadina:canonical:v1`.
- Native TTS providers must echo both IDs; identity substitution fails closed.
- `voiceProfileWithApprovedIdentity()` cannot promote Jhadina's runtime profile
  until the shared identity has an admitted fingerprint and approval receipt.

Current status:

**SOURCE IMPLEMENTED / CANDIDATE IDENTITY — NOT YET ACOUSTICALLY APPROVED.**

Still required before Jhadina's identity is production-approved:

1. generate/audition original Jhadina candidate audio;
2. select an exact reference sample and bind its SHA-256 + rights provenance;
3. run the pinned provider-independent speaker fingerprint worker;
4. create the shared persistence migration through the normal Supabase migration
   workflow rather than inventing a migration filename;
5. persist the candidate, fingerprint and provider provenance;
6. obtain explicit approval for the exact sample + fingerprint;
7. change the runtime identity state from `candidate` to `approved`;
8. run a real generated take through the similarity floor and forced-drift rejection.

The permanent identity ID is therefore stable now, while the acoustic identity remains
honestly unapproved until the audition/admission sequence is completed.

## JHADINA-VOICE.7 — Calibration Reference Pack

Create identity-consistent reference/calibration material covering at least:

- normal
- thoughtful
- playful
- serious
- excited
- quiet/intimate
- command/urgent
- storytelling
- skeptical / make-it-make-sense
- operational sass
- short quip
- escalating shared bit
- callback/reentry to task

All samples must preserve the same canonical speaker identity.

## JHADINA-VOICE.7 source implementation receipt

The calibration/audition contract is now source-implemented.

Implemented:

- one versioned calibration pack bound to `voice:jhadina:canonical:v1`;
- thirteen required registers: normal, thoughtful, playful, serious, excited, quiet/intimate, command/urgent, storytelling, Make-It-Make-Sense skepticism, operational sass, short quip, shared-bit escalation, and callback/reentry;
- original calibration copy only — no quotes, source-person imitation prompt, or biometric reference is embedded in the pack;
- every sample carries bounded provider-neutral prosody targets and `identityMustRemainStable=true`;
- serious calibration explicitly forbids playful/sass/escalation delivery;
- a governed audition plan supports multiple provider candidates while the identity remains `candidate`;
- audition candidate receipts require exact artifact SHA-256, provider/model/task provenance, calibration sample IDs, transcript/duration, and `qualityClaim=false`;
- shortlist and rejection are explicit audition states;
- shortlisting never promotes the canonical identity to `approved`;
- rejected candidates cannot be silently resurrected;
- a read-only calibration manifest is exposed through the Jhadina voice API so audition/provider surfaces consume one canonical pack.

Still required for live `.7` completion:

1. run the calibration pack through admitted native TTS candidate providers;
2. retain exact candidate audio bytes in private storage;
3. calculate and persist each candidate artifact SHA-256;
4. audition/shortlist a candidate;
5. pass the shortlisted exact artifact into the `.6` fingerprint + explicit-approval admission flow.

Status: **SOURCE IMPLEMENTED — LIVE AUDITION RECEIPT REQUIRED.**

## JHADINA-VOICE.8 — Native Provider Runtime

Complete and certify the native provider path around the existing
`services/jhadina-voice` service while reusing Bonez's provider-independent identity
and speaker-QC contracts.

Preferred native candidates include Qwen3-TTS and VoxCPM2 with provider-neutral
fallback. Provider changes must not change Jhadina's identity.

Native provider requests should carry the immutable identity metadata plus the full
bounded delivery genome. Every generated take must be eligible for ECAPA comparison
against the admitted canonical fingerprint. Provider responses must fail closed when
they return a different/missing identity or when measured speaker similarity falls
below Jhadina's approved floor.

Where Director's existing live-take QC and repair receipts are generic enough, reuse
them. Where they are Bonez-specific, extract the underlying contract instead of
duplicating the implementation.

## JHADINA-VOICE.9 — Streaming, barge-in, and conversational timing

Integrate:

- progressive streaming TTS
- interruption/barge-in
- short quip fast-lane timing
- pause-aware response onset
- clean cancellation
- resumed/replanned speech after interruption
- continuity of speaker identity across chunks

A fast quip must not require waiting for an entire long-form response to synthesize.

## JHADINA-VOICE.10 — Surface unification

The same canonical identity and expression runtime must serve:

- Ask Jhadina
- desktop Jhadina
- phone/device Jhadina
- Director when Jhadina appears or narrates
- Music/creative surfaces where Jhadina herself speaks
- future embodied interfaces

No surface may invent a second "Jhadina voice."

## JHADINA-VOICE.11 — Memory/personality/voice integration tests

Required scenarios:

- verified relationship callback is spoken naturally;
- unsupported callback is suppressed;
- successful session bit remains non-durable;
- repeated proven callback can be admitted through governed provenance;
- serious/high-stakes context kills quip, bit, profanity, sass, and callback;
- playful context permits a short bit without semantic mutation;
- discomfort kills a bit immediately;
- correction/forgetting removes invalid callback support;
- expression changes do not change speaker identity;
- provider failover preserves identity metadata;
- ECAPA speaker-QC verifies the generated voice against Jhadina's admitted fingerprint;
- a below-floor speaker match fails closed;
- an explicit voice-approval receipt is required before production use;
- forced voice drift/failure can be detected and locally repaired without changing the approved identity;
- no transcript-reference name reaches runtime as an imitation instruction.

## JHADINA-VOICE.FINAL — Canonical voice certification

Final certification requires all of the following together:

- namesake/reference corpus provenance;
- Personality -> Real Nigga Core -> Behavioral Kernel path;
- Quip Engine;
- Banter Bit Engine;
- Callback Learning Engine;
- Expression/Prosody Genome;
- original canonical speaker identity admitted through the generalized Bonez voice-identity path;
- provider-independent speaker fingerprint + explicit approval receipt;
- native provider identity lock + similarity enforcement;
- streaming/barge-in;
- cross-surface reuse;
- serious-mode/evidence firewalls;
- exact-head automated test receipt.

The final acceptance question is not merely "does Jhadina speak?"

It is:

> Does the same Jhadina identity remember appropriately, react naturally, know when to
> joke or stop joking, carry shared history without inventing it, preserve her
> independent posture, and sound recognizably like the same person across every
> register and surface?
