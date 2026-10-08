# SHADOW-REPAIR.1–.9 → SHADOW-GDRIVE.5–.9 canonical handoff

## Source authority and prior conversation audit

The canonical repo is `bookieandco/crispy-waddle`; this is a continuation of SHADOW.1–.9 / SHADOW-LIVE.1–.9 and SHARK-COFFER, **not another trading system**.

Previous decisions preserved:
- Paper/simulated trading and NO_TRADE counterfactuals only. SHARK evidence and MIMS are advisory; no signer, broadcast, live execution, autonomous real-money transfer or live admission.
- Six post-decision horizons: 15M, 1H, 4H, 24H, 3D, 7D. Costs, slippage, realistic failed/partial fills, opportunity rejection and missing market prices must influence grades.
- SHARK enrichment roadmap: Pump.fun stream, exact Pump.fun→PumpSwap graduation boundary, Meteora liquidity/LP adversarial detection, wallet and side-wallet funding clusters, rug/sniper evidence, independent onchain observations, reproducible token/pair identity, timing and source-quality controls. Do **not** claim these signals from a DexScreener pair API alone.
- Shadow must feed later risk/Money/SHARK decisions through reviewed, provenance-carrying learning—not leak results to live mandates or money execution.
- Owner's current Homebase is an iPhone operator; Google Drive is private encrypted offsite recovery only. Prefer existing CPU/workers over new paid services. Do not spin up a replacement Pod or Network Volume as an implicit repair.
- Prior historical PR #1090's 11 fifteen-minute observations, 11 lessons, 1 calibration and 4 memories do **not** certify continuous current operation or profitable performance.

## Live read-only RunPod discovery

Read-only, pinned RunPod inventory workflow from this repair branch: `SHARK Shadow repair read-only Pod inventory`, run #37737685405. It found **eight stopped** CPU Pods named `jhadina-shark-shadow`, **zero running**, desired status EXITED. No returned item asserted `networkVolumeId`; the returned local disk fields were zero and mount fields null. This is a provider-observed status, **not** an assertion that stored data are deleted or recoverable. No Pod start/stop/create/delete was called by the inventory workflow.

**P0 recovery gate:** locate evidence/receipts for the actual historical data-bearing instance or owner-controlled copy; inspect exact existing Pod storage and associated volume/backup metadata before any billable resume. If there is no demonstrably persistent storage, treat the historic ledger as **UNRECOVERED**, not recreated. Never initialize an empty DB in its place and claim history recovered.

## Source changes implemented in repair branch

1. `shark-shadow-runpod-runtime.ts`: present-day market quotes are captured for forward sample history, but overdue horizons must resolve stored sample evidence from **their own** interval. The target sample must match source token, chain, baseline pair, positive price, nonempty evidence, and not lie beyond processing time. No sample means `missingPrice`, never a fabricated grade.
2. Migration `033_shark_shadow_grade_review.sql` and store audit: preserve old decisions, observations, lessons and market samples; add non-destructive `INVALID` or `UNVERIFIED` review rows when a legacy live `runpod-shadow-reprice:v1` observation is found. Never rewrite historic observations. Exclude reviewed legacy observations, lessons, calibrations, and memory cards from new evidence-based calibration/retrieval. Verification requires independent proof; no automatic promotion to VERIFIED.
3. Explicit evidence provenance: DexScreener pair observations carry a DEX-only provenance label. Unverified PumpSwap/Meteora/wallet-cluster/authority signals are labeled **unverified**, never silently promoted to validated onchain intelligence. Memory feedback requires a sufficiently sized cohort with point-in-time evidence; old spot-quote-only memory cannot shift a later paper decision.
4. Separate P2 evidence contract: all 6 horizon observations/lessons, zero unresolved legacy reviews, three distinct healthy watchdogs spaced across 30+ minutes, verified exact-storage recovery, acknowledged SWLC import with no rejection, simulated fill/cost audit, deterministic replay, later memory influence without relaxing baseline rejects. A `PASS`/ `FAIL` simulated performance verdict is **distinct** from runtime health and never implies real-market profitability.
5. SWLC scheduled importer: handle both actual Shadow Pod names and optional explicitly configured ID. Require an unambiguous **running** match before exporting. Redact artifact uploads to numeric reconciliation metrics rather than posting pending learning payloads as CI artifacts.
6. No-new-compute Pod inventory workflow and hermetic TypeScript CI for point-in-time, stale spot, provenance, paper authority and P2 contracts.

## Phase ledger — source work versus evidence-backed operations

| Phase | Source task | External live proof and current gate |
| --- | --- | --- |
| .1 Pod resolution | Read-only discovery of stopped/running Shadow candidates; no create/start | Eight stopped, no running; data-bearing original not identified **BLOCKED** |
| .2 PIT grading | Time-window, original pair, no future quote, missing history | Hermetic tests; **real 15m/1h/4h/24h/3d/7d observations not recertified** |
| .3 Legacy grade quarantine | Separate immutable status ledger and memory exclusion | Need live migration and read-only review tally |
| .4 Durable storage | Keep old Pod and original ledger; recovery manifest must map original state and volume ID | No independently verified Network Volume on a running Shadow host **BLOCKED** |
| .5 SWLC import | Correct Pod discovery and redact credentials/evidence artifacts | SWLC production health previously HTTP 500; no imported/acked receipts **BLOCKED** |
| .6 SHARK provenance | DEX-only evidence labels; unverified richer signals cannot contaminate memory | Wallet/funding/Meteora/PumpSwap adapters and adversarial canaries **NOT COMPLETE** |
| .7 Separate operational/edge certification | Strict P2 pure certification helper | Do not label runtime health as strategy profitability |
| .8 Six horizon + realistic fills | PIT source and six-horizon certification gates | Requires independent multi-day live/synthetic evidence; 7D needs elapsed time |
| .9 Unattended watchdog | Three distinct healthy cycles + observed replay, storage, SWLC, memory-feedback receipts | All live gates **BLOCKED** with stopped Pod |
| SHADOW-GDRIVE.5 | Worker machine Google OAuth | Interactive ChatGPT Drive and Colab are **not** worker authorization |
| SHADOW-GDRIVE.6 | Encrypted exact-folder Restic snapshot, restore hash | No real snapshot yet; reuse PR #1148, no unencrypted DVC |
| SHADOW-GDRIVE.7 | Isolated PostgreSQL full ledger restore and source-vs-target row validation | Required Shadow tables only source/test proof; no production restore |
| SHADOW-GDRIVE.8 | Scheduled private snapshots, failure alerts, retention rehearsals | No timers enabled or delivered alert receipts |
| SHADOW-GDRIVE.9 | Reconcile frozen sync queue and durable archive recovery | No SWLC acknowledgement or production recovery proof |

## Highest-leverage next source/commission action

1. Verify latest exact repair PR head CI, repair red runs, and review/merge it ahead of any worker restart. Merge Google Drive PR #1148 separately only after its own tests and source review.
2. **No-spend:** inspect original Pod exact read-only `get` fields to distinguish local volume, network volume and container disk; search previously saved snapshots/receipts. If none exists, declare evidence lost/unrecoverable **until proved otherwise**.
3. When a suitable stopped data-bearing Pod is identified, obtain explicit owner authorization for a *billable start*, never automatic creation. Snapshot all data read-only before schema migrations; replay only into an isolated fork first.
4. Run non-destructive grade review and PIT re-evaluation on a disposable copy. Preserve original plus quarantined rows and calculate lineage-aware restored vs original counts. Do not overwrite suspect grades.
5. Wire official authenticated multi-source SHARK adapters, prioritizing Pump.fun/PumpSwap and Meteora, then wallet-funding cluster provenance and rug/anomaly checks. Each needs observed/available timestamps, token/pair chain identity, source ID, independent confirmation, evidence freshness and tamper controls. One unverified signal cannot raise approval or rewrite evidence.
6. Only after all six genuine horizons and repeat health checks, capture strict P2 certification with MIMS verdict separate. The project must remain shadow-only even on a successful paper certification.
7. Commission PR #1148's Restic private Google folder path **after** a real trusted worker and a source database are available. No supplanting Jhadina Postgres, Network Volume, Supabase or active compute with Drive.

## Pass/fail invariants

- An outcome must be based on a source quote observed **within that horizon**, for that same chain/token/pair and before grading time.
- Unavailable samples remain unavailable; bad old grades keep immutable original evidence and get an explicit review status.
- A memory card influenced a later decision only if its constituent lesson IDs are valid, time-bounded, sufficiently sampled and accurately sourced. Baseline rejections can only be maintained or strengthened.
- SWLC acknowledges queue records **only** after an authenticated, accepted idempotent import. Return of HTTP 200 for the workflow does not prove import happened.
- Long-term PostgreSQL and Drive backups each require byte rehydrate plus disposable database and semantic integrity checks before decommissioning originals.
- `canExecute`, `canSign`, `canBroadcast`, `canAuthorizeLive` remain false across all Shadow interfaces.
- No new billable Pod, no automatic restart and no live-money execution in this sequence.

**Related source branch:** `feat/shadow-repair-pit-provenance-20261007`.
**Recovery source PR:** https://github.com/bookieandco/crispy-waddle/pull/1148 .
**Google Drive canonical Shadow folder:** https://drive.google.com/drive/folders/1DG1p-VXZ5UFViRYsT461O1i5pR6x_EWW .

## October 8 — SHARK-RECOVERY.LIVE.1–.7 continuation

**No certification was granted and no billable Pod was started.** This section is the actual production-status ledger; do not interpret a hermetic CI pass or Supabase dashboard status as recovered learning.

| Phase | Code/read-only proof | External gate |
| --- | --- | --- |
| LIVE.1 | Existing PRs #1149, #1148 and #1165 reconciled; source contracts checked | Merge only after exact-head green and compatibility review |
| LIVE.2 | New read-only RunPod inventory #37815361377 used `pod get --include-network-volume` and `network-volume list`; eight stopped Shadow CPU Pods, no reported attached volume, zero named SHARK/Jhadina volume candidates | Authentic historical ledger **UNRECOVERED** |
| LIVE.3 | Existing `PGDATA` bootstrap now fails closed absent `RECOVERED_CLONE_ONLY` and private, exact-target restore attestation; checked by hermetic tests | Actual source backup, immutable hash, isolated PostgreSQL restore and source-vs-target row-count parity absent |
| LIVE.4 | Non-destructive invalid/unverified historical grade review and PIT correction source in this PR | Cannot regrade absent original ledger and independently timestamped price samples |
| LIVE.5 | SWLC metadata reported `ACTIVE_HEALTHY`, but authenticated SQL probe returned PostgreSQL `57P03`. Read-only postgres logs at ~17:13 UTC showed WAL redo advancing while connections were refused | Leave DB recovering; no schema mutation, automated restart or import/ack while read-only SQL remains unavailable |
| LIVE.6 | Protected `runMemeAssessmentCycle` POST path in #1165 requires OIDC, current market evidence and active PAPER/SHADOW charter; disabled by default | Full-evidence producer, durable writes and protected production smoke test absent |
| LIVE.7 | Source worker and fail-closed paper-certification gates in repo; no more funded Pods launched | Durable continuously running owner-controlled host, real six-horizon observations, repeated watchdog and safe memory feedback absent |

Recovery admission now additionally requires:
- `SHARK_SHADOW_EXISTING_LEDGER_APPROVED=RECOVERED_CLONE_ONLY`, a private 0600 receipt at `SHARK_SHADOW_RECOVERED_CLONE_RECEIPT`, correct exact clone directory and distinct immutable original location.
- Source/restore SHA-256 equality, the nine Shadow aggregate-table count parities, nonempty historical market/decision rows, no orphan records or execution authority, and owner-reviewed isolated restore metadata.
- The receipt is **operator-attested JSON**; metadata matching is not independent cryptographic evidence that a clone or backup exists. Host commissioning must actually prove the hash, source/target content, and original preservation before issuing a legitimate receipt.

Critical operational restrictions:
- Never call `runpodctl pod start`, `pod create`, or `network-volume create` implicitly; additional billable resources require a separate owner decision.
- Never initialize a new empty ledger under a path claimed to contain historical learning.
- Do not repurpose the ChatGPT Google Drive connector as the worker's machine rclone OAuth.
- Keep export and acknowledgement frozen until SWLC durable read/write and the original Shadow queue have both been verified.
- Paper trading may begin on a separately labeled **new** ledger after explicit approval, but this must not be described as restored prior learning.

Canonical read-only evidence: https://github.com/bookieandco/crispy-waddle/actions/runs/37815361377 .
