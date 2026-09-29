# DIRECTOR-REPLICATE.FINAL — LIVE CERTIFICATION

**Certification date:** 2026-09-27 UTC  
**Repository:** `bookieandco/crispy-waddle`  
**Production alias:** `https://crispy-waddle-jhadina-web.vercel.app`  
**Certified application commit:** `b5df3b068df22e866140ccfb1f7a3c5e03fa2bee`  
**Certified Vercel deployment:** `dpl_65uKPUe4cCgDYu2Kw4jkus6As87Q`  
**Supabase project:** SWLC (`kqbkaozfjubkjevdfvic`)  
**Director OIDC gateway:** `jhadina-director-live-cert-gateway` version **2**  
**Gateway ID:** `8a98e132-69ac-4497-9724-dea22dfbff9a`  
**Gateway source SHA-256:** `7120e9b7a8e2caf0a0e367ca590a9dfd533a10299486ba6849de28033e7212be`  
**Final live run:** `director-live-cert:e95f6ac8-1e46-4edf-a3e0-1778b1711736`

## Verdict

**DIRECTOR-REPLICATE.FINAL live runtime certification: PASS.**

This PASS certifies the real deployed orchestration path:

```
production Vercel Ask/Director boundary
  -> Vercel workload OIDC
  -> Supabase Director privileged gateway
  -> real public reference Study
  -> durable process observations
  -> reference recipe
  -> explicit improved recipe + improvement receipts
  -> canonical Director video jobs
  -> previs
  -> rehearsal retry + Director note + approved take
  -> certification render
  -> private Supabase Storage
  -> stored-media duration verification
  -> editable baseline timeline
  -> localized edit timeline
  -> final Director production-project receipt
```

The certification deliberately separates **runtime/orchestration PASS** from **cinematic-quality claims**. The smoke renderer does not certify photorealism, acting quality, cinematography, product realism, identity fidelity under a production model, or the user's subjective “no AI slop” bar. Those require an admitted real production model/provider and output-quality review on actual generated scenes.

## Certified source

The final run studied the real public repository:

`https://github.com/replicate/lora-training`

The Study pipeline persisted **16 process-step observations** at confidence **0.84**, then produced:

- **16 reference recipe steps**
- **16 improved recipe steps**
- **16 explicit improvement receipts**
- **9 canonical production stages**

Independent database inspection confirmed the observations were source-related LoRA workflow material, including character/LoRA setup, inference, weight download, DreamBooth/LoRA training, image ZIP input, and LoRA weight use.

This is not a canned synthetic Study receipt.

## Duration matrix

The exact production deployment completed four canonical Director video jobs:

| Target | Stored MP4 measured duration | Job state | Provider |
|---|---:|---|---|
| 30 seconds | **30 s** | `preview_ready` | `director-certification-smoke` |
| 10 minutes | **600 s** | `preview_ready` | `director-certification-smoke` |
| 25 minutes | **1500 s** | `preview_ready` | `director-certification-smoke` |
| 60 minutes | **3600 s** | `preview_ready` | `director-certification-smoke` |

Duration was not accepted from provider metadata. Each MP4 was uploaded into the private `director-media` bucket, downloaded again, and its MP4 timing boxes were parsed from the **stored bytes**.

Persisted receipts independently confirmed:

- video jobs: **4**
- generated editing assets: **4**
- private Storage objects: **4**
- SHA-256 asset receipts: **4**
- completed Director production runs: **4**

## Rehearsal proof

Every duration class persisted a rehearsal receipt.

Independent verification:

- rehearsal receipts: **4**
- first-take disposition = `retry`: **4**
- approved second take present: **4**

The Director note used in the smoke rehearsal was:

> Move the character half a step camera-left before the cross; preserve the eyeline.

The certification therefore proves the runtime can issue a corrective note, retry, graduate an approved take, and persist the receipt **before** finalization.

This is a governed rehearsal simulation, not a claim that synthetic characters are conscious.

## Editable-delivery proof

Each duration created two durable timeline versions:

1. baseline timeline;
2. localized trim edit with the baseline as parent.

Independent verification:

- timeline snapshot rows: **8**
- baseline versions: **4**
- edited child versions: **4**
- affected Director projects: **4**
- final Director production projects: **4**
- final projects marked editable: **4**
- final projects bound to a master asset: **4**
- final projects bound to a timeline version: **4**

This proves a completed generated asset can be reopened as a versioned Director timeline and locally modified without discarding the original version.

## Stage-chain proof

For all four projects, SWLC independently reported **approved** stages for:

- previs — 4
- rehearsal — 4
- generation — 4
- edit — 4
- review — 4
- final — 4

The canonical video-job RPC now creates `previs -> rehearsal -> generation`, removing the earlier ability for the generic video-job path to jump directly from previs into generation.

## Production identity and privileged transport

The first production attempt correctly failed closed because Vercel did not contain `SUPABASE_SERVICE_ROLE_KEY`.

Instead of weakening RLS or copying the admin key into Vercel, DIRECTOR-REPLICATE.FINAL adopted the repo's existing secretless workload-identity architecture:

```
Vercel production workload
  -> Vercel OIDC token
  -> Supabase Edge Function
  -> strict issuer/audience/subject/team/project/environment verification
  -> Supabase internal secret/service-role
```

The gateway accepts only the exact production workload identity for:

- owner/team: `bookieandcos-projects`
- team id: `team_NYQJ3NwijZZ6UJQdOdc5FjmX`
- project: `crispy-waddle-jhadina-web`
- project id: `prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco`
- environment: `production`

The final receipt records `privilegedTransport = vercel-oidc-supabase-edge`.

No Supabase admin secret was placed in browser code, source control, or the Vercel client runtime.

## One-use admission token

The final smoke used a randomly generated certification token whose SHA-256 hash alone was stored in SWLC.

Independent verification confirms:

- token was consumed;
- it was consumed before expiry;
- it cannot be replayed because consumption requires `consumed_at is null`.

The plaintext token is intentionally absent from this report.

## Security checks

New Director certification state remains service-role-only:

- `director_runtime_config`
- `director_live_certification_runs`
- `director_live_certification_tokens`
- `director_editable_timeline_snapshots`

RLS is enabled and restrictive service-role-only policies are present.

`public.create_director_video_job(...)` privilege was independently probed:

- `anon`: **no EXECUTE**
- `authenticated`: **no EXECUTE**
- `service_role`: **EXECUTE**

The final Supabase Security Advisor scan returned **zero findings referencing the new Director live-cert tables or `create_director_video_job`**. Existing unrelated project findings are outside this certification.

## Failures discovered and repaired during live certification

Live certification found two issues that source CI alone did not expose:

1. **Vercel service-role credential absent**
   - observed production result: `DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED`
   - repair: Director-specific Vercel OIDC -> Supabase Edge privileged gateway
   - result: secretless production admin bridge without weakening RLS

2. **Markdown Study segmentation**
   - observed live result: `DIRECTOR_CERT_PROCESS_EVIDENCE_INSUFFICIENT`
   - cause: README line boundaries were collapsed before process segmentation
   - repair: prefer raw GitHub README content and preserve Markdown line boundaries
   - failed run was explicitly closed as failed instead of being left stuck in `studying`
   - final run persisted 16 real process observations

## Implementation lineage

Relevant merged PRs:

- **#723** — process-replication foundation
- **#724** — replication RLS hardening
- **#725** — durable Study/reconciliation + Rehearsal Loop
- **#727** — DIRECTOR-REPLICATE.12 duration/source certification
- **#729** — public Supabase Auth bootstrap
- **#730** — .12 certification receipt
- **#734** — FINAL live Study/rehearsal/render/editable-runtime implementation
- **#737** — Vercel OIDC privileged Director gateway
- **#738** — real GitHub Markdown Study parser repair

PR #738 passed:

- Director Targeted Tests
- Media Production Certification
- Jhadina Web Deploy Conformance

before merge.

## Final classification

```
DIRECTOR-REPLICATE.FINAL

SOURCE / CONTRACT CERTIFICATION          PASS
PRODUCTION DEPLOYMENT                    PASS
REAL-SOURCE STUDY RUNTIME                PASS
DURABLE STUDY OBSERVATIONS               PASS
REFERENCE + IMPROVED RECIPE              PASS
IMPROVEMENT RECEIPTS                     PASS
PREVIS RUNTIME                            PASS
REHEARSAL RETRY / NOTE / APPROVAL        PASS
VIDEO JOB AUTHORITY                      PASS
PRIVATE MEDIA STORAGE                    PASS
STORED MP4 DURATION MATRIX               PASS
30 SECOND RUNTIME                        PASS
10 MINUTE RUNTIME                        PASS
25 MINUTE RUNTIME                        PASS
60 MINUTE RUNTIME                        PASS
EDITABLE TIMELINE VERSIONING             PASS
LOCALIZED EDIT PROOF                     PASS
FINAL PROJECT / MASTER LINEAGE           PASS
VERCEL OIDC PRIVILEGED TRANSPORT         PASS
SINGLE-USE CERT ADMISSION                PASS
NEW DIRECTOR SECURITY-ADVISOR FINDINGS   0

DIRECTOR-REPLICATE.FINAL LIVE RUNTIME:   PASS
```

## Quality boundary

The certification provider intentionally sets `qualityClaim: false`.

Therefore this receipt **does not** claim:

- a 60-minute photorealistic AI feature has been generated;
- character acting has met a cinematic bar;
- clothing, accessories, furniture, products, props, pipes, environments, or physics have passed real-model visual continuity review;
- a production image/video model has met the user's “no AI slop” threshold.

Those are **production-quality admission tests**, not missing replication-runtime wiring.

The important change from DIRECTOR-REPLICATE.12 is now proven: Jhadina can take a real reference through the deployed Study → improve → rehearse → render → store → reopen/edit pipeline with durable receipts, at the full requested duration classes, without source-only or synthetic-database-only certification.


---

## Re-certification — 2026-09-29 UTC

A second production smoke was run after the single-use GET trigger was merged.

**Trigger PR:** #787  
**Trigger merge commit:** `1edb66a9d127fe498754642e83e57f6cb8e31479`  
**Certified Vercel deployment:** `dpl_3X6WBGb3zAwsF5uAvp4NqFiHVkch`  
**Deployment state:** `READY`  
**Re-certification run:** `director-live-cert:098ffafb-a988-45c2-b61a-079eda8e99b2`

The source was again the real public repository:

`https://github.com/replicate/lora-training`

Observed and independently verified receipts:

- live run status: **completed**
- Study observations: **16**
- minimum observation confidence: **0.84**
- explicit improvement receipts: **16**
- video jobs: **4**
- video jobs in `preview_ready`: **4**
- rehearsal receipts: **4**
- first rehearsal take disposition `retry`: **4**
- approved second takes: **4**
- generated editing assets: **4**
- private `director-media` Storage objects: **4**
- stored MP4 durations: **30 / 600 / 1500 / 3600 seconds**
- editable timeline snapshots: **8**
- baseline timelines: **4**
- localized edited child timelines: **4**
- final editable Director projects: **4**
- final stages approved: **4**
- unused one-use certification tokens remaining after cleanup: **0**

The localized edits were directly verified in durable timeline JSON:

| Runtime class | v1 clip duration | v2 clip duration |
|---|---:|---:|
| 30 s | 30.0 s | 29.7 s |
| 600 s | 600.0 s | 599.5 s |
| 1,500 s | 1,500.0 s | 1,499.5 s |
| 3,600 s | 3,600.0 s | 3,599.5 s |

All four projects persisted the approved dependency chain:

`previs -> rehearsal -> generation -> edit -> review -> final`

The runtime response and SWLC both recorded:

`privilegedTransport = vercel-oidc-supabase-edge`

The re-certification therefore confirms the earlier FINAL PASS still holds after subsequent mainline changes.

**DIRECTOR-REPLICATE.FINAL live runtime remains PASS.**
