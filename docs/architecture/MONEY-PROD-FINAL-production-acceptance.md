# MONEY-PROD.FINAL — Production Acceptance

## Objective

MONEY-PROD.FINAL is the terminal production-acceptance gate for the combined Money trading-learning system:

- stocks;
- forex;
- SHARK / meme trading;
- sports betting;
- paper/shadow learning;
- bounded autonomous trading.

It deliberately separates **software completion** from **external live commissioning**.

A green repository test suite does not prove that a broker, DEX wallet, or sportsbook account is configured or that a real live canary has executed and reconciled.

## Acceptance states

```text
BLOCKED_SOFTWARE
      |
      v
SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED
      |
      v
PRODUCTION_ACCEPTED
```

`PRODUCTION_ACCEPTED` can only be produced when all four execution lanes independently satisfy their external receipts and the cross-domain shadow soak passes.

## Four execution lanes

### STOCK

Software surface:

- point-in-time stock reality/intelligence;
- chart-vision research evidence;
- Alpaca stock/ETF adapter;
- Action Core authority;
- autonomous mandate;
- hard risk limits;
- single-use execution permits;
- reconciliation;
- kill switch.

Live acceptance additionally requires:

- Alpaca live provider configuration;
- server-side credential verification;
- a tiny live canary;
- provider lifecycle evidence;
- portfolio reconciliation;
- kill-switch drill.

### FOREX

Software surface:

- point-in-time FX reality/intelligence;
- carry/macro/session modeling;
- Finnhub read-only market-data adapter;
- fail-closed Roboflow chart-vision research;
- paper/shadow learning;
- autonomous mandate/risk/permit spine.

Finnhub is **not** an execution broker and cannot satisfy the execution-provider receipt.

Live acceptance additionally requires a separately admitted Forex execution broker, server-side credentials, tiny live canary, reconciliation, and kill-switch drill.

### SHARK_MEME

Software surface:

- SHARK actor/liquidity/rug intelligence;
- SHARK -> Money research bridge;
- paper execution/outcome learning;
- Money autonomous mandate/risk/permit spine;
- protected Money funds remain inaccessible to SHARK intelligence.

Live acceptance additionally requires a dedicated trading wallet and separately admitted DEX/swap provider, live canary, on-chain reconciliation, and kill-switch drill.

No private key, wallet signer, Jupiter/Jito submission authority, or protected-fund access is added by this phase.

### SPORTS_BETTING

Software surface:

- SPORT-PRED-01 -> Money research ingress;
- odds normalization;
- fair-probability edge;
- sports-native paper wager ledger;
- settlement/P&L;
- closing-line value;
- outcome learning.

All sports paper records remain `PAPER_ONLY` with `bettingAuthority='NONE'`.

Live acceptance additionally requires a distinct sportsbook execution provider, credential verification, tiny live canary, wager/settlement reconciliation, and a betting kill-switch drill.

A sportsbook wager must never masquerade as `money.trade.submit`.

## Cross-domain shadow soak

Before final acceptance, all four lanes must complete an evidence-backed shadow soak.

The soak fails closed on:

- insufficient resolved samples;
- excess drawdown;
- unresolved executions;
- duplicate executions;
- future-information leakage;
- authority escalation;
- cross-domain truth contamination.

SHARK evidence cannot become stock/FX truth merely because it was profitable.

Sports predictions cannot become sportsbook execution authority.

Vision model detections cannot become canonical price truth.

## Durable commissioning receipts

`money_production_commissioning_receipts` is an append-only service-role ledger for:

- software certification;
- market-data readiness;
- provider configuration;
- credential verification;
- live canary;
- reconciliation;
- kill-switch drills;
- shadow-soak receipts.

The table stores evidence IDs, not secrets.

Browser roles have no grants. RLS is enabled and forced.

Receipt records themselves have `authority='CERTIFICATION_ONLY'` and `canExecute=false`.

## New provider/reference surfaces

### Finnhub

`finnhub-forex-market-data.ts` uses only HTTPS GET requests for Forex exchanges, symbols, and candles. It can create point-in-time Money market observations but cannot submit orders.

### Roboflow Forex datasets

`forex-sells/forex-buys` and `forex-sells/forex-sells` are registered with opaque label semantics.

Dataset titles do not imply directional ground truth.

A class-to-direction mapping requires independent resolved-outcome calibration and still remains research-only.

### Opselon/ForexTradingBot

Retained as a reference for signal orchestration, background queues, resilience, and provider separation. It is not a Money execution provider.

## Certification surface

Implementation:

- `finnhub-forex-market-data.ts`
- `fx-chart-vision-research.ts`
- `sports-paper-betting.ts`
- `money-production-commissioning.ts`
- `money-prod-software-certification.ts`
- `postgres-money-production-commissioning-store.ts`
- `015_production_commissioning_receipts.sql`

MONEY-PROD.FINAL is fail-closed: absence of a real provider receipt is represented as a blocker, never synthesized from a software test or model output.

## Current acceptance interpretation

Repository completion may reach `SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED` without any live capital being enabled.

The status may advance to `PRODUCTION_ACCEPTED` only after real external commissioning evidence exists for **every** lane.

No default production acceptance receipt is created by this document.
