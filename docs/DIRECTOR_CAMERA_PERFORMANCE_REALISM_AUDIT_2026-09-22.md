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

## Integration changes

- `StoryboardBoard` can persist camera, performance and realism plans.
- `buildStoryboardShotPlan` validates and carries the latest structured plans.
- `TakeRequest` carries all three plans.
- `compileTakePrompt` translates structured direction into provider-facing sections.
- `GenerationPlanAdapter` sends the compiled direction and retains the structured plan objects in provider parameters for lineage/QC.
- Legacy `CinematographyPreset`, `cameraLanguage` and plain prompt fields remain supported.

## What still should come next

This change sharpens the contract layer. The next runtime work should be:

1. Add mobile-camera provider adapters for a React Native VisionCamera-class executor and a native iOS/Mijick-class executor.
2. Add a virtual-camera adapter capable of text/keyframe execution in Blender/Unity/Bevy or equivalent.
3. Bind frame/audio observations to `DirectedTakeQcObservation` using Director Vision Relay/FFmpeg/vision providers.
4. Feed `DirectedTakeQcDecision` into multimodal take selection so failed anatomy/source-preservation/camera matches are hard failures.
5. Add camera/performance plan editing controls in the Director workstation.
6. Certify one real generative-video provider, one physical camera provider, and one virtual/previs provider against the same `DirectorCameraPlan`.

## Invariant

**Camera movement is not style decoration. Performance is not a single adjective. Realism is not random imperfection. Each becomes explicit, motivated, observable and testable Director intent.**
