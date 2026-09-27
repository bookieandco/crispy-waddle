# DIRECTOR-REPLICATE.12 — FINAL CERTIFICATION

**Certification date:** 2026-09-27 UTC  
**Repository:** `bookieandco/crispy-waddle`  
**Canonical production web:** `crispy-waddle-jhadina-web.vercel.app`  
**Canonical Supabase project:** SWLC (`kqbkaozfjubkjevdfvic`)  
**Certification lineage:** PRs #723, #724, #725, #727, #729

## Verdict

**DIRECTOR-REPLICATE.12 certification work is complete. FINAL PASS is intentionally withheld.**

Four claims are tracked independently, matching the repository's existing certification convention:

| Layer | Result | What is actually proven |
|---|---|---|
| **SOURCE PASS** | **PASS** | Process-replication, durable Study evidence, recipe improvement, rehearsal, editable production project, localized repair and the 30s→60m certification matrix compile/type-check/test cleanly. |
| **INFRASTRUCTURE PASS** | **PASS** | Required SWLC tables/RLS/policies and the production Vercel/Auth route are provisioned and live; the four-duration production-stage schema drill passed and rolled back cleanly. |
| **LIVE-RUNTIME PASS** | **PARTIAL** | The exact production deployment was exercised: Director machine reconciliation fails closed at 401 without its secret, and Ask Jhadina reaches the real Supabase sign-in boundary instead of the former middleware/configuration failure. No real Study-worker → recipe → render job has completed. |
| **FINAL PASS** | **WITHHELD** | There is no durable live receipt yet for a real reference being studied, converted into an improved recipe, rehearsed, generated, edited and mastered. No real 30s, 8–13m, 25m or ~60m output was rendered by this certification. |

This distinction is mandatory. Source/infrastructure success must never be rewritten as proof of media that was not actually rendered.

## What DIRECTOR-REPLICATE now does

The governed path is:

```
Ask Jhadina
  -> detect replicate/study-and-apply intent
  -> durable replication job
  -> Director Study jobs
  -> durable evidence observations
  -> immutable reference process recipe
  -> explicit Director-native improvement receipts
  -> CreativeStageGraph
  -> previs
  -> rehearsal loop
  -> generation
  -> edit / review / localized repair
  -> editable Director production project
  -> final master only after the existing Director approval gates
```

The source process remains evidence. Jhadina's substitutions are explicit and receipt-bound instead of silent prompt mutation.

## Source certification

### PR lineage

- **#723 — DIRECTOR-REPLICATE.FINAL**
  - Ask Jhadina process-replication routing
  - provider-neutral `DirectorProcessRecipe`
  - explicit improvement receipts
  - recipe → canonical `CreativeStageGraph`
  - versioned `DirectorProductionProject`
  - long-form dialogue / PerformanceMaster / mocap / Blender-certification forward-port from superseded #693
- **#724 — replication/project RLS follow-up**
  - explicit restrictive service-role-only policies
- **#725 — DIRECTOR-REPLICATE.RUNTIME**
  - durable Study observations
  - authenticated Study callback
  - reconciliation runtime
  - Study-worker fail-closed contract
  - Rehearsal Loop
  - rehearsal creative stage between previs and generation
- **#727 — DIRECTOR-REPLICATE.12 matrix**
  - 30s / 10m / 25m / 60m certification tests
  - production middleware repair discovered by live drill
- **#729 — production Supabase Auth bootstrap**
  - env-first canonical SWLC public configuration
  - browser/server/middleware share one low-privilege publishable configuration
  - service-role credentials are never exposed as public fallback

### Final source CI receipts

On PR #729 head:

- **Director Targeted Tests — run 36298008992: SUCCESS**
  - Director Core authority/lifecycle: success
  - Director Core type-check: success
  - Workstation/Studio/Social bridge + Auth bootstrap tests: success
  - full Jhadina Web type-check: success
- **Jhadina Web Deploy Conformance — run 36298008947: SUCCESS**
  - deployment guard: success
  - frozen install: success
  - filtered production build: success
- **Media Production Certification — run 36298008950: SUCCESS**
  - Music Core type-check/tests
  - TV Core type-check/tests
  - Jhadina Web type-check
  - Director character-training runtime
  - Director replacement runtime

On #727, the Director certification suite reported **88 test files / 404 tests passing**, including `director-replicate-certification.test.ts`.

## Duration matrix — source behavior

`director-replicate-certification.test.ts` exercises these four production classes:

| Class | Duration | Source certification |
|---|---:|---|
| Short ad | 30 seconds | PASS |
| Branded short film | 600 seconds (10 minutes; represents the requested 8–13 minute class) | PASS |
| Episode | 1,500 seconds (25 minutes) | PASS |
| Long movie | 3,600 seconds (60 minutes) | PASS |

For every class, the test proves:

1. Ask detects process-replication intent.
2. Requested duration and editable-delivery intent survive compilation.
3. Evidence becomes a provider-neutral reference recipe.
4. Weak source steps receive explicit Director-native improvement receipts.
5. Stage order contains `previs -> rehearsal -> generation -> edit -> review/final`.
6. A bad rehearsal produces Director notes and a retry.
7. A clean rehearsal can graduate and issue a rehearsal receipt.
8. Localized generation repair does not invalidate approved previs/rehearsal.
9. Final project validation requires story/cast/voice/audio/timeline/master references.
10. An incomplete final project fails closed.

This is **source certification**, not evidence that these four media durations were rendered live.

## Rehearsal certification

Rehearsal is a first-class production stage, not a metaphor hidden in a prompt.

Supported modes:

- table read
- blocking
- performance
- interaction
- camera
- full dress

Rehearsal observations can cover:

- dialogue timing
- performance/gesture
- eyelines
- blocking/crosses
- collisions
- prop/furniture interaction
- garment/product continuity
- character identity
- camera timing
- audio/continuity

A rehearsal decision can:

- approve
- retry with Director notes
- escalate fidelity
- block

An approved rehearsal can preserve a `PerformanceMaster` for downstream final generation.

This does **not** claim that a synthetic character is conscious or literally practicing. It is a governed iterative simulation/performance-control loop.

## Live SWLC infrastructure receipts

Live migrations/probes verified:

- `director_studies`
- `director_study_checkpoints`
- `director_study_observations`
- `director_process_replication_jobs`
- `director_production_projects`
- `director_creative_stages.kind = rehearsal`

Security:

- RLS enabled on Director replication/Study observation/project tables.
- `anon` and `authenticated` have no direct table access to service-role-only runtime state.
- `service_role` has the required CRUD.
- explicit restrictive service-role policies exist.
- Supabase Security Advisor no longer reports the new Director tables for RLS-without-policy.

### Four-duration live database drill

A rollback-safe production transaction created four temporary production projects:

- 30 seconds
- 600 seconds
- 1,500 seconds
- 3,600 seconds

For each project it persisted:

```
previs (approved)
  -> rehearsal (approved)
  -> generation (ready, depends on rehearsal)
```

Observed receipt:

- projects = **4**
- rehearsal stages = **4**
- generation-after-rehearsal = **4**
- durations = **[30, 600, 1500, 3600]**

The transaction was rolled back and verified:

- certification projects remaining = **0**
- certification stages remaining = **0**

## Production Vercel drills

### Failure discovered during certification

Before #727, production deployment `dpl_FEgoG2Pfj3ACMhnytBj8QupPGUHG` on commit `8af394749cb18927d191186d235892e68161e0c7` returned:

```
MIDDLEWARE_INVOCATION_FAILED
Your project's URL and Key are required to create a Supabase client
```

That was treated as a certification failure and repaired rather than ignored.

### Middleware repair

Production deployment for #727:

- deployment: `dpl_5CaYs7mLyLXsgLWFT28HHGFHTsVe`
- commit: `87cc0aeb03e8c67cd7be3f8f83a8a5931830826f`

Live machine-route drill changed from middleware 500 to the intended secret boundary:

```
GET /api/director/process-replication/reconcile
-> 401 {"ok":false}
```

Ask then exposed the second infrastructure problem: Vercel had no public Supabase Auth configuration and returned a deliberate 503 rather than crashing.

### Auth bootstrap repair

PR #729 added an env-first canonical SWLC public configuration using a modern Supabase **publishable** key. It does not expose or use the service-role secret.

Production deployment:

- deployment: `dpl_5DeTJ6soWYyDD2g1HskyaNSgrZL2`
- commit: `3455f7bae32528cf98eddd6a88de0a3acddce796`
- state: **READY**
- target: **production**

Post-repair live drills:

```
GET /api/director/process-replication/reconcile
-> 401 {"ok":false}
```

This is correct without the machine secret.

Unauthenticated production Ask access now reaches the Jhadina Supabase sign-in boundary. The canonical production alias returned the Jhadina login UI with:

```
Sign in to Jhadina
Your Jhadina workspace is protected by Supabase Auth.
```

The prior `Authentication service is not configured` 503 is no longer the production behavior.

## Live-runtime evidence that does NOT exist yet

At final certification query time SWLC contains:

- `director_process_replication_jobs` = **0**
- `director_studies` = **0**
- `director_study_observations` = **0**
- `director_video_jobs` = **0**
- `director_production_projects` = **0**

Therefore DIRECTOR-REPLICATE.12 does **not** have evidence for:

- an authenticated user asking Jhadina to replicate a real reference;
- an external Study worker successfully observing that reference;
- durable process-step observations from a real tutorial/video;
- a live improved recipe generated from those observations;
- an actual character rehearsal clip/take;
- a live video-generation provider producing the final shots;
- a real editable 30-second ad;
- a real editable 8–13 minute branded film;
- a real editable 25-minute episode;
- a real editable ~60-minute movie.

Those claims remain blocked, not assumed.

## Remaining gates for FINAL PASS

FINAL PASS can be granted only after all of these receipts exist:

1. **Study worker admission**
   - configure/deploy `JHADINA_DIRECTOR_STUDY_WORKER_URL`
   - configure `JHADINA_DIRECTOR_STUDY_CALLBACK_URL`
   - configure `JHADINA_DIRECTOR_STUDY_WORKER_TOKEN`
   - prove callback authentication and durable observation write in production

2. **Real reference replication**
   - authenticated Ask Jhadina request using a real reference URL/file
   - non-zero durable replication job + Study + observation receipts
   - reference recipe and improved recipe persisted

3. **Real rehearsal**
   - at least one scene enters the rehearsal stage
   - first take receives evidence-backed notes or passes cleanly
   - approved take/graduation receipt persists
   - PerformanceMaster survives into final generation where applicable

4. **Real provider execution**
   - admitted live image/video/voice/mocap/provider workers
   - provider idempotency/cost/rights receipts
   - Production Coherence Gate on actual output
   - localized repair demonstrated on a real failing segment

5. **Editable delivery**
   - final Director timeline/project opens after generation
   - user can change take/camera/wardrobe/timing without restarting the whole project
   - export/master/stems/project lineage remains intact

6. **Duration live matrix**
   - actual live production receipts for a 30-second ad
   - actual live production receipts for an 8–13 minute branded film
   - actual live production receipts for a ~25-minute episode
   - actual live production receipts for a ~60-minute movie

Real provider spend and long-duration generation must not be silently incurred merely to turn a certification label green.

## Final classification

```
DIRECTOR-REPLICATE.12
SOURCE PASS:          PASS
INFRASTRUCTURE PASS:  PASS
WEB LIVE BOUNDARY:    PASS
STUDY LIVE RUNTIME:   NOT YET PROVEN
MEDIA LIVE RUNTIME:   NOT YET PROVEN
FINAL PASS:           WITHHELD

CERTIFICATION PROCESS: COMPLETE
```

The system is now correctly wired, durable, rehearsal-aware, production-deployed, auth-reachable, and honest about the difference between **being capable of running the workflow** and **having produced the real-world evidence required to certify the finished media pipeline**.
