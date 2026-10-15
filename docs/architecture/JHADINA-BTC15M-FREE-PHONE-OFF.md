# Jhadina BTC 15m — free phone-off fallback (GitHub Actions)

This is the alternative for the owner's iPhone, where tapping into the
Google Apps Script `Code.gs` editor never opens the keyboard.

## Admission / activation
- This branch is an **inactive draft PR**. A GitHub `schedule` only runs from the
  repository's **default branch** after merging/activation; creating this PR
  does **not** start forecasts.
- The `crispy-waddle` repository is **PUBLIC**. Standard GitHub-hosted runners
  are free for public repositories (larger runners are not). Artifacts from
  these runs may be accessible by anyone. **Get owner approval for public
  prediction records before merging.**
- Once admitted, GitHub's schedule runs **no more frequently than every
  five minutes**, on a best-effort basis. Jobs may run late or be skipped.
  This is **not** a continuous WebSocket feed or a seconds-latency alert.
- No server hosting purchase, Railway, Oracle, Google Workspace payment,
  custom-domain subscription or iPhone-foreground process is needed.

## Current implementation
- `paper-observe.mjs` sends **public GET only** to Kalshi's official
  `/markets?series_ticker=KXBTC15M&status=open` listing.
- Records provider-verified tradeable market ticker (NOT the event ID),
  source, UTC timestamp taken **after** HTTP completion, target, closing
  time and yes/no bid quote proxy. Requires at least 120 seconds before
  close to avoid post-hoc calls. Ambiguous/unavailable source produces
  ABSTAIN or NOT_OBSERVED, never an invented call.
- The `UP/DOWN` direction is **venue quote baseline only**, not an
  independent AI prediction, a proven probability or a tradable edge.
- Does **not** fetch or infer BRTI settlement, place orders, hold keys,
  move funds or claim official wins.
- Every five-minute job produces an individual JSON artifact on GitHub
  Actions, retained for **7 days** (a temporary evidence buffer).
  Artifacts are **not** automatically added to Google Drive.
- Tests verify no late backfill, issuer market contract, absent quote
  abstentions, bounded pagination and source-failure evidence.
- GitHub code and runs do not require Google or Kalshi secrets.

## After explicit approval
1. GitHub checks must pass on the draft PR.
2. Agree whether public artifact storage is acceptable. If not, migrate
   the paper-study workflow to an appropriately private repository with
   sufficient included GitHub Actions usage, or arrange access-controlled
   data storage before activating.
3. Review and merge the PR to `main`. Only the default branch can trigger
   `on: schedule`.
4. Watch **Actions → Jhadina BTC15m Free Paper Observations** for real
   `schedule` and `workflow_dispatch` runs. Examine one JSON artifact.
5. To keep the study longer than 7 days or sync to the existing owner
   [Google Sheet](https://docs.google.com/spreadsheets/d/1l-heS5CLxx-TyucPa6jQNIZt06axoWiqBB73M5utdPo/edit),
   authorize a **separate restricted** Google Sheets writer. The current
   ChatGPT Google Drive connector is not background GitHub OAuth.
6. Add independent market-grade verification and official settlement
   grading only after real prospective baseline events are captured.
7. For true low-latency monitoring, use the separately uncommissioned
   persistent .02–.05 WebSocket worker, not five-minute GitHub cron.

## No-financial-authority
PAPER_ONLY, `canSubmitOrders:false` and no trade entry paths.
No new charges authorized and no 24/7 reliability claim.

Tracking: https://github.com/bookieandco/crispy-waddle/issues/1241
