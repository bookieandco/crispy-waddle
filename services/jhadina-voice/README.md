# Jhadina Voice Service

Native speech runtime for JLLM. This service owns audio normalization and speech-provider routing only. It does **not** own Jhadina's personality, Real Nigga Core, memory, permissions, repair authority, or subsystem execution.

## Runtime contract

1. admitted microphone/media bytes
2. FFmpeg normalize to mono 16 kHz PCM WAV
3. ASR provider with failover
4. transcript returns to Jhadina Intelligence
5. Expression Kernel chooses semantic delivery directives
6. TTS provider renders the canonical `jhadina:canonical` identity

The first native ASR target is Faster-Whisper. TTS engines are adapters and must preserve the canonical Jhadina profile. Voice cloning requires an admitted, consented voice reference.

## Production admission

Dependencies must be version-pinned before a production image is certified. The service fails closed when FFmpeg, ASR, or TTS is unavailable. Provider failures do not grant authority and do not change identity.


## Expression / prosody delivery contract

`/v1/speak` and `/v1/speak-stream` accept the provider-neutral delivery genome
projected by Core Spine. In addition to rate/pause/style and optional emphasis targets,
the service validates bounded fields for micro-pause density, thought-pause duration,
pitch range/contour, energy, warmth, grounded confidence, conversationality,
intimacy, breathiness, emphasis strength, sentence finality, spontaneity, reaction
intensity, playfulness, operational sass, absurd escalation, poetic compression, and
storytelling intensity.

These values are performance targets only. Providers must not treat them as emotion,
health, honesty, identity, or intent diagnoses. The canonical speaker identity remains
separate from expression and will be enforced by the generalized Bonez
fingerprint/approval path in JHADINA-VOICE.6+.


## Canonical calibration / audition

Jhadina's audition corpus is owned by Core Spine at
`packages/jhadina-core-spine/src/voice-calibration.ts`.

Consumers should use the read-only `GET /api/jhadina/voice/calibration` manifest to discover the pack identity/version rather than maintaining provider-specific prompt lists.

The calibration pack does **not** approve a voice. Candidate generation must preserve:

- `voiceIdentityId=voice:jhadina:canonical:v1`;
- exact candidate audio SHA-256;
- provider / model / provider-task provenance;
- calibration pack and sample IDs;
- unapproved candidate state;
- `qualityClaim=false`.

A shortlisted candidate still requires the shared speaker-fingerprint and explicit approval admission flow before the web health boundary may report the native Jhadina identity as approved.

## Production acoustic identity enforcement

`/v1/audition` and `/v1/speak` deliberately have different authority.

- `/v1/audition` can render the canonical identity target while it is still a candidate. Its response is always marked `candidate_unapproved`, `candidateUnapproved=true`, and `qualityClaim=false`.
- `/v1/speak` and every `/v1/speak-stream` chunk require an approved identity runtime.
- Production readiness requires two configured native TTS lanes, an explicit approval receipt ID, the exact approved reference file, a matching SHA-256, and a ready provider-independent speaker-QC service.
- Every admitted production take is compared acoustically against the exact reference. A take below the configured speaker-similarity floor fails that provider lane and routing may try the next provider.
- The provider must echo the exact `voiceProfileId`, `voiceIdentityId`, `modelId`, and `providerVoiceRef`; substitution fails closed.

The approved reference should be mounted read-only into the private voice runtime. `JHADINA_VOICE_REFERENCE_SHA256` is checked against the bytes on disk before synthesis is considered production-ready.

The existing Director/Bonez ECAPA service is intentionally reused. Point `JHADINA_SPEAKER_QC_URL` and `JHADINA_SPEAKER_QC_TOKEN` at that private worker, or use the legacy `DIRECTOR_SPEAKER_QC_URL/TOKEN` names when colocating the same service. The expected model remains the pinned `speechbrain/spkrec-ecapa-voxceleb` revision.

Each TTS lane additionally requires a fixed model/voice binding:

- `JHADINA_QWEN3_TTS_MODEL_ID` + `JHADINA_QWEN3_TTS_VOICE_REF`
- `JHADINA_VOXCPM2_TTS_MODEL_ID` + `JHADINA_VOXCPM2_TTS_VOICE_REF`

A configured endpoint without those bindings is not admitted as a native lane.


## Streaming timing / fast lane

`/v1/speak-stream` accepts a bounded `maxChars` value from 80–500. Ask Jhadina uses smaller budgets for already-governed fast-lane quips/callbacks and a larger budget for normal semantic speech.

The client owns interruption authority: one AbortController spans the whole spoken plan. Barge-in aborts the stream request, pauses the current audio element, cancels browser speech fallback, and prevents later planned segments from starting.

A native-stream failure before any audio is played may fall back to browser speech. Once native audio has played, the client does not restart the same segment from the beginning; it leaves the remaining response visible as text instead of double-speaking.

Chunk size is a latency control only. It does not weaken the `.8` speaker-similarity gate: every native chunk still goes through the approved identity/reference/QC path before it is emitted.
