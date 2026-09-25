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


## Dialogue coverage / reverse-angle consistency audit

The supplied dialogue-coverage workflow demonstrates a cost-aware way to solve a recurring AI-film problem: master shots, over-the-shoulders, reverse angles and close-ups often drift in background geometry or eyelines when each shot is generated independently.

The source's practical sequence is:

- design character-specific background views and a camera diagram;
- use a stronger/more expensive model to establish the master and coverage angles;
- review that generated coverage for usable reaction/eyeline variants;
- extract approved frames for each character/eyeline;
- feed those frames into a cheaper dialogue model as start frames;
- attach dialogue audio for lip-sync;
- edit the resulting coverage together.

### Existing Director coverage reused

Director already had:

- structured camera plans, including over-shoulder and medium-close-up compositions;
- immutable frame extraction with source-time provenance;
- reference manifests with `first-frame` and `audio` roles;
- voice/lip-sync execution;
- generation cost estimates and spend authorization;
- reference/continuity manifests.

The missing piece was a scene-level coverage contract connecting those systems.

### Gap 20 — dialogue coverage geometry

Added `DialogueCoveragePlan`.

It locks:

- project/scene/location identity;
- camera diagram asset;
- scene axis reference;
- character reference assets;
- explicit eyelines and screen direction;
- one master shot;
- over-shoulder/reverse/medium-close-up/close-up/reaction coverage;
- background anchors expected in each angle;
- camera-plan references and provenance.

Coverage therefore has a single governed spatial relationship instead of a set of unrelated prompts.

### Gap 21 — approved coverage-frame handoff

Added `CoverageFrameSelection` and `CoverageHandoffPlan`.

A selected frame records:

- source coverage shot;
- character;
- source video and time;
- extracted frame asset and digest;
- eyeline variant;
- background anchors;
- evidence.

The handoff validates that the selected frame still matches the approved coverage shot's background anchors and character eyeline.

### Gap 22 — cost-aware two-stage generation

The handoff records three existing Director `GenerationCostEstimate` objects:

- establishment/coverage model cost;
- cheaper dialogue-model cost;
- estimated cost of generating the dialogue coverage entirely with the premium model.

Director computes the projected savings but does not invent provider prices. If the staged workflow is not actually cheaper, the handoff fails its cost-advantage check.

This is planning/QC evidence, not automatic spend authorization; normal Director spend authorization still applies.

### Provider-ready first-frame + audio manifest

Added `buildDialogueCoverageGenerationManifest()`.

For an approved frame and admitted dialogue audio it emits the existing canonical `GenerationReferenceManifest`:

1. slot 1 = `first-frame` with frame digest, coverage shot, eyeline and background provenance;
2. slot 2 = `audio` with dialogue timing/lip-sync provenance.

That makes the workflow executable through the existing generation/provider boundary without hard-coding Seedance, MiniMax or any other vendor into Director core.

### Authority boundary

The source reports that Seedance performed better for its camera/background establishment and that MiniMax H3 was cheaper for the dialogue pass. Director preserves that as experiment/provider evidence only.

Canonical Director truth is instead:

- which model is admitted for establishment;
- which model is admitted for dialogue;
- approved coverage geometry;
- approved extracted frames;
- exact eyelines/background anchors;
- current cost estimates;
- dialogue audio;
- final QC.

A future provider can replace either stage without changing the scene's coverage authority.


## Agentic canvas / persistent project context audit

The supplied CapCut Director workflow demonstrates a useful production pattern: put the script, style and approved creative assets into one persistent project context, then direct by intent such as "generate scene two" instead of manually pasting the same style, character, location, prop and script references into every request.

The source also shows several practical failure modes:

- over-binding references can make a model literalize a prop that should only influence point of view, such as rendering binocular lenses instead of a binocular-view vignette;
- scene duration matters, and script timestamps help keep long scenes from being forced into short clips;
- reference count can affect generation cost;
- agent conversation/thinking can itself consume budget;
- repeated praise/enthusiasm is less useful than a technical collaborator mode;
- localized AI repair becomes cheaper when the clip is trimmed to the interval that actually needs repair;
- last-frame -> next-start-frame continuity and simple sketch/storyboard references are useful but already covered by existing Director systems.

### Gap 23 — persistent agentic project context

Added `AgenticProjectContext`.

It stores once per project:

- script asset;
- reusable style/character/location/prop/effect/composition/motion asset bindings;
- global versus scene-local scope;
- scene IDs and order;
- scene start/end timing;
- scene direction;
- required, optional and explicitly excluded references;
- provenance/evidence.

This makes persistent context a governed Director artifact rather than hidden conversational memory.

### Gap 24 — generate scene by ID without manual rebinding

Added `resolveAgenticSceneContext()`.

Given a project context, workspace library and scene ID it:

1. verifies project/workspace lineage;
2. verifies all referenced assets actually exist in the project library;
3. derives target duration from the scene's script time range;
4. automatically includes global assets such as the project style;
5. includes only required assets plus explicitly admitted supplemental assets;
6. removes excluded references;
7. emits the existing canonical `GenerationReferenceManifest`.

This prevents manual over-binding from becoming the default production path.

An asset not declared required/optional for that scene cannot be injected as a supplemental reference.

### Reference semantics stay explicit

The source's binocular example is represented by scene scope rather than provider-specific prompting tricks.

If the binocular prop should not be visually present in a point-of-view shot, that scene can exclude the binocular asset while the scene direction still says the audience is seeing through binocular vision.

Likewise, a bow or other recurring prop can be required only in the scenes where continuity demands that it be physically visible.

### Gap 25 — compound agentic cost receipt

The source reports that final cost can vary based on:

- generated media duration;
- number of bound references;
- conversational/agent token use;
- downstream repair.

Added `AgenticSceneCostPlan` and `summarizeAgenticSceneCost()`.

Cost components remain separate:

- `media-generation`;
- `reference-surcharge`;
- `orchestration`;
- `repair`.

Each component uses the existing `GenerationCostEstimate` structure with provider/model/pricing-source provenance.

Director does not invent a universal formula for reference cost or agent "thinking." Provider adapters must supply current estimates.

The summary exposes both total projected cost and per-component cost so an operator can see whether time savings from the agent are worth the additional orchestration spend.

Normal Director spend authorization remains the final authority.

### Gap 26 — technical collaborator interaction profile

The source explicitly changes the agent from enthusiastic creative cheerleader to technical collaborator.

Added `DirectorCollaborationProfile` with:

- mode = `technical-collaborator`;
- response-detail preference;
- `evidence-only` praise policy;
- optional model optimization target;
- evidence/provenance.

This does not rewrite Jhadina's global personality. It is a scoped Director working mode for production sessions where useful critique, optimization and factual feedback matter more than hype.

### Gap 27 — localized trim-first video repair

The source repairs generated continuity mistakes by:

1. trimming the clip to the portion actually needed;
2. masking only the unwanted object/region;
3. running AI remove on that smaller interval;
4. paying only for the scoped repair when the provider prices by duration.

Added `LocalizedVideoRepairPlan` and `evaluateLocalizedVideoRepair()`.

The plan records:

- source clip/asset;
- timeline version;
- exact repair interval;
- mask asset;
- remove/replace/cleanup operation;
- repair instruction;
- optional full-clip and scoped cost estimates;
- evidence.

The decision validates source bounds and can report projected savings when both estimates are available.

Director does not claim that trimming always saves money; it only reports the difference using provider-derived estimates.

### Existing systems reused

No duplicate subsystem was added for:

- canvas/media organization -> `CreativeWorkspaceLibrary`;
- script/scene/shot duration -> shotlist and storyboard stages;
- style/character/location/prop references -> generation reference manifests and locked references;
- last-frame continuity -> current-frame extraction and continuity strategy;
- simple sketches/storyboards -> storyboard reference board and previs;
- visual reaction shots and emotional progression -> performance direction and storyboard planning;
- trimming/editing -> canonical timeline editing;
- generation spend approval -> existing generation spend gate;
- provider prompt optimization -> documentation-grounded prompt translator.

The new layer only makes persistent project context, selective scene binding, compound agent costs and localized repair explicit and inspectable.


## 3D world / consistent-location reference audit

The supplied OpenArt workflow demonstrates a useful environment-continuity pipeline:

- create a navigable 3D world from an image or text description;
- preview the environment before committing to the more expensive full-world generation;
- navigate the world and capture multiple camera angles;
- vary focal length while keeping the same underlying location;
- place recurring characters into that world;
- use those captures as reference images rather than necessarily as literal image-to-video endpoints;
- turn selected world captures into a storyboard;
- combine storyboard/reference imagery with timestamped scene direction;
- use last-frame continuation for a later action beat;
- generate only the missing few seconds when the rest of the scene already exists.

### Existing Director systems reused

Director already had:

- `EnvironmentViewPack` for canonical location continuity and approved views;
- `DirectorCameraPlan` / previs focal-length and camera control;
- storyboard reference boards;
- multi-shot/reference manifests;
- timestamped scene/shot duration;
- first/last-frame continuity;
- selective short-duration generation;
- generation spend estimates and authorization.

The missing layer was the provenance between a navigable world, its camera captures, and those existing continuity/storyboard artifacts.

### Gap 28 — governed world-build plan

Added `WorldBuildPlan`.

It records:

- project/environment identity;
- whether the world was derived from an image or text;
- source asset or source prompt;
- optional preview asset;
- project style references;
- evidence/provenance.

Provider-specific world implementations remain downstream. Director does not treat OpenArt's world format as canonical.

### Gap 29 — camera/character world capture session

Added `WorldCaptureSession`, `WorldCameraPose`, `WorldCharacterPlacement` and `WorldReferenceCapture`.

Each captured view records:

- camera position/rotation;
- focal length;
- character placements and optional look-at relationships;
- intended use:
  - `omni-reference`;
  - `storyboard`;
  - `first-frame`;
  - `last-frame`;
- capture asset/hash;
- provenance.

This preserves the useful distinction in the source:

- a loose omni/reference image may tolerate modest character-position discrepancies because it is guidance;
- start/end-frame captures are continuity endpoints and therefore require explicit continuity grouping and matching character sets.

Director does not assume that every world snapshot is safe to use as a literal start/end frame.

### Gap 30 — world capture -> environment view pack

Added `buildEnvironmentViewPackFromWorld()`.

A validated world session can now emit the existing canonical `EnvironmentViewPack`, carrying:

- the canonical location capture;
- all approved world views;
- camera/focal-length evidence;
- reference-use metadata;
- world-source lineage;
- style references.

This means the 3D world is a production tool for generating environment evidence, while `EnvironmentViewPack` remains Director's continuity authority.

### Gap 31 — world capture -> storyboard board

Added `buildStoryboardReferenceBoardFromWorld()`.

Selected world captures become the existing `StoryboardReferenceBoard`, preserving:

- frame order;
- still hashes;
- view labels;
- focal length metadata;
- world/capture provenance.

This directly supports the source's world -> images -> storyboard -> video sequence without introducing a second storyboard representation.

### Gap 32 — preview-before-full-world cost gate

The source previews a text-generated panorama at much lower cost before committing to a full 3D world.

Added `evaluateWorldPreviewCost()`.

It compares provider-derived preview and full-world `GenerationCostEstimate` records and requires:

- project lineage;
- valid cost provenance;
- an accepted preview;
- an actual positive cost advantage.

Director does not hard-code the source's example credit values. Provider adapters supply current estimates.

### Existing techniques retained without duplication

The following lessons already map to canonical Director features:

- focal-length variation -> camera/previs plans;
- OTS/reverse placement specificity -> dialogue coverage and camera plans;
- character wardrobe consistency -> character identity/reference contracts;
- multiple world views as general references -> environment view packs;
- storyboard plus timestamped prompts -> storyboard reference board + structured generation direction;
- last frame of one clip as the next clip's first frame -> continuity strategy/current-frame extraction;
- generate only the missing four seconds -> target-duration generation and spend planning.

The new world workflow only governs how a navigable environment produces trusted reference views and storyboards.


## Hunyuan3D-1 / Realsee3D backend audit

Two additional 3D references were supplied:

- `Tencent-Hunyuan/Hunyuan3D-1`;
- `realsee-developer/RealSee3D`.

They serve different roles and should not be treated as interchangeable "world engines."

### Hunyuan3D-1

The repository supports:

- text -> image -> fixed multi-view -> mesh generation;
- image -> fixed multi-view -> mesh generation;
- six fixed azimuth views relative to the input: 0, 60, 120, 180, 240 and 300 degrees;
- optional texture mapping;
- mesh/turntable rendering.

It is useful for generating 3D props or set pieces that may later be placed inside a Director world/previs environment.

It is **not** a navigable free-camera scene generator by itself.

#### License boundary

The repository source headers state that Hunyuan3D-1 is licensed under the **Tencent Hunyuan Non-Commercial License Agreement**. The README also states that the optional Dust3R-backed baking module uses CC BY-NC-SA 4.0 and cannot be used commercially.

Director therefore exposes Hunyuan3D-1 as a non-commercial asset-generation capability profile and fails closed for commercial production use.

This does not mean generated meshes are automatically admitted as canonical production assets. Normal asset provenance, QC and approval still apply.

### RealSee3D

RealSee3D is a large multi-view RGB-D dataset, not an inference runtime.

The repository documents:

- 360-degree equirectangular RGB panoramas;
- aligned depth;
- metric depth scale;
- 4x4 camera-to-world extrinsics;
- floor indices;
- semantic segmentation;
- viewpoint covisibility matrices;
- point-cloud reconstruction utilities.

Real-world segmentation maps are model predictions rather than human-verified ground truth; synthetic labels are rendered exactly from the synthetic scene definition.

#### Access boundary

The repository's code utilities are described as MIT licensed, but access to the actual dataset requires a signed **Realsee3D Data Usage Agreement** and approval from Realsee.

Director therefore treats Realsee3D as an `agreement-required` dataset/benchmark profile.

It may support research/evaluation of environment reconstruction once access is approved, but it cannot be treated as an available production runtime merely because the GitHub repository is public.

### Gap 33 — governed 3D backend capability profiles

Added `World3DBackendProfile` and `evaluateWorld3DBackend()`.

Profiles record:

- backend kind:
  - `asset-generator`;
  - `reconstruction-runtime`;
  - `dataset-benchmark`;
- explicit capabilities;
- runtime availability;
- access mode;
- code/model/data license information;
- commercial-use policy;
- restricted features;
- source/evidence provenance.

A use request declares:

- intended use;
- required capabilities;
- whether the project is commercial;
- whether controlled dataset access has been approved;
- whether a runnable inference backend is required.

The evaluator fails closed on:

- missing capabilities;
- missing runtime;
- unapproved dataset access;
- prohibited commercial use;
- unresolved commercial terms;
- attempts to use a non-navigable backend as a navigable world engine.

### Canonical role in the Director world stack

Current intended separation:

- OpenArt-like world providers -> navigable environment/reference capture;
- Hunyuan3D-1 -> non-commercial 3D prop/set-piece generation;
- Realsee3D -> controlled-access reconstruction benchmark/evaluation data;
- Director `EnvironmentViewPack` -> canonical approved environment continuity;
- Director `WorldCaptureSession` -> camera/character capture provenance;
- Director previs -> authored camera/blocking execution.

This prevents a useful 3D model or dataset from being promoted beyond what it actually provides.


### Large Sparse Reconstruction Model (LSRM)

Reference: `facebookresearch/Large-Sparse-Reconstruction-Model`.

LSRM is a feed-forward **object-centric** reconstruction and inverse-rendering model. Its documented runtime consumes posed sparse multi-view RGB images plus foreground masks and can produce:

- reconstructed object meshes;
- textured/UV-unwrapped meshes;
- novel-view renders;
- inverse-rendered material channels including albedo, roughness and metallic;
- Blender re-renders/relighting from the reconstructed asset.

It is therefore a strong candidate for reconstructing a prop or set piece from a controlled multi-view capture set.

It is not a whole-room or navigable-world reconstruction backend.

#### Runtime/access boundary

The repository documents inference using less than 40 GB GPU memory and notes testing on NVIDIA H200 hardware.

The runtime also requires separately gated DINOv3 ViT-H/16+ weights. Director now models this explicitly as required external access rather than assuming that a public GitHub repository means every dependency is immediately runnable.

A backend can therefore be:

- publicly cloned;
- runtime-capable in principle;
- still inadmissible until gated model access is approved.

#### License boundary

The LSRM repository is licensed under **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

Director therefore fails closed for commercial production use, just as it does for other non-commercial 3D backends.

#### Gap 34 — external dependency access admission

`World3DBackendProfile` now supports `requiredExternalAccessIds`, and `World3DBackendRequirement` can declare `approvedExternalAccessIds`.

`evaluateWorld3DBackend()` fails with `DIRECTOR_3D_BACKEND_EXTERNAL_ACCESS_REQUIRED` when a required gated dependency has not been approved.

This avoids discovering gated checkpoints only after a reconstruction job has already been scheduled.

#### LSRM capability profile

The LSRM profile records:

- posed sparse multi-view input;
- foreground-mask input;
- object mesh reconstruction;
- novel-view synthesis;
- inverse rendering;
- mesh texturing;
- albedo, roughness and metallic material recovery;
- turntable/render output;
- non-commercial use;
- gated DINOv3 runtime dependency.

Current intended use in Director:

- approved non-commercial object/prop reconstruction from controlled multi-view captures;
- material-reference recovery for previs/look-development;
- reconstruction experiments.

Not admitted as:

- commercial production backend;
- room/world reconstruction;
- free-camera navigable environment engine.


## GitGlobe + Matrix-3D + GEV integration

The user's existing GEV work is now explicitly connected to the Director world stack.

### GEV remains the real-world intelligence boundary

The previously merged GEV architecture remains unchanged in authority:

`source -> observation -> immutable evidence -> explicit Reality admission -> SpatialContext -> Ask Jhadina / governed consumers`.

CCTV, aircraft, AIS vessels, FIRMS fire, USGS earthquakes, public satellite context and other admitted providers remain intelligence inputs. None of the new rendering/world tools can bypass evidence or Reality admission.

### GitGlobe is a presentation/control pattern, not geospatial evidence

GitGlobe's useful contribution is its ID-based camera protocol and scalable globe rendering architecture.

Director/Spatial reuse the design rule:

> the model chooses grounded entity/reference IDs; the renderer owns geometry.

No GitGlobe semantic-layout coordinate is interpreted as latitude/longitude.

### Matrix-3D is the navigable-world backend slot

Unlike Hunyuan3D-1 and LSRM, Matrix-3D genuinely targets 360-degree explorable scene generation.

It can therefore satisfy Director requirements that explicitly ask for:

- free-camera world;
- navigable world;
- panoramic generation;
- panoramic scene reconstruction;
- custom camera trajectory.

Commercial use remains fail-closed until checkpoint/model terms are independently verified beyond the MIT code license.

### Synthetic world bridge from GEV

GEV SpatialContext can now be projected into a `SpatialWorldVisualizationSeed` containing evidence/Reality/provenance/uncertainty.

The seed is intelligence-only and marked `MUST_NOT_REENTER_SPATIAL_REALITY`.

This enables workflows such as:

- build a spatially informed visualization for Director;
- create a Matrix-3D environment inspired by admitted public-world context;
- fly/focus the Spatial globe by grounded entity IDs;
- use the generated world for planning, storytelling or visualization;

without claiming that generated geometry is observed reality.
