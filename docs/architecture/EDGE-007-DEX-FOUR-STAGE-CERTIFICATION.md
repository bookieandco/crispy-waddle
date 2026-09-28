# EDGE-007 + DEX four-stage execution certification

## Objective

Close the integrity gap between SHARK/Jhadina intelligence and any future unattended meme-coin DEX execution, then make the execution path prove itself in four ordered stages:

1. historical replay;
2. live shadow decisions;
3. signed/simulated transactions with no broadcast;
4. controlled live canary.

This work does **not** grant unrestricted live trading.

## EDGE-007 — Integrity Guard

Canonical implementation:

- `packages/shark-intelligence-core/src/meme-trader/integrity-guard.ts`
- `packages/shark-intelligence-core/src/meme-trader/__tests__/integrity-guard.test.ts`

The guard is a veto-only boundary. It never authorizes a trade or promotion.

It blocks:

- coordinated promotion intended to move a market;
- spam amplification;
- fake volume;
- wash trading;
- self-dealing/self-trading;
- misleading claims;
- intentional omission of material risk;
- targeted hype intended to manufacture exit liquidity;
- manufactured social proof;
- undisclosed public research while holding a position.

It permits ordinary public-attention monitoring, narrative analysis, wallet-flow analysis, disclosed research, and already-approved execution to continue downstream, but `PASS` means only that EDGE-007 found no prohibited integrity action. Money Core must still independently approve risk, allocation, execution authority, signer scope, and canary limits.

## DEX four-stage certification

Canonical implementation:

- `packages/money-core/src/dex-four-stage-certification.ts`
- `packages/money-core/src/dex-four-stage-certification.test.ts`

Certification command:

```bash
pnpm --filter @jhadina/money-core verify:dex-edge007
```

The package-wide Money certification suite also includes the DEX staged-certification tests.

### Stage 1 — Historical replay

Must prove:

- at least one decision;
- no future evidence at the replay cutoff;
- zero signing;
- zero broadcast;
- zero reconciliation side effects;
- EDGE-007 PASS receipt.

Historical replay is research/certification evidence only.

### Stage 2 — Live shadow

Must prove:

- real-time or recorded-real-market decisions;
- no future-data leakage;
- zero signing;
- zero broadcast;
- zero reconciliation side effects;
- EDGE-007 PASS receipt.

Shadow success cannot promote itself to live authority.

### Stage 3 — Signed simulation, no broadcast

Must prove:

- isolated signer boundary;
- at least one signed transaction artifact;
- at least one successful provider/chain simulation;
- zero simulation failures;
- zero broadcast;
- zero provider execution receipt;
- zero on-chain signature;
- no private-key material observed by Jhadina, SHARK, Money shared memory, logs, or certification artifacts;
- EDGE-007 PASS receipt.

### Stage 4 — Controlled live canary

Static or synthetic tests cannot certify this stage.

Operational certification requires live-runtime-attested evidence proving the same strategy/instrument lineage that passed stages 1–3, including:

- isolated Coffer wallet/signer binding;
- EDGE-007 PASS;
- preflight simulation;
- distinct entry and exit execution IDs;
- one bounded entry broadcast and one bounded exit broadcast;
- both broadcasts reconciled to provider and on-chain evidence;
- sellability proven by the real exit and the position flat after exit;
- no duplicate broadcast;
- no unknown execution;
- restart/recovery behavior proven while preserving idempotency;
- capital boundary enforced;
- kill switch proven;
- modeled versus realized execution costs reconciled;
- provider execution receipts for both legs;
- exactly two on-chain signatures, one per leg.

A successful controlled canary still sets `unrestrictedLiveAuthorized=false`.

## Current repository truth

Existing Money Core already provides:

- point-in-time replay/no-future-leakage controls;
- shadow observation with no-submit/no-cancel authority;
- execution permits, attempts, idempotency, recovery and reconciliation;
- live-canary controls;
- Action Core authority binding;
- Coffer and signer-boundary contracts;
- owner Phantom connection UI.

Existing SHARK already provides wallet/actor intelligence, launch evidence, historical observations, liquidity/rug controls and the research-only SHARK→Money bridge.

The repository still states that a production meme-coin DEX signing/swap adapter is an external provider-commissioning task. The Coffer execution wallet is likewise shown as not commissioned. Therefore this change intentionally does **not** fabricate stage-4 success.

## Acceptance rule

EDGE-007 is complete when its package tests pass.

The four-stage DEX software gate is complete when Money type-check/build/tests pass.

Operational stage-4 certification is complete only after the commissioned DEX adapter and isolated signer produce real live-runtime evidence satisfying the controlled-canary contract. Until then:

- stages 1–3 may be certified;
- stage 4 remains blocked;
- unrestricted live remains impossible through this certification path.
