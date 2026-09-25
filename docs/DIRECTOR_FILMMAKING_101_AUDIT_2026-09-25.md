# Director — Filmmaking 101 source audit — 2026-09-25

## Source role

This source is a broad independent-filmmaking fundamentals workshop.

It reinforces existing Director systems for story, storyboards, camera language, lighting, performance, editorial reduction and collaboration, while adding four concrete gaps:

1. treatment -> screenplay -> director annotation lineage;
2. dialogue-axis / screen-direction continuity;
3. production audio and room-tone capture;
4. evidence-driven editorial cut hierarchy.

The source's examples and personal heuristics remain contextual unless separately adopted by a project policy.

## Gap 47 — treatment -> screenplay -> director annotation lineage

Added:

- `StoryTreatment`;
- `ScreenplayScene`;
- `ScreenplayDialogueLine`;
- `ShootingScriptAnnotation`;
- `validateScreenplayBlueprint()`.

The source distinguishes:

### Treatment

A compact prose representation of the story:

- title;
- synopsis;
- beginning;
- middle;
- ending;
- character references;
- location references;
- provenance.

### Readable screenplay

Scene-level blueprint:

- INT / EXT / INT-EXT;
- location;
- time of day;
- action;
- dialogue;
- treatment lineage.

### Director annotation

Technical production detail remains a separate layer:

- coverage/camera-plan references;
- camera direction;
- lighting direction;
- production notes.

This preserves readability for cast/story review while allowing Director to maintain a technical version for production.

## Gap 48 — dialogue-axis / screen-direction continuity

The existing `dialogue-coverage-workflow.ts` already handled:

- a single master;
- over-the-shoulder and reverse coverage;
- medium and close coverage;
- reactions;
- approved eyelines;
- location/background anchors;
- coverage-frame extraction;
- premium establishment model -> lower-cost dialogue model handoff.

It now also supports:

- `establishingAxisSide`;
- optional per-coverage `axisSide`;
- per-subject screen direction;
- explicit `DialogueAxisTransition`.

Allowed transition mechanisms are:

- visible camera crossing;
- visible subject crossing;
- neutral reset.

If an established sequence silently crosses the axis, validation returns:

`DIRECTOR_COVERAGE_AXIS_CROSSED_WITHOUT_TRANSITION`.

If a participant silently flips screen direction, validation returns:

`DIRECTOR_COVERAGE_SCREEN_DIRECTION_FLIPPED`.

A visible transition may intentionally establish a new axis.

The source therefore sharpens the existing dialogue-coverage system rather than creating a second one.

## Gap 49 — production audio / room tone

Added:

- `ProductionAudioScenePlan`;
- `ProductionMicrophonePlacement`;
- `RoomToneCapture`;
- `ProductionAudioPolicy`;
- `validateProductionAudioScenePlan()`;
- `FILMMAKING_101_AUDIO_CAPTURE_PROFILE`.

Durable lessons captured:

- important dialogue should not depend only on distant camera-reference audio;
- microphone proximity matters;
- dedicated dialogue microphones may be directional boom or lavalier;
- camera/reference audio is useful for synchronization;
- room tone helps preserve ambience continuity across dialogue edits;
- observable background/noise sources should be logged.

The workshop suggests roughly 30-60 seconds of room tone.

Director records a 30-second minimum only in the optional source-derived `FILMMAKING_101_AUDIO_CAPTURE_PROFILE`; it is not a universal audio law.

## Gap 50 — positive reason to cut / Rule of Six hierarchy

Added:

- `EditorialCutDecision`;
- `EditorialCutCriterionAssessment`;
- `EDITORIAL_RULE_OF_SIX_ORDER`;
- `evaluateEditorialCutDecision()`.

The source gives this descending edit hierarchy:

1. emotion;
2. story;
3. rhythm;
4. eye trace;
5. two-dimensional screen plane;
6. spatial continuity.

Director requires a positive reason to cut.

A direct conflict with emotion, story or rhythm fails admission.

Lower-order visual/spatial continuity may be:

- supportive;
- neutral;
- conflicting and routed for review;
- intentionally disrupted with scene-specific rationale/evidence.

This captures the source's point that editing is emotional storytelling, not an assembly line or fixed cut timer.

## Existing Director systems reused

No duplicate subsystem was introduced for:

- idea/logline/feasibility -> `NonfictionStoryCompass`;
- storyboards and coverage planning -> storyboard + dialogue coverage;
- camera position/composition/movement -> camera language + cinematography analysis;
- camera motivation -> existing movement motivation;
- lighting exposure/depth/mood -> cinematic lighting;
- actor emotion/performance -> performance direction/capture;
- progressive raw/select/scene/master workflow -> `EditorialReductionGraph`;
- final mix hierarchy/safety -> audio priority + audio mix safety;
- render and final inspection -> FFmpeg QC + `FinalExportInspection`.

## Collaboration lessons retained as workflow guidance

The source repeatedly emphasizes that filmmaking is collaborative and that writer, director, cinematographer, editor and performer perspectives can improve the result.

Director preserves this as:

- role-specific authored plans;
- evidence/provenance;
- human approval;
- performance iteration;
- non-destructive editorial history.

The source's examples about feeding volunteer cast, reimbursing transport, giving credit/copies and allowing some creative input are useful independent-production practices, but are not encoded as universal technical admission gates.

## Contextual source heuristics, not universal truth

Kept noncanonical unless a project explicitly adopts them:

- good / fast / cheap — pick two;
- DIY gear as an early production strategy;
- particular gear brands or price points;
- hard-vs-soft lighting examples as simplified emotional shorthand;
- specific film examples used to illustrate dolly/reveal/follow movement;
- exact room-tone duration beyond the optional source profile.

The Director core keeps authored project intent and evidence as the final creative authority.
