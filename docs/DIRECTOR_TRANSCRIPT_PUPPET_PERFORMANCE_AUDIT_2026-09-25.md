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


## Roboflow people detection adapter

Reference model: `people-detection-o4rdr/12` on Roboflow Serverless.

Added:

- isolated server-side worker using `InferenceHTTPClient`;
- header-based API-key transport;
- `ROBOFLOW_API_KEY` secret-only configuration;
- model override through `ROBOFLOW_PEOPLE_MODEL_ID`;
- normalization into Director's existing object-detection evidence path;
- person aliases normalized to the canonical `person` class;
- detected people become protected `person` visual regions rather than generic critical objects;
- explicit limitations preventing identity, demographic, intent or temporal-continuity claims.

Perception responsibilities are deliberately separated:

- Roboflow people detector -> person presence and bounding regions;
- Human -> body/hand pose, gaze/orientation and gesture geometry;
- SAM2 -> temporal tracks and masks;
- Director -> evidence admission, QC, approval and editing authority.

The credential is never embedded in source or transported in request bodies. A credential pasted into chat or other non-secret surfaces should be rotated before production use.


## AI-film continuity workflow audit

The supplied AI-film walkthrough reinforces a workflow Director already mostly implements:

- lock the story before generation;
- build and save reusable character and location references;
- use structured shot direction instead of one flat free-form prompt;
- assign performance/emotional direction per shot;
- chain a prior video/shot reference only for true continuations;
- use environment-only shots when no recurring character belongs in the frame;
- repair generation defects in editing rather than accepting visible continuity failures;
- normalize recurring character voice identity across independently generated clips.

Existing Director coverage:

- story/shot structure -> storyboard sequence, shot adapters and production orchestration;
- reusable character/location assets -> generation reference manifest and cast/location references;
- structured generation direction -> camera, performance, realism, animation, continuity and reference manifests compiled by the generation orchestrator;
- prior-shot reference continuity -> `ContinuityStrategyPlan` and required prior-shot reference assets for continuity chains;
- character identity -> locked recurring-character reference contracts;
- voice consistency -> `CharacterVoiceIdentity`, dialogue generation requests and voice QC;
- editing repair -> timeline proposal/rough-cut/editing evidence paths;
- environment-only shots -> references are optional by role and are not forced when the shot contains no character.

No provider-specific JSON grammar is promoted to canonical Director truth. Director's typed generation plans already provide the structured hierarchy that the walkthrough gets from JSON prompts, while remaining portable across providers.

The remaining operational lesson is sequencing: continuity references should be used only when a shot is a direct visual continuation, not indiscriminately across scene changes. Director's continuity strategy already encodes that distinction.


## Hybrid animation / Passport Rush workflow audit

The supplied production breakdown adds several practical lessons from a traditional-animation-plus-AI pipeline.

### Asset-first approach

The source treats character sheets, prop sheets, backgrounds and effects sheets as the visual foundation of the film. Recurring assets deserve dedicated references; incidental/background elements do not automatically require bespoke asset construction.

Director already has the corresponding canonical machinery:

- cast and locked character references;
- environment view packs;
- generation reference manifests;
- previs reference bindings;
- product/prop-style reference assets;
- continuity QC.

No second asset registry was added.

### Gap 11 — explicit shot routing: direct generation vs previs

The source uses a simple production rule:

- complex/specific movement, camera or timing -> build a Blender previs;
- simpler shots -> go directly to video generation;
- if animating the motion is clearer/faster than explaining it in words, use previs.

Director already had a detailed `PrevisBlockoutPlan`, but no canonical upstream decision describing when a shot should enter it.

Added `routeHybridShot()` with three outcomes:

- `direct-generation`;
- `previs-conditioned`;
- `performance-research`.

Specific movement, camera, timing, multi-object interaction, or motion that is difficult to express textually can route to previs.

### Gap 12 — performance gap detection

The source identifies a distinct failure mode in the ceiling-handle gag:

- the greybox carries timing/blocking;
- subtle expression/hand acting is too weak to survive;
- increasing greybox detail can cause the video model to copy temporary geometry instead of the locked character design.

Director now calls this out explicitly as `DIRECTOR_HYBRID_PERFORMANCE_GAP`.

A subtle-performance-critical shot whose greybox is not performance-readable is routed to `performance-research` instead of assuming more previs detail will solve the shot.

This can then use existing Director performance-direction, performance-capture, pose/hand observation, character identity and reference-manifest systems.

### Gap 13 — contradictory reference detection

The source's headphone example demonstrates that individually useful references can conflict:

- the canonical character sheet says headphones are present;
- a screenshot selected for camera framing omits them;
- the model follows the contradictory framing reference and repeatedly drops the headphones.

Added `evaluateReferenceCoherence()`:

- observations describe explicit traits per reference;
- canonical trait values are preserved;
- noncanonical references that disagree are surfaced before generation;
- conflicts identify the exact trait, canonical value and conflicting asset IDs.

A framing or motion reference is therefore not allowed to silently override character identity.

### Gap 14 — production visual-rule ledger

The source converts pre-production experiments into durable project rules. Examples from the supplied breakdown include:

- late-afternoon / golden-hour light after midday tests looked flat;
- the recurring taxi became cleaner 3D after heavy watercolor texture failed in motion;
- recurring props get dedicated sheets while incidental elements may remain text-generated.

Added a `ProductionVisualRuleLedger` with:

- rule kind;
- human-readable production rule;
- experiment IDs that produced the rule;
- evidence IDs;
- locked versus advisory state.

This extends the existing creative-experiment system: experiments preserve the tests; the visual-rule ledger preserves what production learned from them.

### Existing Director systems reused

No duplicate subsystem was added for:

- storyboards and animatics -> storyboard/reference board;
- Blender-like authored previs -> `PrevisBlockoutPlan`;
- exact greybox timing/camera -> previs shot packages and motion references;
- image references for final appearance -> generation reference manifests;
- animation principles -> existing `AnimationPrinciplesPlan`;
- beat-by-beat reaction pauses -> existing performance-direction beats and pauses;
- character/prop/location continuity -> existing continuity strategy and locked references;
- repeated generation/review -> creative experiments, take QC and selection;
- hand-edited reference fixes -> treated as a new version of the governed reference asset with new provenance.

The source's prompt block ordering is useful provider craft, but Director already compiles structured camera, performance, continuity, reference and animation directives. No vendor-specific long-prompt syntax is promoted to canonical authority.

### Previs readability heuristic

The tutorial reports a shot where a close greybox camera produced large ambiguous gray shapes and too little environmental context; pulling the camera back made the action interpretable to the video model.

This is retained as a production/QC heuristic: if a motion reference is not semantically readable, revise framing/context rather than adding arbitrary prompt text. The source does not provide a defensible numeric visibility threshold, so Director does not invent one.


## AI fight-scene workflow audit

The supplied fight-scene tutorial demonstrates a useful high-motion production pattern:

- begin from locked character references and a storyboard;
- generate explicit pose/keyframe images for major action states;
- preserve visual style by carrying approved references forward;
- use different image models when one provider performs better for a specific camera/effects task;
- chain authored first/end frames into short video transitions;
- build a continuous action story rather than a collection of unrelated clips;
- review automatically generated sound effects instead of assuming they are usable;
- accept that faster/more complex subject motion, camera motion and effects increase deformation/flicker risk;
- repeated image/video edits can soften faces and lose fine detail.

### Existing Director coverage reused

No duplicate subsystem was added for:

- start/end-frame video generation -> existing continuity strategy already requires first/last frame anchors for large motion;
- pose diagrams and authored blocking -> storyboard/reference boards and previs actor/object tracks;
- multiple camera angles -> camera-language + previs;
- model swapping by use case -> generation registry plus creative experiments/take selection;
- recurring character/style references -> generation reference manifests and continuity locks;
- automatically generated SFX -> existing Foley/SFX and audio-mix QC;
- final upscale/finishing -> chunked video upscale with frame/timing preservation.

### Gap 15 — action-sequence risk budget

The source reports a consistent trade-off: as subject motion, camera motion, multi-character interaction and visual effects become denser/faster, temporal consistency becomes harder and body structures may warp or flicker.

Director now has a provider-neutral `ActionSequenceRiskPolicy` and `evaluateActionSequenceRisk()`.

Important boundary:

- no universal motion threshold is claimed;
- each production supplies its own high/severe thresholds and weights;
- the score is planning evidence, not provider truth;
- higher-risk shots automatically require stricter QC dimensions.

The risk input separates:

- subject motion;
- camera motion;
- effects density;
- interaction complexity;
- whether locked identity is critical.

### Gap 16 — body-structure, flicker and detail-retention QC

Directed take QC now has three explicit metrics:

- `body-structure`;
- `temporal-flicker`;
- `detail-retention`.

An `ACTION_SEQUENCE_TAKE_QC` policy combines those with identity stability, motion plausibility, camera-plan match and performance-plan match.

This lets Director fail a visually energetic fight take even if general motion looks impressive when bodies tangle, geometry flickers or face/detail quality collapses.

### Gap 17 — iterative reference edit quality

The source also observes that repeated generative editing can progressively blur faces and lose specific details.

Added `evaluateReferenceIterationQuality()` with:

- explicit parent asset provenance for edited references;
- edit depth;
- identity score;
- detail-retention score;
- configurable maximum depth and minimum quality thresholds.

Again, Director does not assume a universal maximum number of edits. The production policy decides the acceptable edit depth and quality floor.

When an iterated reference fails, the correct response is to return to a higher-quality parent/canonical reference or regenerate from governed source material rather than letting degraded derivatives silently become the next canonical identity anchor.

### Model-per-shot selection remains an experiment, not identity authority

The tutorial gets better results by alternating image models for different tasks such as camera-angle changes and effects/power imagery. Director already supports provider/model registries, creative variants and take selection.

The lesson is retained as model-per-shot experimentation with measured evidence. A model that performs well on one shot type does not become the universal provider, and switching models must not weaken character/style/continuity locks.


## Documentation-grounded model prompt translation audit

The supplied prompting workflow argues for a useful authority split:

- the filmmaker owns the idea, story, emotional intention and desired camera/performance behavior;
- the model's official documentation describes how that specific generator expects those ideas to be phrased;
- a separate translator can convert human creative intent into model-optimized prompt grammar;
- creative feedback such as "less melodramatic" or a changed camera reveal should refine the translation without replacing the underlying authored intent.

Director previously compiled a strong provider-neutral prompt, but it sent that compiled text directly to the selected generation provider.

### Gap 18 — model/version-specific documentation profiles

Added `ModelPromptProfile` and `PromptDocumentationSource`.

A governed profile requires:

- provider ID;
- exact model ID;
- exact model version;
- official documentation or official prompt-guide source;
- source content hash;
- capture time;
- provenance/evidence IDs.

A profile cannot be silently reused across another model/version.

This treats prompt documentation like any other production dependency: versioned, attributable and inspectable.

### Gap 19 — provider prompt translator

Added a `ModelPromptTranslator` interface and `translatePromptForModel()`.

The translator receives:

- project/take identity;
- Director's canonical compiled prompt;
- optional creative refinement feedback;
- the governed prompt profile.

The result must identify:

- the prompt profile;
- provider/model/version;
- exact documentation source IDs used;
- translated prompt;
- canonical-prompt digest receipt;
- translation evidence.

Director validates that all cited documentation sources belong to the active profile.

### Generation boundary integration

`GenerationPlanAdapter` now optionally accepts a prompt-profile resolver and model prompt translator.

When a `promptProfileId` is requested:

1. Director resolves the selected generation model.
2. Director resolves the requested documentation profile.
3. Provider ID, model ID and model version must match exactly.
4. Director compiles its canonical camera/performance/continuity/reference prompt.
5. The translator converts that canonical prompt into model-specific grammar.
6. Only the translated prompt is sent as the provider's prompt.
7. The generation request also retains:
   - `canonicalPrompt`;
   - refinement feedback;
   - profile/model/version identity;
   - documentation source IDs;
   - translation evidence.

Creative refinement feedback cannot be supplied through this path without a governed prompt profile.

### Authority boundary

This implementation intentionally does not make prompt engineering part of Director's creative authority.

Director remains authoritative for:

- story intent;
- camera intent;
- performance;
- realism;
- animation principles;
- references and continuity;
- approvals and QC.

The translator is a provider adapter. It may reorganize or phrase the canonical brief according to official model guidance, but it does not get to invent story beats, change locked references, or override Director's creative contracts.

### Iteration workflow

The source recommends generate -> review -> explain what feels wrong -> regenerate an improved model-specific prompt.

Director now supports that pattern through `promptRefinementFeedback`, while retaining the original canonical prompt alongside every translated submission.

This means feedback such as "too dramatic", "more emotionally subdued", or "change the reveal to a pull-back/orbit" can be preserved as an explicit refinement receipt instead of silently editing the production's source intent.

### Existing capabilities reused

No duplicate system was added for:

- natural-language directing -> existing TakeRequest and structured camera/performance plans;
- model selection -> GenerationRegistry;
- provider submission -> GenerationPlanAdapter / GenerationService;
- reference attachment -> GenerationReferenceManifest;
- failed-result review -> directed take QC and take selection;
- alternate model comparison -> creative experiments and per-shot provider routing.

The new layer only translates canonical intent into documented model-specific prompt syntax.
