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
