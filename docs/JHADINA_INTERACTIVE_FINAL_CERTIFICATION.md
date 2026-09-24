# JHADINA-INTERACTIVE.FINAL — Certification

Certification date: 2026-09-23 (America/Los_Angeles)

Status: **CERTIFICATION COMPLETE — WEB PRODUCTION PASS / NATIVE VOICE BLOCKED_EXTERNAL / FULL NATIVE PASS WITHHELD**

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
| INT.1 | explicit live phase controller | **PASS** | N/A | production bundle verified |
| INT.2 | wake once + natural follow-up | **PASS** | browser dependent | deployed; physical microphone drill not run |
| INT.3 | background speech ignored before wake | **PASS** | browser dependent | deployed; physical microphone drill not run |
| INT.4 | ordinary reasoning barge-in | **PASS** | current web runtime | deployed; physical active-speech drill not run |
| INT.5 | stale-turn suppression | **PASS** | current web runtime | production bundle verified |
| INT.6 | progressive native TTS stream | **PASS** | **BLOCKED_EXTERNAL** — native voice service not provisioned | native live receipt blocked |
| INT.7 | browser chunked TTS fallback | **PASS** | browser dependent | production bundle verified; physical audio drill not run |
| INT.8 | cancellation propagation | **PASS** | current web runtime | production bundle verified |
| INT.9 | Expression delivery -> speech | **PASS** | provider dependent | browser fallback deployed; native provider receipt blocked |
| INT.10 | screen/file context retained | **PASS** | current web runtime | deployed; physical screen-share drill not run in this certification |
| INT.11 | WorkSession continuity retained | **PASS** | Supabase ready | deployed; second-device physical drill not run |
| INT.12 | canonical voice identity | **PASS** | native providers blocked | browser fallback only; native identity A/B blocked |
| INT.13 | live presence UI | **PASS** | current web runtime | production bundle verified |
| INT.14 | approval/policy invariants | **PASS** | existing policy runtime | production route remains identity-gated |
| INT.15 | production interaction smoke | **PASS for deployment/routes** | production READY | Ask 200, health 200, voice route protected; physical microphone drill outstanding |

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

## Final receipt

Source head `fb5585d501f36ce05b1b4e6859a715ba04d3ebaf` passed the dedicated
`Jhadina Interactive Final Certification` workflow plus JLLM Runtime Final,
Personality Core, Launch Gate, Web Deploy Conformance, UX, Social, Growth, Media and
Spatial source/conformance workflows.

The feature merged through PR #675 as main SHA
`b2229a818de06e0e39362a3fbce86b4184225a10`.

Vercel deployment `dpl_JCJRdyznkpZUSJKB96quFCa5ESvD` is `READY`, targets
production, carries that exact main SHA, and has no alias error.

Production receipts:

- `GET /api/health` returned 200 and reported the exact main SHA,
  `environment=production`, and `durableMemory=ready`.
- `GET /ask-jhadina` returned 200.
- The served Ask Jhadina JavaScript bundle contains the live-presence UI,
  wake-once conversation path, native-voice health probe, progressive
  `/api/jhadina/voice/speak-stream` path, and interrupted-turn state.
- Unauthenticated `GET /api/jhadina/voice/health` returned 401, preserving the
  verified-session boundary.
- No runtime error clusters were found for the Ask/command/voice/health routes in
  the certification window.
- No error/fatal logs were found on the exact production deployment in that window.

Native compute remains separately tracked by GitHub issue #676. Railway rejected a
dedicated Jhadina Voice project with `Free plan resource provision limit exceeded`.
No unrelated PupsonStuff service was repurposed and no native/GPU spend was created.

## Final decision

**JHADINA-INTERACTIVE.FINAL certification is complete.**

- **SOURCE PASS**
- **WEB PRODUCTION PASS**
- **NATIVE VOICE = BLOCKED_EXTERNAL**
- **FULL NATIVE/PHYSICAL INTERACTION PASS = WITHHELD**

This is a completed certification result, not an unfinished audit. Promoting the
withheld native/physical line requires the receipts explicitly tracked in #676:
deployed Faster-Whisper, deployed native TTS, native streamed barge-in, and a real
microphone/audio drill. Until then, the production system correctly exposes browser
speech recognition/TTS as the admitted interactive fallback.
