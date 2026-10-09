# SHARK-FRESH-COMMISSION.01 → .05 — integrated paper learning handoff

**Truthful status:** full source integration and repeatable hermetic test gate are in draft [PR #1185](https://github.com/bookieandco/crispy-waddle/pull/1185). This is **not** a commissioned service. Real original SHARK ledger remains unrecovered. No historical data, production PostgreSQL or real-money trading may be substituted with synthetic test receipts.

## .01 — Integrate the nonduplicated recovery implementation

PR #1185 combines the reviewed *source* files from:
- [#1148](https://github.com/bookieandco/crispy-waddle/pull/1148) — genuine machine-scoped Google Drive Restic backup, isolated PostgreSQL semantic restore, retention watchdog / service timers
- [#1149](https://github.com/bookieandco/crispy-waddle/pull/1149) — point-in-time Shadow repair, paper learning, persistent-storage and first-boot/new-ledger restart safeguards
- [#1172](https://github.com/bookieandco/crispy-waddle/pull/1172) — exact synthetic PostgreSQL original-row-to-restore comparison
- [#1181](https://github.com/bookieandco/crispy-waddle/pull/1181) — history inventory/provenance quarantine and safe fresh-start admission

The only overlapping source file was `infrastructure/homebase/google-drive/restore_drill.py`. The integration preserves #1148's required-Shadow-tables and read-only semantic audit callback and adds #1172's exact synthetic test-marker query without changing the network-isolated restore protections. No separate backup or paper runtime was introduced. **Do not merge** until exact integration head workflows and independent review pass. Preserve parent PRs and recovery issue [#1168](https://github.com/bookieandco/crispy-waddle/issues/1168) until reconciliation.

## .02 — Commission an existing, authorized owner-controlled persistent worker

The user's phone and ChatGPT's connected Google Drive are control/evidence interfaces, **not** a verified always-on process or RunPod worker Google OAuth. The user must have an already authorized owner-controlled laptop/server/Pod and a **different, actually persistent filesystem mount**. Do not create a billable Pod or repurpose stopped disposable container disks automatically. Identify old historical archive root separately and scan it read-only under `scripts/shark_history_salvage_inventory.py`. A fresh ledger begins as `NEW_HISTORY_NOT_RECOVERED`; never overwrite any original archive.

Host preflight, **read only**:

```bash
umask 077
python3 scripts/shark_history_salvage_continuation.py fresh-preflight \
  --old-root /owner/known-old-shadow-archive \
  --new-root /owner/dedicated-persistent-volume/new-shadow-paper \
  --owner-approval YES_NEW_PAPER_HISTORY_NOT_RECOVERED \
  --out /owner/private-audit/fresh-preflight.json
```

The preflight must report `READY_FOR_OWNER_STAGING_REVIEW`. This alone neither creates PostgreSQL nor authorizes billing or running the worker.

## .03 — Initialize the **new** schema without commissioning learning

On the authorized worker, after separate review of persistent mount and source, use the existing reviewed bootstrap:

```bash
export SHARK_SHADOW_DATA_DIR=/owner/dedicated-persistent-volume/new-shadow-paper
export SHARK_SHADOW_FRESH_LEDGER_APPROVED=YES
export SHARK_SHADOW_FRESH_LEDGER_LABEL=NEW_EMPTY_RESEARCH_ONLY
export SHARK_SHADOW_SETUP_ONLY=YES
export SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED=YES
bash scripts/shark-shadow-runpod-bootstrap.sh
```

That specific first-run branch initializes **empty** PostgreSQL on an independently mounted filesystem, applies current Shadow migrations, creates mode-0600 `.shadow-fresh-genesis.json` pinned to PGDATA inode/device/version, and exits **before** scheduling the trading-research worker. An existing unmarked PGDATA remains protected and cannot enter this path. The owner is responsible for provider activation and monitoring; this runbook itself has not performed this step.

## .04 — Prove **real** encrypted Drive backup and isolated database restoration

On **that same worker**, connect the machine's Google OAuth remote to a **private owner-controlled folder**, with an owner-only Restic password and explicitly approved destination. ChatGPT's 646-byte synthetic Drive canary is **not** sufficient. Reuse the existing `infrastructure/homebase/google-drive/shadow_backup.py` implementation, not a new backup stack:

```bash
umask 077
export JHADINA_HOMEBASE_TRUST_DOMAIN=OWNER_CONTROLLED
export JHADINA_RESTORE_TRUST_DOMAIN=OWNER_CONTROLLED
export JHADINA_RESTORE_APPROVED=YES
export SHADOW_DRIVE_BACKUP_APPROVED=YES
# Set machine-scoped GOOGLE_HOMEBASE_* rclone and Restic env through
# the reviewed existing Homebase onboarding. NEVER paste secrets in chat.
python3 infrastructure/homebase/google-drive/shadow_backup.py doctor \
  > /owner/private-audit/worker-drive-doctor.json
python3 infrastructure/homebase/google-drive/shadow_backup.py backup-db \
  > /owner/private-audit/first-shadow-backup-output.json
# Pass the exact private shadow-SNAPSHOT receipt emitted in
# JHADINA_BACKUP_ROOT/shadow/receipts; do NOT use a synthetic test receipt:
python3 infrastructure/homebase/google-drive/shadow_backup.py restore-drill \
  --receipt /owner/backup-root/shadow/receipts/shadow-EXACT-SNAPSHOT.json \
  > /owner/private-audit/first-shadow-restore.json
```

Require a real `jhadina.shadow.google-drive-backup.v1` snapshot with encrypted Restic readback and a distinct `jhadina.shadow.google-drive-restore.v2` with real PostgreSQL required-table and semantic checks. Before the worker starts, decisions/outcomes may legitimately be **zero**; that is an *empty newly initialized ledger*, not recovered historical decisions. For historical recovery, separate original-Pod/Volume provenance and nonzero original row parity remain required.

## .05 — Restart paper learning and accumulate genuine outcomes

For the freshly initialized **same** PGDATA only, the reviewed bootstrap's existing `SHARK_SHADOW_FRESH_LEDGER_RESTART_APPROVED=YES` branch requires the exact private `SHARK_SHADOW_FRESH_BACKUP_RECEIPT` and `SHARK_SHADOW_FRESH_RESTORE_RECEIPT` paths; it rejects fake or missing receipts, symlinked files, a changed PGDATA inode/version, and live-money authority. After verifying restart eligibility, run the existing worker under the owner's trusted host supervision. Confirm real data-source entitlements, provider quotes and point-in-time sample provenance before considering any decision/grade genuine.

Capture **two separate real runtime health receipts** with actual `observedAt` timestamps, valid paper-only flags, and actual `certification.observationCounts` and `lessonCounts`; the second must be **at least seven days after the first** and include independently sourced 15M, 1H, 4H, 24H, 3D and 7D outcome counts. Verify data persists after a restart and encrypted snapshot; keep SWLC sync deferred until its Supabase database recovers. Historical market data used for retrospective research must be quarantined from these forward outcomes.

The source-only attestation report can be run against **real owner-only receipts**:

```bash
python3 scripts/shark_fresh_commission.py \
  --source /owner/private-audit/exact-head-review.json \
  --preflight /owner/private-audit/fresh-preflight.json \
  --genesis /owner/private-audit/fresh-genesis-copy.json \
  --doctor /owner/private-audit/worker-drive-doctor.json \
  --backup /owner/backup-root/shadow/receipts/shadow-EXACT-SNAPSHOT.json \
  --restore /owner/private-audit/first-shadow-restore.json \
  --first-health /owner/private-audit/first-real-health.json \
  --later-health /owner/private-audit/day-seven-real-health.json
```

No helper **generates** production approval automatically. The .01 source review JSON must be independently sourced from the exact GitHub commit and recorded by the operator. The .03 genesis JSON must be a faithful owner-private copy of the marker actually created during setup-only bootstrap; scripts do not invent one. Real health/backup/restore receipts must be produced by the worker, not derived from test fixtures.

**Result semantics:** a blocked phase lists missing evidence. Even if every locally supplied JSON contract matches, the report returns `INDEPENDENT_HOST_AND_PROVIDER_ATTESTATION_REQUIRED` and `productionCommissioned=false`: self-attested files do not prove provider access, real-time streaming, retention or results. Honest operational certification demands independent host/provider observations. Real-money execution is permanently disabled in this pathway, and research returns do not establish profitability.

### Known unresolved P0 and owner-host blockers

1. Original stopped RunPod container-disk history not found; recovery remains open under #1168.
2. SWLC Supabase PostgreSQL is recovering after disk-full/WAL problems (#1110). Independent fresh paper PostgreSQL does **not** require SWLC to start, but SWLC reconciliation must not run until it is healthy.
3. No presently verified owner-controlled always-on worker, dedicated persistent mounted volume, *machine* Google OAuth, real SHARK encrypted database backup, isolated real-data restore, or actual six-horizon observations from the new run. **Do not claim production is online.**


## Owner-host operational continuation — four missing real-world proofs

**Current actual infrastructure inventory:** authenticated Railway listing contains two projects, `OverageOS` (production has no services or volumes) and `PupsonStuff Media Services` (existing unrelated media services with no volumes and pending staged changes). Neither is a SHARK owner-controlled persistent PostgreSQL worker. The previous RunPod inventory found stopped Shadow Pods without a verified surviving attached persistent volume. Do not repurpose existing Railway deployments or create a new billable host without explicit approval. The connected ChatGPT Google Drive account is *not* the host's rclone OAuth credential.

On an **existing owner-controlled always-on Linux host with an attached dedicated persistent volume** (not an ephemeral CI runner), this commit adds real host operations and witnessed-paper monitoring. The source-only CI mocks these external operations and never falsely certifies them as executed. Do not paste machine secrets or a Restic password into ChatGPT, Drive Docs or GitHub issues.

### A — Verify actual mounted disk and existing fresh PostgreSQL

After mounting the dedicated volume and initializing the paper schema through the existing setup-only bootstrap, run:

```bash
umask 077
export JHADINA_HOMEBASE_TRUST_DOMAIN=OWNER_CONTROLLED
export SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED=YES
export SHARK_SHADOW_DATA_DIR=/owner/dedicated-volume/shark-new
python3 scripts/shark_fresh_host_operations.py probe \
  --state-root "$SHARK_SHADOW_DATA_DIR" \
  --receipt /owner/private-audit/first-host-probe.json
```

Actual `findmnt`, free-space and new `PG_VERSION` checks occur **on that machine**. The result `persistentMountObserved=true` is a point-in-time observation, not proof of continuous uptime. Check that the paper worker stays running across multiple real intervals independently.

### B/C — Verify *worker-machine* Google OAuth, run actual encrypted Restic backup + isolated PostgreSQL restore

With the new local database running and its private `.shadow-fresh-genesis.json` present, configure the host's existing Google Homebase rclone OAuth remote and owner-held Restic password file. Use the existing Homebase variable configuration, and additionally approve:

```bash
export SHARK_FRESH_REAL_BACKUP_RESTORE_APPROVED=YES
export SHADOW_DRIVE_BACKUP_APPROVED=YES
export JHADINA_RESTORE_TRUST_DOMAIN=OWNER_CONTROLLED
export JHADINA_RESTORE_APPROVED=YES
python3 scripts/shark_fresh_host_operations.py backup-and-restore \
  --state-root "$SHARK_SHADOW_DATA_DIR" \
  --receipt /owner/private-audit/first-real-backup-restore.json
```

This **actually calls** `shadow_backup.source_settings`, `shadow_backup.scoped_repository` (machine-level rclone/Restic remote authentication), `shadow_backup.archive` (genuine local pg_dump → encrypted Google Drive snapshot → exact SHA-256 cloud readback), and `shadow_backup.recovery_drill` (isolated local PostgreSQL recovery and semantic checks). It will fail closed if run on CI, on a missing/disposable filesystem, for mismatched fresh-genesis/PGDATA, absent exact source path, missing approval, unconfigured credentials or a failed restore. Successful provider operations create an owner-only append-only receipt outside the database root; they do not start background learning or authorize trades. **No such actual host execution has occurred in this chat.**

### D — Start paper worker after restore and witness genuine forward cycles

Only after source-review, real host/disk and an independently verified genuine offsite restore have passed, use the existing reviewed `SHARK_SHADOW_FRESH_LEDGER_RESTART_APPROVED=YES` branch with the actual backup and restore receipt files to start paper-learning, never direct wallet/trade execution.

The new `scripts/shark_fresh_forward_witness.py` makes an HTTP-200 `GET http://127.0.0.1:8094/health` from that **same machine**, verifies the paper-only authority flags and a ready service state, and writes an immutable owner-only JSON snapshot:

```bash
python3 scripts/shark_fresh_forward_witness.py \
  --port 8094 --receipt /owner/private-audit/paper-day0.json
# After at least seven days of *real elapsed time and actual provider prices*:
python3 scripts/shark_fresh_forward_witness.py \
  --port 8094 --receipt /owner/private-audit/paper-day7.json
```

The health witness does **not** claim independently verified provider provenance or seven-day certification. Preserve real feed provider names and quote timestamps in the canonical immutable market samples. Demand complete real 15M, 1H, 4H, 24H, 3D and 7D decision/grade/lesson evidence across several worker cycles and a database restart; validate external data/feed licenses and costs. Only then use the existing `scripts/shark_fresh_commission.py` evidence gate; it remains a *planning and local audit* output until independently verified by host/provider records.

### Progress boundary

All four requested operational items are **pending a connected owner-controlled host**; implementation, CI, and Google Drive account visibility are not substitutes. No existing historical Shadow source has been overwritten, no paid Pod started, no SHARK real database was backed up or restored, and no real paper-learning cycles have been witnessed from this chat.
