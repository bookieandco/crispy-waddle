# Director local-first UGC / human-media convergence

**Date:** 2026-10-06  
**Repository:** `bookieandco/crispy-waddle`  
**Branch:** `feat/director-local-ugc-stack-20261006`

## Goal

Fold the current Arcads/UGC work and the newly supplied open-source references into the **existing Director** without creating another editor, scheduler, Business Factory renderer, voice authority, or media supervisor.

Canonical execution preference:

```
Homebase / local GPU
        ↓ if unavailable or insufficient
metered GPU burst (RunPod or equivalent)
        ↓ only when explicitly admitted
metered external API
        ↓ last resort / explicit authorization
subscription SaaS (Arcads-class)
```

Paid subscription services are **not** the production default. They remain optional benchmark/fallback providers so Director can compare quality, latency and cost-per-accepted-output without becoming dependent on them.

## Canonical ownership

- Director Workstation remains the editing/co-directing surface.
- `@jhadina/compute-core` remains the compute scheduler/router.
- Director UGC Product Truth, creator rights, claim evidence and disclosure gates remain authoritative.
- Watch / human-media QC remains responsible for take evaluation and accepted-output evidence.
- Growth remains responsible for experiments, attribution and contribution economics.
- Social remains responsible for governed scheduling/publication.
- Business Factory supplies opportunity/product/offer/customer context.
- External/open-source projects are provider or architecture references only.

## Source fold

### Anil-matcha/Open-AI-UGC

**Disposition:** architecture/workflow reference only.

Useful patterns:
- multi-model UGC selector;
- up to seven reference images;
- async generation webhook;
- creation history;
- credits/cost accounting;
- simple model capability metadata.

Do **not** adopt:
- its separate SaaS UI/auth/billing stack;
- its database as Director truth;
- MuAPI as a required runtime.

Reason: the code is open source, but the generation path is MuAPI-backed. It therefore does not satisfy local-first execution by itself.

### PunithVT/ai-avatar-system

**Disposition:** local runtime architecture reference.

Harvest:
- persistent MuseTalk worker instead of loading weights per request;
- sentence/chunk streaming;
- worker health and observability;
- local-first storage;
- GPU/CPU fallback patterns;
- cancellation/barge-in concepts for interactive avatars.

Do **not** duplicate:
- its standalone chat UI;
- auth/database;
- scheduler;
- LLM orchestration.

Director Workstation and Compute Core already own those concerns.

### TMElyralab/MuseTalk

**Disposition:** primary local lip-sync / video-dubbing worker candidate.

Target role:
`canonical voice/audio + source/animated actor video -> MuseTalk -> lip-synced take`

Execution:
- Homebase/local GPU first;
- same container on RunPod/equivalent as burst;
- no subscription required.

Code license observed: MIT.  
Production gate: verify exact model/dependency artifacts before commercial admission.

### KlingAIResearch/LivePortrait

**Disposition:** primary local portrait-motion / expression worker candidate.

Target role:
`approved portrait/reference + motion/expression driver -> LivePortrait -> performance take`

Use for:
- gestures;
- head/body portrait movement;
- expression transfer;
- more natural UGC performance before/after lip sync.

Code license observed: MIT.

**Commercial blocker:** upstream explicitly says bundled InsightFace detection models are non-commercial research models. Commercial admission requires replacing those detection models and recording the replacement + artifact license evidence.

### OpenTalker/SadTalker

**Disposition:** fallback local talking-head worker.

Use when:
- MuseTalk path is unavailable;
- only a single still exists;
- a cheap fallback/prototype is preferable;
- the output passes Watch/QC.

Code license observed: Apache-2.0.  
Production gate: verify all third-party model artifacts/dependencies used in the exact runtime bundle.

### coqui-ai/TTS

**Disposition:** local voice/speech framework candidate.

Target role:
`Director SpeechPerformancePlan -> admitted local voice model -> WAV/stems -> MuseTalk`

Capabilities:
- text-to-speech;
- multilingual speech;
- voice cloning where the admitted model supports it;
- voice conversion;
- streaming.

Framework code license observed: MPL-2.0.

**Important:** model licenses are separate from framework code. Production voice models must be admitted individually with commercial-use and voice-rights evidence. Do not assume every Coqui-distributed model is suitable for commercial client work.

## Arcads position after this fold

Arcads is no longer the default UGC execution path.

It becomes:
1. a quality benchmark;
2. an optional premium whole-video/talking-actor provider;
3. a last-resort provider when local + GPU-burst routes cannot meet the accepted quality/runtime requirement;
4. a source of feature/product ideas such as actor filters, voice controls, gestures, workflows and batch variation.

Its output still returns through Director QC and the Workstation.

## Local UGC production path

```
Business Factory / Growth research
        ↓
Product Truth + audience + offer + evidence-backed angle
        ↓
Director UGC plan / script / creator + rights
        ↓
Director voice performance plan
        ↓
local admitted TTS model (Coqui framework candidate)
        ↓
reference actor / generated actor / approved character
        ↓
LivePortrait when motion/expression transfer is useful
        ↓
MuseTalk 1.5 primary lip sync
        ↓
SadTalker fallback where appropriate
        ↓
OHBench-style + Watch + Product Truth QC
        ↓
Director rough cut / B-roll / captions / Foley / mix
        ↓
final QC
        ↓
Growth experiment / governed Social proposal
        ↓
performance + realized economics
```

## Compute policy

The source contract `local-human-media-stack.ts` makes the default policy:

- prefer local/Homebase;
- allow metered GPU burst;
- disable metered external APIs by default;
- disable subscription SaaS by default.

A paid API or subscription cannot beat a healthy, commercially admitted local worker merely because its quality score is slightly higher. Premium providers must be explicitly admitted by policy.

Provider comparison should optimize **cost per accepted output**, not advertised cost per render:

`compute/API cost + retries + failed generations + post repair + human time -> accepted master`

## Licensing/provenance rules

Code license is not sufficient production evidence.

Each live worker needs:
- exact upstream commit/tag;
- runtime container digest;
- model/checkpoint digest;
- model license basis;
- dependency/model artifact license evidence;
- commercial-use decision;
- worker health receipt;
- benchmark/QC receipt;
- provenance retained on generated outputs.

No reference catalog record becomes a live provider merely because the source is public.

## Current source implementation

This branch adds:

- human-media capabilities to Director's generation capability vocabulary;
- reference-only provider/model catalog records for MuseTalk, LivePortrait, SadTalker and Coqui TTS;
- a local-human-media source fold covering all six supplied repositories;
- commercial license gates;
- local-first execution policy;
- routing tests proving local -> GPU burst -> paid external/subscription order.

It does **not** fabricate live worker admission or claim models are installed.

## Next production sequence

`DIRECTOR-LOCAL-UGC.1 — source + license registry` **built on this branch**  
→ `.2 — container/runtime contracts for MuseTalk, LivePortrait, SadTalker, local TTS` **built: immutable runtime/model/image + health/execution receipt contracts**  
→ `.3 — Homebase worker health + compute profiles` **built: validated health receipts + per-engine GPU resource profiles + local-first selection**  
→ `.4 — RunPod/equivalent GPU-burst deployment for the same images` **built at routing/admission layer: burst is refused unless image digest, source revision and model bundle exactly match Homebase; real endpoint commissioning remains evidence-gated**  
→ `.5 — canonical local voice generation adapter`  
→ `.6 — LivePortrait performance/gesture adapter`  
→ `.7 — MuseTalk lip-sync adapter`  
→ `.8 — SadTalker fallback adapter`  
→ `.9 — OHBench/Watch human-media QC + reroll reasons`  
→ `.10 — cost-per-accepted-output router`  
→ `.11 — UGC variant/batch experiment integration`  
→ `.12 — optional Arcads/MuAPI premium fallback adapters`  
→ `DIRECTOR-LOCAL-UGC.FINAL`

## Commissioning boundary

Source work through the adapters and tests can proceed while SWLC/Supabase production is unhealthy.

Do not claim `DIRECTOR-LOCAL-UGC.FINAL` until:
- the selected runtime artifacts are commercially admitted;
- Homebase or a metered GPU-burst worker produces real media;
- voice rights/provenance are durable;
- Watch/OHBench-style QC produces real evidence;
- one Business Factory UGC canary reaches final QC and governed Social handoff;
- realized compute/provider cost is measured.

## .2-.4 implementation receipts

- `packages/director-core/src/human-media-worker-contract.ts` defines the canonical job, runtime-bundle, health and execution-receipt contracts.
- `packages/jhadina-compute-core/src/director-human-media-runtime.ts` defines MuseTalk, LivePortrait, SadTalker and Coqui resource profiles plus Homebase-first / RunPod-burst routing.
- Public GPU burst is fail-closed for sensitive media and for any runtime whose image digest, source revision or model artifact digests differ from the Homebase bundle.
- RunPod remains execution-only; every route returns `canonicalCommitTarget: HOMEBASE`.
- This is source-complete for `.2-.4`; it does not claim a real Homebase GPU or RunPod endpoint is commissioned. That live evidence belongs to the worker adapters/canary stages.
