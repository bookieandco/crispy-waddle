# JHADINA-INTERACTIVE.FINAL — Certification

Certification date: 2026-09-23 (America/Los_Angeles)

Status: **SOURCE CANDIDATE — exact-head CI and production/live receipts required**

## Goal

Make Jhadina feel like one continuous governed presence instead of separate text,
microphone, TTS, screen-share and tool features.

The interaction path is:

```text
wake / explicit mic
  -> live transcript / native Whisper when available
  -> current turn controller
  -> Context + Personality + RNC + Behavioral Kernel + Expression
  -> governed semantic response
  -> progressive speech stream / browser speech fallback
  -> interruption / next turn
  -> WorkSession + Hippocampus references
```

Interactive transport never grants action authority.

## Source implementation

### Conversation loop

Ask Jhadina exposes these live phases:

- idle
- listening
- understanding
- thinking
- speaking
- interrupted
- error

Voice turns are latest-turn-wins. A new voice turn can cancel an ordinary in-flight
reasoning request and speech playback. A stale aborted response cannot replace the
newer turn.

Governed production flows that may already be committing durable work are not
duplicated by barge-in. The UI reports that the existing governed production turn is
still active instead.

### Wake-once conversation

When browser continuous speech recognition is available:

1. background speech is ignored until the explicit wake word;
2. `Jhadina` / `Hey Jhadina` activates the live conversation;
3. the user can continue speaking naturally without repeating the wake word;
4. `stop listening`, `go to sleep`, `goodbye`, or `that's all` deactivates
   the conversation;
5. disabling wake recognition stops the acoustic monitor and active conversation.

### Barge-in

Speech start calls the interruption boundary.

It cancels:

- the current ordinary Ask HTTP request;
- progressive native TTS fetch;
- active native audio element;
- browser speech synthesis fallback.

The next finalized voice utterance becomes the active turn.

### Progressive TTS

Native voice supports a progressive NDJSON stream at:

`POST /v1/speak-stream`

Long semantic responses are split into bounded sentence/clause chunks. Each chunk is
synthesized and emitted as soon as it is ready, followed by a final `done` event.

The Vercel server bridge exposes:

`POST /api/jhadina/voice/speak-stream`

and forwards client cancellation upstream.

Expression presentation hints are forwarded as provider-neutral delivery metadata:

- rate
- pauseScale
- style/register

The canonical voice identity remains `jhadina:canonical`.

If native voice is unavailable, Ask Jhadina falls back to chunked browser
`SpeechSynthesis`, preserving interruption behavior and language selection.

### Live presence UI

Ask Jhadina displays:

- current interaction phase;
- whether wake conversation is active;
- an explicit Interrupt control while reasoning/speaking;
- the recent conversational exchange;
- existing screen/file/voice controls.

This display is presentation only and does not alter task authority.

## Existing capabilities retained

- browser wake phrase
- browser speech recognition
- native microphone recording bridge
- screen frame refresh
- ephemeral screen artifacts
- durable quarantined artifact flow
- WorkSession persistence
- Personality / RNC / Expression
- Ask Jhadina governed command routing
- browser TTS fallback
- native canonical voice contract

## Infrastructure result

A Railway project creation was attempted for the native Jhadina Voice runtime.

Railway returned:

```text
Free plan resource provision limit exceeded. Please upgrade to provision more resources!
```

Therefore:

- no Railway project/service was created;
- no unrelated Railway service was repurposed;
- no GPU/native TTS spend was created;
- native Faster-Whisper remains infrastructure-blocked;
- native Qwen3-TTS + VoxCPM2 remain infrastructure-blocked;
- browser recognition + browser speech remains the admitted live fallback.

Vercel Services was considered but would require changing the current Jhadina
project-root/framework topology to a multi-service beta layout. That risk is not
admitted solely to bypass the Railway resource limit.

## Invariants

- microphone input does not grant execution authority;
- wake word does not grant action approval;
- barge-in does not cancel or duplicate already-committing governed external work;
- stale response cannot overwrite the latest voice turn;
- acoustic cues remain observations, not emotion/intent/truth/health/identity claims;
- screen frames remain evidence with provenance, not automatic facts;
- voice provider cannot mutate Personality, Values, Policy or Memory;
- TTS provider cannot change `jhadina:canonical` identity;
- callbacks and cultural references remain governed expression assets;
- browser fallback does not weaken evidence or policy boundaries.

## Certification matrix

| Gate | Requirement | Source | Infrastructure | Live/production |
| --- | --- | --- | --- | --- |
| INT.1 | explicit live phase controller | implemented | N/A | pending |
| INT.2 | wake once + natural follow-up | implemented | browser dependent | pending |
| INT.3 | background speech ignored before wake | implemented | browser dependent | pending |
| INT.4 | ordinary reasoning barge-in | implemented | current web runtime | pending |
| INT.5 | stale-turn suppression | implemented | current web runtime | pending |
| INT.6 | progressive native TTS stream | implemented | native voice service blocked | blocked native |
| INT.7 | browser chunked TTS fallback | implemented | browser dependent | pending |
| INT.8 | cancellation propagation | implemented | current web runtime | pending |
| INT.9 | Expression delivery -> speech | implemented | provider dependent | pending/fallback |
| INT.10 | screen/file context retained | existing | current web runtime | pending |
| INT.11 | WorkSession continuity retained | existing | Supabase ready | pending |
| INT.12 | canonical voice identity | implemented | native providers blocked | fallback only |
| INT.13 | live presence UI | implemented | current web runtime | pending |
| INT.14 | approval/policy invariants | implemented | existing policy runtime | pending |
| INT.15 | production interaction smoke | pending | current main deployment required | pending |

## FINAL rule

`JHADINA-INTERACTIVE.FINAL` may be called:

- **SOURCE PASS** when exact-head focused CI, JLLM CI, type-check, tests and build pass;
- **WEB PRODUCTION PASS** when the merged exact lineage is READY and the Ask/live routes
  are healthy;
- **NATIVE VOICE PASS** only after a deployed real-audio Whisper + native TTS receipt;
- **FULL PASS** only when both web production and required physical microphone/audio
  drills exist.

A blocked native provider path must remain visible; browser fallback is not relabeled
as a two-provider native voice certification.
