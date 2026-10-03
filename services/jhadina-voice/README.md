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
