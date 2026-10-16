# MEME-VENTURE — transparent profit-taking (paper study only)

This is the proposed answer to the owner's request: "I don't want to rug pull, but I want her to consistently take profits."

**The system must pursue a repeatable PROCESS, not promise repeatable profits.**
No crypto strategy guarantees profits, and the price impact of real markets could be worse than hypothetical quotes.

## Distinct income streams

- **Service business**: Original meme branding/metadata/education creates ordinary service income only after actual paid orders; the current $49/$149 quotes are unvalidated demand hypotheses. Record customer payments through existing Commerce/Money Core and deduct verified costs.
- **Creator treasury**: Hypothetical sale of already-disclosed, vested creator tokens. This is different from removing pooled liquidity. In production, public advance disclosure, vesting, treasury ownership, legal review, and canonical Action + Money approval would be mandatory. Those are NOT implemented by this paper helper.
- **AMM fee income**: The MEME-VENTURE simulator retains trading fees in the hypothetical pool. It does NOT treat AMM fees as Jhadina's revenue or let her withdraw reserves.

## Paper-only policy constraints

A pure function simulateDisclosedTreasuryProfitTaking in packages/opportunity-core/src/domain/meme-profit-policy.ts simulates at most seven predeclared treasury sales within 30 days. Each sale must occur on a distinct day. Illustrative default refusal limits:

1. Sale ≤0.25% of total token supply per tranche.
2. Total sales ≤5% of the declared creator allocation.
3. Estimated *instantaneous* AMM spot-price impact ≤150 basis points per tranche.
4. Require advance public schedule disclosure and explicit bans on artificial volume and withdrawing liquidity.
5. Account for assumed network costs, token cost basis, business overhead and a separately shown hypothetical tax reserve.
6. Block when costs consume the proposed proceeds, caps are exceeded, or plans lack owner research consent.

The limits are conservative study assumptions, **not** proof of fair execution, legal compliance, safe liquidity, real profitability, or authorization to operate a token.

Result includes simulated receipts, remaining treasury inventory, gross/net proceeds, and a profit/loss estimate. It never emits orders, signatures, RPCs, payments, approvals or real P&L actuals; every resulting authority flag is false.

## Follow-up after paper study

- Validate true seller inventory, vesting and disclosed treasury policies independently.
- Use authorized market data and an immutable pre-execution simulation receipt only; account for gaps, MEV, slippage, failed sells and taxes.
- Obtain expert legal review and user-approved limits before enabling *any* live token sales; preserve Money Core + Action Core approval as the only irreversible-action boundary.
- Run time-separated paper experiments; assess **net returns after costs, drawdown, liquidity impact, and refusal rate** rather than merely number of exits or hypothetical profits.

## Current state

The accompanying MEME-VENTURE.RUNTIME.01–.03 storage PR is #1314. This profit policy is a separate paper-only Opportunity Core module, with no private key, sale execution, real-money access, or claim that tokens currently exist.
