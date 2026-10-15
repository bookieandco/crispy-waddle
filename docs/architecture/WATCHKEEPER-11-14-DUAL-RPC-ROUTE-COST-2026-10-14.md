# WATCHKEEPER.11–.14 — Coordinated research-only commissioning

Prepared October 14, 2026 PDT. Repository bookieandco/crispy-waddle.

## .11 original branch reconciliation
PR #1292 contains .09–.10 local checkpoint and actual Oct 20 END-gated
research evaluation. Reconcile to exact current main, then require SHARK
safety, Spatial Conformance and Jhadina Launch Gate on the new head.
Preserve existing collector and avoid duplicate Money/Shadow systems.

## .12 two fixed public Solana RPC source comparison
ops/meme/dual_rpc_pool_observer.py reuses .06 pool ownership and SPL
vault parsing, one context slot per getMultipleAccounts response.
It compares two fixed public endpoint responses at identical slots:
pool program, mint, vault owner, SPL balances and account state.
Any slot drift, zero/frozen reserves, address mismatch, corrupt receipt
or RPC outage fails closed. Even two agreeing public hosts do NOT prove
independent operation, transaction success, fee schedule, LP ownership,
transfer restrictions or genuine token sellability. Uses keyless
read-only JSON-RPC POST requests only when manually invoked.

## .13 genuine ledger-linked Jupiter quote pairing
ops/meme/paired_route_evidence.py verifies the existing SHA-chained state,
one exact cycle, forward and reverse GET diagnostic digests, same mint,
exact reversed token amount and bounded nonfuture quote times.
Missing directions are NO_TWO_SIDED_EVIDENCE. Reports only indicative
roundtrip SOL quote ratios. Aggregator legs need not use the same DEX
pool and no swap simulation or actual fill took place. The optional .12
same-mint pool receipt may be linked but never grants sellability.

## .14 bounded cost stress, not independent PnL
ops/meme/paired_route_cost_stress.py calculates the quoted indicative
ratio and *hypothetical* net SOL after two legs of separately supplied
network/priority estimates, plus assumed incremental DEX fee, transfer
fee, slippage and market impact. The existing .02 DEX constant-product
benchmark remains the reference for independently attested DIRECT pool
research: Jupiter aggregator outputs are NOT a direct pool quote.
Fees and price impacts already embedded in the aggregator quote cannot
be separated. Additional assumptions may DOUBLE COUNT cost. Results
are scenario sensitivities, not executed prices, paper fills, Sharpe,
profits, trading recommendations or certified sellability.

Both modules are CLI/offline research tasks; this pull request does not
add new scheduled jobs, Supabase writes, real trading, paid API access,
strategies, keys or wallets.

## Verification
python -m unittest discover -s ops/meme -p 'test_*.py' -v
python -m compileall -q ops/meme

## Remaining independent blockers
Authenticated independent provider receipts, exact route-to-pool binding,
token authority, Token-2022 transfer restrictions, verified fee parsers,
actual executable sellability, independent external archives, encrypted
Swlc backup/restore and database migrations (issue #1257). The original
Oct 13–20 seven-day experiment continues without live funds or fills.
