# JLLM Unified Voice Runtime

Status: source integration plan for `feat/jllm-unified-interface`.

## Goal

Jhadina has one governed voice identity and one conversation pipeline. Individual ASR/TTS/voice-cloning engines are replaceable providers; they do not own personality, memory, authorization, or subsystem execution.

```
microphone / audio / video
  -> local wake word / explicit capture
  -> FFmpeg canonical decode + normalization
  -> ASR
  -> acoustic/prosody observations
  -> Jhadina context + Personality + Real Nigga Core
  -> response language + expression directive
  -> TTS provider
  -> viseme timing / embodiment
```

## Provider references

### Voice-Pro (abus-aikorea/voice-pro)

Audited against upstream v4.0.0 (2026-07-13).

Useful components:
- openai-whisper / faster-whisper / whisper-timestamped
- FFmpeg media normalization
- live transcription and translation
- F5-TTS zero-shot voice cloning
- CosyVoice / Fun-CosyVoice3
- Kokoro
- Edge-TTS and optional Azure TTS
- Deep Translator / optional Azure translation
- language detection
- Demucs / MDX-style source separation for noisy media

Integration rule:
- Do not embed Voice-Pro's Gradio UI into Ask Jhadina.
- Do not let a TTS/ASR provider mutate Jhadina personality or memory.
- Extract/adapt the engines behind a provider-neutral Jhadina voice service.
- Preserve source license notices for reused code and dependencies.
- Treat cloned voice references as consent/rights-governed assets.

### VoxCPM

Primary local multilingual/high-fidelity TTS candidate.

### VibeVoiceFusion

Candidate for multi-speaker / cloning / LoRA voice realization.

### Existing Director / Bonez voice stack

Reuse the existing governed Director boundaries for:

- FFmpeg decoding;
- voice sync;
- Rhubarb phoneme/viseme timing;
- MuseTalk/Wav2Lip visual synchronization;
- `director_voice_identities`, reference samples, provider bindings and language variants;
- Bonez's provider-independent ECAPA speaker-fingerprint receipt flow;
- exact audio SHA binding and explicit voice approval receipt;
- minimum speaker-similarity enforcement;
- RunPod speaker-QC runtime;
- live-take QC and localized-repair receipt patterns.

Jhadina must get her own canonical identity and fingerprint. The Bonez acoustic identity
is never reused; only the infrastructure and governance contracts are shared.

## Conversation subtlety / non-robotic behavior

FFmpeg is the canonical decoder, not an emotion detector.

For recorded media:
- decode to mono PCM through `createNodeFfmpegDecoder`
- analyze timing and acoustic shape with `observeConversationProsody`
- retain pause ratio, RMS mean/peak, energy variance, pitch mean/variance
- align acoustic observations with timestamped ASR segments

For live microphone turns:
- use local Web Audio measurements so always-on audio is not uploaded merely to obtain prosody
- attach a bounded `ConversationSignalContext` to that turn
- transcript remains the semantic source; acoustic cues are secondary evidence

Never infer emotion, honesty, health, identity, or intent from pitch/loudness alone.

## Conversation-craft dependency

Native voice certification depends on the integrated build in
`docs/architecture/JHADINA_CANONICAL_PERSONALITY_VOICE_BUILD.md`.

Before TTS realization, Jhadina's governed conversation-craft layer must handle:

- short quips without forcing a joke;
- stateful banter bits with setup/escalation/exit;
- provenance-backed recurring callbacks;
- clean return to the actual task;
- serious/high-stakes suppression.

The current `allowQuip` and `bitDepth` fields are gates, not a complete
comedy/banter runtime.

## TTS realization target

The Expression Kernel should project a provider-neutral expression/prosody genome,
including bounded delivery hints such as:

- serious vs conversational;
- response length;
- warmth/directness;
- permitted humor/profanity;
- cadence and micro-pause density;
- thought-pause duration;
- emphasis targets;
- speaking-rate target;
- pitch-range / contour target;
- energy and grounded confidence;
- conversationality and intimacy/distance;
- playfulness / sass / absurd escalation;
- poetic compression / storytelling intensity;
- interruption/barge-in state.

The TTS provider realizes those hints while preserving the same canonical Jhadina
speaker identity. Generated audio should be verifiable against the admitted
provider-independent speaker fingerprint using the same generalized QC pattern already
used for Bonez.

## Current usable interface

PR #613 currently provides:
- Ask Jhadina wake phrase: `Jhadina` / `Hey Jhadina` where browser speech recognition is available
- multilingual speech-recognition locale selection
- browser TTS fallback for spoken responses
- local acoustic nuance capture for spoken turns
- explicit screen sharing with refreshed visual evidence
- image and bounded text attachment input
- multimodal evidence passed through the existing governed Ask Jhadina context
- Personality / Real Nigga Core remains above model/provider layers

## Canonical remaining build sequence

The older provider-only checklist is superseded by the integrated sequence in
`docs/architecture/JHADINA_CANONICAL_PERSONALITY_VOICE_BUILD.md`:

1. namesake/personality corpus;
2. Quip Engine;
3. Banter Bit Engine;
4. Callback Learning Engine;
5. full Expression / Prosody Genome;
6. Jhadina voice identity admitted through the generalized Bonez identity/fingerprint/approval path;
7. calibration reference pack;
8. native TTS provider identity lock + ECAPA similarity enforcement;
9. streaming/barge-in/fast-lane timing;
10. cross-surface unification;
11. memory/personality/voice integration tests;
12. exact-head final certification.

Existing service/ASR/provider work remains reusable implementation underneath this
sequence; it no longer defines completion by itself.
