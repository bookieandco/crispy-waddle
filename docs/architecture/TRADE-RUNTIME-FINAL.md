# TRADE-RUNTIME.FINAL — event fabric, mechanical executor, position management, and learning loop

## Outcome

This phase turns the meme-trader lifecycle into one durable, event-driven trade lineage shared by Jhadina, SHARK, Money Core, execution, and shared memory.

Canonical lifecycle:

```text
TOKEN_DISCOVERED
  -> SHARK_ANALYZED
  -> THESIS_CREATED
  -> RISK_APPROVED
  -> ORDER_INTENT_CREATED
  -> TX_SIMULATED
  -> TX_SIGNED
  -> TX_SENT
  -> FILLED
  -> POSITION_MONITORED
  -> RISK_APPROVED (EXIT)
  -> ORDER_INTENT_CREATED (EXIT)
  -> TX_SIMULATED
  -> TX_SIGNED
  -> TX_SENT
  -> FILLED
  -> EXITED
  -> TRADE_REVIEWED
```

The requested shorthand sequence remains canonical; the repeated exit risk/order/transaction stages are the concrete round-trip expansion.

## 1. Durable real-time trade event fabric

Canonical code:

- `packages/jhadina-event-bus/src/trade-events.ts`
- `packages/jhadina-event-bus/src/trade-memory.ts`
- `packages/jhadina-event-bus/src/trade-runtime-coordinator.ts`
- `packages/jhadina-event-bus/src/trade-runtime.test.ts`
- `supabase/migrations/20260928023000_trade_runtime_memory.sql`

The trade runtime uses the existing journal-before-dispatch `DurableEventBus` and `jhadina_runtime_events` journal.

Routing is explicit:

- Jhadina receives the full trade stream.
- shared trade memory receives the full trade stream.
- SHARK receives discovery/intelligence/position/review events.
- Money receives intelligence lineage plus risk/order/execution/position/exit events.

`TradeEventSequenceGuard` rejects invalid ordering, including execution before risk approval, monitoring before an entry fill, exit risk before monitoring, and review before a completed exit.

The latest canonical projection is persisted as a service-role-only `jhadina_trade_memory_records` record while the append-only event journal remains the event-history authority.

Event receipt never grants trading authority.

## 2. Deliberately mechanical executor

Canonical code:

- `packages/money-core/src/solana-dex-runtime-contracts.ts`
- `packages/money-core/src/dex-controlled-canary-runtime.ts`
- `packages/money-core/src/solana-rpc-http-observer.ts`
- `packages/money-core/src/trade-runtime-events.ts`

The executor has no discovery, thesis, strategy selection, sizing opinion, or signal-generation API.

A DEX intent can be created through the governed factory only from:

- a named SHARK assessment;
- a named thesis;
- a complete passing EDGE-001 through EDGE-006 bundle;
- a passing EDGE-007 integrity receipt;
- an approving Money risk receipt.

Money derives the EDGE and integrity hashes itself. The approval binding also contains a fingerprint of the exact execution parameters. Changing the wallet, mint, size, minimum output, route identity, or other execution parameters after approval invalidates the intent.

Execution ordering is:

1. validate immutable Money intent and approval binding;
2. validate execution permit and wallet/signer/connector boundaries;
3. obtain provider order;
4. reject a quote below Money's minimum;
5. simulate the unsigned provider transaction;
6. reserve bounded canary capital;
7. call the isolated signer;
8. persist the signed attempt;
9. verify the signed transaction against Solana;
10. consume the single-use execution permit;
11. broadcast exactly once;
12. reconcile against on-chain truth.

The executor emits only:

- `TX_SIMULATED`;
- `TX_SIGNED`;
- `TX_SENT`;
- `FILLED`.

Those events are execution telemetry only and cannot create a new trade idea.

Restart reconciliation does not emit a duplicate `FILLED`.

## 3. Position management

Canonical code:

- `packages/money-core/src/position-management.ts`
- `packages/shark-intelligence-core/src/meme-trader/position-review.ts`

Open-position state now preserves and evaluates:

- cost basis;
- current executable value;
- liquidity and liquidity quality;
- current incremental edge;
- smart-wallet exit risk;
- observed smart-wallet net flow;
- narrative degradation;
- whale distribution risk;
- observed whale net flow;
- correlation risk;
- explicit thesis invalidation and reasons;
- profit giveback and current executable exit/add prices.

SHARK remains intelligence-only. Money remains downstream capital/risk authority.

A current position can independently create a `PositionExitIntentCandidate` after re-underwriting. The exit candidate does not require the original entry signal to fire again and cannot execute itself.

## 4. Post-exit learning loop

Canonical code:

- `packages/shark-intelligence-core/src/meme-trader/live-trade-learning.ts`
- `packages/shark-intelligence-core/src/meme-trader/trade-runtime-events.ts`

After a closed trade, SHARK can create a learning-only record containing:

- original assessment and thesis lineage;
- gross and net return;
- fees;
- planned versus realized entry size and sizing diagnosis;
- modeled versus realized execution slippage;
- execution-cost diagnosis;
- expected versus observed narrative;
- per-signal worked/failed attribution;
- confidence-weighted candidate learning deltas;
- exit reason codes;
- merged evidence lineage;
- lesson tags.

The complete review summary is published as `TRADE_REVIEWED` and therefore lands in the same shared trade-memory record as discovery, entry, monitoring, and exit.

Learning records have:

- `authority='LEARNING_ONLY'`;
- `financialAuthority='NONE'`;
- `canExecute=false`.

Learning can influence later intelligence only through separately governed future decisions.

## Security and authority invariants

- Jhadina/SHARK/shared memory never receive private keys, seed phrases, signer tokens, or raw signer credentials.
- SHARK cannot sign or broadcast.
- EDGE gates cannot authorize a trade.
- event delivery cannot authorize a trade.
- shared memory cannot authorize a trade.
- position review cannot authorize a trade.
- learning cannot authorize a trade.
- a Money execution permit and the isolated signer boundary remain mandatory.
- `unrestrictedLiveAuthorized` remains false in the existing DEX certification path.

## Source-level acceptance

The implementation includes tests for:

- full event routing and shared-memory projection;
- illegal event ordering;
- Money risk/order/exit publishers;
- SHARK discovery/analysis/thesis/position/review publishers;
- approval-binding forgery rejection;
- post-approval transaction mutation rejection;
- unsigned simulation before signing;
- deterministic executor lifecycle events;
- no duplicate fill on restart recovery;
- independent current-evidence exit intent creation;
- smart-wallet/narrative/whale deterioration exits;
- signal/sizing/slippage/narrative post-exit learning attribution.

## Deliberate non-claims

This phase does not claim:

- the new Supabase trade-memory migration has already been applied to the production database;
- the production app has already instantiated the durable trade coordinator against that database;
- an external Coffer signer has been commissioned and funded;
- a real funded Jupiter/Solana Stage-4 canary has completed;
- unrestricted live trading is authorized.

Those are runtime commissioning facts and must be proven separately rather than inferred from source/tests.
