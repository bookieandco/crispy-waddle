# Director Creative Factory + One-Shot Audit — 2026-10-04

## Scope

This audit reconciles current `main`, the SHARK SHADOW one-shot/watchdog pattern, Director RunPod commissioning, Director/Workstation certification, Music Juggernaut integration, faceless YouTube/Owned Media, Social/Growth creative production, and the recent handoff state.

The goal is not another Director implementation. The goal is one production runtime and one resumable execution spine that can serve multiple governed media recipes without the owner manually re-running a failed workflow.

## Canonical ownership

- **Director** owns production/generation, continuity, rehearsal, editing, QC, repair, render and final media lineage.
- **Shotlist Core** owns owned-channel/video-plan intelligence, including faceless YouTube recipes.
- **Growth** owns creative experimentation, distribution evidence, performance and attribution.
- **Social** owns governed publication/outbox behavior.
- **Music Juggernaut** can now submit real Director video jobs and reconcile them before Social handoff.
- **Opportunity / Side Hustle** owns the commercial family and realized business evidence.
- **RunPod** is burst/staging compute. It is not durable creative truth.
- **Homebase** remains the intended long-term private compute/storage authority; current production still depends operationally on SWLC for several Director runtime records.

## Production families already represented

### Ads / commercial creative

Existing source includes:

- `ugc_ad`;
- `product_demo`;
- `testimonial`;
- commercial creative lab;
- product identity/reference controls;
- Social/Growth -> Director bridges;
- Growth paid-media measurement boundaries.

### TikTok / Reels / Shorts

Existing source includes:

- Ask-video short detection for short/reel/TikTok/YouTube Short;
- 9:16 defaults;
- UGC platform contracts for TikTok, Instagram Reels, YouTube Shorts and Facebook Reels;
- social-production bridging without publication authority.

### Faceless YouTube / owned media

Existing source includes:

- Ask-video `faceless` mode;
- YouTube channel intelligence;
- storytelling/documentary;
- ranking/product-review;
- screen-recording/tutorial;
- AI-music;
- compilation with explicit reused-content risk;
- owned-media production cycles and monetization evidence.

The remaining owned-media gap is runtime integration and first-party analytics/publishing evidence, not niche theory.

### Music video

Existing source includes:

- Music Juggernaut -> Director submission;
- music beat/section references;
- music-video shot style;
- music lip-sync package;
- voice replacement/edit support;
- stems/audio mix and timeline integration.

### Shorts / films / movies

Existing source includes:

- `short_film`;
- `film`;
- long-form Ask-video detection for movie/film/documentary/feature;
- Cast/Voice/Audio bibles;
- continuity and world state;
- rehearsal/performance masters;
- localized repair;
- long-form production fixtures through ~60 minutes.

## One-shot finding

SHADOW solved the operational problem using four separate ideas:

1. a reusable commissioner;
2. a one-shot launcher;
3. scheduled watchdog/recovery;
4. durable receipts and fail-closed authority.

Director previously had a manual guarded replacement and a manual live commissioner, but no durable armed state. A failed SWLC or capacity attempt therefore pushed retry work back to the owner.

## One-shot repair on this branch

### `.github/workflows/director-runpod-replacement.yml`

The guarded replacement is now reusable with `workflow_call`.

Billable creation remains fail-closed:

- manual replacement still requires exact `CREATE_BILLABLE_DIRECTOR_GPU`;
- automated continuation additionally requires `DIRECTOR_ONE_SHOT_ARMED`;
- push-triggered plan runs cannot create a GPU.

Retry safety is strengthened:

- a previous replacement Pod is resolved/resumed before another Pod can be created;
- newly created replacements are stopped after a failed commission;
- the old canonical Pod is still never deleted;
- the current unsupported RunPod `--stop-after` create flag is removed;
- `--terminate-after 8h` remains the disposable-volume forgotten-idle cap.

### `.github/workflows/director-creative-factory-once.yml`

The one-shot control plane uses issue **#1020** as durable state.

One explicit owner dispatch can:

- `plan`;
- `arm`;
- `disarm`.

Arming requires:

- repository owner actor;
- exact `CREATE_BILLABLE_DIRECTOR_GPU`;
- explicit GPU selector/cost ceiling.

Once armed:

- a scheduled pass runs every 15 minutes;
- it first checks whether Director is already `productionReady`;
- it waits without GPU mutation while SWLC durable health is unavailable;
- when SWLC is ready it invokes the reusable guarded replacement;
- partial replacement work is resumed rather than duplicated;
- failures leave the one-shot armed for the next scheduled pass;
- successful production readiness removes the armed label automatically.

This changes the owner experience from repeated workflow dispatches to one explicit authorization followed by bounded automatic recovery.

## Current hard blockers

### P0 — SWLC

The production database still blocks runtime authority, migrations and admission records. The one-shot deliberately does not create a GPU while the durable production health boundary is unavailable.

### P0 — REF-PROV live evidence

A production-ready Hunyuan worker is not sufficient by itself. Canonical generation still requires a real:

- `ArtifactAdmissionReceipt`;
- `RuntimeArtifactAttestation`;
- `director_generation_artifact_deployment_requirement`.

Those must bind the exact admitted `hunyuan-video-1.5:runtime-model-bundle` and runtime instance.

### P0 — durable Workstation rollout

PR #1043 remains the correct durable timeline forward-port and should stay held until SWLC accepts SQL/migrations again.

## Creative-factory commissioning order

1. **DIRECTOR-ONE-SHOT.1** — merge/source-certify the reusable + durable one-shot.
2. **DIRECTOR-ONE-SHOT.2** — recover SWLC and apply pending Director admission/timeline migrations.
3. **DIRECTOR-ONE-SHOT.3** — land/verify durable Workstation.
4. **DIRECTOR-ONE-SHOT.4** — arm once; let scheduled recovery provision/commission the admitted GPU.
5. **DIRECTOR-ONE-SHOT.5** — persist Hunyuan bundle admission + runtime attestation.
6. **DIRECTOR-ONE-SHOT.6** — run one canonical governed take through `/api/director/generation/takes`.
7. **DIRECTOR-FACTORY.1** — 30-second commercial/ad canary.
8. **DIRECTOR-FACTORY.2** — short vertical/TikTok/Reel/Short canary.
9. **DIRECTOR-FACTORY.3** — faceless YouTube video through Shotlist -> Director -> approval -> owned-media receipt.
10. **DIRECTOR-FACTORY.4** — Music Juggernaut -> Director music-video canary with beat/lip-sync/stem evidence where applicable.
11. **DIRECTOR-FACTORY.5** — 8–13 minute branded/narrative short.
12. **DIRECTOR-FACTORY.6** — episode and feature only after shorter classes survive the complete pipeline.
13. **DIRECTOR-LEARNING.1** — feed first-party channel/ad outcomes back into Growth/Owned Media and complete the planned 10-video evidence cycle before automatic format scaling.

## Guardrails preserved

- No publication authority is granted by Director planning/generation.
- No unarmed scheduled run may create billable GPU compute.
- No second GPU should be created merely because a retry failed after partial provisioning.
- No runtime health check is equivalent to cinematic-quality certification.
- No faceless/compilation workflow may silently treat third-party reused clips as owned production assets.
- No 10/25/60 minute render should be used to prove plumbing that a 30-second canary has not yet proven.
- Source claims/RPM heuristics remain hypotheses until first-party evidence replaces them.

## Audit verdict

The architecture is converging correctly.

The highest-value next step is no longer adding more media concepts. It is making the existing Director production spine self-recovering, commissioning one genuine provider path, and then proving each media family through the same durable receipts.
