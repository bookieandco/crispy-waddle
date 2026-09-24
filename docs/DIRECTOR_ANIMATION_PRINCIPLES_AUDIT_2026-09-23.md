# Director Animation Principles Sharpening — 2026-09-23

## Goal

Turn classical animation craft into explicit Director intent that can survive storyboard planning, generation, rig execution, frame-timeline validation and QC.

The source lesson covers the twelve principles as practical motion/design rules: squash and stretch, anticipation, staging, straight-ahead and pose-to-pose, follow-through and overlapping action, slow-in/slow-out, arcs, secondary action, timing, exaggeration, solid drawing/form, and appeal.

## Architecture added

`animation-principles.ts` defines a provider-neutral `AnimationPrinciplesPlan` with:

- squash/stretch amount, peak timing, continuous-stretch restraint and mandatory volume preservation;
- anticipation cues and optional multi-level anticipation;
- staging with one primary read, audience attention target, competing-action policy and readable pauses;
- straight-ahead / pose-to-pose / hybrid method selection;
- key / extreme / breakdown pose hierarchy;
- follow-through chains with driver/follower lag and settle frames;
- slow-in/slow-out frame budgets with impact opt-out;
- authored motion arcs;
- secondary actions that support rather than obscure the primary action;
- FPS, exposure on ones/twos/threes/mixed, frame budget and readable holds;
- exaggeration strength tied to the idea being clarified;
- solid-form constraints for volume, weight, balance, perspective and twinning avoidance;
- appeal via shape language, proportion emphasis, detail simplification and personality read.

The module also provides deterministic `AnimationPrinciplesQcDecision`. Perception systems can produce observations, but only Director policy determines admission.

## Runtime integration

The plan now flows through:

```
StoryboardBoard.animationPlan
  -> StoryboardShotPlan
  -> TakeRequest.animationPlan
  -> [ANIMATION PRINCIPLES] provider prompt section
  -> provider parameters
  -> AnimationPerformanceState.principlesPlan
  -> RigAnimationInput.animationPlan
  -> rig worker
  -> Director animation QC
```

The canonical animation timeline rejects a principles plan whose FPS conflicts with the authored frame timeline.

Rig execution validates the plan before provider I/O and records animation-method/evidence lineage.

## Persistence

A forward migration adds `camera_plan`, `performance_plan`, `realism_plan`, and `animation_plan` JSONB to canonical storyboard boards and append-only board history, then updates the board-version capture function to preserve all four plans.

The Supabase read adapter hydrates all four structured plans.

Remote application of that migration is not claimed by this source change.

## Principle-specific invariants

- Squash/stretch may exaggerate shape but cannot silently change overall volume.
- Pose-to-pose/hybrid work requires explicit key poses.
- Anticipation must have a readable preparatory cue.
- Staging must identify the primary read and audience attention target.
- Follow-through uses non-negative driver/follower lag and settle timing.
- Secondary action supports the main action and can be flagged not to obscure it.
- Exaggeration must clarify an idea while remaining believable.
- Solid form preserves volume, weight and balance.
- Timing is frame-aware, not a vague speed adjective.

## Source boundary

The lesson is treated as a craft reference. Director stores independent structured contracts and tests rather than copied tutorial prose or an external animator's implementation.
