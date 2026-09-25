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
