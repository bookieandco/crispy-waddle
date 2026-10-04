# SHARK-COFFER.COMMISSION.1-.10 — source completion and live gate

Date: 2026-10-03

## Authority boundary

This sequence commissions evidence. It does not authorize unrestricted live trading.

- SHARK remains intelligence-only.
- MIMS remains advisory.
- Money remains the capital/risk authority.
- Purse/Coffer allocation remains distinct from execution.
- A commissioning PASS never creates a permit, signs a transaction, broadcasts a transaction, or bypasses a controlled-canary boundary.
- Every snapshot is `COMMISSIONING_EVIDENCE_ONLY` and `canExecute=false`.

## Stage contract

1. **COMMISSION.1 — production schema**: all SHARK/Coffer runtime, Purse, DEX shadow, wallet, signer, provider-admission and DEX-attempt tables are queryable.
2. **COMMISSION.2 — scheduler/OIDC**: the commissioning request itself must be signed by the exact main-branch GitHub OIDC workflow identity. CRON-secret access can inspect the endpoint but cannot satisfy this gate.
3. **COMMISSION.3 — Purse charter**: at least one active MEME-enabled owner-governed charter exists.
4. **COMMISSION.4 — real SHARK ingress**: recent durable SHARK runtime ingress exists.
5. **COMMISSION.5 — market/liquidity evidence**: recent execution evidence contains a bound market snapshot and accepting route snapshot with evidence.
6. **COMMISSION.6 — paper MIMS/Money/Coffer**: an owner-governed PAPER_AUTONOMOUS MEME charter has a recent validated Money opportunity and a recent paper Purse/Coffer run.
7. **COMMISSION.7 — cross-lane allocation**: a recent runtime run contains allocation plan + decision set + rebalance plan lineage.
8. **COMMISSION.8 — Pump/PumpSwap execution evidence**: recent execution evidence contains an accepting Pump/PumpSwap market/route binding.
9. **COMMISSION.9 — signed simulation / no broadcast**: an active Coffer execution wallet, admitted DEX provider, temporally valid signer lease and a recent `SIMULATED` DEX attempt are all bound together; the attempt must have signed-hash/signature + simulation/provider-request IDs and no provider broadcast receipt.
10. **COMMISSION.10 — measured shadow**: a recent zero-sign/zero-broadcast DEX shadow run for a Pump/PumpSwap instrument is certified and exposes quote age, observed slippage and fee measurements.

All ten must be PASS in one production snapshot before the workflow says `COMMISSION.1-.10 = PASS`.

## Durable surfaces

The commissioning endpoint reads existing canonical durable evidence instead of creating a second execution path:

- `money_shark_runtime_ingress`
- `money_opportunities_v2`
- `money_shark_execution_evidence`
- `money_shark_execution_packages`
- `money_shark_coffer_runtime_runs`
- Purse charter/allocation/decision/rebalance tables
- `money_dex_shadow_runs`
- `money_wallet_connections`
- `money_signer_leases`
- `money_market_connector_admissions`
- `money_dex_execution_attempts`

The endpoint returns only aggregate gate/count information and bounded shadow metrics. It does not return owner IDs, wallet addresses, signer fingerprints, token addresses, private keys, raw transactions or credentials.

## Current live blockers re-probed on 2026-10-03

Supabase project `Swlc` still reports `ACTIVE_HEALTHY` at the management layer, but both migration-history access and a direct read-only SQL probe fail at the database connection layer. The direct probe returned PostgreSQL `57P03`: `the database system is not accepting connections`, detail `Hot standby mode is disabled`.

Vercel project `crispy-waddle-jhadina-web` has no production deployment for the current-main lineage at this audit point. The latest READY production deployment observed is older than the commissioning branch.

Therefore this branch completes the **source machinery** for COMMISSION.1-.10, but production PASS remains fail-closed until exact deployed lineage and live database/provider evidence exist.

## Manual production run

Use the existing `Jhadina Production Scheduler` workflow and choose `money-shark-coffer-commission`.

The job:

1. requires exact healthy production lineage;
2. requests the scoped GitHub OIDC token;
3. captures a baseline snapshot;
4. runs one bounded real SHARK observation cycle;
5. runs one bounded non-executing SHARK/Coffer cycle;
6. reads the final durable commissioning snapshot;
7. refuses success unless COMMISSION.1 through COMMISSION.10 are all PASS and `canExecute=false`.

This job does **not** synthesize a Purse charter, wallet, provider admission, signer lease, signed simulation, or shadow evidence. Missing operational configuration remains visible rather than being fabricated.
