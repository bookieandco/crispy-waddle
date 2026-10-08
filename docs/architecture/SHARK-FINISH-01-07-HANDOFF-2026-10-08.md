# SHARK-FINISH.01–.07 canonical execution handoff — 2026-10-08

This continues SHARK/COFFER, SHADOW-REPAIR PR #1149 and SHADOW-GDRIVE PR #1148, not a new trading engine. No real-money mandate, signer, order broadcast, or paid host operation is authorized by this work.

## Source changes
- PR #1149's source-only point-in-time and legacy-grade safeguards remain the canonical Shadow repair. Certification now requires independent per-horizon verified observation/lesson counts and zero lineage mismatches rather than accepting uncorroborated aggregate counts. It requires exact SWLC imported/acknowledged equality with no pending or rejected records.
- PR #1148's restore semantic validator now blocks absent grade-review schema and mismatched observation/sample timestamps. This does not certify a restored original database: source-vs-target row parity, immutable digests, real market outcomes and full ledger recovery still need live receipts.
- This branch introduces a protected POST-only app caller of runMemeAssessmentCycle. It validates source identity, a recent market observation, immutable evidence metadata, bounded input, and scheduler OIDC. It remains disabled without SHARK_MEME_ASSESSMENT_INGRESS_ENABLED=YES and a trusted full-evidence producer. It cannot synthesize unavailable Pump/Meteora/wallet/rug inputs or start a scheduler by itself. The canonical persisted actor-aware service and Money ingress remain unchanged.
- The manual Shadow RunPod commissioning form now defaults to reuse_only, not create_dedicated_cpu_pod. Starting an existing paid Pod or creating any compute must be a deliberate separate operator action.

## Live read-only facts, not inferred health
- Read-only Shadow inventory workflow #37737685405: eight stopped Shadow-named CPU Pods, zero running. Authoritative data-bearing disk / Network Volume / historical database not proven present.
- Supabase connected project's control-plane metadata was ACTIVE_HEALTHY at inspection, **but** list_tables, list_migrations and a read-only SQL query all failed PostgreSQL 57P03 (Hot standby mode is disabled). Thus SWLC is not operational and no migration or import has been executed.
- Google Drive SHADOW-PAPER-TRADING folder and five categories exist; ledger snapshots, market replay, learning memory and health receipts are empty at this audit. Drive connector access is NOT rclone worker OAuth.
- Hermetic source tests are not the same as live data restoration or unattended operation.

## Milestone truth table

| Phase | Current result | Unfinished external evidence |
| --- | --- | --- |
| .01 exact repair PR checks/review | Source CI validated/re-run on exact heads; PRs #1149 and #1148 remain drafts | Final merge after review and verified full CI |
| .02 original stopped Pod resolution | Read-only inventory; no billing/start | Unique historical Pod, durable volume/backup chain and ownership |
| .03 isolated original ledger recovery | Guarded bootstrap and isolated restore tools exist; no original restore claimed | Snapshot before mutation, authentic rows, exact SHA and recovery receipt |
| .04 suspect legacy grade quarantine | Source migrations and independent correction review in #1149 | Live migration on authorized original clone and re-grade receipts |
| .05 semantic restore hardening | Validator/test fixes in #1148 | Real original-source/clone row parity and external restore |
| .06 canonical assessment-to-ingress | Protected POST caller and validation in this branch, disabled by default | Trusted full-evidence producer, storage recovery, authenticated smoke test and scheduled triggering |
| .07 persistent paper worker | Existing RunPod worker, watchdog, cost-safe bootstrap; manual default fixed | Authorized recoverable host, genuinely durable ledger and successive paper/learning/watchdog cycles |

## Recovery / activation order (non-destructive)

1. Record exact PR heads and wait for passing checks. Review/merge source in dependency order, without overwriting any newer main work.
2. Use read-only provider Pod detail, old receipts and Network Volume/Drive inventory to **identify** historical data; do not create empty replacement state as recovery.
3. After explicit approval for any billable start, mount the original data-bearing volume read-only for first snapshot if feasible, then take and hash an independent copy. Restore to a disposable isolated PostgreSQL; preserve original observations.
4. Apply and test non-destructive grade review/correction migration on the clone. Absent matched point-in-time chain/token/pair quotes means UNVERIFIED, not repaired. Keep bad grades out of learning.
5. Establish durable PostgreSQL health and actual migration readback. Back up using Restic encrypted to exact scoped Google Drive folder only from an owner-controlled worker; prove independent byte restore plus semantic/source parity.
6. Only when persisted full source market+actor+liquidity+rug evidence exists, enable the research-only assessment POST producer and verify its app-side SHARK assessment → Money ingress via authenticated receipt. Do not equate the stock SMA paper-autopilot worker to meme-autonomous paper decisions.
7. On an approved *existing* trusted host, prove a real paper decision + NO_TRADE twin, six point-in-time horizons after their actual elapsed windows, measured simulated costs, lessons, safe memory feedback, and three separated watchdog receipts; zero signer/broadcast/live authority.
8. No SHARK-PAPER.FINAL until authenticated operational receipts pass. A source-only passing CI, synthetic test data or a successful HTTP status is insufficient.

## Links
- #1149: https://github.com/bookieandco/crispy-waddle/pull/1149
- #1148: https://github.com/bookieandco/crispy-waddle/pull/1148
- Original RunPod inventory: https://github.com/bookieandco/crispy-waddle/actions/runs/37737685405
- Google Drive archive folder: https://drive.google.com/drive/folders/1DG1p-VXZ5UFViRYsT461O1i5pR6x_EWW
