# @jhadina/energy-opportunity-core

Safe foundation for Jhadina's Energy & Compute Opportunity Core.

The package currently contains only deterministic domain logic. It does **not** start miners, access wallets, connect to pools, or spawn background processes.

## Current capabilities

- resource authorization model
- workload estimates
- expected-net calculation
- deterministic policy decisions
- Bitcoin-mining workload classification
- unit-test coverage for deny/observe/start/stop paths

## Planned adapters

Real hardware, pool telemetry, electricity tariffs, worker control, and Money Core accounting belong behind explicit adapters and Safeguard policy checks.
