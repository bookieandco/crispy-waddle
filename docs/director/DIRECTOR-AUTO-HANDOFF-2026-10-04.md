# DIRECTOR / WORKSTATION / JHADINA WATCH — HANDOFF REPORT

**Date:** 2026-10-04  
**Repository:** `bookieandco/crispy-waddle`  
**Working branch:** `fix/director-one-shot-20261004`  
**Pull request:** #1096 — **DIRECTOR-ONE-SHOT — self-retrying RunPod commissioning and media routing**  
**PR state at handoff:** OPEN, mergeable, not yet merged  
**Pre-handoff implementation head:** `5d0d52e501560f7fe72a02f7077dcb213d700ff8`  
**Important:** creating this document advances the branch by one docs-only commit, so resume from the current branch head rather than hard-coding the SHA above.

---

## 1. Executive status

Director is no longer just a generation backend. The current branch converges the previously separate work into one production system:

```
Business Factory / Music / owner prompt / uploaded script
        ↓
Director production plan + provenance
        ↓
screenplay / storyboard / shot list / creative gates
        ↓
bounded multi-take generation
        ↓
Watch/VLM take QC + winner selection + preserved backups
        ↓
durable Workstation rough cut
        ↓
voice / music / Foley / lip-sync / mix / render work session
        ↓
normal-project final QC + final watch + coherence evidence
        ↓
governed Social publication proposal/schedule
        ↓
performance/learning feedback
```

Separate but connected learning paths:

```
authorized TV / film / video
        ↓
Jhadina Watch
        ↓
timecoded observations + cinematic notebook
        ↓
feedback / taste hypotheses
        ↓
explicitly approved taste only
        ↓
future Director creative context
```

and:

```
authorized live/recorded game source
        ↓
Jhadina Watch
        ↓
Director sports observations
        ↓
Sports/Money context features
        ↓
simulation / parlay intelligence
```

Sports observations remain **context-only**. They do not establish canonical score/clock/possession without official reconciliation and they do not authorize or execute bets.

---

## 2. User requirements that must remain canonical

The owner explicitly wants Director/Jhadina to handle:

- ads;
- TikToks / Shorts / Reels;
- faceless YouTube;
- music videos;
- short films;
- feature films;
- generative extend;
- multiple takes and preserved backup takes;
- B-roll;
- narration;
- Foley/SFX;
- dialogue/lip-sync/ADR;
- captions;
- stems;
- Final Cut Pro-like editing;
- FCPXML / OTIO export;
- uploadable scripts and references;
- co-directing through the Workstation;
- automatic scheduled Social handoff;
- Business Factory context so Director knows **what business/product/campaign the media is for**;
- Jhadina watching movies/TV and forming taste from notes/evidence;
- Jhadina watching games to improve sports intelligence;
- autonomous/background watching so the owner does not have to upload every clip;
- RunPod burst compute now, Homebase/local runtime later;
- minimum unnecessary recurring external spend.

Do not rebuild another editor, another taste engine, another sports perception system, or another Business Factory renderer. Extend the canonical systems already present.

---

## 3. Canonical editing surface: Director Workstation

The existing Workstation remains the canonical human/Jhadina co-directing interface.

Current branch now surfaces these panels/components:

- `WorkstationBusinessContext`
- `WorkstationProjectInputs`
- `WorkstationScreenplayProposals`
- `WorkstationProductionGates`
- `WorkstationRoughCut`
- `WorkstationTakeSets`
- `WorkstationAudioPost`
- `WorkstationFinalQc`
- `WorkstationAnnotationReview`
- `WorkstationBusinessCanary`
- `WorkstationAutoFinal`
- `WorkstationWatchCommissioning`
- `WorkstationWatchStudy`
- `WorkstationMediaStudy`
- `WorkstationSocialScheduler`
- `WorkstationTimeline`

The durable Workstation timeline from the older stranded Workstation PR was folded forward into #1096.

The timeline supports:

- multi-track editing;
- clip move/trim/split/ripple;
- fades/cross-dissolves;
- volume/opacity;
- markers/playhead;
- undo/redo and durable version history;
- generated-asset insertion;
- governed generative regions/extend;
- clip/source continuity;
- long-form timelines, not only a 30-second demo;
- 9:16, 16:9, or 1:1 initialization;
- up to four-hour production duration;
- FCPXML export;
- OTIO export.

Do not claim the Workstation needs to be invented.

---

## 4. Business Factory → Director

Primary bridge:

`apps/jhadina-web/src/lib/opportunities/side-hustle-director-bridge.ts`

Media-capable families include:

- `content_social`
- `creative_advertising`
- `media_production`
- `owned_media`
- `creator_monetization`

Production formats include:

- `tiktok_short`
- `ugc_ad`
- `faceless_youtube`
- `music_video`
- `short_film`
- `feature_film`

Plans persist:

- opportunity ID;
- source/source refs;
- rights evidence;
- production evidence;
- active task;
- aspect ratio;
- target runtime;
- Director project ID;
- Workstation URL;
- take-set policy;
- approved creative preferences;
- publication authority = NONE;
- paid-media authority = NONE.

Business Factory can create/reopen the exact Director project instead of inventing a parallel creative renderer.

Important persistence:

`director_project_business_context`

---

## 5. Screenplay / script path

User scripts can enter through the existing Universal Artifact Core.

Current path:

```
Project Inputs
 → Artifact Core scan
 → clean/extracted text
 → screenplay ingest proposal
 → Workstation review
 → explicit Accept blueprint
 → canonical screenplay blueprint
 → storyboard/shot-list planning
```

Relevant code:

- `packages/director-core/src/screenplay-ingest.ts`
- `packages/director-core/src/screenplay-storyboard-planner.ts`
- `apps/jhadina-web/src/app/api/workstation/screenplay/route.ts`
- `apps/jhadina-web/components/workstation/WorkstationScreenplayProposals.tsx`

Parsing is deliberately proposal-only. Messy PDF/DOCX extraction must not silently become unquestioned screenplay truth.

---

## 6. Multiple takes and backup takes

Director now has a real take-set path, not only a policy concept.

Canonical pieces include:

- bounded take-set submission;
- deterministic take-group/take IDs;
- preserved alternates;
- Watch/VLM QC evidence;
- multimodal ranking;
- durable take-selection receipts;
- Workstation take-set inspection.

Long-form generation is intentionally **bounded**. Do not submit an entire feature film to GPU in one pass.

Default behavior is one small board/take batch at a time, then:

```
submit candidate takes
 → provider reconciliation
 → generated assets
 → Watch QC
 → multimodal ranking
 → selected take + preserved backups
 → next board
```

Reference-aware shots must fail closed if they require an I2V/reference binding that is not ready.

Important files:

- `side-hustle-director-take-runtime.ts`
- `side-hustle-director-take-reconciler.ts`
- `multimodal-take-selection.ts`
- `director_take_qc_evidence`
- `director_take_selections`

A bug was fixed so generic rights-confidence evidence cannot masquerade as actual Watch visual QC.

Watch take-QC was also improved to use temporal multi-frame evidence for continuity/motion instead of pretending a single frame can prove temporal continuity.

---

## 7. Rough cut and Workstation assembly

Current branch includes:

- `side-hustle-director-edit-assembler.ts`
- durable edit assembly proposals;
- selected-take insertion;
- preservation of alternate takes;
- Workstation rough-cut controls;
- durable timeline materialization.

Important contract:

`stage:business:<projectId>:<planId>:<kind>`  
`gate:business:<projectId>:<planId>:<kind>`

A cross-file ID mismatch was repaired so commissioning, storyboard, generation, selection, and edit assembly now address the same production graph.

---

## 8. Audio / Foley / captions / stems / lip sync

Current branch includes:

- `side-hustle-director-audio-post.ts`
- durable `director_audio_post_plans`
- Workstation Audio Post panel;
- voice/dialogue/voiceover segment planning;
- soundtrack brief;
- Foley plan;
- captions;
- separate stem roles;
- lip-sync requirement tracking;
- canonical compute-worker blockers.

Important distinction:

**Planning is real; execution must still come from commissioned compute workers and durable receipts.**

Never mark audio post complete because a plan exists.

Required worker profiles can include:

- `creative.voice`
- `creative.audio`
- `creative.foley`
- lip-sync runtime
- mix/render/final-watch tasks

The newer branch also contains:

- `side-hustle-director-post-work-session.ts`
- `side-hustle-director-post-executor.ts`
- `side-hustle-director-post-result.ts`
- durable post-task receipts;
- canonical compute submission authority;
- result reconciliation.

These are the correct place to continue execution rather than inventing one-off Foley/music/voice routes.

---

## 9. Normal-project final QC

Do **not** confuse normal project QC with the old four-fixture Director production certification harness.

Normal project final QC is now implemented separately.

Relevant code:

- `packages/director-core/src/project-final-qc.ts`
- `apps/jhadina-web/src/lib/opportunities/side-hustle-director-final-qc.ts`
- `WorkstationFinalQc`
- `director_project_final_qc_evidence`

Readiness explicitly blocks on missing:

- final master asset;
- final-watch inspection;
- hierarchical coherence evidence;
- selected takes;
- selected-take evidence;
- rights evidence;
- rehearsal graduation;
- required executed audio stems;
- audio evidence;
- narration evidence where required;
- lip-sync evidence where required;
- editable NLE export where required;
- current timeline version.

Final-QC readiness has:

- no publication authority;
- no paid-media authority.

Never use provider “quality” metadata alone as final QC.

---

## 10. Auto-final and business canary

The branch has advanced beyond the original `DIRECTOR-AUTO.1-.5` midpoint.

Current branch includes:

- `side-hustle-director-canary.ts`
- `side-hustle-director-auto-final.ts`
- `WorkstationBusinessCanary`
- `WorkstationAutoFinal`
- `director_business_canary_receipts`
- `director_auto_final_receipts`

Auto-final checks include:

- durable timeline;
- autopilot receipts;
- live Watch runtime;
- Watch commissioning receipts by purpose;
- final-QC admission when required;
- persisted final-QC receipt;
- Business Factory canary;
- Social handoff verification.

Authority remains certification/readiness only:

- canPublish = false;
- canSpend = false;
- canWager = false.

This is the correct shape. Do not turn auto-final into silent publication or paid-media execution.

---

## 11. Social scheduling

The Workstation has a governed Director → Social path.

Flow:

```
approved Director asset
 → Workstation Social Scheduler
 → Social proposal
 → immutable Social publication approval receipt
 → scheduled/provider dispatch
```

Two approvals remain deliberately separate:

1. Director asset approved for use/edit.
2. Social publication approved for exact caption/media/accounts/time.

Director approval is never publication approval.

Relevant code:

- `apps/jhadina-web/src/app/api/workstation/social-proposal/route.ts`
- `WorkstationSocialScheduler.tsx`
- existing Social governed-publication/outbox system

No automatic paid-media spend is authorized here.

---

## 12. Autonomous Jhadina Watch — TV, movies, and games

### User requirement

The owner explicitly asked whether Jhadina can watch TV and games **without manually uploading media**, including in her spare time.

Answer: yes, and the current branch implements the architecture.

### Current model

Register an authorized source once:

```
Watch Source Registry
 → recurring due time
 → Director background supervisor
 → idle-capacity check
 → Watch worker
 → observations/notes/QC
 → durable callback receipts
```

Relevant persistence:

`director_watch_sources`

Supported source concepts include:

- authorized HTTPS stream/file;
- HLS;
- DASH;
- Homebase capture;
- local file;
- RTSP/capture paths for Homebase/local use.

Cloud execution remains restricted to cloud-safe authorized source types.

### Spare-time behavior

`director-idle-watch-worker.ts` checks for active:

- Director render/video work;
- Watch jobs;
- recent pending compute work.

Background study does not start if real production work is active.

This turns “spare time” into actual low-priority scheduling rather than merely an hourly cron.

### Director-scoped scheduler

Background Director work was removed from reliance on the unrelated global scheduler health path.

Canonical workflow:

`.github/workflows/director-background-supervisor.yml`

It uses:

- GitHub OIDC;
- exact workflow identity;
- Director-scoped audience;
- exact production deployment SHA containment check;
- production autopilot first;
- idle Watch second.

Watch still performs its own capacity check so it does not steal capacity from a render started by the autopilot pass.

### Homebase

The branch now contains explicit Homebase Watch support:

- `services/director-watch-worker/Dockerfile.homebase`
- `docker-compose.homebase.yml`
- `homebase_handler.py`
- `homebase_server.py`
- `local_qwen.py`
- `homebase-capture` source type
- edge-prefilter support

This is the future path for truly unattended TV/tuner/capture viewing without shipping everything to cloud.

### Legal/technical boundary

Do not implement DRM/paywall bypass.

Jhadina may consume:

- owner-authorized feeds;
- owner media library/DVR;
- tuner/capture sources the owner controls;
- permitted HLS/DASH/HTTPS sources;
- other explicitly authorized media.

She should not defeat streaming protections.

---

## 13. Entertainment taste learning

Durable media/taste persistence now exists:

- `jhadina_entertainment_media`
- `jhadina_entertainment_observations`
- `jhadina_entertainment_feedback`
- `jhadina_entertainment_preferences`
- `director_cinematic_notes`

Watch observations do **not** automatically become “taste.”

Canonical flow:

```
observe
 → note/evidence
 → owner feedback
 → taste hypothesis
 → explicit approval
 → approved creative preference
 → Director planning context
```

Only approved preferences are injected into Business Factory → Director plans.

External media is inspiration/reference evidence, not permission to reproduce protected expression or clone a living creator’s style.

---

## 14. Sports Watch

Sports Watch is deliberately separate from the creative editor even though it uses the same perception spine.

Current branch includes:

- `apps/jhadina-web/src/app/api/sports/director-watch/route.ts`
- sports source resolution;
- recurring Watch sources;
- `sports_director_perception_observations`;
- Director → Sports observation adapter;
- existing Sports parlay intelligence.

Critical safety/accuracy boundary:

Director video inference cannot establish official:

- score;
- game clock;
- possession;
- substitution state

without official reconciliation where required.

Outputs remain:

- canonicalRealityEligible = false;
- bettingAuthority = NONE;
- financialAuthority = NONE;
- canExecute = false.

Do not auto-bet.

---

## 15. Watch commissioning

A real commissioning layer now exists:

- `WorkstationWatchCommissioning`
- `/api/director/watch-jobs/commissioning`
- `director_watch_commissioning_receipts`
- real authenticated callback requirement

Commissioning covers purposes such as:

- creative;
- sports;
- take-QC.

Take-QC commissioning must use a real generated take rather than a fake fixture.

Auto-final correctly treats Watch as live only when runtime readiness **and** commissioning evidence exist.

---

## 16. Visual annotation / CVAT / edge perception

The branch also now includes visual annotation infrastructure that should be preserved:

- CVAT annotation provider/service;
- visual annotation provider contracts;
- Ultralytics/object-detection observation support;
- edge Watch prefilter;
- edge vision worker;
- annotation review UI.

Do not collapse detector output into final semantic truth. Detector/annotation evidence should stay provenance-scoped and confidence-bearing.

---

## 17. Director autonomous production supervisor

Current branch includes:

`side-hustle-director-autopilot-worker.ts`

Protected endpoint:

`/api/internal/director/production-autopilot`

The supervisor is deliberately fail-closed.

It can machine-advance safe stages but cannot approve creative gates.

Expected behavior:

- propose storyboard/shot list;
- stop for storyboard/shot-list approval;
- stop for real previs/rehearsal evidence;
- stop for generation approval;
- submit one bounded take batch;
- reconcile provider jobs;
- dispatch Watch take-QC;
- select a winner only from real QC evidence;
- preserve alternates;
- propose/materialize rough cut after required asset approval;
- compile audio/post plan;
- coordinate post tasks through canonical compute;
- wait for final QC;
- hand off to governed Social.

It does **not**:

- approve itself;
- fabricate rehearsal;
- fabricate final-watch evidence;
- publish;
- buy media;
- authorize wagers.

---

## 18. RunPod one-shot commissioning

PR #1096 originally began as Director RunPod convergence with the SHADOW one-shot/watchdog pattern.

Preserve these rules:

- reusable replacement workflow;
- explicit trusted workflow-call path;
- unsupported `--stop-after` removed;
- newly created replacement stopped on failed commissioning;
- explicit SSH readiness probe;
- bounded AUTO GPU selection;
- cap approximately **$0.60/hour** in the current one-shot workflow;
- do not duplicate a healthy runtime;
- scheduled retries should no-op when healthy;
- runtime health is not the same thing as artifact/provenance admission.

### REF-PROV

Do not fabricate Hunyuan model-bundle admission/attestation.

If runtime is healthy but governed artifact deployment proof is absent, keep the system in a waiting/admission state rather than spawning duplicate GPU capacity.

---

## 19. Current CI snapshot

At the pre-handoff implementation head `5d0d52e501560f7fe72a02f7077dcb213d700ff8`, the latest exact-head CI snapshot showed:

### Completed success

- Growth Vercel Prebuilt Preview
- Spatial Conformance
- Jhadina Evolution Core CI
- Media Production Certification
- Social Core Certification
- SPORT-AUTO.1-.7 Certification
- SPORT-BET.FINAL Certification
- Staffing Postgres Integration
- Jhadina Compute Core CI
- UX Final Certification
- Growth Production Certification

### Still running at snapshot time

- SPORT-SIM.2F Certification
- Jhadina Launch Gate
- Jhadina Web Deploy Conformance
- Jhadina Personality Core CI
- JLLM Runtime Final Certification
- Opportunity Core CI
- SHARK Intelligence Core CI
- Money R13B Certification
- SPORT-PRED.FINAL Certification
- Director Targeted Tests
- Jhadina Interactive Final Certification
- SH Dropshipping Certification
- Jhadina Live Context Final Certification

Do not call the branch fully green until the exact current head’s complete matrix finishes successfully.

Earlier compile failures involving Watch sports value narrowing, audio speech role typing, an unused autopilot variable, and Workstation timeline type imports were repaired before this later snapshot.

---

## 20. Current DIRECTOR-AUTO sequence status

Use this as the continuation map:

### DIRECTOR-AUTO.1 — generation-gate continuation
**Built.**

- storyboard/shot-list gates;
- correct board readiness;
- real previs/rehearsal evidence required;
- separate generation gate;
- no fabricated approvals.

### DIRECTOR-AUTO.2 — bounded shot/take-set submission
**Built.**

- one small board batch at a time;
- deterministic idempotency;
- 2–4 candidates;
- Hunyuan provider path;
- reference-aware shots block if I2V binding is not ready.

### DIRECTOR-AUTO.3 — take QC + winner + backups
**Built.**

- Watch/VLM take-QC;
- temporal continuity/motion evidence;
- durable QC evidence;
- multimodal ranking;
- durable selection receipts;
- backups preserved.

### DIRECTOR-AUTO.4 — auto assembly / rough cut / B-roll
**Built to rough-cut proposal/materialization layer.**

- selected assets;
- durable edit assembly proposal;
- Workstation rough cut;
- timeline materialization.

Continue validating real B-roll population on actual canary productions rather than claiming every B-roll worker is commissioned.

### DIRECTOR-AUTO.5 — narration / music / Foley / captions / lip-sync
**Planning and post-work orchestration built. Execution is receipt-dependent.**

- audio post plan;
- stems;
- captions;
- Foley;
- voice/dialogue;
- lip-sync requirements;
- post work session;
- canonical compute dispatch;
- post-task result reconciliation.

Continue by commissioning/proving actual workers and receipts, not by weakening blockers.

### DIRECTOR-AUTO.6 — normal-project final QC
**Built.**

- final master;
- final watch;
- coherence;
- rehearsal lineage;
- take evidence;
- audio/stem evidence;
- lip-sync/narration checks;
- editable NLE checks;
- stale timeline rejection.

Continue live proving against a real business canary.

### DIRECTOR-AUTO.7 — Workstation final hydration
**Largely built.**

The Workstation now exposes production gates, take sets, rough cut, audio post, final QC, annotations, canary, auto-final, Watch commissioning, media study, Social scheduling and the canonical timeline.

Continue UI polish only after functional canary proof; do not rebuild the workstation.

### DIRECTOR-AUTO.8 — governed Social handoff
**Built.**

- approved asset → Social proposal;
- exact media/caption/account/time receipt;
- separate publication approval;
- no paid-media authority.

Continue end-to-end verification with a canary.

### DIRECTOR-AUTO.9 — Watch commissioning receipts
**Built.**

- creative;
- sports;
- take-QC;
- authenticated callback receipts;
- cloud and Homebase readiness;
- Workstation commissioning panel.

Continue actual runtime commissioning.

### DIRECTOR-AUTO.10 — end-to-end Business Factory canary
**Canary and Auto-Final framework built. Live completion still evidence-dependent.**

- canary inspection/certification;
- Social-ready boundary;
- final-QC dependency;
- Watch commissioning dependency;
- auto-final receipt.

The true finish line is a real opportunity/media job going through the whole chain with durable receipts.

### DIRECTOR-AUTO.FINAL
**Do not declare yet unless exact-head CI is green and the live canary proves the complete path.**

---

## 21. Immediate continuation order

Resume in this order:

1. **Fetch current PR #1096 head and exact-head workflow matrix.**
   - Do not rely on the SHA in this report after the docs commit.
   - Repair any exact-head CI failures first.

2. **Audit the newest post-execution/final-QC code before adding anything.**
   - Current branch already contains substantial `.6-.10` work.
   - Do not duplicate final QC, canary, Watch commissioning, or auto-final.

3. **Commission/prove post workers.**
   - `creative.voice`
   - `creative.audio`
   - `creative.foley`
   - lip sync
   - mix/render
   - final-watch

4. **Run Watch commissioning.**
   - creative fixture;
   - sports fixture;
   - real generated take-QC;
   - require authenticated callback receipts.

5. **Run/verify a real Business Factory canary.**
   Prefer a bounded low-cost production first:
   - UGC ad / TikTok for whole-video provider path, and/or
   - short faceless production for multi-shot path.

6. **Verify Workstation.**
   - source/script ingest;
   - screenplay acceptance;
   - gates;
   - takes + backups;
   - rough cut;
   - audio plan/results;
   - final QC;
   - FCPXML/OTIO;
   - Social proposal.

7. **Verify autonomous background Watch.**
   - recurring source;
   - idle-capacity behavior;
   - no dispatch during active production;
   - durable source completion/failure receipts.

8. **Verify Homebase Watch separately when local capture runtime is available.**
   - tuner/capture/RTSP/local sources;
   - local Qwen/edge prefilter;
   - no cloud assumption for local-only sources.

9. **Only after live proof: certify auto-final / DIRECTOR-AUTO.FINAL.**

10. **Merge #1096 only after exact-head checks and live-risk review.**
    Remember merge/push can arm automatic Director RunPod recovery behavior under the bounded workflow.

---

## 22. Important migrations added in this convergence branch

Key migrations include:

- `20261003221000_director_durable_workstation_timeline.sql`
- `20261004193000_director_workstation_project_inputs.sql`
- `20261004194500_director_business_context.sql`
- `20261004200000_entertainment_media_study.sql`
- `20261004203000_sports_director_perception.sql`
- `20261004210000_director_screenplay_ingest_proposals.sql`
- `20261004214500_director_business_production_runtime.sql`
- `20261004221000_director_screenplay_blueprints.sql`
- `20261004224500_director_watch_jobs.sql`
- `20261004231500_director_watch_sources_idle_scheduler.sql`
- `20261004234500_director_take_selection_runtime.sql`
- `20261005000500_director_take_qc_watch_jobs.sql`
- `20261005003000_director_edit_assembly_proposals.sql`
- `20261005010000_director_audio_post_plans.sql`
- `20261005013000_director_business_autopilot_receipts.sql`
- `20261005020000_director_project_final_qc_evidence.sql`
- `20261005023000_director_post_task_receipts.sql`
- `20261005023000_director_watch_commissioning_receipts.sql`
- `20261005024500_director_business_canary_receipts.sql`
- `20261005024500_director_visual_annotation_provider.sql`
- `20261005030000_director_watch_homebase_source_kind.sql`
- `20261005031500_director_auto_final_receipts.sql`

Do not blind-push these migrations into an unhealthy SWLC environment. Preserve the repo’s migration/recovery guardrails.

---

## 23. Key workflows

- `.github/workflows/director-runpod-one-shot.yml`
- `.github/workflows/director-runpod-replacement.yml`
- `.github/workflows/director-runpod-live-commission.yml`
- `.github/workflows/director-background-supervisor.yml`
- `.github/workflows/director-targeted-tests.yml`

Background supervisor is now Director-scoped and should not be re-coupled to unrelated global Memory health.

---

## 24. Non-negotiable guardrails

Do not:

- auto-bet;
- let Director sports inference become official score/clock truth without reconciliation;
- publish because a Director asset is merely edit-approved;
- spend paid-media budget from Director;
- fabricate screenplay parsing certainty;
- fabricate rehearsal/previs evidence;
- fabricate Watch commissioning;
- fabricate take-QC;
- fabricate final-watch/coherence evidence;
- call provider quality metadata final QC;
- bypass DRM/paywalls;
- duplicate the Workstation;
- duplicate Entertainment taste;
- duplicate Sports perception;
- duplicate the Business Factory creative renderer;
- create a second autonomous media supervisor;
- treat a healthy GPU as admitted governed generation;
- spawn duplicate GPU while waiting for REF-PROV/admission;
- call `DIRECTOR-AUTO.FINAL` until live canary receipts and exact-head checks support it.

---

## 25. Resume prompt

A new chat can resume with:

> Continue the Director handoff from `docs/director/DIRECTOR-AUTO-HANDOFF-2026-10-04.md`. Fetch the current #1096 exact head and CI first. Do not rebuild the Workstation or duplicate existing `DIRECTOR-AUTO.6-.10` systems. Repair exact-head CI, then commission/prove post workers, Watch commissioning, and the real Business Factory end-to-end canary until `DIRECTOR-AUTO.FINAL` is evidence-backed.

---

## 26. Bottom line

The architecture has converged substantially.

The remaining work is increasingly **commissioning and live proof**, not invention:

- get exact-head CI fully green;
- prove canonical post workers;
- prove Watch cloud/Homebase runtime;
- prove authenticated Watch commissioning;
- prove final QC on real media;
- prove the Business Factory canary;
- prove governed Social handoff;
- then certify auto-final.

The owner should not need to manually upload every TV/game clip going forward. The current branch supports a recurring authorized Watch source registry plus a low-priority idle dispatcher, and Homebase support provides the eventual always-on local capture path.


---

## 27. 2026-10-05 live continuation evidence

This section supersedes the older PR/head snapshot above for operational resume purposes.

### Merged repair chain

- PR #1096 merged after **24/24 exact-head checks** passed on `29553ac8ecdce89bf6abbdfa882d2ba4da12e51f`.
  - Added the canonical Director post-compute dispatcher binding into production autopilot without rebuilding the Workstation or `DIRECTOR-AUTO.6-.10`.
- PR #1102 merged as `6e4fdd4880d816c86593d19438e770679f48fda9`.
  - Scoped Vercel request-context OIDC to live Director runtime routes.
  - Kept Memory's synchronous storage-selection semantics unchanged.
  - Hardened RunPod plan/waiting states and one-shot OIDC.
- PR #1103 merged as `03372fcb00fe474f1818c91f71c8e3289f2df003`.
  - Treats the missing canonical RunPod pod as `replacement-required`, not a workflow crash.
  - Preserves no-delete/no-duplicate behavior.
  - Admits scheduled one-shot OIDC status checks and exact reusable replacement identity.
  - Supabase Edge Function `jhadina-director-bonez-gateway` was deployed as **version 17** from the merged source.
- PR #1104 merged as current production main `813e74b2b156a329f99f433df3d8957a28343802`.
  - Bounds the two read-only production health probes in Director RunPod Live Commission to 30 seconds each.

### Mainline live proof

Current production Vercel deployment for `crispy-waddle-jhadina-web` is **READY** on
`813e74b2b156a329f99f433df3d8957a28343802`.

The old canonical RunPod pod `xn73vwwekavcc6` now returns **404 / pod not found**.
It is not a zero-GPU pod anymore.

Post-merge proof:

- **Director RunPod Guarded Replacement: success**
  - old pod classified `DIRECTOR_OLD_POD_MISSING_REPLACEMENT_REQUIRED`;
  - viable Secure US `NVIDIA RTX A6000` discovered at **$0.53/hour**, 48 GB VRAM;
  - SWLC provisioning authority unavailable;
  - create step skipped;
  - no billable replacement created;
  - no delete requested.
- **Director RunPod One Shot: success**
  - state = `waiting-director-authority`;
  - commission job = skipped;
  - no billable compute created.
- **Director RunPod Live Commission: success**
  - canonical pod classified missing/replacement-required;
  - GPU/runtime mutation steps skipped;
  - diagnostic production health probes bounded to 30 seconds;
  - readiness receipt records `podPresent:false`, `replacementRequired:true`.

These are the intended fail-closed outcomes while durable authority is unavailable.

### SWLC production blocker

The SWLC Supabase project control plane may report `ACTIVE_HEALTHY`, but the actual
Postgres SQL path is **not usable**.

Observed production SQL failure:

`FATAL 57P03: the database system is not accepting connections; Hot standby mode is disabled.`

Postgres logs repeatedly show crash recovery plus:

`could not extend file "base/5/29792": No space left on device`

This failure has recurred across many recovery attempts and causes the startup process
to exit, shut the database down, and restart WAL replay.

A safe Free-tier pause/restore attempt was made through the Supabase control surface.
Supabase rejected the pause **before mutation** with:

`Failed to verify backup status before pausing`

Therefore:

- no destructive restore was forced;
- no data/migrations were deleted to manufacture disk space;
- no migration push should be attempted;
- Watch commissioning and Business Factory canary receipts remain blocked because the
  durable database cannot accept reads/writes;
- RunPod replacement creation remains blocked because SWLC cannot provide durable
  provisioning/registration authority.

This is now a **Supabase platform/storage recovery blocker**, not a Director code blocker.

### Post-worker commissioning blocker

The Director post orchestration code is wired to the canonical compute contract, but
production Vercel currently has **no**
`JHADINA_DIRECTOR_POST_COMPUTE_*` environment bindings.

The repository already contains the provider-neutral canonical compute implementation:

- `@jhadina/compute-core`;
- `KubernetesComputeSubmitter`;
- `KubernetesApiJobTransport`;
- durable compute execution receipt contracts;
- Homebase runtime/router/storage/fleet contracts.

The Homebase source architecture is marked source-complete, but live Homebase hardware
certification remains evidence-gated. There is not yet a live Homebase HTTP compute
gateway/Kubernetes endpoint that can truthfully satisfy:

- `GET /health` with `authority=CANONICAL_COMPUTE_SUBMISSION`;
- `trustDomain=homebase|remote-homebase`;
- `POST /v1/director/post-submissions`.

Do **not** bind Director post execution to a public RunPod proxy merely to clear this
gate. Current post bindings deliberately require sensitive/local-first compute and
forbid public-cloud burst.

### DIRECTOR-AUTO current verdict

- Exact-head/source CI: **repaired and green on the merged repair heads**.
- Production Vercel deployment: **READY**.
- RunPod failure/replacement state handling: **LIVE-PROVEN / FAIL-CLOSED**.
- One-shot OIDC status path: **LIVE-PROVEN**.
- Post workers: **NOT LIVE-COMMISSIONED — Homebase gateway/hardware binding required**.
- Watch commissioning: **BLOCKED by unavailable SWLC durable store and absent compute runtime**.
- Business Factory end-to-end canary: **BLOCKED by the same durable/runtime dependencies**.
- `DIRECTOR-AUTO.FINAL`: **NOT DECLARED**.

### Exact next continuation sequence

1. Recover SWLC through a platform-safe path that preserves backup integrity.
   - Do not force pause/restore while Supabase reports backup verification failure.
   - Re-test direct SQL before doing any Director migration or commissioning work.
2. Once SQL is healthy, verify Director migrations/tables and background-health.
3. Commission the canonical Homebase compute gateway/hardware.
   - Reuse `@jhadina/compute-core`; do not create a parallel scheduler.
   - Bind production `JHADINA_DIRECTOR_POST_COMPUTE_URL` and
     `JHADINA_DIRECTOR_POST_COMPUTE_TRUST_DOMAIN` only after a real trusted Homebase
     endpoint passes health.
4. Prove post-worker receipts:
   - `creative.voice`;
   - `creative.audio`;
   - `creative.foley`;
   - lip sync;
   - mix/render;
   - final-watch.
5. Run Watch commissioning:
   - creative fixture;
   - sports fixture;
   - real generated take-QC;
   - authenticated callback receipts.
6. Run one bounded real Business Factory media canary through:
   opportunity → Director → takes → Watch QC → rough cut → post → final QC →
   governed Social proposal.
7. Certify `DIRECTOR-AUTO.FINAL` only when those durable live receipts exist.



---

## 28. Supabase audit/repair lane — 2026-10-05

All SWLC/Supabase-specific recovery work is now tracked in:

- `docs/supabase/SUPABASE-AUDIT-REPAIR-2026-10-05.md`

That queue is cross-system and supersedes the older pause wording above where necessary.

Current correction:

- pause requests **were accepted** and SWLC entered `PAUSING`;
- SWLC never reached `PAUSED` because Postgres continued/restarted WAL recovery;
- `restore_project` refused to start while the project remained `PAUSING`;
- the recovery loop again hit `No space left on device`;
- direct SQL remains unavailable with `57P03` / connection timeout;
- no destructive restore, blind migration push, cleanup deletion, or fake commissioning receipt was used.

Treat downstream Memory/Director/SAM/Overage/etc. 5xx responses as shared-SWLC outage
symptoms until `SUPABASE-CROSS-SYSTEM.9` proves otherwise.

Director should resume from the Supabase queue only after direct SQL, migrations, Auth/API,
Edge Function dependencies, runtime config, and Storage integrity have been re-proven.
