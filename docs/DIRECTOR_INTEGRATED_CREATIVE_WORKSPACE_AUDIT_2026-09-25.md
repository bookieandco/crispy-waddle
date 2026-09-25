# Director Integrated Creative Workspace Audit — 2026-09-25

## Source-derived product pattern

The supplied Firefly video-editor walkthrough demonstrates a useful integrated creative loop:

```
captured media + generated media
-> one project media/history view
-> multitrack editable timeline
-> current-frame generation continuation
-> generated video/image/audio/speech variants
-> text/timeline editing
-> iterative refinement
```

The key architectural lesson is not to make one vendor authoritative. It is to reduce context switching while preserving canonical project state, source lineage, and reversible editing.

## Existing Director capabilities already covering the walkthrough

Director already has stronger canonical support for:

- multitrack video/audio/overlay/subtitle/effect timelines;
- split/trim/ripple/lift/slip/slide/roll edits;
- speed changes;
- transforms, crop, opacity, blend modes and keyframes;
- generated-asset insertion;
- text/subtitle layers;
- provider-neutral image/video generation;
- source/reference manifests;
- generated sound effects / Foley;
- Voice Identity and dialogue generation;
- storyboard/reference boards;
- generative extension;
- Quick Cut/text-semantic rough-edit proposals;
- source-driven character replacement;
- explicit asset approval and provenance.

Those pieces are not duplicated.

## New gap 1 — unified project media/history view

`creative-workspace-media.ts` creates a read-only project workspace view that combines:

- captured media;
- uploaded media;
- imported media;
- generated image/video/audio/3D/motion/subtitle assets.

It does not replace canonical storage.

Generated assets retain:

- generation-job identity;
- provider/model identity;
- storyboard version;
- generation stage/version;
- board lineage;
- prompts and metadata.

Captured/uploaded/imported media must retain explicit provenance refs.

Cross-project media and duplicate asset IDs fail closed.

This supplies the source's useful “everything I generated or captured is at my fingertips” behavior without collapsing provenance.

## New gap 2 — current playhead frame as generation seed

The walkthrough's “Use Current Frame” continuation pattern is now represented by `playhead-generation-continuation.ts`.

Director:

1. resolves the active visible video/overlay at the playhead;
2. honors an explicit selected clip when supplied;
3. converts timeline time to exact source time using source-in, speed and reverse state;
4. creates a deterministic frame-extraction plan bound to the current timeline version;
5. validates the extracted frame artifact;
6. creates a normal Director generation-reference manifest with:
   - required first-frame reference;
   - optional source-video context.

The provider still performs generation. Director owns which exact frame and source video are authoritative.

## New gap 3 — soundtrack generation briefs

`creative-audio-generation.ts` adds a provider-neutral soundtrack brief with:

- project identity;
- creative purpose;
- mood tags;
- style tags;
- normalized energy;
- tempo or exact BPM;
- target duration;
- requested variation count;
- optional source-video conditioning;
- evidence.

Generated soundtrack candidates carry:

- provider/model;
- artifact digest;
- duration;
- mood alignment;
- purpose alignment;
- optional beat alignment;
- rights evidence;
- QC evidence.

Director selects only admitted candidates. An admitted soundtrack becomes a standard timeline audio clip with role `music`.

## New gap 4 — performance-directed speech generation

Speech generation remains inside Director Voice Identity.

A `SpeechPerformancePlan` adds:

- speed;
- pitch;
- sentence/phrase tone spans;
- explicit pauses;
- target duration.

It compiles into the existing `DialogueGenerationRequest` so provider-specific emotion tags never become canonical speaker identity.

Tone spans cannot overlap, pause locations are validated, and all direction/evidence follows the request.

## Deliberately not duplicated

### Clip speed / transform / PIP

Already present in `timeline-model.ts`, `timeline-editing.ts`, and `timeline-command.ts`.

### Text-based editing

Quick Cut / transcript-driven editing and timeline commands already cover this at the canonical Director level.

### Boards / mood boards

Storyboard reference boards already preserve visual references, crops, annotations, prompts, versions, and animatic timing.

### Prompt-based image edits

Director already has provider-neutral generative/edit boundaries with source-preservation rules. Vendor-specific “edit image” chat syntax should remain an adapter concern.

## Authority boundary

The integrated workspace is a project surface, not new governance authority.

- Media history does not auto-approve generated assets.
- Current-frame continuation does not silently mutate the timeline.
- Soundtrack/speech generation produces candidates.
- Timeline insertion remains governed.
- Providers execute generation; Director owns reference selection, provenance, QC, and approval.
