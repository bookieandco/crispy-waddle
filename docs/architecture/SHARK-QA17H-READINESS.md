# SHARK QA.17A-H Production-Data Readiness

As of 2026-09-20. Branch: `build/shark-qa17-production-readiness`.

## Scope

QA.17 hardens SHARK's existing intelligence/paper-trading system for repeated production-data ingestion. It does not authorize live trading. Jupiter/Jito/wallet signing remain outside SHARK and subject to Jhadina/Money Core governance.

## QA.17A — actor association confidence

- Removed the remaining "strongest edge makes the whole actor certain" behavior.
- Durable reputation confidence now takes the strongest association per launch and averages those launch-level confidences.
- A directly verified deployer can remain confidence 1 when every launch association is verified.
- Weak developer/cluster associations remain weak and cannot be upgraded by one unrelated certain edge.
- Regression coverage proves a 1.0 association does not upgrade .6/0 associations to certainty.

## QA.17B — atomic outcome persistence

- Added `jhadina_shark_apply_outcome_batch`.
- Evaluation receipts, canonical launch outcome revisions, and derived actor reputation rows commit in one database transaction.
- Application code derives the post-batch canonical actor state before invoking the transaction.
- A failed transaction leaves no evaluation receipt, no launch revision, and no reputation cache mutation.

## QA.17C — outcome correction semantics

- Retains `launch-outcome-v2` semantics from QA.16.
- New evidence can revise an earlier non-UNKNOWN classification.
- Revision ordering is now gated by the source observation timestamp, not worker wall-clock time.
- Evaluation time remains a receipt/audit timestamp.
- Replaying the same evidence cannot advance `outcome_observed_at`.
- Evaluation IDs remain content-derived from launch + evaluator version + observation fingerprint.

## QA.17D — launch idempotency

- Durable launch + actor-edge persistence remains a single transaction.
- Duplicate webhook ingestion can merge identity/provenance evidence but cannot overwrite the outcome worker's canonical classification.
- Chain/token identity remains canonical.
- Observation/signature provenance is retained.
- Existing graph tests cover duplicate actor collapse, chain-aware edge IDs, and evidence merge.

## QA.17E — historical observation fairness

- Scheduler now prioritizes launches with no historical observation.
- Once all launches have evidence, the launch with the stalest newest observation is selected first.
- Last-attempt time is a tie-breaker rather than the primary freshness signal.
- This prevents high-churn/new launches from monopolizing refresh work.

## QA.17F — provenance/schema debt closure

Live Supabase inspection identified an important compatibility issue: the current Jhadina database has the earlier wallet-launch/sniper form of `jhadina_token_launches`, with `owner_id` and JSONB `evidence_ids`, while later SHARK repo migrations expect text-array evidence plus ingestion provenance columns.

The durable-ingestion migration now bridges that live schema before later SHARK migrations:
- JSONB evidence arrays are converted to canonical `text[]`.
- `owner_id` is retained.
- missing `source`, `observation_id`, `signature`, `slot`, and `outcome_observed_at` columns are reconciled.
- legacy empty launch evidence is reconstructed from durable signature/observation/source identity.
- empty actor-edge evidence inherits canonical launch evidence.
- evidence constraints are then explicitly validated.
- duplicate actor/history and chain/token indexes are removed.
- owner-scoped client launch rows remain available only to their owner; service-role SHARK rows with `owner_id is null` are hidden from authenticated Data API reads.

Live data counts at audit time were zero for token launches, outcome observations, actor histories, and outcome evaluations. `jhadina_token_actor_edges` was not yet deployed. No production migration was applied as part of QA.17; these changes remain in the open PR.

## QA.17G — provider and Meteora integrity

Provider contracts were checked against current official documentation:
- Helius webhook `authHeader` is delivered verbatim as `Authorization`; SHARK now compares the exact configured value and no longer invents Bearer stripping or an alternate header.
- Helius `getTransfersByAddress` response/pagination semantics are covered with a current response-shape fixture.
- CoinGecko token OHLCV is explicitly labeled as most-liquid-pool provider selection; callers cannot mistake it for fixed-pool continuity.
- DexScreener `pairCreatedAt` is treated as pair age, not the observation time of current liquidity/volume/price.
- DexScreener price-only changes now produce distinct observations.
- Meteora DLMM snapshot reconciliation tracks gross per-bin additions/removals, rejects duplicate bin evidence, and keeps simultaneous bin movement classified as rebalance unless stronger transaction evidence proves withdrawal.

Reference pages:
- Helius webhook examples: https://demo.helius.dev/webhooks
- Helius getTransfersByAddress: https://www.helius.dev/blog/introducing-gettransfersbyaddress
- CoinGecko token OHLCV: https://docs.coingecko.com/reference/token-ohlcv-token-address
- DexScreener API: https://docs.dexscreener.com/api/reference

## QA.17H — soak gate

The Jhadina SHARK persistence soak exercises:
- simulated transaction abort before commit;
- clean retry;
- outcome correction from persisted evidence;
- evaluation-ID deduplication;
- actor-history preservation across an older rug plus a newer failed launch;
- conservative association-confidence aggregation;
- 25 repeated worker cycles;
- stable `outcome_observed_at`;
- no evaluation duplication;
- no actor-history shrinkage;
- evidence preservation.

The focused SHARK workflow now runs this app-level soak in addition to SHARK core TypeScript, core Vitest, Jhadina SHARK integration TypeScript, frozen install, and migration presence validation.

## Production boundary

QA.17A-H is a repository readiness gate, not a production deployment. The live Jhadina Supabase project has not received the QA.16/17 migration stack during this work. Apply/verify migrations only after PR review/merge through the normal deployment path.
