# DIRECTOR Editing Intelligence Audit — 2026-09-22

## Source material

This audit delta reconciles the Director subsystem against the newly supplied video-editing / faceless-content transcripts. The transcripts describe workflows centered on Claude + Descript, Claude + VidIQ, Viblo-style ranking-video construction, and local/free AI video generation. External product claims in the transcripts are treated as reference observations until independently verified; they are not production capability claims.

## Core finding

The strongest signal from the editing transcript is a failure mode Director must explicitly prevent:

> A system can read and time-align the transcript perfectly while still making bad edits because it never understood the actual frames.

Examples described in the supplied material:
- spoken production directions such as “cut that part out” can be mistaken for publishable dialogue;
- punch-in/zoom placement can be semantically irrelevant because the editor does not understand expression/body motion;
- text can be placed over faces or important objects;
- transcript-only importance scoring does not imply spatially safe on-screen placement;
- correcting a transcript-only autonomous pass can take longer than using native editor assists directly.

Therefore Director must not equate **speech understanding** with **video understanding**.

## Required canonical edit-perception stack

Director editing intelligence should converge on:

```
source media
-> immutable timebase
-> transcript + word/phoneme timestamps
-> silence / breath / filler / repetition candidates
-> visual frames / scene boundaries
-> face / person / object tracks
-> expression / pose / gesture observations
-> saliency + safe-title regions
-> camera-motion / framing observations
-> audio structure / music beats / stems
-> semantic intent / spoken-production-direction classification
-> edit candidates
-> multimodal validation
-> governed edit proposal
-> timeline mutation
-> render
-> QC
-> human approval / publish handoff
```

No single modality is authoritative.

## DIR-EDIT.1 — Transcript-native cleanup

Add an editing-analysis contract for:
- filler-word candidates;
- dead-air / long-gap candidates;
- repeated-sentence / false-start candidates;
- breaths and hesitation spans;
- explicit user-marked keep/remove spans;
- semantic “production direction” candidates such as “cut that”, “restart”, or “use the other take”.

These are **proposals**, never destructive edits by default.

Important distinction:
- a spoken phrase that sounds like an edit command inside recorded content is not automatically an authorization command;
- edit authority comes from the authenticated editing session / action request, not dialogue inside the media.

## DIR-EDIT.2 — Multimodal watch-before-edit gate

Before autonomous visual edits such as:
- punch-in / zoom;
- crop / reframe;
- kinetic text;
- overlay placement;
- b-roll replacement;
- reaction emphasis;
- cutaway insertion;
- face-following crop;

Director must have frame-derived evidence for the requested interval.

At minimum each candidate should carry:
- frame/time range;
- visible-person tracks;
- face bounding boxes;
- high-saliency regions;
- safe-overlay regions;
- motion estimate;
- expression / pose observations where available;
- confidence and limitations.

If frame evidence is unavailable, Director may perform transcript cleanup but must fail closed on visual-layout automation.

## DIR-EDIT.3 — Face/object-safe text placement

The transcript calls out words being selected correctly but placed incorrectly on screen.

Director needs a spatial placement solver that:
1. identifies faces, hands, products, subtitles, logos and other protected regions;
2. scores candidate text regions across the display-safe area;
3. avoids important content;
4. checks legibility/contrast;
5. re-evaluates across the entire text-on-screen duration, not one sampled frame;
6. records why a placement was chosen.

A placement that becomes unsafe midway through a shot must be rejected or tracked dynamically.

## DIR-EDIT.4 — Semantic zoom / punch-in policy

Do not generate zooms from transcript emphasis alone.

A punch-in candidate should combine:
- semantic emphasis;
- speaker identity;
- expression/gesture change;
- shot scale;
- current crop headroom;
- continuity with adjacent cuts;
- motion;
- duration;
- platform format.

QC should detect:
- zooms into empty/irrelevant regions;
- facial clipping;
- excessive repeated punch-ins;
- rapid oscillation;
- crop instability.

## DIR-EDIT.5 — Native-editor / external-editor adapter boundary

The supplied workflow suggests value in Descript-style text editing and external editor automation.

Director should support a provider-neutral editor adapter:

```
EditorAdapter
- inspectProject
- readTranscript
- proposeTranscriptEdits
- applyApprovedEdits
- renderPreview
- exportTimeline / artifact
- reconcileOperation
```

Potential implementations can include Descript-like editors later, but external tools must remain providers, not Director authority.

The adapter must preserve:
- project ownership;
- exact artifact/version;
- edit proposal fingerprint;
- approval receipt when required;
- provider operation ID;
- reconciliation after timeout;
- exported-media hash/provenance.

“Always allow every step” in an external tool must never bypass Jhadina Action Core policy. User convenience at the provider UI is not equivalent to Jhadina authorization.

## DIR-EDIT.6 — Assist-first editing mode

The transcript provides evidence for a useful product distinction:

### Assist mode
Fast deterministic utilities:
- shorten gaps;
- filler-word suggestions;
- transcript deletion;
- studio-sound / cleanup adapter;
- caption/layout suggestions;
- b-roll search suggestions.

### Autonomous edit mode
Requires full multimodal perception, evidence and QC.

Director should prefer Assist mode whenever confidence is insufficient for a high-quality autonomous decision.

## DIR-EDIT.7 — Idea / packaging intelligence is upstream, not editing authority

The transcripts repeatedly argue that video idea, niche, title, thumbnail and intro often matter more than editing complexity.

This maps cleanly to the current Social/Growth -> Director production bridge now on main.

Desired flow:

```
Growth evidence
-> Content Project / Big Idea
-> title / thumbnail / hook hypotheses
-> Director creative brief
-> Director production
-> platform-native variant
-> Social publication
-> performance observations
-> Growth learning
-> future Director insight candidate
```

Do not let CTR/view-performance evidence directly mutate a live Director timeline.

## DIR-EDIT.8 — Outlier / competitor research

The supplied “ICON method” / VidIQ workflow uses:
- competitor channels;
- views;
- subscriber counts;
- view-to-subscriber ratios;
- outlier videos;
- title / thumbnail / topic patterns.

Treat these as Growth evidence and hypotheses, not guaranteed virality rules.

Director can consume a creative brief such as:
- target audience;
- proven topic family;
- reference videos;
- packaging hypothesis;
- hook hypothesis;
- desired format.

It should not blindly clone another creator’s work.

## DIR-EDIT.9 — Faceless Shorts / ranking-video workflow

A legitimate ranking-video production recipe can exist, but the transcript’s suggested workflow includes copying/downloading third-party TikTok clips and removing watermarks.

That must **not** become the canonical Director automation path.

Director should require each source clip to have a rights/provenance state such as:
- owned;
- licensed;
- public-domain;
- provider-cleared;
- explicit creator permission;
- unknown / blocked.

Unknown-rights media may be used as research/reference evidence but cannot be automatically republished.

A ranking recipe itself is fine:
- 5–7 ranked items as an experiment, not a hard truth;
- custom ordering as an experiment;
- title overlays;
- hook;
- pacing;
- caption styling;
- optional narration/commentary;
- provenance per source.

But source acquisition must stay rights-aware.

## DIR-EDIT.10 — Local generation

The transcript also describes local/free AI video generation.

Director already has a provider-neutral generation boundary, which is the correct architecture. Local engines should enter through that boundary with:
- exact model/checkpoint identity;
- artifact digest;
- license;
- runtime attestation;
- deterministic/recoverable submission semantics where possible;
- generated-output provenance.

“Free/unlimited locally” is a provider/runtime economic property, not a Director guarantee.

## New acceptance tests implied by these transcripts

1. **Transcript command confusion**
   - recorded speech says “cut this part out”;
   - Director must not interpret it as authenticated edit authorization.

2. **Face-safe caption placement**
   - moving face crosses a candidate text region;
   - static unsafe placement is rejected.

3. **Semantic zoom**
   - transcript has an emphasized word but speaker is visually idle/off-frame;
   - zoom is rejected.

4. **Read-vs-watch**
   - transcript evidence exists but frame evidence is unavailable;
   - dead-air/filler proposal may proceed;
   - visual crop/zoom/text automation fails closed.

5. **Repeated-take cleanup**
   - two semantically similar takes exist;
   - system proposes candidate removal with evidence and keeps original version recoverable.

6. **External editor reconciliation**
   - provider times out after applying an edit;
   - Director reconciles before retrying and never double-applies the edit.

7. **Rights-aware ranking source**
   - reference clip has unknown rights;
   - it may inform idea research but cannot be inserted into a publishable artifact.

8. **Performance feedback isolation**
   - Social says one hook outperformed another;
   - creates a future creative insight, not a direct timeline mutation.

## Updated Director priority after R1/R2

After project-authority / Studio-QC closure:

1. DIRECTOR-AUDIT.R3 — canonical Director project state/version.
2. DIRECTOR-EDIT.1 — immutable edit-perception/timebase contract.
3. DIRECTOR-EDIT.2 — transcript cleanup candidate engine.
4. DIRECTOR-EDIT.3 — frame/watch evidence + saliency/face-safe placement.
5. DIRECTOR-EDIT.4 — multimodal zoom/crop/layout QC.
6. DIRECTOR-AUDIT.R4 — temporal ShotContract / beat events.
7. DIRECTOR-AUDIT.R5 — Study, Music and Spatial evidence bridges.
8. DIRECTOR-EDIT.5 — provider-neutral external editor adapter.
9. DIRECTOR-AUDIT.R7/R8 — CI, artifact provenance and real-runtime acceptance.

## Bottom line

The new reference material does not justify replacing Director with Claude/Descript/Viblo-style automation.

It validates a stronger architecture:

**Director should be able to use those classes of tools as workers, while Jhadina itself watches the media, understands transcript + frames + audio together, owns the timeline/project state, applies governed edits, verifies visual quality, preserves provenance, and learns from downstream performance without allowing performance signals to become editing authority.**
