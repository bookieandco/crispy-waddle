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

### Existing Director voice stack

Reuse the existing governed Director boundaries for:
- FFmpeg decoding
- voice sync
- Rhubarb phoneme/viseme timing
- MuseTalk/Wav2Lip visual synchronization
- voice identity references

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

## TTS realization target

The Expression Kernel should supply semantic delivery hints such as:
- serious vs conversational
- response length
- warmth/directness
- permitted humor/profanity
- deliberate pauses
- emphasis targets
- speaking-rate target
- interruption/barge-in state

The TTS provider realizes those hints in the selected language while preserving the same canonical Jhadina voice identity.

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

## Runtime work still required for full native voice

1. Jhadina Voice Service endpoint (ASR/TTS/prosody contract).
2. Faster-Whisper / Whisper-Timestamped adapter derived from Voice-Pro patterns.
3. F5-TTS / CosyVoice adapter derived from Voice-Pro patterns.
4. VoxCPM adapter.
5. VibeVoiceFusion adapter.
6. Canonical JhadinaVoiceProfile with cross-provider calibration clips.
7. Native wake-word engine + owner speaker verification.
8. Streaming TTS + barge-in.
9. Native-device audio route.
10. End-to-end multilingual voice quality certification.
