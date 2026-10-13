# Jhadina Sports Lab — Week 001 (Oct 13–20, 2026)

## Current functional scope

This is a **paper-only, research-only** experiment. It does not place bets, execute financial transactions, scrape private accounts, or tune model weights. The nominal **$3,100 bankroll is virtual**, and the actual stake is always **$0**.

- Schedule: `.github/workflows/jhadina-sports-lab-week001.yml` runs twice daily at **02:13 UTC and 14:13 UTC** on October 13–28, 2026 (GitHub schedules can be delayed or skipped); manual dispatch is also available. The retired `jhadina-sports-lab-discovery.yml` workflow is manual-only, not a second recurring worker.
- Host: Standard GitHub-hosted `ubuntu-latest` runner, Node.js 22. Does not require your phone to remain online, Supabase, Railway, or a paid VPS.
- Data: limited requests to an undocumented third-party ESPN site feed, for 11 sport/league combinations spanning NFL, NCAAF, NBA, NHL, MLB, soccer, tennis and UFC. Its reachability is **not a data license or official verification**. It may be blocked, incomplete or changed.
- Source evidence: each observational pre-event forecast embeds past completed-game records, source URLs, source-observation timestamps, a SHA-256 input digest, and a separate SHA-256 forecast receipt. None of these digital hashes independently proves third-party data correctness.
- Baseline: uncalibrated, small-sample, Laplace-smoothed winner probability and score projections. The engine abstains when either team/participant lacks sufficient historical observations.
- Outputs: `training/sports/paper-ledger/week001/forecasts` (immutable forecast receipts); `preliminary` (append-only **unofficial** result comparisons); `runs` (health/coverage reports). GitHub Actions also retains per-run output artifacts for 14 days. The repository is **public**; outputs are visible to others.
- Durability: `publish-batch.mjs` commits a batch with Git Trees, with `force:false` and at most 3 race-safe retries. It refuses to modify an existing receipt whose bytes differ. Normal runs use a single Git commit, avoiding per-forecast Vercel/CI build storms. Workflow `GITHUB_TOKEN` requires `contents:write`; no personal token, paid host, or Supabase is required.
- Verification: `node --test training/sports/experiments/2026-10-13-week-001/*.test.mjs` and `publish-check.mjs` run before publication. GitHub run `38482383190` passed 70 regression tests and published 9 forecasts atomically; subsequent run `38482074623` passed 63 tests with one batch commit. Later run counts may differ as additional tests and forecasts are appended. `scoreboard.mjs` emits a phone-readable Actions summary and the JSON/Markdown artifacts on each run. Results are provisional until real end-of-game observations exist. The web UI at `/sports-lab` compiled successfully in GitHub Actions run `38482638167`, but production deployment was not independently verified.

## Market coverage

| Requested market | Status |
|---|---|
| Winner | Preliminary uncalibrated probability; no verified bookmaker quote |
| Spread | Score-margin estimate; **no verified line** |
| Game total | Total-score estimate; **no verified line** |
| Player props | Blocked pending sourced player statistics and quote permissions |
| Period props | Blocked pending period-level official stats and verified quotes |
| Touchdowns / scorers | Blocked pending individual scorer evidence and verified quotes |

`markets.mjs` enforces all six market names, quote timestamps, required player/period/scorer identifiers, provider identity, and affirmative rights evidence. **No real quote provider is connected.** It does not manufacture a market quote or approve a wager.

## Trust and admission boundaries

- A third-party score marked final is **not** official settlement evidence. Preliminary grades remain `PRELIMINARY_UNOFFICIAL_NOT_SETTLED` and `eligible_for_training:false`.
- An unofficial research forecast is not a certified winning probability or bookmaker edge. No calibration or holdout evaluation is claimed.
- Original October 12 NFL case files remain unchanged; Week 001 has a separate ledger.
- The GitHub runner can stop or be delayed; check Actions failures and `runs` receipts. Actions schedules are not guaranteed to execute exactly on the minute.
- Scheduled workers stop collecting after October 28, 2026, by their program cutoff. Remove the scheduled workflow or disable Actions afterward if you no longer need execution.
- No payout tracking, trading integration, sportsbooks, or bank credentials exist in this pipeline.

## Owner's iPhone checks

1. Open [Jhadina Sports Lab GitHub Actions](https://github.com/bookieandco/crispy-waddle/actions/workflows/jhadina-sports-lab-week001.yml).
2. A successful run should show passing tests, successful collection, publication validation, and append-only ledger publication.
3. Open [Run receipts](https://github.com/bookieandco/crispy-waddle/tree/main/training/sports/paper-ledger/week001/runs) to see provider errors, new forecasts, preliminary grades, abstentions, and market-coverage gaps.
4. Open [Forecast receipts](https://github.com/bookieandco/crispy-waddle/tree/main/training/sports/paper-ledger/week001/forecasts) for immutable predictions; avoid interpreting unofficial data as bookmaker-confirmed odds.

## Remaining external prerequisites for fully certified all-market operation

Obtain permission for the relevant data feeds; use independently verified official fixture, result, and period/player-statistics feeds; obtain licensed and timestamped market odds; record bookmaker settlement-rule variants; run sufficient prospective calibration and out-of-sample tests; verify recurring schedules and first-writer-wins across restarts. **Keep official admission, paid services, and wagering disabled until separately authorized.**
