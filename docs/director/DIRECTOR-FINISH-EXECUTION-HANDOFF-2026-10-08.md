# DIRECTOR-FINISH.01–.14 → FINAL — execution and live-recovery handoff

Date: 2026-10-08 (America/Los_Angeles)
Canonical repo: `bookieandco/crispy-waddle`
Source base: `b8803dad61f22be6d862fa78b722d672f556985a`
Work branch: `fix/director-finish-readiness-20261008`
Authority: **SOURCE REPAIR / READ-ONLY AUDIT ONLY**. No live FINAL certification is asserted.

## Verified P0 status and why workflow green ≠ commissioned

- Vercel production deployment `dpl_HrYpqNjLvUhxQAomxag1iZknM4dk` was READY and tied to exact source base `b8803dad...`. This proves deployment identity, not durable storage or media generation.
- Director Background Supervisor run [37890334435](https://github.com/bookieandco/crispy-waddle/actions/runs/37890334435) ended green, but its protected background-health route responded **HTTP 503**, `storageReady=false`; autopilot and idle Watch both skipped.
- Previous background health returned `hasSupabaseUrl=false`, `hasSupabaseServiceRoleKey=false`, plus missing direct Watch variables. These fields are *not sufficient* for identifying real storage/Watch failures because the canonical code supports GitHub OIDC → service proxy and Watch → Hunyuan sidecar. The current source patch makes transport candidate status explicit and requires live table readback for storage readiness.
- Supabase dashboard API reports SWLC `ACTIVE_HEALTHY`, **but direct read-only SQL timed out** and migration history inspection failed with **57P03** (PostgreSQL not accepting connections). Database readiness is **BLOCKED**, regardless of dashboard status.
- Recovery-cert run [37888785737](https://github.com/bookieandco/crispy-waddle/actions/runs/37888785737) concluded success with `SUPABASE_PLATFORM_STILL_BLOCKED:http=500:durable=unknown`; its privileged certification was skipped.
- Director RunPod One Shot run [37888652734](https://github.com/bookieandco/crispy-waddle/actions/runs/37888652734) found no healthy existing Director Pod. `commission` and `reconcile_existing` skipped; state `replacement-required-waiting-approval`. **Do not create billable compute without fresh explicit owner approval.**
- Google Drive `JHADINA-HOMEBASE/02-DIRECTOR-ASSETS` exists but is empty as inspected; no genuine rendered Director master, backup hash or isolated restore was found there. Google Drive may hold encrypted/offsite assets and reviewable receipts but is not the online transactional database.
- Canonical background-health route and accompanying tests in this branch distinguish **proxy eligible** from **storage proven healthy**. They classify PostgREST/SQL error codes without returning raw provider errors. Watch remains **not probed**, even with configuration candidates.
- Director-targeted CI now triggers on internal Director API routes and runs the new diagnostics regressions. Background Supervisor emits an explicit *blocked* reason and summary when skipping live work.

## Preserve existing architecture — do not rebuild

1. Director Workstation timelines, multi-track NLE, FCPXML/OTIO.
2. Business Factory → Director production context, screenplay ingress, storyboards, hierarchical continuity and rehearsal gates.
3. Hunyuan generator, multi-take batch, Take Selection/QC and artifact provenance.
4. Director Watch, background Watch Source Registry, sports observation and approved entertainment taste.
5. Local UGC human-media stack, MuseTalk sidecar, Watch QC, accepted-output economics, `LOCAL-UGC.FINAL` commissioner, append-only canary ledger.
6. Canonical Compute Core/Homebase post worker, Audio/Foley/Mix, Music Restoration/DAW integration.
7. Social and Growth governed publication/experiment engines.
8. Voice identity approvals, paid-provider commercial admission, no silent publication/spend/betting.

## Ordered execution gates

| Milestone | Current state | Release condition |
| --- | --- | --- |
| FINISH.01 exact-head audit | Source committed | PR exact-head Director tests + changed-file and safety contracts green |
| FINISH.02 Vercel credentials/route | Source repair committed; live needs reprobe | Correct OIDC/direct eligibility and real authenticated Director health response; do not add service role to browser or use dashboard flag as readiness |
| FINISH.03 SWLC durability | BLOCKED | 57P03 cleared; read-only SQL, migration history, approved drift/recovery + restart persistence proven |
| FINISH.04 autonomous supervisor | BLOCKED | HTTP 200 `storageReady=true`; real admitted production and Watch worker passes with receipts |
| FINISH.05 existing GPU/replacement | BLOCKED | Read-only inventory first; exactly one admitted healthy GPU, or explicit new billable approval + guarded create |
| FINISH.06 Hunyuan artifact admission | BLOCKED | Exact deployed model checkpoint/dependency/license fingerprints + actual generation receipt |
| FINISH.07 MuseTalk | BLOCKED | Real sidecar health, rights-clean job, source/output SHA, execution receipt |
| FINISH.08 LOCAL-UGC.FINAL | BLOCKED | Same `ugc-canary:<id>` across health→job→execution→QC→economics→accepted outcome→Social proposal→FINAL + durable readback |
| FINISH.09 audio/post | Source capability present; live unverified | Canonical compute post jobs for voice/music/Foley/lip-sync/mix/render with receipts, hashes, costs |
| FINISH.10 Workstation export | Source capability present; live unverified | Durable timeline roundtrip, FCPXML/OTIO, real final playback/asset hashes |
| FINISH.11 autonomous Watch | BLOCKED | Authenticated callbacks from authorized sources, commission creative/take-QC/sports separately, persisted observations |
| FINISH.12 learning loop | Source capability present; live unverified | Observations→owner feedback→approved preference→subsequent choice; restart isolation, provenance and revocation |
| FINISH.13 format canaries | BLOCKED | Rights-clean UGC, music video, faceless 16:9 YouTube, multi-scene narrative and resumable long-form verified |
| FINISH.14 Social/Business Factory | Source integration present; live unverified | Exact QC-approved master reaches governed Social proposal with business/conversion identity |
| DIRECTOR-AUTO.FINAL | BLOCKED | Real full-production evidence chain with persisted post/Watch/final-QC/business receipts, no synthetic promotion |
| DIRECTOR-LOCAL-UGC.FINAL | BLOCKED | Real UGC canary and independent hash/readback plus recomputed commissioner COMPLETE |

## Recovery-order instructions

1. Inspect and restore SWLC database using the shared `SUPABASE-PLATFORM.1 → DB.2 → MIGRATIONS.3 → ... → CROSS-SYSTEM.9` runbook. Stop if the platform is unable to accept read-only queries; do not blindly push migrations or delete production data.
2. Verify Vercel production env targeting / OIDC service proxy with *non-secret* diagnostics. Direct `SUPABASE_SERVICE_ROLE_KEY` is **not** universally required: the existing Vercel/GitHub OIDC identity bridge intentionally avoids that long-lived secret.
3. Run Director Background Supervisor against the precise deployed commit. A green **safe skip** is a BLOCKED receipt, not a successful rendering test.
4. Read-only RunPod inventory; preserve no-duplicate/no-unapproved-billable-GPU gates. Once compute is approved and registered, pin/attest production artifacts.
5. Commission one deliberately small, rights-clean UGC canary before spending on advanced long-form, then complete post, Watch, learning and broader formats in that order.
6. Google Drive: store only encrypted non-secret asset backups, approved licensing/evidence, signed/hash-bound receipts and handoff copies in the existing `02-DIRECTOR-ASSETS`, `05-JOB-RECEIPTS`, `01-BACKUPS` or `07-DVC-VERSIONED-ASSETS` paths. An uploaded file is not a backup proof until roundtrip hash and isolated restore succeed.

## Safety / acceptance rules

- **No synthetic artifact or fixture may count as a real provider, Watch or final-QC result.**
- Production GPU, metered APIs, subscriptions, media publication and paid ads require their own existing approvals.
- Health checks, commissioner decisions and background supervisors never grant creative approval, financial authority or auto-wager authority.
- Protected identities/keys/tokens are never logged or stored in Google Drive handoff text.
- Review and merge only after **exact PR head** tests pass; don't merge old, divergent docs-only branch #1132 as the source of truth.
- If SWLC is still down, continue source-only fixes and keep runtime milestones **BLOCKED** rather than claiming DONE.

Canonical references:
- `docs/director/DIRECTOR-AUTO-HANDOFF-2026-10-04.md`
- `docs/director/DIRECTOR-LOCAL-UGC-HANDOFF-2026-10-07.md`
- `docs/supabase/SUPABASE-AUDIT-REPAIR-2026-10-05.md`
