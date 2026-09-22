# SHARK-CONVERGE.8 — Live database commissioning receipt

Date: 2026-09-22  
Production Supabase project: Swlc  
Scope: SHARK persistence, evidence, actor/outcome history, calibration evidence, least privilege and transactional runtime smoke.

## Admission result

**PASS — database/runtime substrate commissioned.**

This receipt certifies the live Supabase persistence plane only. It does not grant live trading, wallet signing, capital authority, protected-fund access, auto-copy trading, MEV execution or autonomous financial mutation.

## Pre-commissioning state

The live database had only the early SHARK migrations through the September 2 launch/outcome history work. The later QA.16/17 reconciliation stack was absent.

Before reconciliation:
- `jhadina_token_launches`, outcome observations/evaluations and actor history existed with zero rows.
- `jhadina_token_actor_edges` did not exist.
- launch provenance columns such as `source`, `observation_id`, `signature`, `slot` and Pump 2 metadata were absent.
- legacy anon/authenticated table grants and authenticated read policies remained on backend SHARK tables.
- no `jhadina_shark_*` QA.16/17 RPC surface was present.

## Migration repair

The first reconciliation migration contained a malformed PL/pgSQL delimiter (`do $ ... $;`) and failed at parse time before mutating production.

The repository repair changed it to valid `do $$ ... $$;` syntax and added a SHARK CI check that rejects lone migration dollar quotes. The repair landed through PR #571.

## Live migration sequence

The complete missing SHARK sequence was then applied in repository order:

- `shark_durable_launch_ingestion`
- `shark_historical_observation_ratio_contract`
- `shark_evidence_provenance_contract`
- `shark_service_role_only_rls`
- `shark_schema_reconciliation`
- `shark_latest_observation_rpc`
- `shark_historical_backfill_scheduler`
- `shark_outcome_revision_contract`
- `shark_actor_association_confidence`
- `shark_atomic_outcome_apply`
- `shark_atomic_launch_bundle`
- `shark_wallet_intelligence_quota`
- `shark_atomic_outcome_batch`
- `shark_backfill_observation_fairness`
- `shark_provenance_debt_closure`
- `shark_shared_launch_rls`
- `shark_pump_v2_launch_features`
- `shark_research_evidence_runtime`

Additional live closure receipts:
- `20260922033916 shark_least_privilege_closure`
- `20260922034145 shark_fk_index_closure`

## Verified live schema

Verified after migration:
- `jhadina_token_actor_edges` exists.
- `jhadina_token_launches` includes canonical provenance columns and `pump_features jsonb`.
- actor association confidence and outcome observation chronology are present.
- wallet-cluster calibration observations are durable.
- Meteora cash-flow and position-state evidence are durable append-only stores.
- historical backfill scheduling and atomic launch/outcome RPCs are present.

## Least-privilege proof

All private SHARK persistence tables now revoke table privileges from `PUBLIC`, `anon` and `authenticated`.

The shared `jhadina_token_launches` registry is intentionally excluded from that blanket revoke because its later migration preserves owner-scoped authenticated policies.

For private SHARK tables:
- `anon`: no SELECT/INSERT privileges.
- `authenticated`: no SELECT/INSERT/UPDATE privileges.
- `service_role`: required operational privileges only.
- research-evidence tables keep service-role SELECT/INSERT and explicitly deny UPDATE/DELETE.

All audited `jhadina_shark_*` SECURITY DEFINER functions:
- are owned by the database privileged role;
- pin `search_path = public, pg_temp`;
- deny EXECUTE to anon/authenticated;
- grant EXECUTE to service_role.

The Supabase Security Advisor reports RLS-with-no-policy informational notices for service-only SHARK tables. These are intentional deny-by-policy surfaces and are paired with explicit client grant revocation. No SHARK authenticated/anonymous SECURITY DEFINER execute finding remains.

## Transactional runtime smoke

A live transaction was executed under `service_role` and then rolled back.

The smoke proved:
1. wallet-cluster calibration evidence inserts and deterministic replay returns `INSERTED` then `REPLAY`;
2. Meteora cash-flow evidence appends successfully;
3. Meteora position-state evidence appends successfully;
4. atomic launch + actor-edge persistence returns the canonical launch ID;
5. atomic outcome batching updates the canonical launch outcome;
6. the same batch updates actor outcome history;
7. all test data disappears after `ROLLBACK`.

A post-rollback query verified zero commissioning rows remained in launch, edge, evaluation, actor-history, cluster-calibration, Meteora cash-flow and Meteora state tables.

## Advisor closure

Supabase Performance Advisor initially identified two missing covering indexes:
- `jhadina_token_actor_edges.launch_id`
- `jhadina_token_launches.owner_id`

Migration `20260922034145 shark_fk_index_closure` added both indexes. A fresh advisor run confirmed both findings cleared.

Unused-index notices are expected while production SHARK tables remain empty and are not an admission blocker.

## Remaining production work

Database commissioning is complete. Remaining SHARK production certification work is outside this gate:

1. **SHARK-CONVERGE.9 — read-only provider soak**
   - Helius
   - DexScreener
   - CoinGecko
   - Pump/PumpSwap
   - Raydium
   - Meteora
   - stale-data, contradiction, retry, quota and replay behavior

2. **SHARK-CONVERGE.FINAL**
   - prove one canonical Money simulation/execution ledger;
   - prove SHARK cannot access protected capital;
   - prove simulated outcomes cannot authorize live activity;
   - prove each learned outcome traces to exact SHARK evidence/proposal and Money result.

