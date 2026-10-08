# DIRECTOR-LOCAL-UGC handoff — 2026-10-07

**Repository:** `bookieandco/crispy-waddle`  
**Canonical branch:** `main`  
**Main head at handoff creation:** `4e7811999a7844be93eba3de3fb45d74b54d8454`  
**Primary source detail:** `docs/director/DIRECTOR-LOCAL-UGC-STACK-2026-10-06.md`

## Executive status

The **source architecture is complete through `DIRECTOR-LOCAL-UGC.12`** and now includes the missing runtime, convergence, commissioning, and durable-evidence contracts needed for a real FINAL canary.

Do **not** rebuild the Director Workstation, Director scheduler, Business Factory, Social scheduler, Growth experiment system, Watch/QC, voice authority, or compute router. The work completed here intentionally folds UGC/human-media into those existing systems.

The remaining blocker is **operational commissioning**, not another architecture pass.

### Current truth

- Local-first UGC execution is canonical.
- MuseTalk 1.5 is the primary live lip-sync runtime candidate.
- LivePortrait, SadTalker, and Coqui remain admitted/candidate local human-media capabilities subject to their exact commercial/model gates.
- RunPod is the metered GPU-burst layer.
- Arcads and MuAPI exist only as explicitly admitted premium fallbacks/benchmarks.
- Director remains final quality authority; worker/provider completion never means creative acceptance.
- Growth owns experiment/performance truth.
- Social owns governed scheduling/publication.
- Business Factory supplies opportunity/product/offer/customer context.
- No paid external provider, subscription SaaS, or replacement GPU may be silently activated.

**`DIRECTOR-LOCAL-UGC.FINAL` is not live-certified yet.**

The latest Director One Shot run on current `main` completed safely but reported:

```
DIRECTOR_ONE_SHOT_RUNPOD_RECOVERY_NONE
DIRECTOR_ONE_SHOT_REPLACEMENT_REQUIRED_WAITING_APPROVAL:no-existing-director-pod
```

Its `commission` and `reconcile_existing` jobs were both skipped. That is correct fail-closed behavior: no billable replacement GPU was created without explicit approval.

The same One Shot run also timed out while probing the production SWLC gateway and Vercel Director health route before falling back to read-only RunPod inventory. The current Supabase Production Recovery Certification workflow is green, but that **does not by itself prove the Director control plane or database-backed runtime registry is fully healthy**; the latest Director One Shot still had to use its recovery path and found no existing Director GPU.

## Completed source sequence

### `DIRECTOR-LOCAL-UGC.1 → .8`

Canonical local human-media stack, routing, worker contracts, commercial/license admission, runtime provenance, local-first execution policy, and integration boundaries were built without creating a second Director.

See the detailed canonical source report:

`docs/director/DIRECTOR-LOCAL-UGC-STACK-2026-10-06.md`

### `.9 — human-media QC + reroll decisions`

Merged through PR **#1121**.

Director now owns human-media acceptance for MuseTalk, LivePortrait, SadTalker, and Coqui outputs.

Key behavior:

- `accept`
- `reobserve`
- `localized-repair`
- `reroll-same-engine`
- bounded MuseTalk → SadTalker fallback when explicitly admitted
- `manual-review`

Missing or malformed evidence causes re-observation rather than unnecessary GPU spend. Worker receipts retain `qualityClaim:false`; Director QC remains acceptance authority.

### `.10 — cost per accepted output`

Merged through PR **#1122**.

Director now prices human-media routes by expected/realized **cost per accepted output**, not advertised render price.

Economics include:

- current generation cost;
- retries / failed generations;
- repair cost;
- human-review time;
- posterior acceptance rate;
- realized accepted-output cost.

Sparse history fails closed unless an evidence-backed prior exists. Local/Homebase remains preferred unless explicitly bounded economics make it unviable.

### `.11 — governed UGC batch experiments`

Merged through PR **#1123**.

Director can compile one approved UGC plan into governed treatment variants without creating a second experiment system.

Important rules:

- maximum 20 treatment variants;
- every treatment needs mutation-stage + generation-brief approval;
- canonical UGC readiness is re-run for every treatment;
- Product Truth, claims, rights, disclosure, platform, aspect ratio, and non-mutated dimensions remain fixed/evidenced;
- creator/location variants can map to causal-compatible Growth experiments;
- concept/script variants stay exploratory rather than pretending isolated causality;
- accepted-output cost and artifact lineage flow into the existing Growth experiment contracts.

### `.12 — optional Arcads / MuAPI premium fallbacks`

Merged through PR **#1124**.

Arcads and MuAPI are **not defaults**.

They require all of the following before submission:

- explicit paid-tier admission;
- evidence that local/GPU-burst execution was unavailable, incompatible, or QC-exhausted;
- current service/terms evidence;
- external data-handling evidence;
- pricing evidence;
- canonical UGC/Product Truth readiness;
- exact provider/model cost estimate;
- existing generation spend authorization.

Provider results always return with `qualityClaim:false` and must pass Director QC.

## Real MuseTalk runtime repair

Merged through PR **#1126**, then hardened by later recovery/runtime work.

The earlier source sequence exposed a real gap: Director had the job/runtime/QC/economics contracts but no production MuseTalk worker service.

That gap is now implemented.

### Runtime shape

`services/director-human-media/worker.py`

- accepts canonical `director.human-media-job.v1`;
- supports MuseTalk lip-sync only for this live commissioning slice;
- verifies rights-bearing inputs;
- verifies SHA-256 source bytes;
- rejects disallowed remote/private-network asset targets;
- normalizes audio to mono 16 kHz PCM;
- executes pinned MuseTalk 1.5;
- emits canonical human-media execution receipts;
- never claims Director quality or publication authority.

### Sidecar topology

MuseTalk runs as a localhost sidecar on the **existing Director RunPod**:

`127.0.0.1:8095`

The existing Hunyuan gateway exposes only the allowlisted human-media health/job/artifact routes through the same Vercel-OIDC-authenticated transport.

This avoids:

- a second public RunPod port;
- a second static production token;
- a second GPU solely for MuseTalk.

### Provenance

The runtime records:

- pinned MuseTalk code revision;
- pinned model/dependency snapshots;
- exact downloaded model artifact hashes;
- runtime fingerprint;
- license evidence;
- GPU health;
- source revision;
- worker health receipt.

Unresolved/unknown/pending model-license evidence fails health closed.

## RunPod recovery / no-duplicate-GPU protections

Subsequent runtime-recovery work is now on `main`:

- **#1130** — safely recover exactly one healthy existing Director RunPod during SWLC outages.
- **#1131** — add SWLC-independent non-secret runtime locator fallback to disambiguate multiple healthy existing Director pods.
- **#1133** — fix One Shot reusable-workflow permission inheritance.
- The One Shot has explicit states for existing-runtime recovery, human-media reconcile, and replacement-required waiting approval.

Critical invariant:

> Missing MuseTalk alone must never authorize a replacement GPU.

If a healthy Director pod exists but MuseTalk is missing, the supervisor must reconcile MuseTalk **in place**.

If no healthy Director pod exists, the system may report that a replacement is required, but creation remains blocked until explicit billable-GPU approval.

## FINAL convergence work now merged

### `DIRECTOR-LOCAL-UGC.FINAL` convergence gate

Merged through PR **#1134**.

`packages/director-core/src/local-ugc-final.ts`

FINAL cannot be assembled from unrelated receipts.

One explicit `ugc-canary:<id>` evidence marker must survive the entire chain:

```
runtime health
→ governed MuseTalk job
→ execution receipt
→ Director human-media QC
→ realized economics
→ accepted UGC outcome
→ Business Factory / Social handoff
→ FINAL certification
```

The gate revalidates, rather than trusting stored booleans:

- runtime bundle identity;
- execution/job/runtime parity;
- Director QC result;
- artifact hash;
- accepted-output economics;
- UGC outcome linkage;
- Social handoff linkage.

FINAL remains evidence-only:

- `canApproveCreative:false`
- `canPublish:false`
- `canSpend:false`

### FINAL canary commissioner

Merged through PR **#1137**.

`packages/director-core/src/local-ugc-canary-commissioner.ts`

The deterministic commissioner advances exactly one validated boundary at a time:

```
runtime health
→ governed MuseTalk job
→ ready execution
→ QC acceptance
→ realized accepted-output economics
→ accepted UGC outcome
→ governed Social handoff
→ FINAL
```

A missing next receipt can be `admissibleToAdvance:true`.

A malformed, stale, cross-canary, or contradictory receipt blocks at that exact boundary.

The commissioner cannot:

- create compute;
- authorize spend;
- approve creative;
- publish.

### Durable FINAL canary evidence ledger

Merged through PR **#1138**.

`supabase/migrations/20261007230500_director_local_ugc_canary_receipts.sql`

The ledger is:

- append-only;
- service-role-only;
- SHA-256 bound;
- idempotent for identical checkpoints;
- secret-field rejecting;
- evidence/reconciliation state only.

It does **not** replace the canonical health/execution/QC/economics/outcome systems.

It grants no compute, spend, creative approval, publication, or wagering authority.

## Current repo anchors

At handoff creation, current `main` includes:

- `4e7811999a7844be93eba3de3fb45d74b54d8454` — **#1138** durable local UGC canary commissioning evidence.
- `8c5f498a09a8241ea5557d0137b03924ee4394c6` — **#1137** local UGC FINAL canary commissioner.
- `ce3e3f3025ade13bd0943a28afeaff03eb980114` — **#1134** local UGC FINAL convergence certification.
- `86cb03cc545a84c0808d81724914699a13a47feb` — **#1133** One Shot reusable-workflow permission fix.
- `92d280e083b3d0034d0a742f5570ddd33597abb0` — **#1131** SWLC-independent safe runtime locator fallback.
- `623fe7e348504bd65236e5ba0f6a3e5646a54e1c` — **#1130** safe existing-RunPod recovery during SWLC outage.
- `7639f1c4d95f1b943fb7cb396a0d395155c47686` — **#1129** Supabase PLATFORM.1 recovery certification hardening.

Earlier local-UGC milestones include PRs **#1121, #1122, #1123, #1124, and #1126**.

## Latest live evidence

### Supabase recovery workflow

Latest observed **Supabase Production Recovery Certification** run on current `main` is green.

Interpretation:

- recovery-cert contracts/public durable admission are currently passing;
- this is a positive platform signal;
- it must **not** be interpreted as proof that Director runtime registration, Hunyuan, or MuseTalk is live.

### Director One Shot

Latest observed Director RunPod One Shot:

- workflow conclusion: **success**;
- preflight conclusion: **success**;
- billable `commission`: **skipped**;
- `reconcile_existing`: **skipped**;
- SWLC/Vercel health probes timed out during preflight;
- read-only RunPod recovery found **no existing Director pod**;
- state: **replacement-required-waiting-approval**.

This means the safety supervisor is working correctly, but there is no live Director GPU to reconcile or canary against.

## Do not do next

Do **not**:

- rebuild the Workstation;
- rebuild `DIRECTOR-AUTO.6-.10`;
- create another UGC planner;
- create another Growth experiment engine;
- create another Social scheduler;
- create a new QC selector beside Director/Watch;
- make Arcads the default;
- make MuAPI the default;
- silently enable paid APIs/subscriptions;
- silently create a replacement RunPod;
- mark FINAL green from source-level tests;
- write synthetic commissioning receipts just to satisfy FINAL;
- weaken sensitive-media Homebase policy to make cloud execution easier.

## Immediate continuation sequence

Continue from the **operational commissioning boundary**, not from architecture.

### `DIRECTOR-UGC-LIVE.1 — Control-plane proof`

Prove the live Director control path, not merely its CI contract:

- SWLC provisioning/status request returns without timeout;
- production Director health route returns;
- determine whether runtime registry is usable;
- retain a timestamped receipt.

If SWLC is degraded, use the existing read-only safe recovery path. Do not bypass authority for billable creation.

### `DIRECTOR-UGC-LIVE.2 — Existing GPU or explicit replacement decision`

Current evidence says no existing healthy Director RunPod is present.

Therefore:

- recheck inventory;
- if exactly one healthy existing Director pod appears, reconcile it;
- if zero healthy pods remain, report `replacement-required-waiting-approval`;
- do **not** create the billable replacement without explicit user approval.

### `DIRECTOR-UGC-LIVE.3 — MuseTalk commission`

Once a Director pod exists:

- start/reconcile the MuseTalk sidecar;
- require a real `director.human-media-health.v1` receipt;
- verify productionReady;
- verify runtime/source/model/license provenance;
- persist this checkpoint to the durable canary ledger when the migration/runtime is actually available.

### `DIRECTOR-UGC-LIVE.4 — Governed canary inputs`

Prepare one deliberately simple, rights-clean UGC canary:

- one approved source/synthetic actor video or image;
- one approved canonical audio asset;
- Product Bible / product truth;
- rights evidence;
- claim/disclosure evidence;
- one stable `ugc-canary:<id>` marker.

Do not use a real client/private-sensitive asset for first commissioning.

### `DIRECTOR-UGC-LIVE.5 — Real MuseTalk execution`

Submit the canonical MuseTalk job through the registered human-media runtime.

Require:

- real provider job ID;
- ready execution receipt;
- output artifact;
- output SHA-256;
- runtime parity;
- same canary marker.

### `DIRECTOR-UGC-LIVE.6 — Director QC`

Run Watch/OHBench-style observation plus any required sync/speaker evidence.

The result must be a real Director decision:

- accept; or
- reobserve; or
- localized repair; or
- same-engine reroll; or
- admitted fallback; or
- manual review.

Do not alter QC thresholds solely to pass commissioning.

### `DIRECTOR-UGC-LIVE.7 — Accepted-output economics`

For the accepted attempt, write realized:

- generation cost;
- repair cost;
- review labor/time;
- accepted-output cost;
- evidence IDs.

The cost must reconcile exactly with the accepted artifact/QC attempt.

### `DIRECTOR-UGC-LIVE.8 — Accepted UGC outcome`

Issue the canonical accepted UGC outcome bound to:

- exact project;
- exact experiment/canary;
- exact variant;
- exact artifact hash;
- exact review decision;
- exact accepted-output economics.

### `DIRECTOR-UGC-LIVE.9 — Business Factory / Social handoff`

Prove the accepted QC master reaches the existing governed Social proposal path.

This is a **handoff/proposal** boundary, not automatic publication.

### `DIRECTOR-UGC-LIVE.10 — FINAL + durable evidence`

Run the FINAL commissioner against the complete real receipt chain.

Only when the recomputed commissioner reports COMPLETE:

- issue the FINAL convergence receipt;
- persist the durable canary checkpoint;
- re-read and recompute the ledger row;
- verify hash/idempotency/tamper checks;
- mark `DIRECTOR-LOCAL-UGC.FINAL` evidence-backed.

## Success condition

The build is done only when this exact real chain exists:

```
one governed UGC canary
+ real production-ready MuseTalk runtime
+ real MuseTalk render
+ real Director QC acceptance
+ real cost-per-accepted-output
+ real accepted UGC outcome
+ real governed Social handoff
+ FINAL recomputation
+ durable untampered evidence receipt
= DIRECTOR-LOCAL-UGC.FINAL
```

Anything less is source-ready or partially commissioned, not FINAL.

## Optional work after FINAL

Only after the local path is live and measured:

1. commission LivePortrait where motion/expression transfer materially improves accepted-output economics;
2. commission SadTalker as bounded fallback;
3. admit a commercial local voice model under the Coqui framework where needed;
4. benchmark Arcads/MuAPI against local + RunPod using **cost per accepted output**, not per-render marketing price;
5. feed real UGC variant results into Growth and Product Sniper realized-learning;
6. expand from UGC ads into the broader Director ad/TikTok/YouTube/film production path without forking the system.

## Handoff command

The next session should begin with:

```
Continue from docs/director/DIRECTOR-LOCAL-UGC-HANDOFF-2026-10-07.md.

Fetch current main exact head and the latest:
- Director RunPod One Shot
- Supabase Production Recovery Certification
- Director Background Supervisor

Do not rebuild Director, Workstation, Growth, Social, Watch, Business Factory, or human-media contracts.

Start at DIRECTOR-UGC-LIVE.1. Preserve the no-duplicate-GPU and no-unapproved-spend gates. Do not mark DIRECTOR-LOCAL-UGC.FINAL complete until the real canary receipt chain is evidence-backed end-to-end.
```
