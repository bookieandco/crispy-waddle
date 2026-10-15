# WATCHKEEPER.09–.10 — Research readiness and honest end-of-window audit

**Prepared October 14, 2026, America/Los_Angeles.**
Applies to Jhadina SHARK paper-only October 13–20 research experiment.

## .09 — bounded restart-safe local checkpoints

- \`ops/meme/watchkeeper_checkpoint.py\` validates the full experiment
  ledger hash chain before accepting a snapshot (not just the last event).
- It stores a complete **byte-identical** source snapshot using SHA-256
  content addressing and logs checkpoint receipts in a POSIX flock-locked,
  fsync'ed, strictly append-only local journal.
- Repeating the exact same run/receipt is an idempotent no-op; stale
  conflicting run IDs, replayed source heads, regressions, fake positive
  certification, corrupt snapshots, broken chain links and symlinks fail.
- Stale (>2 hour gap) observation snapshots record
  schedulerFreshEnough=false; they do **not** claim all schedule slots ran.
  Source expiration still requires audit; a valid old snapshot cannot
  imply a current market price or fill.
- \`verify\` reconstructs every archived snapshot and journal hash chain,
  not just the latest JSON filename. Local readback does NOT prove
  cloud-host independence, independent wall clock, a confidential
  encrypted backup or a complete PostgreSQL restore.
- This archive CLI is deliberately **not added** to the active
  GitHub Actions 30-minute observation workflow in this PR.
  A separate storage size/backpressure test, duplicate-run alerting,
  least-privileged archive host and independent readback test must
  precede enabling storage writes in the live research workflow.
  This avoids unexpected GitHub storage costs or disruption to the
  ongoing seven-day study.

## .10 — provisional until Oct 20, with final research gate

- \`ops/meme/watchkeeper_evaluation.py\` consumes the original state,
  rejects forged or corrupted event chains and any purported executable
  order events, and counts true observed market cycles, first-24h marks,
  censored decisions, missing outcomes, partial read-only pools,
  indicative buy/reverse routes and negative risk lookouts.
- The cut-off is **2026-10-20T22:50:00Z**. A final output is
  impossible before cutoff, even with a fake/early END event.
  At or after cutoff, the ledger must actually be COMPLETED and contain
  one valid, non-future END receipt at/after cutoff. Existing
  final_evaluation.py is cross-checked.
- Before maturity the status is
  PROVISIONAL_MISSING_OR_IMMATURE_EVIDENCE. After a genuine completed
  END, it is FINAL_RESEARCH_NOT_EXECUTION_CERTIFIED.
  These labels do not claim a winner, realized P&L or sellability.
- Explicit nulls remain for net return, Sharpe, drawdown, independently
  confirmed rugs, false-positive rates, independent exit feasibility,
  and certified strategy edge. No reinterpreting spot-only grades
  or counterfactual paper scenarios as financial returns.
- Optional .09 LOCAL_SNAPSHOT_MATCHES_CURRENT_HEAD asserts only a
  local byte-identical source copy. External independent archival,
  Supabase backups/recovery, owner signature and live readiness remain
  **unverified**. Results can never authorize strategy changes.

## Offline commands

    python -m unittest discover -s ops/meme -p 'test_*.py' -v
    python -m compileall -q ops/meme
    python ops/meme/watchkeeper_checkpoint.py --archive-dir /private/shark-archive append --state /private/state.json --run-id sample-run-001 --at 2026-10-15T05:00:00Z
    python ops/meme/watchkeeper_checkpoint.py --archive-dir /private/shark-archive verify
    python ops/meme/watchkeeper_evaluation.py --state /private/state.json --asof 2026-10-15T05:00:00Z --out /private/readiness.md

Do not overwrite prior output; choose a different output path.
The active schedule already runs the original seven-day research observer
approximately every 30 minutes when GitHub scheduling permits.
No new scheduled jobs or paid external infrastructure were authorized.

**Commissioning blockers:** independent encrypted backup and restoration of
Swlc Supabase (#1110, #1257), server/worker uptime and persistent archive
boundaries, real point-in-time DEX fee and reverse-route attestations,
verified sellability and actual on-chain independent trading evidence.
No real wallet funding or live trading permitted.
