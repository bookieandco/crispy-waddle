# MONEY-LIVE.1 — Controlled live canary / Coffer / funding / wallet closure

## Scope

MONEY-LIVE.1 extends the existing Money live-canary spine without weakening the Action Core, reconciliation, or kill-switch boundaries.

This phase adds:

- a canonical Coffer survival/accounting model;
- accountant-style realized-profit sweep decisions;
- double-entry journal candidates and post-movement tie-out controls;
- owner-scoped funding proposals for deposits, withdrawals, and transfers;
- a dedicated Money UI workspace and Funding Desk;
- Phantom as an owner-wallet connection surface;
- a separate Coffer wallet boundary for any future unattended DEX execution;
- stable fail-closed connector openings for stocks, forex, and DEX venues;
- durable Supabase tables for Coffer policy, movement proposals, reconciliations, wallet metadata, and connector admission;
- MONEY-LIVE.1 certification tests.

## Preserved authority rules

MONEY-LIVE.1 does **not** make the LLM a bank, broker, signer, or approval authority.

- Intelligence can recommend, explain, simulate, and prepare.
- Coffer accounting can calculate a sweep candidate.
- The Funding Desk can create a durable `PENDING_APPROVAL` movement proposal.
- A proposal has `canMoveMoney=false`.
- A journal candidate has `canPost=false`.
- Phantom connection metadata has `canSign=false`.
- Stock / forex / DEX connector openings start `UNCOMMISSIONED`.
- Real provider execution still requires the existing governed authority/permit/execution/reconciliation path and separate production commissioning evidence.

The existing MONEY-060 tiny Alpaca equity canary remains manual-canary-only. This change does not claim external bank, forex, DEX, or wallet-signing commissioning.

## Coffer survival model

The Coffer is the only automated-strategy capital pool.

`ACTIVE -> DEFENSIVE -> SURVIVAL -> HALTED -> RECAPITALIZATION_REQUIRED`

Automated strategies may not source rescue capital from the user's connected funding account when the Coffer approaches zero.

The Coffer accountant computes:

1. settled cash;
2. reserved cash;
3. spendable cash;
4. realized gross profit;
5. realized costs;
6. planning reserve;
7. retained profit;
8. survival / defensive capital;
9. remaining sweepable realized profit.

Unrealized P&L and unsettled balances do not satisfy the profit threshold.

## Profit sweep accounting

A threshold hit does not directly move money.

The accountant emits a sweep candidate only when:

- Coffer state is `ACTIVE`;
- net realized profit is above the configured threshold;
- planning reserve and retained profit have been preserved;
- the transfer leaves the Coffer above the defensive floor;
- an owner destination is configured;
- a standing mandate reference exists.

The candidate then produces a balanced journal:

- debit owner cash destination;
- credit Coffer cash source.

A completed movement is not considered reconciled until:

`source before - source after = sweep amount + provider fee`

and

`destination after - destination before = sweep amount`.

The planning reserve is bookkeeping/risk capacity, not an automated tax calculation or tax advice.

## Funding Desk

The Money UI now exposes:

- Add funds;
- Cash out;
- Transfer.

Those actions create owner-scoped `money_movement_proposals` rows only.

For deposits:

`owned bank account -> Coffer`

For withdrawals:

`Coffer -> owned bank account`

Transfers are limited to distinct, governed owner endpoints with matching currencies.

The Funding Desk derives bank endpoints from the existing governed account-read path. It does not treat Plaid read access as payment capability.

## Phantom / crypto boundary

Phantom is admitted as the owner-facing Solana wallet connection surface.

The browser may request a normal Phantom connection and display the public address. Money Core does not request or persist:

- a seed phrase;
- a private key;
- an unattended Phantom signing session.

Any future unattended DEX path must use separate, bounded Coffer custody with its own provider admission, capital limits, destination allowlist, permits, receipts, reconciliation, and kill switch.

## Market openings

The following connector slots are seeded as `UNCOMMISSIONED`:

- `stock:open`;
- `forex:open`;
- `dex:open`.

This creates stable integration points without silently granting execution authority.

## Reference disposition

### different-ai/agent-bank

Concepts retained:

- agent-facing financial workspace;
- ACH/IBAN transfer proposal vocabulary;
- receipt matching / reconciliation;
- clear separation between proposing and approving transfers.

Disposition: concept-only. No provider execution code imported.

### singularityhacker/bank-skills

Concepts retained:

- provider-neutral balance / receive / send / transfer taxonomy;
- unified activity / statement concepts;
- explicit split between banking and on-chain wallet capabilities.

Disposition: concept-only. Its Wise and Uniswap execution implementation is not imported or commissioned.

### sawongam/bank-management-system-in-web

Concepts retained:

- account dashboard;
- balance visibility;
- transfer history;
- transaction analytics.

Disposition: UX/reference only. PHP/SQL runtime is not imported.

### sophonfinance-wq/finance-automation-portfolio

Concepts retained:

- deterministic accounting calculations;
- separation of duties;
- independent validation;
- reconciliation identities;
- fail closed on tie-out breaks;
- human sign-off for material outcomes.

Disposition: architecture/control reference only.

### roger296/lucaV0.5

Concepts retained:

- double-entry validation;
- append-only audit thinking;
- approval queue;
- bank reconciliation;
- closed-period / immutable-history mindset.

Disposition: architecture reference only. Luca's community-license implementation is not copied.

### williamjxj/agentic-langgraph-accounting

Concepts retained:

- route structured financial questions to deterministic/SQL data;
- route document/audit context separately;
- combine evidence at the explanation layer rather than letting the model invent ledger facts.

Disposition: reasoning/orchestration reference only.

### solana-developers/cash-app-clone

Concepts retained:

- simple consumer cash home / activity / pay mental model;
- clear deposit / withdraw / transfer affordances;
- mobile-first amount-entry and wallet-connected flows.

Disposition: UX/workflow reference only. Its devnet Anchor program and direct wallet transaction code are not imported into Money Core.

### phantom/docs

Authoritative integration rules retained:

- detect Phantom through the injected provider and `isPhantom`;
- connect through `window.phantom.solana.connect()`;
- require explicit user approval before transaction requests;
- prefer Phantom-owned signing/submission when user-approved wallet transactions are later added;
- on mobile, use Phantom's documented `/ul/browse/` universal-link flow to reopen the Money page inside Phantom's in-app browser when the injected provider is unavailable;
- never request or persist the user's private key or seed phrase.

Disposition: authoritative provider-contract reference.

### tabii-dev/accounting-automation-portfolio

Concepts retained:

- configure manually first;
- automate only after a clean observed cycle;
- materiality / uncertainty routes to review;
- immutable audit logs;
- reconciliation to the penny.

Disposition: accounting-operations reference only.

## Durable tables

MONEY-LIVE.1 adds service-role-only state for:

- `money_coffers`;
- `money_profit_sweep_policies`;
- `money_funding_destinations`;
- `money_movement_proposals`;
- `money_profit_sweep_reconciliations`;
- `money_wallet_connections`;
- `money_market_connector_admissions`.

No bank access token, wallet seed phrase, private key, or provider execution credential belongs in these tables.

## Certification

The MONEY-LIVE.1 test suite proves:

- realized/settled-only profit thresholding;
- survival-state gating;
- destination and standing-mandate requirements;
- owner endpoint / currency binding;
- Phantom owner wallet isolation;
- destination allowlisting for any future Coffer wallet path;
- stock / forex / DEX fail-closed admission;
- balanced profit-sweep journals;
- source/destination/provider-fee reconciliation.

## External commissioning boundary

Repository and CI completion cannot manufacture:

- a funded owner Coffer;
- bank transfer permissions;
- broker credentials;
- a forex account;
- a DEX signer;
- KYC / provider approval;
- a real funded canary receipt.

Those remain external commissioning facts. Until they exist, the corresponding connector stays fail closed.
