# Director Camera, Performance & Realism Sharpening — 2026-09-22

## Goal

Sharpen Director so cinematography is not reduced to prompt adjectives.

The new invariant is:

```
creative intent
-> structured camera plan
-> structured performance plan
-> structured realism/source-preservation plan
-> storyboard persistence
-> provider-neutral compiled take
-> generation/capture/previs
-> directed-take QC
-> review/selection
```

A model, camera library, virtual-camera engine or vision system may execute/observe the plan. None of them becomes Director authority.

## Reference disposition

| Reference | Useful contribution | Director disposition |
|---|---|---|
| `wongmjane/nerv-theme` | Strong visual-system thinking and a cinematic green/industrial interface palette | UI/visual-language inspiration only. It is an editor theme, not cinematography logic. MIT metadata was present when reviewed. |
| `GUNMIN-KIM/AI-VIDEO-PRODUCTION-GUIDE-KO` | Intent-first direction, LOCK/PRESERVE vs CHANGE ONLY, camera grammar, physical cause/effect, short-generation/selection/edit workflow, timing and BPM guidance | High-value craft reference. Repository explicitly says no license was added, so concepts only; no source text/code is copied into Director. |
| `inanevin/Cine-AI` | Procedural cinematography, storyboard/timeline manipulation, runtime camera automation and extensible director-style datasets | Strong previs/virtual-camera reference. Director absorbs structured camera intent and provider-neutral execution, not named-director imitation as truth. MIT metadata was present. |
| `Martiusweb/CinemaDeNolan` | Historical interactive cinematography study material | Study/reference only. Code is GPLv3 and content is CC BY-NC-SA per README, so no direct production reuse. |
| `jianghd1996/Camera-control` | Example-, keyframe-, and text+keyframe-driven virtual camera control | Strong research reference for Director camera keyframes and future virtual-camera adapters. Keep implementation independent unless licensing is explicitly cleared. |
| `BlackPhlox/bevy_config_cam` | Configurable camera modes, FOV, movement speed, interpolation and look/follow behaviors | Useful capability-model reference for previs/game-engine adapters. README states dual MIT/Apache-2.0. |
| `SharpAI/DeepCamera` | Pluggable visual skills, frame processing, object detection/segmentation, local vision inference | Observation/QC provider pattern. Director may use comparable local visual evidence, but the surveillance/security product itself is not a Director dependency. MIT metadata was present. |
| `margelo/react-native-vision-camera` | High-performance mobile capture, multi-camera, FPS/resolution, HDR/night, smooth zoom and frame processors | Strong React Native physical-camera adapter candidate. Director owns the shot plan; VisionCamera-class providers expose capabilities and execute capture. MIT metadata was present. |
| `Mijick/Camera` | SwiftUI capture with manual focus/zoom/FPS/resolution/exposure/ISO/HDR controls | Strong native iOS capture-adapter candidate. Apache-2.0 metadata was present. |
| `NomaDamas/CozyClay` | Browser previs, cast/object blocking, camera rails/cuts, camera+prompt shot packages, depth/normal conditioning, deterministic project/export concepts and agent-driven scene edits | High-value previs/runtime reference. Repository is AGPL-3.0-or-later, so Director keeps an independent implementation and treats the repo as a capability/architecture reference unless AGPL adoption is explicitly intended. |
| `GuiYi-Xi/monoform-previs-studio` | Lightweight browser greybox studio, per-shot scene state, camera and actor/object keyframes, pose/IK workflow, focal-length presets, MP4/JSON export | Strong UX/workflow reference for Director previs. No LICENSE/NOTICE file or GitHub license metadata was found during this audit, so concepts only; no code copied. |
| `wassermanproductions/storyboard-reference-studio` | Reference-frame extraction, normalized reframing, shot metadata, camera/action annotations, per-frame prompts, hold timing, animatic and deterministic export packages | Strong reference-board and animatic reference. Apache-2.0 with NOTICE/attribution requirements; Director's new contract is independently implemented and records provenance explicitly. |
| `LudwigKienle/ai-video-production-editor` | Full script→director→storyboard→filming→continuity review→re-film→edit/color/sound/deliver loop, 3D previs and model-per-shot routing | Whole-production workflow reference. GPL-3.0-or-later; no source code copied into Director. |

## User-supplied realism/directing transcript: concepts absorbed

The supplied transcript materially sharpened the gap between "cinematic prompting" and actual directing.

Director now treats the following as first-class planning/QC concerns:

- identity and face stability across frames;
- hand/anatomy failures as QC evidence rather than "acceptable AI weirdness";
- blink/gaze naturalism;
- human imperfection as intentional cues, not indiscriminate degradation;
- character-sheet/reference identity as source evidence;
- lens/focus/camera movement as motivated decisions;
- rack focus triggered by scene action;
- dialogue direction with exact line, pace, energy, emotional state, accent direction and observable end state;
- performance beats driven by triggers, reactions, pauses, breath, gaze and blocking;
- physical cause/effect: weight, inertia, clothing/hair lag, environmental response, light response and synchronized sound;
- source-video preservation using explicit LOCK/PRESERVE and CHANGE ONLY boundaries;
- editing/selection as part of the generation loop rather than assuming one generation must be final.

The transcript's named products/models are not hard-coded as Director truth. They remain provider examples that must enter through capability/provenance review.

## User-supplied UGC + Blender/white-model workflows: concepts absorbed

The later workflows add two production patterns:

### Cheap-first staged UGC production

Before an expensive 30-second generation, Director should separately establish and approve:

1. product identity / multi-view reference sheet;
2. creator identity and creator nature (synthetic, licensed human or brand employee);
3. believable location;
4. creative concept;
5. exact script, pronunciation and performance direction;
6. final generation brief.

`ugc-production.ts` now models that as explicit approval receipts. Generation readiness fails closed if one of the cheap upstream decisions is missing, if script claims are not in approved product truth, or if a synthetic-creator project requires disclosure and none is present.

### Greybox/white-model control before rendering

The supplied Blender workflow reinforces:

- block camera and timing before visual polish;
- give every primitive a semantic role instead of expecting a model to infer whether a cylinder is a can, glass or prop;
- leave intentionally model-generated phenomena (pouring liquid, bubbles, fire, etc.) explicit as generation gaps rather than accidentally blank;
- preserve exact cut frames;
- use only references that actually matter to the shot;
- export the authored control source as a machine-readable shot package.

`previs-blockout.ts` now models exact camera rails/keyframes, actor/object tracks, generation gaps, references and shot packages.

## Contracts added

### `camera-language.ts`

A provider-neutral `DirectorCameraPlan` now encodes:

- narrative function and audience effect;
- shot size, angle, framing, placement, horizon and vanishing point;
- focal length, FOV, focus and depth of field;
- motivated movement instructions;
- triggered focus events/rack focus;
- timing/BPM/beat-grid anchors;
- virtual-camera keyframes;
- physical-camera capture settings;
- provider capability admission and fail-closed validation.

Contradictions such as a locked camera plus an active move are rejected.

### `performance-direction.ts`

`PerformanceDirectionPlan` now encodes:

- scene function;
- actors and start/end state;
- action/reaction/dialogue/pause/breath/gaze/gesture/blocking/focus-trigger beats;
- exact dialogue text;
- pace, energy, emotional state and body state;
- regional/accent direction without requiring caricature;
- trigger -> response -> observable end-state;
- preservation rules.

This moves performance control before generation rather than only scoring performance afterward.

### `realism-direction.ts`

`RealismDirectionPlan` now encodes:

- concrete realism goal;
- intentional naturalism cues such as texture, asymmetry, breathing, weight shift, inertia and parallax;
- physical trigger/response chains across subject, camera, environment, wardrobe/hair, light and sound;
- source-preserving edit boundaries;
- explicit global-regeneration conflicts.

"Realism" is therefore not equivalent to grain/noise or generic "cinematic" language.

### `ugc-production.ts`

Synthetic/creator-style ad production can now carry:

- product truth and prohibited claims;
- multiple creator/location/concept/script candidates;
- explicit human approval receipts between stages;
- pronunciation notes;
- performance + realism direction;
- creator rights/provenance;
- synthetic-creator disclosure policy;
- a hard generation-readiness gate.

### `previs-blockout.ts`

Director previs now carries:

- semantic greybox objects;
- exact frame ranges and cut frames;
- camera plan plus rail/keyframe/locked/free ownership;
- camera rail geometry and authored schedule;
- actor pose tracks and object transform tracks;
- intentional model-fill gaps;
- shot-specific reference bindings;
- optional continuous vs intentionally gapped timelines;
- deterministic shot-package validation for greybox clip, camera metadata, prompt, reference assets and conditioning passes such as depth/normal.

### `storyboard-reference-board.ts`

Reference imagery can now become governed storyboard evidence with:

- source asset/time provenance;
- immutable extracted-still identity/hash;
- normalized non-destructive crop/framing;
- shot/lens/movement/lighting metadata;
- arrow/text direction annotations;
- per-frame hold time;
- optional approved prompt/profile;
- deterministic animatic timing and scratch audio handoff.

### `directed-take-qc.ts`

Post-generation evidence can now fail a take for:

- identity instability;
- face instability;
- hand/anatomy failure;
- unnatural blinking;
- implausible motion;
- camera-plan mismatch;
- focus-plan mismatch;
- source-preservation drift;
- performance-plan mismatch;
- dialogue/prosody problems;
- audio-sync problems;
- background geometry drift.

Perception models supply evidence and confidence. Director deterministically applies policy; a model never self-approves.

Failed QC can also be converted into a **proposal-only** repair scope: audio-only, localized time region, whole shot, or manual review. The repair proposal preserves unaffected authored dimensions; it does not bypass the normal review or generation gate.

## Integration changes

- `StoryboardBoard` can persist camera, performance and realism plans.
- `buildStoryboardShotPlan` validates and carries the latest structured plans.
- `TakeRequest` carries all three plans.
- `compileTakePrompt` translates structured direction into provider-facing sections.
- `GenerationPlanAdapter` sends the compiled direction and retains the structured plan objects in provider parameters for lineage/QC.
- Legacy `CinematographyPreset`, `cameraLanguage` and plain prompt fields remain supported.
- UGC generation is gated behind staged product/creator/location/concept/script/generation-brief approvals.
- Previs exports can be validated against exact shot frame range, fps, resolution, references and provenance.
- Reference boards can preserve crops, annotations and animatic timing without destructively altering source media.

## What still should come next

This change sharpens the contract layer. The next runtime work should be:

1. Add mobile-camera provider adapters for a React Native VisionCamera-class executor and a native iOS/Mijick-class executor.
2. Add a virtual-camera/previs adapter capable of applying `PrevisBlockoutPlan` in Blender/Three.js/Bevy or equivalent and returning a validated `PrevisShotPackage`.
3. Add Director workstation panels for greybox scene hierarchy, shot list, reference board, dual camera/actor timeline and shot-camera monitor.
4. Bind frame/audio observations to `DirectedTakeQcObservation` using Director Vision Relay/FFmpeg/vision providers.
5. Feed `DirectedTakeQcDecision` into multimodal take selection and the existing governed review/re-run lifecycle; repair proposals remain non-authorizing.
6. Add a provider adapter for UGC image/video generation that consumes approved product/creator/location/script references without hard-coding one vendor.
7. Certify one real generative-video provider, one physical camera provider, and one virtual/previs provider against the same Director contracts.

## Invariant

**Camera movement is not style decoration. Performance is not a single adjective. Realism is not random imperfection. Each becomes explicit, motivated, observable and testable Director intent.**
