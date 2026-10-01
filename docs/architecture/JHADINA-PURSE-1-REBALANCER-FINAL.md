# JHADINA-PURSE.1 through PURSE-REBALANCER.FINAL

## Outcome

Jhadina's Purse is the governed capital-allocation layer above Coffer and the lane-specific Money executors.

It answers:

- what capital exists;
- what portion is truly liquid;
- what portion is reserved, unsettled, locked or already exposed;
- which opportunities are admissible across stocks, forex, crypto, meme, sports, prediction markets and metals;
- how much capital each opportunity can justify;
- why Jhadina wants to allocate or leave capital idle;
- when an existing position should be held, trimmed or exited;
- what rebalance intents should be passed to downstream governed executors.

The Purse itself cannot submit an order, place a wager, sign a crypto transaction, withdraw funds or convert assets.

## Milestones

### JHADINA-PURSE.1 — Treasury Charter

`JhadinaPurseCharter` establishes the owner-controlled constitution.

The charter contains:

- total deployable limit;
- minimum liquid and emergency reserves;
- per-lane enablement and allocation caps;
- per-position caps;
- confidence floors;
- maximum correlated exposure;
- maximum rebalance turnover;
- verified owner payout destination;
- protected owner-profit sweep;
- autonomy mode.

Jhadina may allocate and rebalance inside the charter, but the charter explicitly records that she cannot:

- change her own charter;
- change the owner's payout destination;
- disable the owner-profit sweep;
- execute a financial side effect.

Charter changes are new owner-authorized versions, not in-place model mutations.

### PURSE-OPPORTUNITY-BUS.FINAL

The Purse receives normalized intelligence from all admitted lanes.

Each opportunity carries:

- lane and strategy;
- instrument;
- action;
- thesis;
- expected after-cost edge;
- downside;
- confidence;
- evidence quality;
- liquidity;
- minimum and maximum capital;
- correlation groups;
- freshness and evidence lineage.

The bus rejects disabled lanes, expired intelligence, weak confidence, non-positive expected edge, weak evidence and insufficient liquidity.

Cross-domain intelligence remains intelligence only.

### PURSE-DECISION-ENGINE.FINAL

`allocatePurseCapital` ranks admitted opportunities and allocates only within:

- protected reserves;
- total deployable cap;
- available liquid capital;
- lane caps;
- per-position caps;
- per-opportunity caps;
- correlation caps;
- each opportunity's own min/max capital range.

No rule forces Jhadina to deploy all cash.

`buildPurseDecisionSet` produces durable "where and why" records for every allocation and a separate keep-cash decision for unused liquidity.

All decisions retain `financialAuthority='NONE'`.

### PURSE-PORTFOLIO.FINAL

The Purse uses a unified portfolio model without conflating cash, custody and holdings.

Account snapshots represent only cash/non-position value. Positions are separate.

Ledger evidence distinguishes:

- deposits;
- withdrawals;
- transfers;
- trades;
- wagers;
- settlements;
- fees;
- realized P&L;
- valuations;
- reconciliations.

Critical accounting rules:

- valuation/reconciliation cannot create spendable cash;
- valuation/reconciliation cannot create realized P&L;
- transfers cannot create realized P&L;
- fees cannot create profit;
- only reconciled ledger evidence contributes to realized P&L.

This prevents paper gains from becoming spendable capital and prevents account/holding double counting.

### PURSE-LIQUIDITY.FINAL

Spendable liquidity is not net worth.

The liquidity engine subtracts:

- unsettled capital;
- account reservations;
- charter liquid reserve;
- charter emergency reserve;
- pending withdrawals;
- fees;
- tax reserves;
- owner-profit-sweep holds;
- chain fee reserves;
- other restricted capital.

It separately exposes executable position exit value so Jhadina can understand what may become liquid after a governed exit without pretending it is already cash.

### PURSE-REBALANCER.FINAL

The rebalancer combines:

1. new Purse allocation decisions; and
2. existing Money position-management directives.

An allocation can generate an `INCREASE` intent.

A deteriorating or invalidated position can generate `REDUCE` or `EXIT`.

The charter turnover ceiling applies to the complete rebalance plan.

Every rebalance intent is explicitly:

- `financialAuthority='NONE'`;
- `canExecute=false`;
- `requiresDownstreamRiskAndAuthority=true`.

The final trade, bet, conversion, transfer or withdrawal is still performed only by the appropriate governed Money executor after its own live readiness, risk, entitlement, permit and reconciliation requirements pass.

## Reference audit

Two external open-source personal-finance projects were reviewed for architecture ideas only.

### Firefly III

Useful design patterns observed:

- accounts are distinct from transactions;
- transaction journals group transaction semantics;
- budgets are distinct objects rather than inferred from balances;
- transfers are explicit;
- transaction currencies and foreign currencies are explicit;
- reconciliation state is first-class;
- rule triggers/actions are separate from transaction history.

Coffer/Purse retains its own implementation and execution authority model.

### Maybe Finance

Useful design patterns observed:

- accounts distinguish liquid cash, investment holdings and non-cash assets;
- holdings are first-class and separate from account cash;
- valuations/reconciliation anchors are distinct from transactions;
- transfers are excluded from ordinary spending semantics;
- multi-currency accounts require exchange-rate evidence;
- cash flow, balance sheet and holdings are separate projections.

Maybe is no longer actively maintained and is AGPLv3. No source code from Maybe or Firefly III is incorporated into the Purse implementation; only high-level accounting/modeling patterns informed the design.

## Learning + personality bridge

The Purse now consumes existing learning rather than treating every opportunity as a first-time decision.

### Paper-trading memory

Existing Money `StrategyCalibration` records are adapted into Purse learning memory. Supported calibration can modestly confirm confidence; mixed calibration reduces confidence and sizing; rejected calibration blocks the strategy from allocation.

Paper evidence can never authorize live execution.

### SHARK memory

SHARK's existing closed-trade review records feed the Purse with:

- realized net return;
- execution quality versus modeled slippage;
- sizing diagnosis;
- narrative confirmation/failure;
- signal attribution and lesson tags.

A single SHARK trade is intentionally weak evidence. It can reduce sizing/confidence after a bad outcome, but it cannot promote a strategy by itself.

### Purse outcome feedback

Resolved Purse decisions produce `PurseOutcomeLearningRecord` evidence. These records can be folded into the next strategy-learning profile, creating a closed learning loop:

`decision -> outcome -> learning memory -> next allocation`.

### Personality

The allocator accepts a `PurseDecisionStyle` projected from governed `PersonalityState`.

Only explicitly finance-scoped, accepted personality traits are eligible. The current supported hooks are:

- patience;
- cash optionality;
- concentration discipline;
- contradiction sensitivity.

Personality influence is asymmetric: it may tighten score floors, preserve more cash, or reduce concentration/sizing. It may never raise a charter limit, bypass a rejected calibration, create financial authority, change the owner payout destination, or disable the owner sweep.

The default is neutral when no approved finance-specific personality evidence exists.

## Durable evidence

Migration `028_jhadina_purse_rebalancer_final.sql` adds append-only evidence for:

- charter versions;
- opportunity admission;
- allocation plans with learning-profile/personality-style lineage;
- learning events from paper calibration, SHARK trade reviews, Purse outcomes, strategy profiles and personality style;
- decision sets;
- portfolio snapshots;
- liquidity snapshots;
- rebalance plans.

The tables are server-only, FORCE-RLS, revoke public/anon/authenticated access, and grant service role only `SELECT, INSERT`.

Database constraints independently enforce that allocation/rebalance evidence has no execution authority.

## Boundary after PURSE-REBALANCER.FINAL

Jhadina can now decide and explain where capital should go, how much should remain liquid, and how the portfolio should be rebalanced.

She still cannot perform the side effect from this layer.

The next milestones are:

1. PURSE-PROFIT-WATERFALL.FINAL
2. OWNER-PAYDAY.FINAL
3. PURSE-MEMORY.FINAL
4. PURSE-SHADOW.FINAL
5. PURSE-CANARY.FINAL
6. JHADINA-PURSE.LIVE-GOVERNED

`unrestrictedLiveAuthorized=false` remains unchanged.
