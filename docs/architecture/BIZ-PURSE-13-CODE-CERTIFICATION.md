# BIZ-PURSE.13 — code certification / release hold

This milestone is the **software preflight**, not commissioning and not approval to merge or deploy a real-money runtime.

## Scope

- Current review branch: `feat/biz-purse-01-12-governed-foundation-20261014`
- Draft PR: https://github.com/bookieandco/crispy-waddle/pull/1275
- Database repair and owner-proof inventory: https://github.com/bookieandco/crispy-waddle/issues/1276
- No Supabase schema mutation, seed funding, payment, business order, phone deployment, live trade, or unattended worker may be inferred from passing CI.

## Required CI on the exact commit

1. `Opportunity Core CI`: Opportunity package type-check and tests, growth bridge, Money outcome truth bridge, Opportunity web boundaries, plus BIZ-PURSE contract regression suite.
2. `Money R13B Certification`: money-core type-check, certification suite and package build.
3. `MONEY-FINISH P0 Contracts`: finance safety regressions.
4. `Jhadina Launch Gate`: workspace install, type-check, lint, test and production build. A merely running job does not pass.

Use GitHub Actions as the authoritative source and record the immutable PR head SHA and check run IDs. `scripts/biz-purse-13-release-audit.mjs` provides a read-only *inventory* of externally supplied run metadata and explicitly never grants authority. A fabricated inventory cannot certify GitHub results, business operations or payment rails.

To test the module:

```bash
node --test scripts/biz-purse-13-release-audit.test.mjs
node --test scripts/biz-purse-*.test.mjs
pnpm --filter @jhadina/opportunity-core type-check
pnpm --filter @jhadina/opportunity-core test
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core test:certification
pnpm --filter @jhadina/jhadina-web exec tsc --noEmit -p tsconfig.opportunity.json
```

## Release-blocking security boundaries

- No direct trade, payout, charge, message send, host deploy or spend path in the new BIZ-PURSE assessor modules.
- A synthetic/test provider receipt must not be promoted to a real settlement. Retry or unknown provider state never becomes success by default.
- Owner/order/payment identifiers must be bound across receipt and delivery. A refund or chargeback after allocation must block reinvestment and be reconciled against prior distributed funds.
- Live SWLC commercial tables were missing at audit; do not run migrations until an independently verified backup and successful isolated restore exist, followed by canonical full-history migration replay and authenticated two-user RLS tests.
- The optional DeerFlow worker is OFF and import-only; no shell admin, Supabase service secrets, funding wallets, broker credentials or live actions.
- Existing full Launch Gate uses broad GitHub `contents: write` permission for its main-branch lockfile synchronization job. Review least-privilege separation separately; do not silently remove the existing main-branch repair behavior in this PR.

## Completion criteria for .13

- New BIZ-PURSE release-check unit tests pass in the repository workflow.
- All four exact-head GitHub workflows pass, or failures are explicitly recorded and fixed.
- Any code-only review conclusions identify open Supabase and external-provider blockers separately.
- Draft status is kept until reviewers confirm safe merge sequencing; do not equate merging with production authorization.

## Pending .14–.22

Milestone .14 is the separately gated isolated Supabase restore and migration-replay harness. The live database should stay unchanged until that stage has backup proof and an approved deployment plan.
