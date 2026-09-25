# Director Transcript + Puppet Performance Audit — 2026-09-25

## Baseline

PR #689 is merged and remains the integration baseline for unified project media/history, current-playhead generation continuation, soundtrack generation briefs, and performance-directed speech.

The newly supplied Character Animator walkthroughs add two distinct lessons:

1. transcript timing can improve lip-sync alignment beyond audio-only analysis;
2. professional character animation benefits from explicit, independently controllable facial/rig states instead of relying only on live face capture.

These belong inside the existing Director voice-sync and rig-animation authority boundaries.

## Gap 1 — transcript-assisted lip sync

Director already had governed lip/phoneme/viseme tracks and provider-neutral sync execution. The missing layer was canonical transcript evidence.

Added:

- timed SRT cue parsing;
- untimed or timed transcript plans;
- cue range, overlap, confidence and audio-bound validation;
- adapter-specific policy hooks for limits such as maximum untimed duration;
- transcript evidence propagation through the existing governed voice-sync provider;
- worker transport of the transcript plan.

Important boundary:

- provider-specific limits are not treated as universal Director truth;
- language/script restrictions remain adapter capabilities rather than canonical identity rules;
- transcript mismatch or invalid timing fails closed;
- transcript text improves alignment evidence but does not silently override the governed audio asset.

## Gap 2 — advanced character performance rig controls

Director already had rig animation and compact animation performance state. The missing layer was a reusable plan for fine-grained puppet/facial control.

Added:

- custom eye pose sets with a named default;
- custom eyebrow pose sets;
- blend-in/blend-out timing;
- latched non-default pose intent;
- subtle jaw-follow strength plus fixed/jaw anchors;
- independent head/body movement strengths;
- isolated recording-pass order for eyes, brows, hands, body/head/face;
- explicit policy for enabling replay defaults only during the active pass and hiding completed passes;
- governed plan evidence forwarded into the existing rig worker.

The implementation intentionally models the animation mechanics rather than Adobe-specific UI concepts such as trigger keys or panel layout.

## Runtime integrity repair

The rig service's deterministic artifact identity previously depended only on character, tracking and channel names. That could collide when the same source tracking was re-rendered with a different animation/performance plan.

The runtime digest is now bound to the governed animation plan, performance plan and continuity reference as well.

## Authority boundary

- transcript/SRT data is evidence, not a replacement for audio authority;
- viseme/phoneme engines remain adapters;
- pose sets and jaw/head-body controls are performance direction, not asset approval;
- rig output still requires governed tracking and Director QC/approval;
- provider-specific behavior remains downstream of Director's canonical plan.


## Gap 3 — motion accents and particles

The additional Character Animator release walkthrough shows velocity-triggered motion lines and pointer/attachment-following particle trails as reusable character behaviors.

Added:

- velocity threshold;
- lifespan in frames;
- fade/opacity control for motion lines;
- explicit rig attachment points;
- particle asset identity;
- bounded gravity scale;
- optional pointer-follow intent.

These are modeled as provider-neutral character motion-effects plans and are routed through the existing governed rig-animation path.

## Gap 4 — lip-sync sensitivity preferences

The walkthrough also demonstrates three useful tuning concepts:

- viseme density;
- audio-noise gating;
- visual mouth-motion gating.

Director now has a bounded lip-sync tuning plan for those controls plus an optional algorithm profile. The values are direction to the selected sync adapter, not claims that every adapter implements every control identically.

## Gap 5 — position-driven locomotion

The source's position-keyframed walking workflow maps cleanly to a character locomotion plan:

- gait;
- FPS;
- ordered spatial keyframes;
- interpolation;
- explicit foot-plant preservation.

This is deliberately separate from ordinary timeline clip-position keyframes. Timeline transforms move media; locomotion keyframes ask the rig solver to move the character while preserving believable stepping and reducing foot slide.

## Existing capabilities reused from the walkthrough

No duplicate subsystem was added for:

- generic timeline keyframes — already present in `timeline-model.ts` / `timeline-editing.ts`;
- camera keyframes — already canonical in `camera-language.ts`;
- timeline history/version entries — already present in `EditableTimeline.versions`;
- triggerable/generated audio — already covered by Director audio, Foley, speech, and timeline audio paths.

The source mentions broader rig-issue tooling and UI search/filter improvements, but does not provide enough operational detail in this walkthrough to justify inventing a new canonical diagnostic model from it.


## Gap 6 — local lip-sync repair windows

The cartoon workflow source demonstrates an important failure-recovery pattern: when transcript-assisted alignment fails only for a short interval, isolate that interval and fall back to audio-only lip sync instead of recomputing or manually repairing the entire performance.

Added a governed regional repair plan with:

- exact millisecond ranges;
- transcript-assisted or audio-only strategy per range;
- non-overlap and audio-bound validation;
- explicit failure reason and evidence;
- project/audio lineage.

This preserves transcript-assisted sync as the preferred path while making local fallback deterministic.

## Gap 7 — shot-driven minimal rigs

The source repeatedly avoids building features that a brief character or partially hidden shot never uses. Director now records a shot-scoped rig plan:

- exact shot IDs;
- required rig channels;
- mouth mode: none, jaw-only, or full viseme;
- only the needed features such as dangle, eyebrow poses, arm IK, head turns, blinks, or automated lights.

The governed rig request must still include every channel required by the scope. This makes “do only what the shot needs” explicit without weakening QC.

## Gap 8 — triggered and cyclic sprite sequences

Short environmental interactions and recurring machine/city lights are represented as frame-sequence plans:

- triggered or looping mode;
- ordered frame assets;
- frames per step;
- optional start frame;
- trigger for one-shot interactions;
- blend mode and provenance evidence.

This covers quick door-opening frames, blinking lights, and impact/poof sprite sequences without inventing a second animation engine.

## Gap 9 — pre-render caches and master-scene scale safety

For complex scenes, the source replaces expensive live links with a transparent image sequence plus matching WAV, while keeping the same FPS. It also builds a large working composition around the closest intended framing so raster characters do not need to be enlarged above 100%.

Director now has:

- pre-render cache plans bound to the exact source version, frame range, FPS, dimensions, alpha mode, image format and optional WAV;
- render artifact identity bound to those cache instructions;
- master-scene working/delivery dimensions;
- a maximum raster scale that fails validation above 1.0;
- render evidence for these decisions.

## Existing capabilities reused from this source

The following source lessons already map to existing Director primitives and were deliberately not duplicated:

- masked character shadows -> standard effect/compositing parameters;
- crash/poof + bounce + sound layering -> overlays, transform keyframes, animation principles and Foley/SFX;
- slow establishing zooms and transition motion -> camera and timeline keyframes/transitions;
- dialogue beginning before the visual transition completes -> independent audio/video timeline placement;
- simple character bobbing when legs are hidden -> existing transform/locomotion keyframes;
- scene and timeline history -> existing timeline versions.


## Gap 10 — calibrated body-performance capture

The body-tracking walkthrough adds capture behavior that was not explicit in Director's prior rig contracts:

- torso-up versus full-body framing;
- calibration countdown and calibration pose;
- selectable tracked landmarks instead of assuming every possible landmark;
- hold-last versus return-to-rest when tracking is lost;
- configurable return duration;
- tracking-strength control;
- separate body, face, gaze and hands recording passes;
- local repair passes that replace only the faulty limb/interval and blend into surrounding motion;
- controller arbitration so body tracking does not fight dragger/manual or triggered animation.

Director now has a canonical `PerformanceCapturePlan` for those choices. Trigger/manual override windows require body-tracking strength to be zero, making the source's "disable the competing controller" rule deterministic rather than operator memory.

## Human library adapter

Reference: `vladmandic/human`.

Audited upstream capabilities relevant to Director:

- body pose tracking;
- hand/finger tracking;
- face rotation and gaze;
- gesture recognition;
- temporal interpolation;
- browser and Node execution paths;
- MIT license.

Director now exposes a `HumanPerformanceEngine` adapter seam and maps admitted Human results into both:

1. generic frame observations for the existing Director observation registry;
2. canonical Director `FrameAnnotation` keypoints that can join the existing tracking -> approval -> rig pipeline.

The adapter intentionally admits performance geometry only. Human's optional age, gender, race, face embedding/recognition, emotion and liveness fields are not propagated through this animation-performance path because they are unnecessary to puppeteering and action recognition.

Human remains a provider downstream of Director authority; it does not approve tracks or decide animation output.

## ActionAI-derived temporal action recognition

Reference: `smellslikeml/ActionAI`.

The useful architecture is its temporal pattern:

- collect pose keypoints over a rolling frame window;
- normalize pose geometry;
- classify the sequence into an action label;
- make window size configurable rather than infer action from one frame.

Director now has a provider-neutral `PoseActionRecognitionPlan`, rolling-window builder over approved `VideoTrack` keypoints, and classifier interface with bounded label/confidence validation.

Important licensing boundary:

- ActionAI is GPLv3;
- no ActionAI source code or runtime dependency is vendored into Director;
- the implementation only adopts the general temporal-classification pattern behind Director's own interface;
- an ActionAI-compatible or replacement classifier can run as an isolated adapter if desired.

This also avoids coupling Director to ActionAI's historical 36-value pose layout, TensorFlow model format, Intel DLStreamer pipeline, or default five-frame window. Those remain implementation details rather than canonical Director truth.
