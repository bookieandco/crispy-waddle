# JH-PURSE-SELF-FUND.RECOVER.01–.03 — 2026-10-21 / 2026-10-22 UTC

**Scope: code and read-only evidence only.** This PR must not apply migrations, move money, register wallets, buy hosting, place trades, produce live provider claims, or merge unreviewed stale branches.

## .01 — canonical reconciliation
- Pinned source baseline: `main` `04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61` (current at branch creation).
- Canonical Money allocation, portfolio, liquidity and Coffer accounting remain the implementation owners, **not** new duplicate engines.
- Selective integrity donor: PR #1162, head `d28406c8d8f8b35fc6ba31c04bd21ce4e9ea46b8`. Original PR diverged from main (16 commits ahead/1153 behind at review). Exact application of donor hunks to seven existing current-main files verified; all except `index.ts` matched donor contents byte-for-byte. `index.ts` preserved newer exports.
- Stacked donor sequence remains independently unmerged: #1162 → #1166 → #1186 → #1188 → #1190 → #1191 → #1192. Preserve source, but do not merge stack without current-head review.
- BIZ-PURSE donor #1275 head `98552112818c92acb23bbee83b8d0b9fe866605b`, 103 changed files, diverged (103 ahead/612 behind at review), draft, nonmergeable. Do not wholesale merge. Its business logic and source-only testing remain for targeted forward-port after schema repair.
- Existing Opportunity/Commerce, SHARK/Money, Shadow and Phantom ownership boundaries are unchanged. Purse is the owner-facing treasury brand, backed by canonical Coffer accounting; SHADOW remains exclusively nonexecuting paper research.

## .02 — P0 integrity selectively forward-ported
- Reject repeated account, position, ledger entry, exposure and opportunity economic IDs.
- Portfolio snapshot digest binds account liquidity/reserves and ledger evidence, not just marks.
- Aggregate per-instrument position exposure across accounts/strategies; enforce position cap for the combined exposure.
- Rebalance binds risk directives to the precise position and tags the account/position on intents; multi-lot ambiguity is rejected.
- Pending withdrawals reduce available withdrawal liquidity; independent reserve and tax holds remain intact.
- New isolated, nonexecuting Coffer/Profit Sweep waterfall and owner-payday proposal with journal balance, owner destination binding, idempotency and approval requirements.
- Existing `purse-rebalancer-final.test.ts` extended with original donor P0 regression fixtures. Core money execution authority is unchanged.

## .03 — live database readback and evidence holds
Live read-only inspection of the connected **Jhadina** Supabase project (October 22, 2026 UTC) established:
- SQL responds; primary PostgreSQL instance is not in recovery and `transaction_read_only=off`.
- The FIVE commercial business tables in `scripts/purse-self-fund-readonly-audit.sql` are absent from `public`. All five require migration collision review and new RLS.
- Existing `money_coffers`, `money_purse_charters`, `money_profit_sweep_policies` exist and have RLS enabled. `money_purse_charters` currently has no `pg_policies` rows and no `anon`/`authenticated` SELECT grant; do not infer user-facing access.
- The inspected ledger has zero recorded Coffers, charters, funding destinations, movement proposals, approved movements, sweep policies, sweep reconciliation rows or runtime execution attempts.
- The single live funding admission is `UNCOMMISSIONED`; both per-transfer and per-day limits are zero.
- Database availability does **not** prove independent recovery, successful RLS tenant isolation, a commissioned payment provider, a genuine settled balance or owner authorization.

Read-only verification:
```bash
psql "$READ_ONLY_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/purse-self-fund-readonly-audit.sql
node --test scripts/purse-self-fund-recovery-gate.test.mjs
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core test:certification
```

Production migration is **blocked** until: (1) owner-approved backup of actual source data, (2) independent isolated restore with readback and manifest checks, (3) migration history collision resolution against current live versions, (4) disposable migration replay, (5) explicit table grants with RLS and two-user unauthorized-access negative tests, (6) reviewed exact-head CI, (7) separate owner production approval.

The read-only JS gate cannot grant migration authority even when all operator-supplied fields say "PASS". Missing external evidence must remain missing, not asserted as completed.

## Handoff / next target
1. Review exact PR branch + CI and independently repeat the eight-table SQL snapshot and migration version list.
2. Restore genuine backup into isolated database. Resolve versions and RLS before drafting a separate approved production migration PR.
3. Then selectively reconcile commercial code from #1275, followed by Stripe TEST checkout/webhook/refund and the first genuine settlement canary.
4. Always keep live funding and wallet signing at zero authority until independent custody/provider commissioning and owner approval.
