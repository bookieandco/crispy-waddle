# @commerce/offer-engine

Deterministic marketplace offer normalization and ranking.

## Responsibilities

- Filter offers to the requested jurisdiction.
- Require sufficient currently available inventory.
- Reject expired offers.
- Calculate delivered totals from product price, taxes, delivery fee, and platform fee.
- Rank by lowest delivered price, fastest ETA, or best value.
- Include merchant reliability as a bounded best-value signal.
- Preserve inventory source/version and policy version for auditability.

## Non-responsibilities

The offer engine does not:

- reserve inventory;
- process payments;
- determine legal eligibility;
- decide tax rates;
- dispatch couriers;
- mutate merchant POS data;
- let an LLM decide price ranking.

Those responsibilities belong to the reservation/POS, payment, policy, dispatch, and intelligence layers respectively.

## Checkout rule

Search results are offers, not guaranteed inventory. Before payment/order commitment, Commerce OS must perform a live, idempotent inventory reservation through the merchant adapter and recalculate the final payable amount.
