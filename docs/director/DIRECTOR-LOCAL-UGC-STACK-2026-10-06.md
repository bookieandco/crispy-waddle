# Director local-first UGC / human-media convergence

**Date:** 2026-10-06  
**Repository:** `bookieandco/crispy-waddle`  
**Branch:** `feat/director-local-ugc-stack-20261006`

## Goal

Fold the current Arcads/UGC work and the newly supplied open-source references into the **existing Director** without creating another editor, scheduler, Business Factory renderer, voice authority, or media supervisor.

Canonical execution preference:

```
Homebase / local GPU
        ↓ if unavailable or insufficient
metered GPU burst (RunPod or equivalent)
        ↓ only when explicitly admitted
metered external API
        ↓ last resort / explicit authorization
subscription SaaS (Arcads-class)
```

Paid subscription services are **not** the production default. They remain optional benchmark/fallback providers so Director can compare quality, latency and cost-per-accepted-output without becoming dependent on them.

## Canonical ownership

- Director Workstation remains the editing/co-directing surface.
- `@jhadina/compute-core` remains the compute scheduler/router.
- Director UGC Product Truth, creator rights, claim evidence and disclosure gates remain authoritative.
- Watch / human-media QC remains responsible for take evaluation and accepted-output evidence.
- Growth remains responsible for experiments, attribution and contribution economics.
- Social remains responsible for governed scheduling/publication.
- Business Factory supplies opportunity/product/offer/customer context.
- External/open-source projects are provider or architecture references only.

## Source fold

### Anil-matcha/Open-AI-UGC

**Disposition:** architecture/workflow reference only.

Useful patterns:
- multi-model UGC selector;
- up to seven reference images;
- async generation webhook;
- creation history;
- credits/cost accounting;
- simple model capability metadata.

Do **not** adopt:
- its separate SaaS UI/auth/billing stack;
- its database as Director truth;
- MuAPI as a required runtime.

Reason: the code is open source, but the generation path is MuAPI-backed. It therefore does not satisfy local-first execution by itself.

### PunithVT/ai-avatar-system

**Disposition:** local runtime architecture reference.

Harvest:
- persistent MuseTalk worker instead of loading weights per request;
- sentence/chunk streaming;
- worker health and observability;
- local-first storage;
- GPU/CPU fallback patterns;
- cancellation/barge-in concepts for interactive avatars.

Do **not** duplicate:
- its standalone chat UI;
- auth/database;
- scheduler;
- LLM orchestration.

Director Workstation and Compute Core already own those concerns.

### TMElyralab/MuseTalk

**Disposition:** primary local lip-sync / video-dubbing worker candidate.

Target role:
`canonical voice/audio + source/animated actor video -> MuseTalk -> lip-synced take`

Execution:
- Homebase/local GPU first;
- same container on RunPod/equivalent as burst;
- no subscription required.

Code license observed: MIT.  
Production gate: verify exact model/dependency artifacts before commercial admission.

### KlingAIResearch/LivePortrait

**Disposition:** primary local portrait-motion / expression worker candidate.

Target role:
`approved portrait/reference + motion/expression driver -> LivePortrait -> performance take`

Use for:
- gestures;
- head/body portrait movement;
- expression transfer;
- more natural UGC performance before/after lip sync.

Code license observed: MIT.

**Commercial blocker:** upstream explicitly says bundled InsightFace detection models are non-commercial research models. Commercial admission requires replacing those detection models and recording the replacement + artifact license evidence.

### OpenTalker/SadTalker

**Disposition:** fallback local talking-head worker.

Use when:
- MuseTalk path is unavailable;
- only a single still exists;
- a cheap fallback/prototype is preferable;
- the output passes Watch/QC.

Code license observed: Apache-2.0.  
Production gate: verify all third-party model artifacts/dependencies used in the exact runtime bundle.

### coqui-ai/TTS

**Disposition:** local voice/speech framework candidate.

Target role:
`Director SpeechPerformancePlan -> admitted local voice model -> WAV/stems -> MuseTalk`

Capabilities:
- text-to-speech;
- multilingual speech;
- voice cloning where the admitted model supports it;
- voice conversion;
- streaming.

Framework code license observed: MPL-2.0.

**Important:** model licenses are separate from framework code. Production voice models must be admitted individually with commercial-use and voice-rights evidence. Do not assume every Coqui-distributed model is suitable for commercial client work.

## Arcads position after this fold

Arcads is no longer the default UGC execution path.

It becomes:
1. a quality benchmark;
2. an optional premium whole-video/talking-actor provider;
3. a last-resort provider when local + GPU-burst routes cannot meet the accepted quality/runtime requirement;
4. a source of feature/product ideas such as actor filters, voice controls, gestures, workflows and batch variation.

Its output still returns through Director QC and the Workstation.

## Local UGC production path

```
Business Factory / Growth research
        ↓
Product Truth + audience + offer + evidence-backed angle
        ↓
Director UGC plan / script / creator + rights
        ↓
Director voice performance plan
        ↓
local admitted TTS model (Coqui framework candidate)
        ↓
reference actor / generated actor / approved character
        ↓
LivePortrait when motion/expression transfer is useful
        ↓
MuseTalk 1.5 primary lip sync
        ↓
SadTalker fallback where appropriate
        ↓
OHBench-style + Watch + Product Truth QC
        ↓
Director rough cut / B-roll / captions / Foley / mix
        ↓
final QC
        ↓
Growth experiment / governed Social proposal
        ↓
performance + realized economics
```

## Compute policy

The source contract `local-human-media-stack.ts` makes the default policy:

- prefer local/Homebase;
- allow metered GPU burst;
- disable metered external APIs by default;
- disable subscription SaaS by default.

A paid API or subscription cannot beat a healthy, commercially admitted local worker merely because its quality score is slightly higher. Premium providers must be explicitly admitted by policy.

Provider comparison should optimize **cost per accepted output**, not advertised cost per render:

`compute/API cost + retries + failed generations + post repair + human time -> accepted master`

## Licensing/provenance rules

Code license is not sufficient production evidence.

Each live worker needs:
- exact upstream commit/tag;
- runtime container digest;
- model/checkpoint digest;
- model license basis;
- dependency/model artifact license evidence;
- commercial-use decision;
- worker health receipt;
- benchmark/QC receipt;
- provenance retained on generated outputs.

No reference catalog record becomes a live provider merely because the source is public.

## Current source implementation

This branch adds:

- human-media capabilities to Director's generation capability vocabulary;
- reference-only provider/model catalog records for MuseTalk, LivePortrait, SadTalker and Coqui TTS;
- a local-human-media source fold covering all six supplied repositories;
- commercial license gates;
- local-first execution policy;
- routing tests proving local -> GPU burst -> paid external/subscription order.

It does **not** fabricate live worker admission or claim models are installed.

## Next production sequence

`DIRECTOR-LOCAL-UGC.1 — source + license registry` **built on this branch**  
→ `.2 — container/runtime contracts for MuseTalk, LivePortrait, SadTalker, local TTS` **built: immutable runtime/model/image + health/execution receipt contracts**  
→ `.3 — Homebase worker health + compute profiles` **built: validated health receipts + per-engine GPU resource profiles + local-first selection**  
→ `.4 — RunPod/equivalent GPU-burst deployment for the same images` **built at routing/admission layer: burst is refused unless image digest, source revision and model bundle exactly match Homebase; real endpoint commissioning remains evidence-gated**  
→ `.5 — canonical local voice generation adapter` **built: Director Voice Identity + approved Coqui binding/model-license evidence -> human-media job; cloned/owned voice remains local-only**  
→ `.6 — LivePortrait performance/gesture adapter` **built: existing PerformanceDirectionPlan -> LivePortrait job with mandatory commercially approved detector replacement evidence**  
→ `.7 — MuseTalk lip-sync adapter` **built: existing Studio voice-sync lineage -> MuseTalk job; Watch/QC remains acceptance authority**  
→ `.8 — SadTalker fallback adapter` **built: fallback-only talking-head job requiring primary-attempt evidence and explicit fallback reason**  
→ `.9 — OHBench/Watch human-media QC + reroll reasons` **built: deterministic per-engine QC policies fuse Watch visual/temporal evidence with independent identity/speaker/sync/audio evidence; missing measurement re-observes instead of rerolling; real defects produce bounded repair/reroll/fallback decisions**  
→ `.10 — cost-per-accepted-output router` **built: current generation estimates plus observed retry/repair/human-review economics are converted into expected and realized cost-per-accepted-output; sparse history fails closed unless an evidence-backed acceptance prior exists; local-first remains default with explicit bounded economic escalation**  
→ `.11 — UGC variant/batch experiment integration` **built: governed single-axis UGC batch compiler + accepted-output lineage + Growth experiment bridge**  
→ `.12 — optional Arcads/MuAPI premium fallback adapters` **built: opt-in external-service bindings + spend/local-exhaustion/Product-Truth gates + quality-claim firewall**  
→ `DIRECTOR-LOCAL-UGC.FINAL` **source convergence gate built; live certification still blocked on real runtime/canary evidence**

## Commissioning boundary

Source work through the adapters and tests can proceed while SWLC/Supabase production is unhealthy.

Do not claim `DIRECTOR-LOCAL-UGC.FINAL` until:
- the selected runtime artifacts are commercially admitted;
- Homebase or a metered GPU-burst worker produces real media;
- voice rights/provenance are durable;
- Watch/OHBench-style QC produces real evidence;
- one Business Factory UGC canary reaches final QC and governed Social handoff;
- realized compute/provider cost is measured.

## .2-.4 implementation receipts

- `packages/director-core/src/human-media-worker-contract.ts` defines the canonical job, runtime-bundle, health and execution-receipt contracts.
- `packages/jhadina-compute-core/src/director-human-media-runtime.ts` defines MuseTalk, LivePortrait, SadTalker and Coqui resource profiles plus Homebase-first / RunPod-burst routing.
- `apps/jhadina-web/src/lib/director-human-media-worker.ts` provides the single `/health` + `/v1/jobs` transport/probe used by both Homebase and burst workers; actual observed hashes, not configured expectations, become deployment evidence.
- Public GPU burst is fail-closed for sensitive media and for any runtime whose image digest, source revision or model artifact digests differ from the Homebase bundle.
- RunPod remains execution-only; every route returns `canonicalCommitTarget: HOMEBASE`.
- This is source-complete for `.2-.4`; it does not claim a real Homebase GPU or RunPod endpoint is commissioned. That live evidence belongs to the worker adapters/canary stages.

## .5-.8 adapter receipts

- `packages/director-core/src/human-media-adapters.ts` is the domain-to-worker bridge for Coqui, LivePortrait, MuseTalk and SadTalker.
- Coqui does not create a parallel voice identity system: it consumes the existing `CharacterVoiceIdentity` / `DialogueGenerationRequest`, requires the selected Coqui provider binding, preserves consent/reference rights, and requires exact model-license evidence. Clone/reference audio is marked sensitive and public cloud burst is disabled.
- LivePortrait consumes the existing `PerformanceDirectionPlan`; production preparation fails closed unless the face detector replacement has an immutable digest, license evidence, and an explicit commercial-use approval. The bundled upstream research-only detector is not silently admitted.
- MuseTalk consumes the existing `VoiceSyncInput` and refuses media whose governed asset IDs differ from the Studio request. It prepares a worker candidate only; it does not fabricate a sync confidence or bypass Watch/QC.
- SadTalker is encoded as fallback-only. A job cannot be prepared without evidence of the primary attempt and a bounded fallback reason.
- Asset rights evidence and QC/provenance evidence remain separate fields; all worker-facing media digests are validated before job preparation.
- These adapters complete the source boundary for `.5-.8`; they do not claim the model runtimes/checkpoints have been commercially commissioned or that real outputs have passed Watch/QC.

## .9 human-media QC receipts

- `packages/director-core/src/human-media-qc.ts` adds the Director-owned acceptance layer for MuseTalk, LivePortrait, SadTalker and Coqui outputs. Runtime workers still return `qualityClaim:false`; only Director QC can admit a take.
- The policy is OHBench-style rather than a fabricated upstream OHBench score: it evaluates explicit human-media dimensions such as identity stability, face stability, temporal consistency, motion naturalism, performance match, lip sync, speaker similarity, intelligibility, prosody, pronunciation and source preservation using evidence produced by the appropriate independent observer.
- Existing Watch `take-qc` evidence is reused for what sampled frames can actually support: technical quality, visual readability, performance, source relevance, continuity and motion. Watch still does not infer lip sync/dialogue/rights from still frames.
- Existing `DirectedTakeQcObservation` evidence can be folded into the same human-media QC contract for identity, face, motion, performance, source preservation, dialogue prosody and audio-sync measurements.
- Missing or low-confidence QC evidence yields `reobserve` rather than wasting GPU spend on regeneration. Bounded ranged defects can yield `localized-repair`; otherwise real failures yield same-engine reroll while the attempt budget remains.
- MuseTalk can fall back to SadTalker only after the same-engine attempt budget is exhausted and fallback is explicitly allowed. A failed SadTalker fallback never silently cascades into another provider.
- Coqui clone/conversion paths require independent speaker-similarity evidence; missing speaker QC re-observes, while genuine speaker drift can reroll the same admitted voice runtime and eventually stops at manual review rather than silently switching identity/provider.
- Accepted/rejected human-media evidence can be converted into the existing `MultimodalTakeCandidate` contract so this QC layer feeds Director's existing take-selection authority rather than creating a second selector.
- `.github/workflows/director-targeted-tests.yml` explicitly runs the human-media QC regression suite.
- This completes the source boundary for `.9`. It does not claim real Watch/speaker/sync observations exist for a production UGC canary until the live workers are commissioned and evidence is returned.

## .10 cost-per-accepted-output receipts

- `packages/director-core/src/human-media-economics.ts` adds the Director-owned economics layer. It does not replace `generation-spend-gate.ts`; provider/current pricing still enters through a provenance-bearing `GenerationCostEstimate`, and execution still requires the normal spend/budget authority where applicable.
- Every realized human-media attempt can emit `director.human-media-attempt-economics.v1` with the candidate/runtime identity, .9 QC action, accepted flag, generation cost, repair cost, human review minutes/rate, pricing-source refs and evidence refs.
- Acceptance is bound to QC truth: an attempt marked accepted must have .9 action `accept`; retries/repair/manual-review outcomes cannot be relabeled as accepted for economics.
- Expected cost per accepted output is derived from the **current** generation estimate plus observed average repair/human overhead, divided by an evidence-backed posterior acceptance rate. This prices expected retries and failed generations into the route instead of comparing advertised per-render price.
- Historical generation spend is retained separately as realized total cost and realized cost per accepted output; a later provider price change does not rewrite the old realized ledger.
- Sparse history does not invent an acceptance probability. A candidate needs either enough observed attempts or an explicit provenance-bearing acceptance prior/benchmark before it can be economically ranked.
- The default routing policy remains Homebase-first. A healthy, commercially admitted, economically rankable local candidate stays preferred. GPU burst can take over when local is unrankable or violates an explicit accepted-output cost ceiling; a caller can explicitly choose global economic optimization when appropriate.
- Metered external APIs and subscription SaaS remain inadmissible under the default local-first runtime policy. A cheap advertised price cannot silently open a paid tier.
- The router returns planning/selection evidence only; it does not authorize spend, mutate compute authority, or bypass commercial/license readiness.
- Regression coverage proves retry/repair/human-time accounting, current-vs-realized price handling, sparse-history fail-closed behavior, local-first routing, bounded GPU escalation, explicit global-economic override, paid-tier blocking, QC/economics consistency, duplicate-attempt rejection and pricing provenance.
- This completes the source boundary for `.10`. Live realized cost-per-accepted-output remains unproven until real Homebase/RunPod human-media attempts and QC receipts are commissioned.


## .11 UGC variant/batch experiment receipts

- `packages/director-core/src/ugc-batch-experiment.ts` compiles one already-approved canonical UGC plan into a bounded batch experiment instead of creating a second UGC or experiment system.
- The batch is fail-closed and capped at **20 treatment variants**. Every treatment requires its own mutation-stage approval plus generation-brief approval, and the resulting plan is re-run through canonical `evaluateUgcGenerationReadiness` before generation.
- Supported Director mutation axes are creator, location, concept and script. Product Bible, platform, aspect ratio, runtime, disclosure policy and every non-mutated selected UGC dimension are recorded as fixed experiment dimensions.
- Creator and location batches are marked `causal-compatible` because the bridge can map them to the existing Growth single-axis `character` / `visual_treatment` experiment contract. Concept and script batches remain `exploratory-only`; Director does not pretend a concept/script rewrite is an isolated causal mutation.
- Accepted outputs require an approved Director review, a SHA-256 artifact identity, exact project/experiment/variant metadata lineage, cost evidence and experiment evidence. A control artifact cannot be silently attached to a treatment receipt.
- `applyDirectorUgcVariantOutcome` preserves accepted artifact IDs, generation attempt IDs, review/cost evidence and cost-per-accepted-output inside the existing `CreativeExperiment` evidence ledger.
- Experiment selection remains explicit. A variant cannot be selected until it has an accepted artifact, and selection requires who/when/evidence receipts.
- `apps/jhadina-web/src/lib/growth/ugc-batch-experiment-bridge.ts` converts complete accepted-output receipts into the existing Growth `AdCreativeVariantLineage` contract and, only for causal-compatible batches, the existing isolated Growth experiment plan.
- The Growth bridge refuses incomplete, duplicate, foreign-experiment or unknown-variant outcome lineage. It carries Director artifact hashes, review evidence and accepted-output economics into Growth rather than inventing performance truth.
- Regression coverage proves fixed-dimension preservation, treatment approvals, unknown/duplicate replacement rejection, Product Truth/claim readiness on treatment scripts, the 20-variant cap, exploratory concept/script handling, exact artifact/variant lineage, evidence-backed selection, Growth causal-plan construction and fail-closed incomplete lineage.
- This completes the source boundary for `.11`. It does not claim a winning UGC variant or causal performance lift until real accepted outputs are published through governed channels and Growth receives real exposure/conversion/contribution observations.


## .12 optional premium fallback receipts

- `packages/director-core/src/local-human-media-stack.ts` now registers `muapi-premium` and `arcads-premium` as **worker candidates for whole UGC generation**, but only in paid external tiers. They are exposed in `directorLocalUgcStackPlan().premiumFallbacks`; the default runtime policy still disables both metered external APIs and subscription SaaS.
- External-service commercial readiness is now evidence-backed rather than permanently impossible: a worker-candidate external service requires explicit service/terms evidence. The existing `open-ai-ugc-reference` remains reference-only even if service evidence exists because its integration mode is still `architecture-reference`.
- `packages/director-core/src/premium-ugc-fallback.ts` is the canonical paid-fallback preparation contract for both providers. It does not own credentials, endpoints, Product Truth, UGC selection, budgets or QC.
- Every premium fallback requires: explicit paid-tier policy admission; evidence that local/Homebase or GPU-burst execution was unavailable, incompatible or exhausted by QC; current external-service evidence; data-handling evidence for external media transfer; pricing evidence; canonical `evaluateUgcGenerationReadiness`; and the existing `authorizeGenerationSpend` receipt for the exact project/provider/model estimate.
- The request preserves Product Bible ID, creator/concept/script selection, approved reference asset IDs, idempotency identity and evidence lineage. Credentials remain a server-side `credentialRef`; secrets never enter the domain request.
- MuAPI concrete request/status behavior is supported by the supplied `Anil-matcha/Open-AI-UGC` reference: model-specific submit endpoints accept prompt/reference-image payloads and return an upstream request ID; result polling uses the prediction ID. Director intentionally keeps concrete endpoint URLs in transport configuration instead of hard-coding them as domain truth.
- Arcads is treated the same way: public API availability is sufficient to support an optional transport binding, but endpoint/version details remain configuration so Director does not bind its domain model to a changeable SaaS API.
- Provider completion never implies Director acceptance. `director.premium-ugc-provider-result.v1` forces `qualityClaim:false`; a ready result only proves that the provider returned media. It must still be ingested, provenance-bound and passed through Director Watch/human-media/Product Truth/final QC before any governed Social handoff.
- Result normalization requires provider-job identity, evidence, observation time, an output URI when ready, and an error when failed. Cross-request/provider lineage or any attempt to self-assert quality is rejected.
- Regression coverage proves MuAPI and Arcads opt-in preparation, default paid-tier blocking, local-attempt evidence, Product Truth/readiness preservation, pricing provenance, spend authorization, external result normalization and the quality-claim firewall.
- This completes the **source boundary** for `.12`. It does not claim either paid service is connected, funded or commissioned. Live use still requires server-side credentials, current provider terms/pricing receipts and a real canary that returns through Director QC.


## FINAL commissioning repair — MuseTalk runtime

The `.1 → .12` source sequence exposed a real FINAL blocker: Director had human-media job/runtime/QC/economics contracts but no production MuseTalk worker service. The commissioning repair now adds the missing execution boundary without rebuilding Workstation or creating a second orchestrator.

- `services/director-human-media/worker.py` executes only canonical `director.human-media-job.v1` MuseTalk lip-sync jobs and emits the existing execution receipt with `qualityClaim:false`.
- Inputs are rights-bearing, SHA-256-bound governed assets. Remote media is HTTPS-only, private-network SSRF targets are rejected, source bytes are hash-verified, and audio is normalized to mono 16 kHz PCM before inference.
- `scripts/director-human-media-source-pins.sh` fixes the MuseTalk code revision and dependency/model snapshots. The bootstrap records exact downloaded artifact hashes in `DIRECTOR_RUNTIME_SOURCES.json`.
- The worker is a localhost sidecar on the **existing** Director RunPod at `127.0.0.1:8095`. The authenticated Hunyuan gateway exposes only the allowlisted `/human-media/health`, job status/submit/cancel and artifact endpoints. There is no additional public RunPod port.
- `apps/jhadina-web/src/lib/director-human-media-worker.ts` can resolve that sidecar from the existing SWLC Hunyuan runtime binding and reuses the same short-lived Vercel OIDC bearer instead of introducing a new static production token.
- The hourly one-shot has an explicit `reconcile-human-media` state: a healthy Director Pod with missing MuseTalk is reconciled **in place**. If the live SWLC function has not yet exposed the registered Pod identity, the supervisor waits and does not create a replacement GPU.
- Core Director runtime failure still uses the pre-existing guarded replacement path; missing human-media alone can never authorize a replacement Pod.
- The Hunyuan reconcile process already refreshes the checked-out source and restarts the gateway process, so the new proxy route is loaded without replacing the Pod.
- Static contracts guard immutable pins, the proxy surface, the worker request/receipt contract and the no-duplicate-GPU one-shot behavior.

### Remaining FINAL evidence

This repair is **source-complete, not live-certified**. Do not declare `DIRECTOR-LOCAL-UGC.FINAL` until all of the original commissioning boundary is proven by real receipts:

1. the live SWLC `jhadina-director-bonez-gateway` version containing the registered Pod identity is deployed and verified;
2. the existing Director RunPod reconciles MuseTalk and returns a real production-ready human-media health receipt;
3. exact dependency/model commercial-admission evidence is accepted by Director's existing commercial readiness gate;
4. a real governed MuseTalk job returns a hash-bound execution artifact;
5. Watch/OHBench-style QC accepts or explicitly rerolls/repairs that artifact;
6. realized generation/repair/review cost is written into the accepted-output economics path;
7. one Business Factory UGC canary reaches final Director review/QC and the governed Social handoff.

Provider completion remains evidence, never creative acceptance or publication authority.


## FINAL convergence gate

- `packages/director-core/src/local-ugc-final.ts` is the fail-closed convergence contract for `DIRECTOR-LOCAL-UGC.FINAL`.
- FINAL cannot be assembled from unrelated receipts. One explicit `ugc-canary:<id>` marker must survive the root certification request, MuseTalk job evidence, Director human-media QC input, realized economics receipt, accepted UGC outcome evidence and Business Factory/Social handoff evidence.
- Runtime health is revalidated against the exact runtime bundle; execution is revalidated against the original job and runtime provenance; Director human-media QC is recomputed rather than trusting a stored accepted boolean.
- The accepted UGC artifact hash must agree with the real MuseTalk execution output and QC output. The accepted-output price must agree with the realized generation + repair + human-review cost for the accepted attempt, and the UGC outcome must explicitly link the economics receipt.
- Social convergence requires the existing Business Factory canary to be ready for a Social proposal, the social-handoff phase to be verified, and evidence for the QC-admitted final master.
- The FINAL certification is evidence-only: `canApproveCreative:false`, `canPublish:false`, and `canSpend:false`.
- Regression coverage rejects mixed-canary receipts, runtime drift, failed lip-sync QC, artifact-hash drift, economics/QC contradictions, realized-cost drift and incomplete Social handoff.
- **Do not mark live `DIRECTOR-LOCAL-UGC.FINAL` green yet.** As of 2026-10-07 the source gate is complete, but SWLC Postgres is crash-looping on `53100: No space left on device`, the One Shot safely reports no existing Director GPU, and no real MuseTalk/Watch/Business Factory UGC canary has produced the required live receipt chain.


## FINAL canary commissioner

- `packages/director-core/src/local-ugc-canary-commissioner.ts` now owns the deterministic commissioning state machine for one real `ugc-canary:<id>` evidence chain.
- It does **not** create compute, spend money, approve creative, or publish. All four authorities remain false.
- The commissioner advances only one verified boundary at a time:
  `runtime health → governed MuseTalk job → ready execution receipt → Director QC acceptance → realized accepted-output economics → accepted UGC outcome → governed Social handoff → FINAL certification`.
- Every stage is revalidated with existing Director contracts instead of trusting a stored boolean. Runtime drift, job/project mismatch, execution lineage drift, failed lip-sync QC, missing/mixed-canary evidence, realized-cost disagreement, missing Social QC master linkage, or stale FINAL receipts stop advancement at the exact failed boundary.
- The commissioner requires an already-admitted `DirectorHumanMediaRuntimeBundle`; it does not invent runtime/model artifact identities from health hashes.
- A missing receipt with all previous evidence valid returns the exact next boundary and `admissibleToAdvance:true`. A malformed/conflicting receipt returns the same boundary with blockers and `admissibleToAdvance:false`.
- `COMPLETE` is reported only when the supplied FINAL receipt matches a fresh recomputation from the same runtime/job/QC/economics/outcome/Social chain.
- This closes the source-side orchestration gap for FINAL. Live certification still requires an actual runtime plus real receipts; the current SWLC disk-full outage and absent Director GPU remain operational blockers, not reasons to fabricate evidence or loosen spend controls.


## FINAL durable canary ledger

- `supabase/migrations/20261007230500_director_local_ugc_canary_receipts.sql` adds one append-only, service-role-only ledger for point-in-time `DIRECTOR-LOCAL-UGC.FINAL` commissioning snapshots.
- The ledger intentionally does **not** create separate authoritative health/execution/QC/economics/outcome tables. It stores the accumulated canary state plus the freshly recomputed commissioner decision as evidence/reconciliation state only.
- Each snapshot is SHA-256 bound and unique by project + owner + canary + snapshot hash. Retrying an identical checkpoint returns the existing receipt; a genuinely new evidence checkpoint appends a new immutable row.
- `director-local-ugc-canary-ledger.ts` recomputes the commissioner decision on every read, rechecks row metadata/cost/evidence, verifies the snapshot hash, and rejects stale or tampered completion claims.
- Credential-like fields are refused before persistence, including token/secret/password/API-key/authorization/credential keys. Runtime credentials and provider secrets are not part of canary evidence.
- The table has RLS enabled, revokes public/anon/authenticated access, and grants only SELECT + INSERT to service_role. No UPDATE or DELETE grant exists.
- This migration is **source-ready only while SWLC Postgres is disk-full/unavailable**. Do not force-apply it until `SUPABASE-PLATFORM.1 → SUPABASE-DB.2` is green and migration drift has been inspected.
- The ledger does not grant compute creation, spend, creative approval, publication, or wagering authority. A durable row can still describe a blocked/incomplete canary.
