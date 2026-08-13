# Jhadina Energy & Compute Opportunity Core

Status: ARCHITECTURE + SAFE SCAFFOLD

## Purpose

Add an optional background opportunity subsystem that evaluates owned compute/energy resources for legitimate revenue-producing workloads, including Bitcoin mining, without allowing covert or uncontrolled resource use.

## Boundary

The subsystem is an **opportunity evaluator and policy-gated executor**. Jhadina intelligence may recommend an action; deterministic policy and explicit resource authorization decide whether execution is permitted.

### Non-negotiable rules

1. Only explicitly authorized resources may be used.
2. Mining is opt-in and visibly observable.
3. No hidden/background mining on devices without an active authorization.
4. Never bypass operating-system, cloud-provider, pool, or network controls.
5. Respect configured power, thermal, cost, and availability limits.
6. Every start, stop, recommendation, and reward is auditable.
7. Profitability is an estimate, never a guaranteed return.
8. The system defaults to `observe` when required market, energy, hardware, or authorization data is missing.

## System map

```text
Jhadina
  |
  +-- JANET / Memory ---------------------- historical outcomes/preferences
  |
  +-- DELIA / Intelligence ---------------- opportunity analysis
  |
  +-- MARISA / Execution ------------------ controlled worker orchestration
  |
  +-- Safeguard / Policy ------------------ HARD authorization + limits
  |
  +-- Money Core -------------------------- cost/revenue ledger
  |
  +-- Energy & Compute Opportunity Core
          |
          +-- Resource Registry
          +-- Market/Network Snapshot
          +-- Profitability Engine
          +-- Policy Decision Adapter
          +-- Worker Adapter
          +-- Reward/Cost Ledger Adapter
          +-- Health + Telemetry
          +-- Audit Events
```

## Initial domain model

### Resource

Represents an explicitly owned/authorized compute resource.

- `resourceId`
- `kind`: `asic | gpu | cpu | cloud`
- `authorization`: `disabled | observe | execute`
- `powerLimitWatts`
- `availabilityWindow`
- `locationClass` (coarse operational label only)
- `ownerScope`

### Workload

A possible workload such as Bitcoin mining.

- `workloadId`
- `kind`: `bitcoin-mining | ai-compute | other`
- `estimatedRevenuePerHour`
- `estimatedCostPerHour`
- `confidence`
- `providerFees`
- `constraints`

### Decision

Deterministic output after policy checks.

- `decision`: `start | stop | observe | deny`
- `reasonCodes`
- `expectedNetPerHour`
- `confidence`
- `policyVersion`

## Bitcoin mining adapter

The first adapter is deliberately abstract. It does **not** bundle a miner, wallet, credential, or pool secret into the core package.

The adapter contract should eventually support:

- miner health
- hashrate
- power draw
- uptime
- pool/account telemetry
- accepted/rejected shares
- payout observations
- controlled start/stop/throttle

Wallet custody and payout movement remain outside the evaluator and go through existing Money Core / Safeguard controls.

## Decision loop

```text
telemetry + market data + electricity cost
                    |
                    v
             profitability
                    |
                    v
             policy engine
                    |
        +-----------+-----------+
        |           |           |
       DENY       OBSERVE     EXECUTE
                                |
                         worker adapter
                                |
                         telemetry/audit
```

## Phase plan

### Phase 1 — Safe foundation (this change)

- package boundary
- domain types
- deterministic profitability calculation
- policy decision contract
- resource authorization model
- audit event model
- no real miner execution

### Phase 2 — Real telemetry

- ASIC/resource adapters
- power measurements
- pool telemetry
- current BTC/network inputs
- configurable electricity tariffs

### Phase 3 — Controlled execution

- start/stop/throttle adapter
- health watchdog
- emergency stop
- bounded background scheduler
- approval/authorization UI

### Phase 4 — Money Core integration

- append-only cost/reward events
- accounting reconciliation
- tax-reserve visibility
- profitability history

### Phase 5 — Opportunity expansion

Compare Bitcoin mining with other authorized compute opportunities using the same policy boundary.

## Security model

Secrets, pool credentials, wallet keys, and device control credentials must never enter the LLM context. LLMs can propose; deterministic services validate and execute.

## Acceptance criteria for execution

Real mining cannot be enabled until all of the following exist:

- explicit resource authorization
- policy limits
- current telemetry
- profitability inputs
- auditable start/stop events
- emergency stop
- test coverage for deny/observe/start/stop paths
- clear UI indication that mining is active
