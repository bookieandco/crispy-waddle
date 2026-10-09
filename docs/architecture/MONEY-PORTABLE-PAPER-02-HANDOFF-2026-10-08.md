# MONEY-PORTABLE-PAPER.2 — persistent forward-only research queue

**Date:** 2026-10-08. **Repository:** bookieandco/crispy-waddle. **Defer SWLC:** audit/repair [#1110](https://github.com/bookieandco/crispy-waddle/issues/1110), existing authority never silently replaced. **Money commissioning:** [#1178](https://github.com/bookieandco/crispy-waddle/issues/1178).

## This is real code, but NOT a real commissioned worker

The new `src/money-forward-durable-research-cycles.ts` implements an append-only, checksummed research prediction queue on the caller's host filesystem. It uses local exclusive lock files and fsync, validates immutable prediction timestamps / authority / entry quotes, rejects torn or tampered journal content, and prevents conflicting duplicate registrations. After reboot, a fresh process can reopen the same prediction queue and the existing `MoneyLocalForwardJournal`, regrade the *ungraded* horizons only, and never duplicate historical grades. A crash after a grade write but before a cycle response can be safely replayed.

The grader accepts **only externally supplied** `MoneyForwardQuote` values and independently reviewed read-only provider receipts. It never contacts a market vendor or broker itself. It applies the canonical existing `gradeMoneyForwardHorizon` method and cost/spread rules, checks due times and maximum observation lag, records immature horizons and overdue/unresolved marks separately, and never uses a future quote as historical evidence.

**Important:** evidence IDs and `checkedByIndependentOperator` are *assertions made by the caller*, not proof the real vendor was contacted. An independent licensed source integration and audit must populate and verify these. CI only uses fixtures in an ephemeral runner; it cannot certify the machine's persistence.

No code enables real orders, Phantom signing, broker execution, transfers, Purse withdrawal, staking, funding, or unattended trading. All outputs are `FORWARD_PAPER_RESEARCH_ONLY`, `canExecute:false`, `canAuthorizeLive:false`.

## Post-inventory source truth

The [authenticated RunPod inventory #37885402475](https://github.com/bookieandco/crispy-waddle/actions/runs/37885402475) listed **9 Pods, 8 Shadow/SHARK/Money named candidates, 0 Network Volumes**. That is Pod metadata, not recovered original Shadow data; source disk/backups remain unverified. The sanitized artifact has independent audit ID `11596281327`. No compute was started. Preserve `ORIGINAL_SHADOW_UNVERIFIED`. The NEW_FORWARD_ONLY lineage from merged PR #1180 is a separate research source; never rewrite legacy Shadow outcomes as current.

## Operational steps to finish with existing authorized hardware

1. Supply a non-ephemeral, private host with persistent storage and independent backup/reboot readback. The phone stays controller. Reuse existing Homebase PostgreSQL/portable Memory gateway or owner-approved persistent hardware; **no new paid RunPod/Vercel/Railway compute was created here**.
2. Configure a reachable authenticated private OIDC memory service on that host and an HTTPS front for Vercel; use the existing `JHADINA_MEMORY_STORAGE_PROVIDER=oidc_gateway` selector. Without a real host URL, don't set fake gateway environment variables or bypass `/api/health`.
3. Obtain provider entitlements and authorized bid/ask timestamps for stock/FX/options/metals; stock and FX adapters already exist in the repository. Option/metals availability and licensed vendor terms are **not** proven. Avoid treating metals informational midpoints as executable quotes.
4. An authorized separate caller creates a `MoneyForwardPrediction` using the already tested `makeMoneyForwardPrediction`, then `queue.register(prediction)`. Periodically gather external as-of-verified read-only quotes and call `gradeMoneyForwardResearchCycle` with entitlement review and explicit costs. Journal rows are grades; missing horizons remain pending until genuine price observations arrive. Do not synthesize historical data or mark weekend-market absence as a valid price.
5. Verify independent hashed backups, restart queue and journal, readback integrity, at least 3 real advancing watchdog cycles and actual 15m/1h/4h/24h/3d/7d marks.
6. Require independent paper commissioning review. Existing `MONEY-FINISH.FINAL` specifically requires *original* Shadow history; its state remains `NOT_ISSUED`. Forward-only review needs separate scoped certification and explicit operator-approved deployment of a real scheduler. **This PR does not run a real scheduler**.

## Known real-world blockers

- Existing SWLC database SQLSTATE 57P03, formally **deferred** for audit/repair; does not stop this new separate research implementation.
- Exact Vercel deployment reports READY, but latest production scheduler got `/api/health` HTTP `000` (no readable response), so durable Memory still unverified.
- Original Shadow candidate Pod-local data/backup, and licensed provider entitlements absent.
- No independently proven persistent paper host, after-reboot readback, genuine fresh quotes or multi-day results.
- No owner approval for new billable compute, subscriptions or credential migration.

The next meaningful unblock is a **real host + gateway source check**, followed by live read-only provider integrations. All incomplete checks must stay visibly blocked; pass fixture tests only certify software.
