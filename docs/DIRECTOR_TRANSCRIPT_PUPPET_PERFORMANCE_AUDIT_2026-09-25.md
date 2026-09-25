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
