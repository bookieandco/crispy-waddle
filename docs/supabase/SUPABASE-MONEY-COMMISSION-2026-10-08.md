# SUPABASE-DB.2 → SUPABASE-CROSS-SYSTEM.9 → MONEY-COMMISSION.RESTORE → FEEDS → PAPER → FINAL

**Date:** 2026-10-08. **Canonical system:** `bookieandco/crispy-waddle`. **Database authority:** existing SWLC project `kqbkaozfjubkjevdfvic`. **Trading:** research/paper-only, no live orders.

## Operational truth

The existing Supabase control plane reports `ACTIVE_HEALTHY` but the independently attempted read-only Postgres SQL connection returned **SQLSTATE 57P03**, database not accepting connections. Issue [#1110](https://github.com/bookieandco/crispy-waddle/issues/1110) documents `No space left on device` and WAL redo loops. This is **not repaired**. The owner has not yet explicitly approved a subscription or capacity charge. **Do not** pause/restore repeatedly, delete WAL/rows, change RLS, push migrations, provision replacement database, or switch authority to ephemeral storage.

The original SHADOW ledger in [the owner's Google Drive archive](https://drive.google.com/drive/folders/1DG1p-VXZ5UFViRYsT461O1i5pR6x_EWW) remains unrecovered. Empty snapshot/replay/learning folders and synthetic canaries are not original history (Money blocker [#1178](https://github.com/bookieandco/crispy-waddle/issues/1178)). Vercel production was serving an older deployment; durable memory returned HTTP 500 while its database was unavailable. The existing `supabase-production-recovery-cert.yml` and internal `supabase/recovery-cert` endpoint perform bounded read-only checks and refuse privileged recovery traffic while unhealthy.

## What this PR implements

`scripts/supabase-money-commission-evidence.py` is an offline **operator receipt auditor**. It reads only files under a supplied local evidence root (rejects symlink/path escapes). It never calls Supabase, RunPod, a broker, a wallet, a paid provider, GitHub Actions dispatch, or Vercel. Stage output is **BLOCKED** or **REVIEW_REQUIRED**. The terminal output is **always** `finalCertification: NOT_ISSUED`, `financialAuthority: NONE`, `canExecute: false`, `canAuthorizeLive: false`. Even fixture receipts shaped like genuine ones cannot self-certify production.

The verifier binds all eight SWLC recovery stages to the **same existing project**, an exact 40-hex-character main commit SHA, operator evidence IDs, non-synthetic read-only origin, and fresh timestamps. It denies missing prerequisite stages. `MONEY-COMMISSION.RESTORE` requires distinct source/restorer identity, original Pod/Volume identifiers, physically present encrypted backup and independently downloaded byte-for-byte matching file, independently available original/restored ledger JSON with non-empty unique event identities and matching canonical rows, proof of encryption and offsite independent readback. This does **not** establish original Pod custody or that purported encryption is authentic: independent human/host review is still required.

`MONEY-COMMISSION.FEEDS` expects independently timestamped and entitled read-only canaries for **STOCK**, **FOREX**, **OPTIONS** and **METALS**. STOCK/FOREX/OPTIONS require confirmed two-sided quote availability, OPTIONS requires adjusted contract and expiry/settlement receipts, and METALS is explicitly `NON_EXECUTABLE_MIDPOINT`, not a fake broker quote. Any synthetic/unknown provider blocks progression.

`MONEY-COMMISSION.PAPER` reads the **actual journal bytes**, verifies declared SHA-256 and hash-chain links, unique prediction-horizon pairs, no future-dated grades, all **15m/1h/4h/24h/3d/7d** horizons and 3+ strictly advancing independent watchdog checkpoints with matching journal-prefix hashes. It requires durable host and after-reboot evidence IDs. For semantic grade validation, continue using the canonical TypeScript `assertMoneyForwardGrade` and `assessMoneyFinishFinal` in `packages/money-core`; the Python parser is supplementary, not a replacement for the machine's live ledger checks.

**Limits:** Receipt filenames, source/operator identifiers, flags and IDs are *claims until independently checked*. An apparently passing package only reaches **EXTERNAL_REVIEW_REQUIRED**. Do not confuse CI fixtures with operational recovery, encrypted backup from original Pod, payment authorization, real quote rights, or paper profitability.

## Stage acceptance and work order

| Stage | Actual operator evidence required | Block until |
| --- | --- | --- |
| SUPABASE-DB.2 | direct SQL `pg_is_in_recovery()=false`, disk/WAL headroom, relations/replication inventory | existing disk capacity recovery |
| SUPABASE-MIGRATIONS.3 | remote migration history vs repo; drift, RLS, grants; non-destructive plan | DB.2 |
| SUPABASE-AUTH/API.4 | authorized Auth/PostgREST read probes plus RLS denial tests | DB.2–.3 |
| SUPABASE-EDGE.5 | real memory/Director/SAM/Overage/audit-gateway readbacks | DB/Auth |
| SUPABASE-OIDC.6 | Vercel and GitHub OIDC allow/deny receipts | DB/API |
| SUPABASE-RUNTIME-CONFIG.7 | retired Director/worker bindings inventoried, no leaked tokens | successful authorized reads |
| SUPABASE-STORAGE.8 | buckets and sampled metadata/object checks, not assumptions | restored metadata |
| SUPABASE-CROSS-SYSTEM.9 | Memory, Director, Workstation, SAM, Overage, Spatial, Action ledger and OCE independently healthy | upstream SWLC |
| MONEY-COMMISSION.RESTORE | original Pod+Volume, real backup, offsite encrypted copy, isolated restoration and ledger content proof | original data access |
| MONEY-COMMISSION.FEEDS | real rights-approved canaries for all 4 asset classes | provider entitlements |
| MONEY-COMMISSION.PAPER | authorized existing durable host; 6 forward horizons, reboot readback, 3+ watchdog cycles | restore + feeds |
| MONEY-COMMISSION.FINAL | *external* reviewer evaluates all original receipts, real commission, authority and source lineage | all gates |

**No stage may be marked green merely because its code passes tests.** If the original Pod/volume is lost, mark the original history `UNRECOVERABLE` in the audit and start **separate forward-only** paper learning. Never invent old grades.

## Operator commands once existing SWLC capacity is genuinely recovered

On an authorized machine, after read-only `SUPABASE-DB.2` actually succeeds:

```sh
# Review before running: this SQL contains SELECTs only and never deletes rows.
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/supabase-recovery-readonly.sql
# Export remote migrations with the connected Supabase management UI/CLI,
# and compare non-destructively:
python3 scripts/supabase-migration-reconcile.py --remote-json /private/remote-migrations.json
```

Store genuine external receipts **outside Git** under a private restricted local directory, with `supabase/SUPABASE-DB.2.json` through `supabase/SUPABASE-CROSS-SYSTEM.9.json`, plus `money/restore.json`, `money/feeds.json`, `money/paper.json` and referenced files. Do not commit actual private datasets, keys, OIDC tokens, full DB rows, identifiers that reveal individuals, or backups to GitHub.

```sh
python3 scripts/supabase-money-commission-evidence.py \
  --evidence-root /private/money-commission-evidence \
  --main-head "$(git rev-parse origin/main)" \
  --as-of "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Exit code **2** means blocked. Exit code **0** means all supplied *offline receipt shapes and checked file hashes* are ready for independent review, **never** that a live database, paper job or trading account has been certified.

## Next truly unblockable action

Owner reviews the **existing** Supabase SWLC capacity/plan and explicitly approves any charge if acceptable. Then verify direct SQL. Do not substitute Homebase/GDrive for unreadable original SWLC database. Read-only Shadow Pod/Volume inventory may proceed independently on an existing authorized host without creating new billable compute.

All remaining real-world steps must complete on an authenticated host with original state or genuine third-party services. This source PR is a safety/compliance implementation, not production commissioning.
