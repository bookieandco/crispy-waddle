# MONEY-FINISH.15 → FINAL — release/commissioning evidence and blocked operational certification
Prepared **2026-10-08**. Canonical repo `bookieandco/crispy-waddle`.

## Software chain, merge order and verification
1. `#1170` P0 fail-closed governance/source controls.
2. `#1171` read-only stock/forex/metals/options.
3. `#1173` indicator/FX/option scenario research.
4. `#1174` immutable strategy trial + in-process lockbox/MIMS.
5. `#1175` incubation pause, 15m/1h/4h/24h/3d/7d paper grading, local journal/watchdog.
6. **This PR** adds `money-finish-final-gate.ts` and structural rejection tests. It does not change trading permissions.

Existing root CI `Jhadina Launch Gate` and `SPORT-SIM.2F` failed on *the same* unrelated Staffing Web `request-context.test.ts:47 react/display-name`. A separate minimal `#1176` targets `main` to fix the lint callback before integrating the Money stack. Review exact-head tests, root branch protection and reviews before merging. Merge/rebase dependents **in sequence**, preserving the commits; never squash away the parent lineage and assume the later base follows. Do not bypass branch-protection/review requirements.

## Drive source inventory — independently checked
Drive folder `SHADOW-PAPER-TRADING` currently has five child folders. Inspection of `01-LEDGER-SNAPSHOTS`, `02-MARKET-REPLAY` and `03-LEARNING-MEMORY` returned **empty collections**. `04-HEALTH-RECEIPTS` holds only `SHADOW-GDRIVE-CANARY-SYNTHETIC-2026-10-08` and a companion text canary. Both explicitly state `historical_ledger_recovered=false`, `machine_rclone_oauth_verified=false`, and `encrypted_database_backup_restored=false`.

Relevant connected Drive handoff:
- [SHADOW Repair and Drive Recovery Plan](https://docs.google.com/document/d/1VeivVqUktImMzK5DHPlZlBgC0-foDq7e1Pp7xEj-bgc/edit).
- [SHADOW Migration Audit](https://docs.google.com/document/d/1e0iFyr1I5txwY5t564DLBfykziJEYyoIb9jMBqph1b8/edit).
- [Archive folder](https://drive.google.com/drive/folders/1DG1p-VXZ5UFViRYsT461O1i5pR6x_EWW).

Those sources do not prove original RunPod/Shadow volumes survived. The prior read-only Pod inventory reported **eight stopped Shadow CPU Pods, no running Shadow Pod and no attached Network Volume proved**. Existing previous PRs `#1148` / `#1149` contain recovery code; they do not constitute a restored historical ledger.

## FINAL is an independently verified production sign-off, not a CI job label
`src/money-finish-final-gate.ts`:
- Requires the five dependent PRs merged to exact GitHub `main` HEAD and passing **that same HEAD** root CI receipt.
- Requires provider official/contract entitlement receipts, point-in-time independent read-only sample receipts with verified host and freshness.
- Requires **original** Shadow Pod/volume identity, original backup ID, SHA-256 encrypted backup-to-restored input equivalence, non-empty matching source+restored rows and horizon coverage, independent isolate-restorer evidence (not the same machine actor), semantic restored DB proof.
- Requires independently read-back local **durable** journal (not an ephemeral GitHub fixture), one-to-one hash chain grades, complete six-horizon coverage, three separate watchdog cycles that advance verified journal prefixes, real-license sample origin and no live execution. It refuses future grades, repeated IDs, synthetic canaries and stale manifest.
- Returns `BLOCKED` on deficient structured evidence, or `EXTERNAL_REVIEW_REQUIRED` when the submitted receipt *shape* is complete. It **always** returns `finalCertification: NOT_ISSUED`, `canExecute:false`, `financialAuthority:NONE`. This is deliberate: a self-supplied source-rights string, checksum, CI fixture, or an attested Boolean is not independently observed operational truth.

## Operational blockers that cannot be repaired from source or connected ChatGPT Drive alone
- Actual machine OAuth/RunPod read-only inventory and original ledger restore are unavailable here; no new billable Pod should be silently created. If the old volume is unrecoverable, explicitly mark it lost, preserve the incident and commission a **new** separate forward-only dataset; never mislabel it historical.
- No authenticated provider evidence of paid market-data entitlement, real bid/ask series, options tick and OI; source adapters alone don't grant market-data usage rights.
- Google Drive is offsite encrypted archive only, not a transactional database or permanent GPU worker. An iPhone may be the control screen; long-running work needs an authorized durable host.
- No original historical grades may be backdated or filled from current prices. Genuine 7d outcomes require the actual observation window.
- Never claim verified 3-cycle unattended operation, calibrated model edge or profitability from fixture CI.
- No broker connections, orders, Phantom transfers, bank withdrawals, GPU provisioning or live account risk permissions added.

## Practical commissioning and terminal acceptance
On an already approved Homebase host:
1. Read-only original Pod/volume snapshot inventory; independently identify *original* ledger.
2. Take consistent encrypted Restic/pg_dump backup, copy to private owner Drive with genuine worker OAuth, verify SHA-256, restore in isolated PostgreSQL and compare row counts and semantic relationships.
3. Obtain/verify licensing, connect read-only provider canaries with bid/ask timestamps and source custody.
4. Mount an existing durable local journal, verify reboot/independent readback, encrypted backup+restore, alerts and no-trade pause behavior.
5. Run actual predictions prospectively for six horizons through 7d, verify fills are simulated and costs included; at least three separately dated independent watchdog cycles and MIMS adversarial review. Keep performance separate from data health.
6. Record external independent review sign-off, verify actual `main` CI and issue FINAL *only if all above succeeded*. No code-only path may self-certify.

## CI
`MONEY-FINISH.15 FINAL Evidence Gate` runs strict negative source/restore/watchdog tests and full Money Core regression. GitHub green verifies **software only**, not operational commissioning.
