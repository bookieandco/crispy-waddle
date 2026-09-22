# MONEY-AUTO.FINAL — Autonomous trading certification

## Scope

MONEY-AUTO adds an **opt-in bounded autonomous live-trading mode** to the existing Money Core architecture.

It does not replace Action Core, execution permits, broker entitlements, reconciliation, live canary state, or the kill switch. It composes them.

The canonical authority chain is:

```text
USER EXPLICIT APPROVAL
      |
      v
AUTONOMOUS TRADING MANDATE
      |
      +-- immutable capital/risk/venue/strategy constraints
      |
MODEL / SHARK / STOCK / FX INTELLIGENCE
      |
      v
AUTONOMOUS TRADE INTENT             (INTELLIGENCE_ONLY)
      |
      v
AUTONOMOUS RISK GOVERNOR            (RISK_VETO_ONLY)
      |
      v
ACTION CORE CHILD AUTHORITY         (allow under approved mandate)
      |
      v
SINGLE-USE MONEY EXECUTION PERMIT
      |
      v
LIVE CANARY RESERVATION
      |
      v
BROKER / PROVIDER ADAPTER
      |
      v
PROVIDER EVENT -> RECONCILIATION -> ACCOUNTING -> LEARNING
```

The model chooses trades. The model cannot choose or change the hard limits under which it is allowed to trade.

## MONEY-AUTO.1 — User-approved mandate

`AutonomousTradingMandate` is created only from an Action Core request carrying an explicit approval receipt.

The mandate binds:

- user;
- provider;
- broker/wallet account;
- currency;
- instrument-prefix allowlist;
- strategy allowlist;
- opening-short permission;
- maximum order notional;
- daily submitted notional;
- daily order count;
- daily realized-loss ceiling;
- gross-exposure ceiling;
- drawdown ceiling;
- leverage ceiling;
- minimum model-confidence floor;
- start and expiry times;
- Action Core policy version/hash;
- the original approval receipt.

The mandate itself has `canAuthorizeTrade=false`.

## MONEY-AUTO.2 — Autonomous risk governor

Every autonomous intent is separately evaluated against the mandate and a point-in-time risk snapshot.

The governor is veto-only. It can block but cannot issue execution authority.

Blocking conditions include:

- instrument outside allowlist;
- strategy outside allowlist;
- excessive order size;
- unauthorized opening short;
- confidence below the mandate floor;
- excessive drawdown;
- excessive leverage;
- daily realized-loss breach;
- gross-exposure breach;
- unresolved execution;
- missing/stale/future risk evidence;
- provider/account/currency mismatch.

Daily order/notional and live account state are independently enforced again by the existing live-canary reservation.

## MONEY-AUTO.3 — Cross-domain learning

`autonomous-strategy-learning.ts` generalizes closed paper-strategy outcomes into a common learning record for:

- STOCK;
- FOREX;
- MEME;
- CRYPTO;
- SPORTS_BETTING;
- PREDICTION_MARKET.

Paper learning records are `LEARNING_ONLY`.

Strategy calibration may produce `ELIGIBLE_FOR_AUTONOMOUS_REVIEW`, but the promotion assessment is `REVIEW_ONLY` with `canAuthorizeLive=false`.

Paper performance therefore cannot create, expand, mutate, or renew an autonomous mandate.

This preserves the existing SHARK principle that simulated outcomes may improve strategy knowledge without being promoted into observed market truth.

## MONEY-AUTO.4 — Action Core child authority

A child trade is represented by a normal `money.trade.submit` ActionRequest.

Its ActionRequest carries the mandate's original approval receipt, and its economic action fingerprint now contains both:

- `mandateId`;
- `strategyId`.

Action Core must return `decision='allow'` for the exact child request.

The Money permit remains single-use and remains bound to:

- exact ActionRequest fingerprint;
- exact economic action fingerprint;
- Action Core authority;
- policy version/hash;
- original approval receipt;
- opportunity;
- risk decision;
- allocation decision.

Autonomous mode therefore does not create an alternate Money authorization system.

## MONEY-AUTO.5 — Autonomous provider execution

Manual and autonomous execution are separate broker contexts:

- `executionMode='MANUAL'` + interactive trigger;
- `executionMode='AUTONOMOUS'` + autonomous command + mandate ID.

The manual path continues to reject non-interactive trigger substitution.

The autonomous path requires:

1. active mandate;
2. active broker account entitlement;
3. approved risk decision;
4. valid execution plan;
5. successful live preflight/shadow gate;
6. Action Core child authority;
7. fresh single-use execution permit;
8. live-canary reservation;
9. provider live adapter.

Provider ambiguity produces `UNKNOWN`, marks the live canary unresolved, forbids blind retry, and requires reconciliation.

## MONEY-AUTO.6 — Kill switch

MONEY-AUTO reuses the existing Money kill switch and `PermitStore.haltAll()`.

Autonomous mode has no alternate path around it.

## MONEY-AUTO.7 — Durable mandate security

Migration `014_autonomous_trading_mandates.sql` creates the mandate ledger.

Security properties:

- RLS enabled and forced;
- PUBLIC revoked;
- anon revoked;
- authenticated revoked;
- service-role only;
- approval receipt and Action Core authority lineage required;
- constraints persisted as database fields;
- user/browser/model code cannot directly mutate limits.

## MONEY-AUTO.8 — Provider coverage

The autonomous executor is provider-agnostic over the existing live broker adapter contract.

Current repository provider reality:

- Alpaca live adapter: stock/ETF live order support already exists and can consume the autonomous broker context once provider live trading is enabled.
- Generic production HTTP broker adapter: can host separately admitted stock/FX providers.
- Alpaca intentionally does **not** route forex through its equity adapter.
- A production FX provider remains a provider commissioning task.
- A production meme-coin DEX signing/swap adapter remains a provider commissioning task.
- Sports betting shares the learning domain but has no sportsbook real-money executor in MONEY-AUTO; betting execution must remain a separately governed capability rather than masquerading as `money.trade.submit`.

MONEY-AUTO.FINAL therefore certifies the autonomous Money execution architecture and stock-capable live path. It does not falsely certify unconfigured external providers.

## MONEY-AUTO.FINAL certification matrix

The certification report requires all of these named cases:

1. explicit-mandate-approval
2. action-core-child-authority
3. mandate-expiry-revocation
4. instrument-strategy-allowlists
5. order-daily-loss-exposure-limits
6. drawdown-leverage-confidence-veto
7. opening-short-policy
8. paper-shadow-promotion-is-review-only
9. single-use-child-permit
10. provider-account-entitlement
11. unknown-execution-block
12. kill-switch-halts-permits
13. manual-mode-preserved
14. model-cannot-mutate-hard-limits
15. cross-domain-learning-no-authority

Any missing or failed case makes `report.passed=false`.

## Activation boundary

Repository/software certification does **not** activate autonomous real-money trading for a user.

Activation still requires a separately supplied real account/wallet, live provider credentials, an active broker entitlement, live provider configuration, and an explicit user-approved mandate containing the actual capital/risk limits.

No default autonomous mandate exists.
