# MONEY-PORTABLE.3 → .6 — evidence backed research, Supabase deferred

This work builds on merged PRs #1180, #1182, #1183 in `bookieandco/crispy-waddle`.
Keep SWLC Supabase incident [#1110](https://github.com/bookieandco/crispy-waddle/issues/1110) OPEN and marked AUDIT/REPAIR; it is not restored, and this separate forward-only lane does not migrate, delete or relabel old database rows.

## .3 — Existing durable host evidence

`scripts/money-portable-host-durable-check.py` requires an **existing operator-authorized dedicated Linux mount**, private root directory and free-space minimum; refuses temporary or virtual process storage. Run on the actual host, not a phone or GitHub runner. On an authorized host, first issue an immutable 0600 canary with host boot ID and fsync; after an actual host reboot run the readback verification. A same-boot check, missing file, changed expected commit, symlink, absent mount or corrupt receipt fails. The best software state is **INDEPENDENT_HOST_REVIEW_REQUIRED**, not live infrastructure certification. Operator must separately verify immutable physical host / power / backups and signed receipt. Only existing compute is supported; no billable Pod/provisioning in this PR.

Run `python3 scripts/money-portable-host-durable-check.py initialize --root /YOUR-EXISTING-DEDICATED-MOUNT --head "$(git rev-parse origin/main)"`, reboot the machine under authorized operator control, then `python3 scripts/money-portable-host-durable-check.py verify-after-reboot --root /YOUR-EXISTING-DEDICATED-MOUNT --head "$(git rev-parse origin/main)"`. The challenge file intentionally persists. No reboot is initiated by code.

## .4 — Four asset-class real-source ingress

`money-portable-readonly-quote-ingress.ts` adds converters for canonical two-sided `StockQuote`, direct `FxQuote`, `MetalQuote` (real two-sided only), and `OptionChainRow`. It rejects derived FX crosses and missing options contracts. An admitting operator must independently verify provider source response SHA-256, rights for research, **retention and forward-paper use**, source request reference, expiry, observed/available/received ordering and freshness; options need adjusted contract + settlement receipts; FX needs market session verification; metals require units review. Synthetic, unknown, unavailable, crossed/one-sided, stale, unentitled and future quotes fail closed.

`MoneyPortableQuoteJournal` writes append-only hash-linked research quote envelopes with fsync, exclusive lock, independent reopen readback and idempotent duplicates; evidence IDs/rights booleans remain *caller claims*, NOT proof of actual vendor permission. Do not commit quote records or API keys to GitHub. Secrets remain on an authorized host. Existing Alpaca stock adapter can GET stock snapshots and returns two-sided `StockQuote`. Finnhub candle adapter is **not a direct bid/ask FX source**; do not transform last-traded prices into fake FX spreads. Options/metals feed adapters remain external entitlement/review blockers if not actually connected.

## .5 — Forward-paper cycle wiring

`runMoneyReadOnlyQuoteCycle` reopens quote journal, requires nonexpired rights, and calls existing `gradeMoneyForwardResearchCycle` against the separate durable prediction and grade journals. Already-graded horizons are replay-safe; unsettled horizons remain pending/overdue. Uses bid/ask crossing and explicit costs, no future marks, no trading broker or order endpoint. Must run only on existing approved host, with a separately controlled scheduler and real quote ingestion; **this PR does not start an unattended worker or connect an external licensed quote account**. The local journal is single-host and needs independent backup/restart review.

## .6 — Independent operational evidence

`reviewMoneyPortableIndependentEvidence` combines host boot canary and backup readback, exact production SHA/private durable Memory gateway, licensed feeds for STOCK/FOREX/OPTIONS/METALS, ≥6 genuine quote samples, complete 15m/1h/4h/24h/3d/7d grades and ≥3 ascending independent watchdog cycles. It can only report BLOCKED or INDEPENDENT_OPERATIONAL_REVIEW_REQUIRED. Even if all caller-supplied records pass structural validation, FINAL remains NOT_ISSUED and both canExecute/canAuthorizeLive stay false. Independent human/host verification is required before a separately scoped paper-only deployment sign-off.

## Independently checked external blockers as of prior handoff

- SWLC: existing database SQLSTATE 57P03, audit/repair deferred.
- RunPod: [inventory](https://github.com/bookieandco/crispy-waddle/actions/runs/37885402475) listed 9 Pods, eight named Shadow/SHARK candidates and zero Network Volumes. Original ledger backup/restoration **not** verified.
- Vercel: READY does not prove real health. Last observed production scheduler got HTTP 500/000 and refused workers; verified portable OIDC Memory gateway on a persistent host is still absent from operational evidence.
- Stock/FX/options/metals: source adapters and data contracts available, **real licensed account permissions and proper sample receipts not independently proven**.
- Real 7d outcome and three multi-cycle records cannot be established from fixture tests.

## Completion criterion

Source complete when branch TypeScript, focused negative tests, full Money Core regressions, and Python host tests pass on exact head. Operational MONEY-PORTABLE.FINAL *requires different evidence*: a physical durable host plus independent post-reboot readback, a Vercel production health 200 with correct SHA and durable Memory, actual provider licenses with two-sided quotes, genuine prospective outcomes, three real independent cycles, backing up/restoring quote and grade stores, operator sign-off. No live execution under any circumstance via this research lane.

Never label this PR's CI as an original Shadow recovery, SWLC restoration, or new paper system being live.
