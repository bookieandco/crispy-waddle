# MONEY-COMMISSION.1 — Reference fold and commissioning substrate

This phase folds the latest Money references into the existing MONEY-LIVE.1 architecture without promoting any uncommissioned provider to live execution.

## Franklin

Retained concepts:
- hard budget / no-overdraft behavior;
- wallet-funded economic-agent semantics;
- trade-plan approval separation;
- persistent trading journal / spend accountability;
- stop when budget is exhausted.

Implementation:
- `StrategyBudgetSnapshot` and `reserveStrategySpend` create per-strategy Coffer sub-budgets with a hard cap.
- Reservations are non-executing and fail closed when the remaining budget is insufficient.

## AWP Wallet

Retained concepts:
- signer process isolates private keys;
- the agent sees only short-lived session authority;
- per-transaction and rolling spend caps;
- agent/session isolation;
- auditable transaction history.

Implementation:
- `SignerLeasePolicy`, `SignerLease`, and `SignerRollingObservation`.
- only a token fingerprint may be durable;
- raw signer tokens, seed phrases, and private keys are forbidden from the Money tables;
- destination, asset, transaction-count, per-transaction, rolling-24-hour, and expiry limits all fail closed.

## plaid-sync

Retained concepts:
- cursor-based incremental synchronization;
- explicit `ITEM_LOGIN_REQUIRED` / re-auth state;
- account inclusion filtering;
- sync checkpoint durability.

Implementation:
- `ProviderSyncCheckpoint` and `ProviderSyncPage`;
- exact previous-cursor binding before a page can advance state;
- provider login failure becomes `LOGIN_REQUIRED`;
- filtered accounts remain inaccessible to the sync layer.

No Plaid credentials or access tokens are stored in the new checkpoint table.

## robinhood-node

This project is a legacy Node wrapper around Robinhood's private, reverse-engineered API. Its own documentation warns that using the private API is not encouraged.

Retained only as an interface taxonomy:
- account;
- quotes;
- positions;
- orders;
- historicals;
- dividends;
- earnings;
- watchlists;
- limit-order and cancel concepts.

`ROBINHOOD_NODE_REFERENCE_SURFACE` is explicitly marked:
- `officialApi=false`;
- `authentication=PRIVATE_REVERSE_ENGINEERED`;
- `executionAllowed=false`.

Money Core will not commission this adapter for live trading.

## Durable state

MONEY-COMMISSION.1 adds:
- `money_strategy_budgets`;
- `money_signer_leases`;
- `money_provider_sync_state`.

These are service-role-only and store no raw financial-provider or wallet secrets.
