# Jhadina five-lab paper research, 14–20 October 2026

**Authority:** read-only; no trades, wagers, transfers, public social posts, outreach, licensing claims, paid provider subscriptions, production migrations, or changes to the existing app. No credentials are required for the three public research APIs.

## Deployment

Workflow: `.github/workflows/jhadina-five-lab-week001.yml`. In the public `crispy-waddle` repository, GitHub's standard hosted runner is used. Scheduling requires a copy of this workflow on `main`; pull requests by themselves do not run a schedule.

The primary research schedule is **12:37 UTC, October 14–20**, with a strictly outcome-only settlement run at the same UTC time on **October 21** (05:37 PDT). It is not a guaranteed wall-clock start time. Date checks in `runner.py` permit those seven UTC dates, a clearly flagged **October 13 preflight**, or the **October 21 settlement**. No new forecasts can be issued on settlement day. The cron is month/day limited but has no year field; if retained for future Octobers, the runtime guard skips them. Disable/remove the workflow after the trial.

On a successful merge, every `push` and `pull_request` trigger produces a **preflight** run, even during the trial (including when UTC has advanced to the next study day). Only the `schedule` event may issue counted daily research cases; the runner independently forces `push`, `pull_request` and `workflow_dispatch` into preflight. The October 14 post-merge code-push run initially triggered a false day-two alert when UTC crossed midnight; the trigger separation fixes this without rewriting the valid October 14 scheduled artifact. On October 21, the same scheduled collector resolves October 20's forecasts without issuing new forecasts. GitHub Actions `workflow_dispatch` is available with default `dry_run: true` (package commands are NOT executed); use `dry_run: false` for a read-only **preflight** execution of the test suite, never for an additional counted observation. A preflight never counts as a scored learning case.

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

## Source-specific, noncommercial evidence (week001 improvement)

`domain_evidence.py` extracts **bounded public metadata only**, as a separate research section in each source receipt:

* Coinbase bid/ask spread in basis points, plus conservative immediate round-trip spread cost. **Not a trade or profit estimate**; quote information may be absent.
* Apple Search API: up to 10 unique public catalog identities, sanitized titles/artist/genres, a simple term/genre match count, and whether a link belongs to an official Apple catalog domain. **No streaming license, listening behavior or recommendation outcome is implied.**
* Grants.gov: up to 10 public opportunity numbers with limited title/agency/deadline text. **Not an eligibility assessment, qualified lead, or promise of grant funding.**

From October 15 forward, `domain_changes` optionally compares distinct public catalog/opportunity identities between consecutive verified days, recording an observed sample overlap (Jaccard). It is evidence about *search result stability*, never proof of social reach or sales. The finalizer recomputes the overlap from the paired sealed feed receipts, and flags any mismatch.

All previously scheduled sealed forecast counts and October 14 evidence remain unchanged. No additional API calls, authentication, orders, posts, payments or media downloads are introduced.

## Five domain-specific lab models and browser certification

`five_lab_models.py` generates five separate research artifacts per actual run; they are stored within the **same hash-sealed evidence.json** with original source receipts and exact observation cutoff. The finalizer independently recomputes the models from source receipts and prior sealed records before accepting a week's results.

- **Capital:** $1,000 isolated virtual research equity; max $100 paper-only one-day long BTC observation; model fills at the contemporaneous ask and subsequent day's bid, with **10 bps simulated fee and 5 bps simulated slippage on each side**. If any timestamp or bid/ask receipt is invalid, no entry or exit is fabricated. Tracks recorded paper P&L, equity, peak, drawdown and unannualized Sharpe-like score after 2+ observations. *No real-money orders, derivatives or trading SDK; paper fill assumptions do not imply executable quotations.*
- **Social + Music:** deterministic, explicitly synthetic three-variant release experiment across titles, hooks, short visualizers, lyric clips and behind-the-scenes content. Has fixed virtual impressions and a synthetic CTR outcome. **No account data, actual views or publishing.** This is a scenario model, not a claim of audience response.
- **Business:** ranks individual Grants.gov sample numbers from source receipts using a published relevance keyword rule and listed close dates. Funding value is `null` until explicitly sourced; applicant eligibility is **NOT_VERIFIED**. No applications, outreach or lead sales.
- **TV + Music:** bounded Apple public catalog ranking, deduplication, query-title/genre match and time since source retrieval, with official Apple catalog link metadata. **Catalog links are not streaming licenses or playable-source authorization**; authorized playable source count remains zero without rights receipts.
- **Game QA:** `browser_qa.html` runs in **real headless Chromium on GitHub Actions** through `browser_qa.py` and exercises a muted Web Audio graph, keyboard/gamepad-style map, synthetic pointer down/up/cancel, tap-spin behavior and responsive touch-target/screen geometry. It is a test fixture, not a ROM; **no test can certify real iPhone Safari audio, Bluetooth, game performance, touchscreen hardware or device sound output**. Missing Chrome or failed browser checks must be reported as unverified/failure, not silently considered passed.

GitHub Actions runs the browser QA alongside existing Gaming Core type checks/Vitest before sealing the daily receipt. All costs are confined to public-repo GitHub-hosted CI with no new paid provider. The previous six daily sealed baseline forecast cases, October 14 original evidence and October 21 final settlement are unchanged.

## Supplemental verified grant values and gamepad controls

Grants.gov's documented, unauthenticated **`fetchOpportunity`** endpoint can provide `synopsis.awardCeiling`, `awardFloor`, and `applicantTypes` for opportunities discovered by official `search2`. This update retrieves **at most 3 details per five-lab run**, with a hard-coded official endpoint, numeric ID gate, timeout and 256 KiB response cap. Details are best-effort; provider errors leave the value **unknown**. Rank features include relevance, listed deadline and **only verified official ceilings**, which are NOT expected revenue, grants won, or proof the owner is eligible. The original search2 response still controls candidate identity and ordering.

The headless Chromium synthetic input fixture now also checks canonical standard controller button A/B and positive vertical axis mappings, making **nine browser contract checks**. This remains synthetic gamepad/input evidence, not certification of a paired Bluetooth controller or the owner's iPhone.
