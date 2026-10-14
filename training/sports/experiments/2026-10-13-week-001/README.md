# Jhadina Sports Lab — Week 001 (Oct 13–20, 2026)

## Current functional scope

This is a **paper-only, research-only** experiment. It does not place bets, execute financial transactions, scrape private accounts, or tune model weights. The nominal **$3,100 bankroll is virtual**, and the actual stake is always **$0**.

- Schedule: `.github/workflows/jhadina-sports-lab-week001.yml` runs twice daily at **02:13 UTC and 14:13 UTC** on October 13–28, 2026 (GitHub schedules can be delayed or skipped); manual dispatch is also available. The retired `jhadina-sports-lab-discovery.yml` workflow is manual-only, not a second recurring worker.
- Host: Standard GitHub-hosted `ubuntu-latest` runner, Node.js 22. Does not require your phone to remain online, Supabase, Railway, or a paid VPS.
- Data: limited requests to an undocumented third-party ESPN site feed, for 11 sport/league combinations spanning NFL, NCAAF, NBA, NHL, MLB, soccer, tennis and UFC. Its reachability is **not a data license or official verification**. It may be blocked, incomplete or changed.
- Source evidence: each observational pre-event forecast embeds past completed-game records, source URLs, source-observation timestamps, a SHA-256 input digest, and a separate SHA-256 forecast receipt. None of these digital hashes independently proves third-party data correctness.
- Baseline: uncalibrated, small-sample, Laplace-smoothed winner probability and score projections. The engine abstains when either team/participant lacks sufficient historical observations.
- Outputs: `training/sports/paper-ledger/week001/forecasts` (immutable forecast receipts); `preliminary` (append-only **unofficial** result comparisons); `runs` (health/coverage reports); `summaries` (per-run immutable, phone-readable Markdown scorecards). GitHub Actions also retains per-run output artifacts for 14 days. The repository is **public**; outputs are visible to others.
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
3. Open the [permanent phone-readable scorecards](https://github.com/bookieandco/crispy-waddle/tree/main/training/sports/paper-ledger/week001/summaries) and choose the highest run-ID Markdown file. Each report shows the prospective forecast count, provisional grades, Brier score only where outcomes exist, and zero-bet controls. Use [Run receipts](https://github.com/bookieandco/crispy-waddle/tree/main/training/sports/paper-ledger/week001/runs) for detailed provider errors, new forecasts, abstentions, and market coverage.
4. Open [Forecast receipts](https://github.com/bookieandco/crispy-waddle/tree/main/training/sports/paper-ledger/week001/forecasts) for immutable predictions; avoid interpreting unofficial data as bookmaker-confirmed odds.

## Remaining external prerequisites for fully certified all-market operation

Obtain permission for the relevant data feeds; use independently verified official fixture, result, and period/player-statistics feeds; obtain licensed and timestamped market odds; record bookmaker settlement-rule variants; run sufficient prospective calibration and out-of-sample tests; verify recurring schedules and first-writer-wins across restarts. **Keep official admission, paid services, and wagering disabled until separately authorized.**

## Verified October 13 project acceptance

- GitHub cloud run [38486807328](https://github.com/bookieandco/crispy-waddle/actions/runs/38486807328) passed every step including 79 Node regression tests, live third-party collection, scoring summary generation, manifest checking, and one atomic batch publication.
- Its permanent [Markdown report](https://github.com/bookieandco/crispy-waddle/blob/main/training/sports/paper-ledger/week001/summaries/38486807328-1.md) counted **89 immutable research forecasts and zero provisional grades** at that time. Later runs can increase those counts.
- The offline [two-run lifecycle test](https://github.com/bookieandco/crispy-waddle/blob/main/training/sports/experiments/2026-10-13-week-001/lifecycle.e2e.test.mjs) proves the grading code can proceed from pregame evidence to a simulated completed result, durable publication, scoreboard scoring and duplicate-safe replay. This synthetic test is **not** proof that a real scheduled prediction has finished and graded.
- A real-world postgame grading receipt is pending until observed events finish and a subsequent scheduled runner captures trustworthy final status. Scheduled clock-triggered execution itself must also be observed; previous acceptance runs were GitHub push-triggered.
- Web route `/sports-lab` compiled in GitHub [web conformance run 38482638167](https://github.com/bookieandco/crispy-waddle/actions/runs/38482638167), but production deployment is **not verified** due Vercel Hobby daily deployment limit. The GitHub Markdown scorecards require neither Vercel nor a paid plan.

## Verified first real result and duplicate-safe grading — October 13 evening

- Research-run [38495831685](https://github.com/bookieandco/crispy-waddle/actions/runs/38495831685) fetched a real third-party final for Orlando Magic vs Cleveland Cavaliers (Orlando 132, Cleveland 116), then published an `eligible_for_training:false` preliminary outcome. Winner prediction was correct; **Brier score 0.47529**, with no real stake. [Read the recorded grade](https://github.com/bookieandco/crispy-waddle/blob/main/training/sports/paper-ledger/week001/preliminary/espn_basketball_nba_401898403_845e76506911_bdb5ec4892a8.json). This is a single game, not proof of edge or calibration.
- Two earlier GitHub runs each wrote a receipt for that **same final score** with different observation timestamps. They remain in the immutable ledger and the scoreboard counts **one unique event**, not two wins.
- New result receipts are named using the forecast and the observed score/outcome, not the timestamp. The Git publisher verifies duplicate-result hashes, preserves the first receipt for the same result and permits a genuinely revised score as a separate correction to be quarantined by the scoreboard until reviewed.
- Tennis and UFC binary winner indicators do not generate fictional point-error statistics. Their score-error aggregates stay null; their preliminary winner probabilities can still be graded.
- GitHub Actions regression run [38496344023](https://github.com/bookieandco/crispy-waddle/actions/runs/38496344023) passed **114/114** tests, covering duplicate grades, first-writer races, conflicting scores, feed failures and match-winner scoring.
- Full live cloud worker [38496417629](https://github.com/bookieandco/crispy-waddle/actions/runs/38496417629) passed 114 tests, fetched 122/122 requested feed snapshots and successfully committed a run receipt and scorecard. Health warnings now surface high unparseable tournament entries from ATP and WTA feeds, without manufacturing missing participants.
- **Still unverified:** an actual scheduled clock-triggered workflow run, official settlement or paid-data rights, the Jhadina web page deployed to Vercel. Use the permanent GitHub summaries on your phone until Vercel's free quota resets. No upgrade or payment has been authorized.
