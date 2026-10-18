# JH-ZERO-RIG.05 → .08 — bounded implementation handoff

Stacked after **PR #1375** (`feat/jh-zero-rig-01-04`). Do NOT merge this branch directly into `main` before #1375 has landed or its code has been selectively reconciled.

## .05 — Sandbox-only paid intelligence service model
`packages/opportunity-core/src/domain/zero-rig-service-sandbox.ts` computes hypothetical USD-cent margins, variable/fixed costs, daily rate cap and break-even calls, with pricing freshness and evidence plus rights/privacy gates. No HTTP paid API, x402 settlement, token valuation, wallet, customer invoices, credential or payment collection has been implemented. No market demand or revenue is claimed.

## .06 — Canonical governance referral
`zero-rig-governance.ts` returns deny-by-default action referrals to the already existing OpportunityActionIntent -> Policy -> Approval -> Action Core path. Local paper research is distinguishable from registration, submission, accepting funds, bandwidth activation, mining, wallet transfers or purchased compute. The referral is *not* an alternative action authority and never grants permissions. Owner consent and evidence-complete pursuit are necessary but not sufficient; runtime commissioning is separate.

## .07 — Mobile read-only projection
`zero-rig-dashboard.ts` accepts canonical `OpportunityOutcome` observations and admits only traceable Money-Core-owned wins with transaction and source evidence. Duplicates and user-asserted payout claims are excluded. Amounts stay grouped in original currencies, with canonical net revenue (gross minus refunds) distinguished from canonical profit (after direct costs and fees); **never sum USD with USDC or other tokens**. Paper estimates and pending points do not count toward realized receipts.

`apps/jhadina-web/src/app/opportunity/zero-rig/page.tsx` mounts a responsive view linked from the existing Opportunity hub. It is intentionally disconnected and clearly labeled; zero loaded receipts does not imply that the user's real wallet has no assets. There is no client write route or unverified financial disclosure.

## .08 — Seven-day paper experiment evaluator
`zero-rig-paper-pilot.ts` requires 7 distinct UTC dates, validated numerical paper observations and evidence references. Empty or partial runs remain planned/incomplete. A complete offline fixture can be evaluated by tests; it is NOT a seven-day real-world trial. Actual revenue is always null, and no cron, scheduled API, provider calls or persistence writes exist.

## Verification and commissioning gates
- `pnpm --filter @jhadina/opportunity-core type-check`
- `pnpm --filter @jhadina/opportunity-core test`
- `pnpm --filter @jhadina/jhadina-web type-check`
- `pnpm --filter @jhadina/jhadina-web build`
- No code path can submit bounties, claim tokens, publish paid APIs or spend/transfer funds.
- Follow-up commissioning needs official API details, owner eligibility, approved service account, privacy and data-rights review, rate-limited transport, authenticated storage and a real iPhone acceptance run, followed by actual Money Core reconciliation.

## Not done / not claimed
No actual earned crypto, no active agent account, no deployed payment endpoint, no seven days elapsed, no external write actions, no irreversible automation. The PR is source-only until exact-head CI and post-merge acceptance are verified.
