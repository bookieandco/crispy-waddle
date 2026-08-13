# Energy Opportunity → Money Core integration

The Energy Opportunity Core is connected to Money Core through a projection boundary rather than direct financial mutation.

## Flow

Bitaxe/AxeOS read-only telemetry → Energy Opportunity Core → profitability/policy → Money Core projection → verified financial record

### Observed data

- hashrate
- power consumption
- device health
- pool state
- uptime

### Money projection

The `projectMiningEconomics()` bridge converts observed power into electricity cost using a configured USD/kWh rate and combines it with an externally supplied revenue estimate. The result is explicitly an **estimate**.

Estimated revenue is never treated as cash, wallet balance, or realized income.

### Realized BTC

A future wallet/on-chain verifier may produce `RealizedMiningPayout` only after independently verifying:

- destination wallet address
- positive BTC amount
- transaction ID
- verification timestamp

That verified event can then enter Money Core's transaction/income pipeline. This package never stores private keys, signs transactions, sends BTC, or changes a bank account.

## Governance connections

The eventual production path should also emit:

1. **Jhadina audit ledger** — telemetry observations, policy decisions, and financial projections.
2. **Planning/proposal layer** — requests to change mining policy or enable execution.
3. **Safeguard/security gate** — authorization before any future control capability.
4. **Money Core** — realized income and operating expenses only after verification.
5. **Opportunity engine** — compare mining against other compute workloads.

The current implementation stops at observation and projection. No miner control or money movement is enabled.
