# SHARK-HISTORY-SALVAGE.01–.05 — Original evidence versus reconstructed research

**Status:** source implementation and hermetic contract tests. Live historical source restoration and new worker commissioning remain **NOT VERIFIED**. This is a continuation of [recovery issue #1168](https://github.com/bookieandco/crispy-waddle/issues/1168) and does not replace [Money FINISH original-to-isolated-restore parity](../../packages/money-core/src/money-finish-recovery.ts), [SHADOW repair #1149](https://github.com/bookieandco/crispy-waddle/pull/1149), [Drive backup #1148](https://github.com/bookieandco/crispy-waddle/pull/1148), or [Supabase P0 #1110](https://github.com/bookieandco/crispy-waddle/issues/1110).

## .01 — Historical source inventory

Read-only inventory performed October 8, 2026 (America/Los_Angeles):

- **RunPod:** inventory Action [#37815361377](https://github.com/bookieandco/crispy-waddle/actions/runs/37815361377) saw eight stopped Shadow Pods, zero reported attached Network Volumes and zero named SHARK/Jhadina detached candidates. No source database was read and original history remains **unrecovered**. A stopped disposable container disk is not an authenticated backup.
- **Google Drive:** the preexisting SHADOW-PAPER-TRADING archive has no genuine original ledger snapshots, replay or memory uploads located during review. Its health folder now contains **two clearly synthetic canaries** from the independent Google Drive 646-byte exact readback test; these are not a Postgres database dump. ChatGPT Drive OAuth is not the RunPod worker OAuth.
- **GitHub:** inspected artifacts for runs #37884679535, #37815361377, #37813818962, #37825257947, #37824585182 and #37824585243. Two RunPod inventory artifacts were present, other inspected runs had no artifacts. None in this bounded inspection established original PostgreSQL history. The repository has tens of thousands of historical runs; this is **not** an exhaustive artifact or off-repo backup search.
- **Supabase:** SWLC Postgres is still P0 audit/repair, with historical SQLSTATE `57P03` and disk-full/WAL recovery. Do not inspect or mutate its historical data until SQL becomes usable and capacity is verified.

Added `scripts/shark_history_salvage_inventory.py`: on an explicitly approved owner-controlled host, it can scan **only a user-selected existing non-root directory** for candidate copies without writing any source files. Recursion is bounded (1500 files, 512 MiB per file, 1 GiB total); it skips symlinks, ignores unsupported extensions, fingerprints locators rather than exposing names and writes an owner-only 0600 manifest with `O_EXCL` when requested.

**Host-only example after identifying an authorized existing directory** (not executed on RunPod or the phone here):

```sh
python3 scripts/shark_history_salvage_inventory.py \
  --root /path/to/existing-owner-controlled-recovery-archive \
  --out /path/to/private-new-salvage-receipt.json
```

The receipt must be examined by an operator on that host. Even a `PGDMP` header means *candidate only*, never original-source attestation.

## .02 — Quarantine and deterministic evidence catalog

`packages/money-core/src/shark-history-salvage.ts` classifies SHA-256-tagged metadata into:

| Type | Permitted classification |
| --- | --- |
| Authentic-looking local PostgreSQL dump / old export | `ORIGINAL_UNVERIFIED`; requires independent original identity and row-level isolated restore |
| Archived market and blockchain records | `RECONSTRUCTED_RESEARCH_ONLY`; cannot be historical SHARK decisions |
| CI inventories and Drive handoff documents | `NON_LEDGER_EVIDENCE` |
| Any test canary, fixture or synthetic artifact | `SYNTHETIC_EXCLUDED` |

Identity collisions with different content are rejected. No category authorizes real-money execution, creation of original decisions, calibration of forward memory or deletion/overwriting original files.

## .03 — Point-in-time historical reconstruction guard

`admitReconstructedMarket` checks original market event, provider availability, capture and hypothetical-decision chronology; rejects future-leaking data and impossible source ordering. **Even archived quotes with valid clock ordering remain retrospective research**, never original SHARK predictions or real observed forward grades. Existing Helius source research and RunPod Shadow replay modules can be reused for separately labeled reconstruction once authentic read-only provider entitlements, source timestamps and replay isolation are proven. No provider was commissioned or billed here.

## .04 — Fresh-start durable ledger planner

`planFreshShadowHistory` is a pure **planning** gate. It requires explicit owner approval, a different non-nested directory from the old ledger, an owner-verified worker, a persistent separate mount, an actual encrypted offsite restore, and paper-only authority. The best possible result is `OPERATOR_REVIEW_ONLY`, not a service start or runtime certification. It always labels the new namespace `NEW_HISTORY_NOT_RECOVERED` and never overwrites old data. Actual RunPod bootstrap/persistence work belongs to PR #1149; the Google Drive production snapshot/restore belongs to PR #1148.

## .05 — Test, review, and merge handoff

`.github/workflows/shark-history-salvage-contract.yml` runs Money Core TypeScript checks, focused Node salvage provenance tests, and Python read-only scanner tests. Tests explicitly exercise synthetic mislabeling, conflicting hashes, future-price leakage, nested old data paths, absent offsite restore, symlinks and owner-only receipt creation. These tests contain no real historical trading records.

**Acceptance boundary:** `SALVAGE.SOURCE.PASSED` only if the exact PR head CI passes; `ORIGINAL_SHADOW_RESTORED` remains false until independent original-source identification + real encrypted backup + isolated database schema, row-count and lineage proofs. If no original is recovered, a fresh paper ledger can only be commissioned **separately** after host, durable backup and owner gates succeed. No live orders, wallet movements, SWLC migration, Pod starts or new infrastructure spending are authorized by this work.


## Continued work — Connected Drive audit and read-only source hardening

The authenticated Google Drive integration was used again for a **live metadata-only, read-only inventory** of all five canonical SHADOW folders and broader title/content discovery queries (SHADOW, shark, ledger, postgres, runpod, backup, restic, .dump, .sqlite). Exact provider folder listing results at this checkpoint: ledger 0, market replay 0, learning memory 0, health receipts 2 (both deliberately synthetic test files), migration handoff 2 prior planning Google Docs. No original PostgreSQL snapshot, historic SHARK decision ledger or owner-restorable encrypted Restic archive appeared in the accessible result set. This cannot prove that nothing exists on an offline machine, another account or inaccessible provider database.

**New authenticated Drive evidence document**, written and read back, placed in the existing migration folder:
- [SHARK Historical Drive Inventory — Unrecovered Sources](https://docs.google.com/document/d/1X9IWTM1awZtlWO_W7zBwzhsKKBJAnAYl0DzQTXicxdg/edit)
- Folder: [05-MIGRATION-HANDOFF](https://drive.google.com/drive/folders/13EJZYM_IsDBJXKTWZVjYLAPZfmWTZv6m)

**Supabase P0 is still blocking read-only original data discovery.** Authenticated read-only SQL against Swlc again returned PostgreSQL `57P03` / hot standby disabled, and postgres logs showed redo/WAL replay and refused connections. No restarts, migrations, disk changes, billable upgrades or re-synchronization were attempted; #1110 owns repair.

**Owner-host local salvage scanner hardening:** file hashing now descends through verified directory file descriptors and uses `O_NOFOLLOW` on each path component. An inode/size mismatch during open or changed final file metadata fails closed. A private inventory output receipt cannot be placed within the source archive directory. These additions address data-race and accidental source-mutation risks, including a possible filesystem attacker swapping symlinks between the directory walk and file read. Source-only tests cover nested archive files, replaced files and private output containment. Production workers still need an approved root, persistent original source, independent PostgreSQL isolated restore and real Drive machine-scoped encryption.

**Truthful status:** Drive audit receipt and source safety code exist; original historic SHARK ledger **not recovered**, unattended runtime **not commissioned**, and synthetic market history is **not forward learning**.


## SALVAGE.06–.07 — reusable Google Drive evidence and original-source external audit

**.06 — Structured Google Drive metadata receipt.** The new `packages/money-core/src/shark-history-drive-inventory.ts` provides the frozen set of five owner-created Shadow archive folder IDs. A consumer of separately authenticated Drive `list_folder` results must supply every folder once, assert authenticated reads, successful enumeration and an explicit end-of-pages `nextPageToken:null`. It rejects omitted folders, folder-ID substitution, contradictory duplicate Drive objects and invalid item metadata; deterministic inventory hashes are insensitive to listing order. All native Docs, handoff text, and synthetic canaries are excluded from original-history admission. A binary file merely named `shadow-ledger.dump` remains `METADATA_ONLY_NEEDS_BYTES`, not `ORIGINAL_RESTORED`. No Drive token, file download, worker OAuth or automatic import occurs inside Money Core.

The unit fixture mirrors the actual, separately observed Drive folder counts from the latest authenticated read: ledger 0, market 0, memory 0, health 2 synthetic canaries, handoff 3 audit/planning documents. These **test fixture counts are not live observations**, and should be refreshed from a separately authenticated Drive listing for every new audit. [Recorded authenticated Drive audit](https://docs.google.com/document/d/1X9IWTM1awZtlWO_W7zBwzhsKKBJAnAYl0DzQTXicxdg/edit).

**.07 — Original-source audit escalation (never automatic promotion).** New `packages/money-core/src/shark-history-original-gate.ts` composes the existing Money FINISH `MoneyRecoveryReport` and the salvage artifact classification. To request an independent external source audit, an owner-held original source candidate must be associated with the specific historical Pod and persistent storage ID, exact matching artifact digest, independently restored nonempty row-parity manifest, encrypted offsite backup receipt, independent host proof and explicit synthetic exclusion. A missing element produces `BLOCKED`. **Even when all fields are present**, the best state is `EXTERNAL_SOURCE_AUDIT_REQUIRED` because operator-provided metadata alone cannot independently verify physical host identity, authenticated Restic encryption or that records truly originated from the earlier SHARK Pod. Historical recovery, new ledger creation, ingestion of old lessons and live financial execution stay false.

**Next source/operational dependencies:** `SHARK-HISTORY-SALVAGE.08–.10` should cover a trusted owner-host actual read-only candidate discovery and encrypted isolated rehydration; independent provenance audit against immutable original Row/Volume evidence; and a separately authorized fresh-ledger/worker commission only if original data truly cannot be recovered. The connected ChatGPT Drive is suitable now for metadata audits and synthetic storage tests; machine-specific OAuth and real backed-up PostgreSQL remain **unverified**. Supabase is still P0 and cannot be used as a working historic ledger source.


## SHARK-HISTORY-SALVAGE.08–.10 — owner-host recovery or new paper history

This sequence implements a **forked operational strategy**, not a requirement to restore the old Pod before SHARK can ever learn again. If the source ledger is found, first verify it in isolation; if it is not found, keep the archival recovery ticket open and commission a **different, fresh, forward-only research ledger** after separate host/storage/backup admission.

### .08 — Owner-host candidate source re-read

`scripts/shark_history_salvage_continuation.py review` reads the owner-only JSON receipt produced by `shark_history_salvage_inventory.py`. It re-scans the authorized original archive using the hardened no-follow file-descriptor scanner and matches source-root fingerprint, file count, byte count, per-file content SHA-256 and hashed file identity. Removed, replaced, or changed originals block the operation. The result says `ORIGINAL_CANDIDATES_UNVERIFIED` or `NO_ORIGINAL_CANDIDATE_IN_SCOPED_ROOT`, never `RECOVERED`.

Run only on an actual authorized machine where historical files could still exist:

```sh
python3 scripts/shark_history_salvage_inventory.py \
  --root /existing/owner-controlled/historical-archive \
  --out /private/audit/scan.json
python3 scripts/shark_history_salvage_continuation.py review \
  --root /existing/owner-controlled/historical-archive \
  --inventory /private/audit/scan.json
```

The archive scan has not been executed against the old RunPod Pod because there is currently no authenticated persistent volume/dump available.

### .09 — Reconcile *actual* Restic and isolated PostgreSQL restore receipts

`scripts/shark_history_salvage_continuation.py verify-restore` compares a successfully re-hashed archival PostgreSQL candidate's SHA-256 with receipts from the **existing** Google Homebase `backup.py` / `restore_drill.py` pipeline. It requires immutable snapshot ID matching, encrypted Restic receipt with cloud-byte verification, matching dump digest, network-isolated PostgreSQL restore, nonempty application tables and no production DB modifications. Missing or inconsistent evidence **BLOCKS**.

```sh
python3 scripts/shark_history_salvage_continuation.py verify-restore \
  --review /private/audit/review.json \
  --backup /private/audit/real-restic-backup.json \
  --restore /private/audit/real-isolated-postgres-restore.json
```

These receipts are never generated or invented by the verifier. Existing Homebase receipts were designed for `LOCAL_HOMEBASE_COMPOSE`, **not** proof of an old SHARK Pod's identity. Even all-matching receipts result only in `RESTORED_CONTENT_EXTERNAL_LINEAGE_AUDIT_REQUIRED`. Then require external verification of source Pod, volume, old historical decisions and complete per-table row parity with `shark-shadow-recovered-clone-admission.py` on a trusted clone. No code here authorizes ingestion of synthetic data or original-history certification.

### .10 — Stage a separate fresh paper-learning ledger when originals are unavailable

`scripts/shark_history_salvage_continuation.py fresh-preflight` is a read-only **host staging preflight**. It checks that the proposed new history directory is empty or nonexistent, not a symlink, does not overlap the old recovery directory, lives on a separately mounted non-ephemeral filesystem, is running on an owner-controlled host rather than GitHub Actions, and has explicit approval code `YES_NEW_PAPER_HISTORY_NOT_RECOVERED`. It never creates PostgreSQL directories, starts a paid Pod, provisions infrastructure, changes real assets, or touches the old source.

```sh
python3 scripts/shark_history_salvage_continuation.py fresh-preflight \
  --old-root /existing/owner-controlled/historical-archive \
  --new-root /separate/persistent-volume/new-shadow-paper \
  --owner-approval YES_NEW_PAPER_HISTORY_NOT_RECOVERED
```

**Commissioning requires additional existing functionality:** after this review, the new ledger must go through the dedicated-mount and explicit empty-ledger admission in [PR #1149](https://github.com/bookieandco/crispy-waddle/pull/1149) using `SHARK_SHADOW_FRESH_LEDGER_APPROVED=YES`, `SHARK_SHADOW_FRESH_LEDGER_LABEL=NEW_EMPTY_RESEARCH_ONLY`, and `SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED=YES` **on the owner-controlled worker**, and require a real encrypted Google Drive database restore test before unattended service certification. PR #1149 is separate and must be merged/reviewed; this salvage command intentionally does **not** bypass it. The fresh ledger is labeled `NEW_HISTORY_NOT_RECOVERED` and starts with **zero** original SHARK trade/decision/outcome records. Genuine 15m, 1h, 4h, 24h, 3d, 7d future observations take real elapsed time. Historical provider archives can separately populate retrospective research only with valid provider access rights and availability timestamps.

**Neither recovery nor fresh start has been commissioned** by these source-level tests, and the old SWLC/Supabase issue remains deferred for audit/repair. The ability to rebuild future learning is independent of historical restore; original historical learning cannot be recreated by hindsight.


### Receipts for .08–.10
Each subcommand accepts optional `--out /path/to/new-private-audit-receipt.json`. If provided, the command creates an owner-only 0600 JSON file using exclusive creation and fails on existing paths or any destination inside the original or proposed fresh ledger directories. If omitted, the command prints JSON to stdout. Store these receipts outside both ledger roots, and pass the saved review JSON as `verify-restore --review`. Writing this audit receipt does not write or initialize a ledger.
