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
