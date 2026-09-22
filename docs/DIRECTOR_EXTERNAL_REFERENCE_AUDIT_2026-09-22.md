# Director External Reference Audit — 2026-09-22

This audit reconciles the Director subsystem against the newly supplied filmmaking, visual-analysis, orchestration, editing and storyboard repositories.

The rule for this audit is **concept absorption, not repo cloning**. Director keeps its own authority, project state, evidence lineage, Action Core boundaries and provider-neutral interfaces.

## Reference matrix

| Reference | What it contributes | Director disposition |
|---|---|---|
| `cvat-ai/cvat` | Image/video/3D annotation, tracks, boxes/masks/keypoints, dataset management, QA, SDK/API, review/ground-truth workflows | **High-value.** Treat as an optional visual-annotation/ground-truth provider and dataset lab. Do not make CVAT the Director state authority. |
| `wanshuiyin/ARIS-Movie-Director` | Locked source-of-truth artifacts, digest-bound gates, cross-model independent review, fail-closed review, human story gates, long-horizon continuity | **High-value.** Absorb artifact-digest review quorum and producer/reviewer independence. Keep Jhadina's existing approval/runtime model. |
| `smixs/visual-skills` | Dramaturgy-first shot planning, motivated camera, physical details, shot purpose, rhythm, model-specific prompt routing | **High-value craft reference.** Convert to generic Director craft evidence; do not hard-code one filmmaker's aesthetic as universal truth. CC BY 4.0 means copied/derived reference material requires attribution. |
| `juspay/director` | Multi-phase production runner, resumable state, provider routers, scoring, regression gates, cost tracking, observability, HITL distribution | **High-value runtime reference.** Absorb resume-safe phase state, independent quality evidence, budget/cost receipts and provider-neutral stages. Direct code reuse requires separate license/provenance review. |
| `melihsafacelik/MovieDirectorHub` | Modular service/repository/controller CRUD patterns for movies/directors | **Low creative-runtime value.** Existing Jhadina architecture already has stronger service/repository boundaries. Keep as generic backend reference only. |
| `ad-si/awesome-video-production` | Curated map of screenwriting, storyboarding, editing, animation, audio, programmatic video and AI tools | **High-value discovery index, not runtime dependency.** Use to populate candidate provider backlog and reference-provenance audits. |
| `zechenzhangAGI/vibe-filmmaking-veo3-claude` | Iterative style experiments, preserved creative evolution, last-frame continuity, match-cut design, generated-clip metadata | **Useful creative experiment reference.** Absorb variant/attempt lineage and continuity hypotheses. No repository license file was found in this audit, so treat as reference-only unless licensing is clarified. |
| `simonwar119-wq/open-edit` | Footage analysis, intent→style→shot-plan, generated gap shots, grading, subtitles, music, local-first editor, MCP surface | **Strong editor-provider reference.** Useful for Director's future external-editor adapter and technique registry. README states MIT, but no LICENSE file was found in this audit; keep concept-only until verified. |
| `ThirupathiReddyPuchakayala/EMOTIONAL-STORY-BOARD-GENERATOR-FOR-FILM-MAKERS` | Scene emotion inference feeding storyboard generation and editable storyboard UI | **Medium-value advisory input.** Emotion must remain evidence, not scene truth. One frontend path uses mock cycling and backend can fall back to neutral, so never promote these labels automatically. No LICENSE file found. |
| `yaseerairfan/kinograph` | Frame-exact deterministic rendering, pure seek/time contract, timing/score/narration coupling, contact-sheet inspection, real FFmpeg/Chromium tests | **High-value.** Absorb deterministic render/time contracts and actual rendered-frame inspection. MIT licensed. |

## Contracts added to Director from this audit

### 1. Visual observation evidence

`visual-observation-evidence.ts`

Provides a provider-neutral contract for:
- boxes, masks, keypoints, tracks and tags;
- frame coverage;
- confidence/evidence/limitations;
- protected visual regions such as faces, people, products, logos, subtitles and critical objects;
- fail-closed admission for zoom/crop/reframe/overlay/caption-layout when frame-derived evidence is absent;
- overlay collision checks across the overlay lifetime.

This is where a future CVAT adapter belongs:

```
Director media asset
-> annotation task / auto-label provider
-> VisualAnnotationEvidence
-> Director edit candidate
-> visual safety / continuity gate
```

CVAT is never granted edit authority.

### 2. Independent creative review panel

`creative-review-panel.ts`

Adds deterministic review fusion:
- exact artifact SHA binding;
- distinct reviewer-family quorum;
- producer-family self-review exclusion;
- inconclusive reviews never silently pass;
- warnings are policy-controlled;
- pass/fail remains deterministic after model outputs are collected.

This closes the architectural lesson from ARIS without importing its specific agent runtime.

### 3. Dramaturgy / shot-purpose gate

`dramaturgy-gate.ts`

Adds a lightweight craft gate requiring:
- at least one narrative function;
- observable physical detail;
- readable subject geometry;
- motivated camera behavior.

It deliberately does **not** rank artistic taste or require one named director's style.

This should later attach to the temporal ShotContract.

### 4. Resume-safe phase checkpoint

`phase-checkpoint.ts`

Adds:
- run/project/phase identity;
- exact input fingerprint;
- output artifact IDs + output fingerprint;
- stale invalidation when input changes;
- no resume from an unrelated run/project or changed creative input.

This mirrors the strongest runtime lesson from Juspay Director and prevents stale output reuse.

### 5. Frame-exact deterministic rendering

`render-determinism.ts`

Adds:
- positive FPS/dimensions/duration validation;
- duration must resolve to an exact whole frame count;
- repeated render requests for the same time must produce the same frame digest;
- hidden mutable render state fails certification.

This is engine-neutral. Kinograph, Remotion, browser/WebCodecs, Blender or another renderer can satisfy the contract.

### 6. Advisory emotion evidence

`emotion-storyboard-evidence.ts`

Adds:
- provider/model/confidence;
- observed/fallback/inconclusive status;
- evidence refs + limitations;
- explicit `ADVISORY_ONLY` authority.

Fallback labels cannot silently drive storyboard generation.

The intended flow is:

```
script/scene
-> emotion observation
-> confidence + evidence + limitations
-> Director insight candidate
-> storyboard proposal
-> user/project acceptance
```

not:

```
classifier label -> canonical scene emotion
```

### 7. Creative experiment lineage

`creative-experiment.ts`

Preserves:
- hypothesis;
- variable under test;
- all variants;
- all generation attempt IDs, including failed/discarded attempts;
- evidence refs;
- explicit selected-variant receipt.

This gives Director a proper home for "photoreal vs watercolor vs pencil" or alternative match-cut experiments without silently rewriting project truth.

## Important additions from the second reference batch

### Open Edit: technique knowledge should become structured data

Open Edit's strongest concept is translating vague film language into executable edit/shot parameters.

Director should eventually own a **TechniqueSpec registry** with fields such as:

```
technique id
creative purpose
required source evidence
shot/timeline preconditions
parameter ranges
execution provider capability
known failure modes
QC checks
reversibility
```

Examples include J/L cuts, speed ramps, match cuts, reaction inserts, split-screen, montage pacing, color treatments and subtitle styles.

The technique registry should describe what an edit *does* and how to verify it, rather than treating style names as magic strings.

### Kinograph: timeline time must be one source of truth

A key lesson is that picture, narration, score, captions and animation must derive from a shared time model.

Director's R4 temporal ShotContract should therefore include:
- canonical project timebase;
- shot start/end/duration;
- named beats/events;
- narration/phoneme spans;
- music beat/section refs;
- transition handles;
- retime mapping;
- source-time to timeline-time mapping.

This is now a stronger requirement than a simple `durationSec`.

### Kinograph: rendered output must be inspected

A successful render process is not proof the result is visually correct.

Director acceptance should include:
- representative stills/contact sheet;
- protected-region checks;
- black/corrupt/tail-frame detection;
- duration/audio/video stream consistency;
- deterministic frame samples;
- visual quality evidence.

This complements the new multimodal "watch before edit" requirement.

### Vibe filmmaking: preserve the journey

Creative pivots and failed generations should be first-class evidence.

A creative experiment may record:
- candidate style;
- prompt/version;
- generation provider/model;
- reference frame(s);
- result artifact;
- rejection/selection reason;
- reviewer evidence;
- continuity score;
- cost.

Director can then learn:
- which prompts fail for a provider;
- which continuity technique was effective;
- which aesthetic the user selected in this project;
without converting one project's preference into a global immutable rule.

### Emotional storyboard: emotion is not a command

Scene-level emotion can help:
- choose candidate lighting;
- generate storyboard alternatives;
- prioritize performance moments;
- score emotional continuity.

But it must not independently choose:
- final camera movement;
- final color grade;
- final shot;
- canonical story meaning.

Those remain Director/project decisions.

### Awesome Video Production: candidate-provider backlog

The curated list surfaces useful future provider classes:
- transcript/silence editors;
- browser/programmatic editors;
- matting;
- upscaling/interpolation;
- animation engines;
- nonlinear editors;
- motion graphics;
- captioning;
- local-first editing.

Each candidate should enter through Reference Provenance first:

```
source repo/product
-> exact version/commit
-> license
-> capability
-> deterministic/recoverable behavior
-> security/privacy
-> artifact provenance
-> provider adapter
-> conformance tests
```

No provider should be added merely because it appears on an awesome list.

## What is explicitly not being absorbed

- No repo becomes the Director source of truth.
- No external model or agent may self-authorize a timeline mutation.
- No emotion model becomes story authority.
- No style taxonomy becomes a hard universal aesthetic rule.
- No third-party code is copied where license/provenance is unclear.
- No "one command makes the whole movie" claim bypasses human gates, project authority, QC or artifact lineage.
- No successful process exit is treated as proof of visual quality.
- No reference footage with unknown rights becomes publishable media merely because an editor can ingest it.

## Updated Director sequence

After R1/R2:

1. **DIRECTOR-AUDIT.R3** — canonical durable `DirectorProjectState`.
2. **DIRECTOR-EDIT.1** — immutable media/timebase + edit-perception contract.
3. **DIRECTOR-EDIT.2** — transcript cleanup candidate engine.
4. **DIRECTOR-EDIT.3** — annotation/vision provider bridge (CVAT-compatible) and protected-region timeline.
5. **DIRECTOR-EDIT.4** — visual-layout, zoom/crop/reframe QC.
6. **DIRECTOR-AUDIT.R4** — temporal ShotContract with canonical beats/time remapping.
7. **DIRECTOR-CRAFT.1** — TechniqueSpec + dramaturgy evidence.
8. **DIRECTOR-REVIEW.1** — independent multi-family review panel integration into media review lifecycle.
9. **DIRECTOR-RUNTIME.1** — durable phase checkpoints, cost ledger, deterministic render conformance.
10. **DIRECTOR-AUDIT.R5** — Study, Music and Spatial evidence bridges.
11. **DIRECTOR-EDIT.5** — provider-neutral external editor adapter (Descript/Open Edit/Resolve-class tools).
12. **DIRECTOR-AUDIT.R8** — real provider/runtime certification.

## Current conclusion

These references materially strengthen the roadmap, but they do not require a Director rewrite.

The target architecture is now:

```
creative intent
-> canonical project state
-> script/story evidence
-> craft + emotion + reference evidence
-> temporal shot plan
-> storyboard/previs
-> generation or owned footage
-> frame/audio/transcript observation
-> governed edit proposals
-> deterministic timeline mutation
-> render
-> visual/audio/continuity/regression review
-> independent review quorum where required
-> human approval
-> Social distribution
-> performance observations
-> future creative insight
```

The key invariant remains:

**Director can delegate perception, generation, editing and review work to many tools, but only Jhadina's canonical project/evidence/approval spine decides what becomes project truth.**
