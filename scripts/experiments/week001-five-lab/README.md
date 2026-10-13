# Jhadina five-lab paper research, 14–20 October 2026

**Authority:** read-only; no trades, wagers, transfers, public social posts, outreach, licensing claims, paid provider subscriptions, production migrations, or changes to the existing app. No credentials are required for the three public research APIs.

## Deployment

Workflow: `.github/workflows/jhadina-five-lab-week001.yml`. In the public `crispy-waddle` repository, GitHub's standard hosted runner is used. Scheduling requires a copy of this workflow on `main`; pull requests by themselves do not run a schedule.

The primary research schedule is **12:37 UTC, October 14–20**, with a strictly outcome-only settlement run at the same UTC time on **October 21** (05:37 PDT). It is not a guaranteed wall-clock start time. Date checks in `runner.py` permit those seven UTC dates, a clearly flagged **October 13 preflight**, or the **October 21 settlement**. No new forecasts can be issued on settlement day. The cron is month/day limited but has no year field; if retained for future Octobers, the runtime guard skips them. Disable/remove the workflow after the trial.

On a successful merge, a `push` trigger produces a **preflight** run before the trial; on trial days the schedule executes the actual run. On October 21, the same scheduled collector resolves October 20's forecasts without issuing new forecasts. GitHub Actions `workflow_dispatch` is available with default `dry_run: true` (package commands are NOT executed); use `dry_run: false` to execute on an allowed day. A preflight never counts as a scored learning case.

## What runs

Each daily job runs guardrail unit tests, installs the frozen pnpm workspace dependencies and executes the following existing, read-only local certification commands. Each command has a 240-second cap and creates a local log. An exit code, elapsed time and SHA-256 of the log are recorded.

* Capital: two Money Core forward-only research and grading tests.
* Social + Music: the Social Core and Music Core test suites.
* Business: the Opportunity Core public-source runtime test.
* TV + Music Discovery: TV Core and Music Core test suites.
* Game Core: Gaming Core certify (type-check and tests).

A command PASS is a **software test result**, not proof of a real-world investment, commercial sale, social engagement outcome, public-TV playback, or a functioning iPhone audio device.

## Real read-only research sources

`research.py` probes five narrow, allowlisted public requests with a 12-second timeout and 512 KiB response cap:

* Coinbase Exchange BTC-USD ticker: a real observed market price and provider timestamp, NOT a licensed comprehensive trading feed.
* Apple iTunes Search API hip-hop music query: public **catalog** observations, NOT engagement rates or artist-owned analytics.
* Grants.gov `search2`, posted opportunities mentioning business: public grant **search** counts, NOT contractor leads or a monetized business opportunity.
* Apple iTunes TV-show catalog query and separate jazz music query: public **metadata**, NOT a license to stream, cast, or redistribute TV content.

Each receipt contains provider identity, request URL/method, SHA-256 of raw response, parsed metric or error type; no raw media or copyrighted works are downloaded. Missing/invalid provider responses remain UNAVAILABLE, never imputed. No endpoint with trade, posting, account, or payment authority is used.

## Forward learning

The run writes a SHA-256-sealed `evidence.json` with per-lab tests, feed receipts and baseline forecasts. At the next run it tries to retrieve the most recent evidence artifact from completed main-branch workflow runs using a **read-only GitHub token**. It only accepts the previous UTC date and independently recomputes the prior record's hash. Prior dry runs and preflights never receive a performance grade.

For BTC it measures the absolute percentage error of the previous observed quote as a naive one-day forecast. For catalog/Grants search counts it measures the absolute count error. These are **weak, explicit baselines**, not profitable trading strategies, quality scores or causal conclusions. Actual grading starts from the second daily scheduled run, subject to source availability and artifact retrieval. October 21's settlement run is required to score October 20's one-day-ahead cases; without it, seven observation days only give six possible one-day outcomes. Source response hashes permit tamper detection but not full response reconstruction because raw responses are intentionally not persisted.

## Evidence and failure handling

Artifacts are named `five-lab-week001-<run-id>` and retained 14 days. Every source failure is visible in `evidence.json`. Any failed package test returns a nonzero workflow result but still uploads the evidence artifact via `if: always()`. The previous-run lookup is best effort; missing evidence yields no scored outcomes rather than invented ones.

**Known gaps:** GitHub Actions artifacts are not synced to Google Drive; 14-day retention is not durable long-term archival. This lab does not perform social-account analytics, commercial lead outreach, verified licensed TV playback, Safari/iPhone audio tests, a trading simulator with executions, or hands-off model retraining. Those require separate governed integrations and genuine measurements. This deployment is a bounded, read-only evidence/prediction-baseline pilot.

## Seven-day final evidence report

`.github/workflows/jhadina-five-lab-week001-final.yml` runs verification tests on PR/push, and schedules **October 21 at 16:17 UTC (09:17 PDT)** as a final assembly run after settlement. It gathers only scheduled main-branch daily artifacts, verifies SHA-256 record/prediction/grade seals, confirms each day's predecessor hash, reconciles recorded outcomes to their earlier forecasts and contemporary source receipts, and publishes `final-report.json` plus a readable `final-report.md`. Incomplete days, forged data, broken links, or unexpected new October 21 predictions yield **INCOMPLETE_OR_UNVERIFIED**, never a counterfeit full PASS. The finalizer cannot train weights, trade, publish, spend, or promote models.

The experiment is functional as **a read-only, forward-scored public-data research pilot**, not as commissioned social account management, investment execution, business lead brokerage, licensed media playback, or physical iPhone testing. Optional Google Drive archival is not connected automatically; use the GitHub Actions artifacts for no-credential retrieval during the 14-day daily retention window.
