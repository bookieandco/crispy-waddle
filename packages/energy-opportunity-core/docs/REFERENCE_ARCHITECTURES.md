# Energy & Compute Reference Architectures

This document records how external open-source projects inform Jhadina's Energy & Compute Opportunity Core.

## 1. Bitaxe / ESP-Miner

Reference: `bitaxeorg/ESP-Miner`

ESP-Miner is open-source ESP32 firmware for Bitaxe Bitcoin ASIC miners. The project exposes an AxeOS HTTP API for system information, ASIC settings, statistics, and device discovery, making it a strong reference for a real hardware telemetry/control adapter.

Jhadina mapping:

- **Resource discovery:** mDNS / AxeOS discovery becomes a `MiningResourceProvider` capability.
- **Telemetry:** hashrate, ASIC state, statistics, temperature/power data where exposed become normalized `ResourceTelemetry`.
- **Control:** device configuration and start/stop/throttle operations remain behind the Energy Opportunity policy boundary.
- **Fleet management:** Bitaxe swarm discovery can feed a future resource registry.
- **Safety:** thermal protection remains device-local; Jhadina adds an independent policy/watchdog layer.

Important: ESP-Miner is GPL-3.0. Jhadina should prefer an adapter that communicates with a separately installed firmware/device over HTTP rather than copying GPL code into proprietary/shared Jhadina packages. Any distribution of modified ESP-Miner itself must comply with its license.

## 2. Gemmini

Reference: `ucb-bar/gemmini`

Gemmini is a Chisel-generated, RISC-V-coupled DNN accelerator and full-stack hardware exploration platform. It is **not a Bitcoin mining implementation** and should not be treated as one.

Jhadina mapping:

- **Compute resource abstraction:** Gemmini is a useful model for representing heterogeneous accelerators as schedulable resources.
- **Telemetry/benchmarking:** accelerator utilization, memory traffic, latency and energy measurements can inform the general compute opportunity model.
- **Workload selection:** Jhadina can eventually compare AI workloads against other uses of authorized compute resources.
- **Hardware exploration:** Gemmini may inform a future Jhadina hardware/accelerator research track, separate from Bitcoin mining.

Gemmini's license is a permissive BSD-style license. Its code should remain a separately attributed research dependency/reference unless a concrete integration is justified.

## 3. Target abstraction

```text
                    JHADINA
                       |
             Energy Opportunity Core
                       |
                Resource Registry
                       |
          +------------+-------------+
          |                          |
    Mining resources             Compute resources
          |                          |
    +-----+------+             +-----+------+
    |            |             |            |
 Bitaxe/ASIC   CPU/GPU      Gemmini      Future accelerator
    |            |             |
 ESP-Miner    cpuminer       DNN/AI workloads
    |            |             |
    +------------+-------------+
                       |
                 Telemetry API
                       |
                 Profit / Cost
                       |
                 Safeguard Policy
                       |
              +--------+--------+
              |                 |
            DENY             EXECUTE
                                |
                         Controlled Adapter
                                |
                              Ledger
```

## 4. Design rule

External projects provide **adapters and reference architectures**, not authority.

Jhadina's deterministic policy layer remains authoritative for:

- resource ownership/authorization
- power and thermal limits
- profitability thresholds
- workload allowlists
- operating windows
- emergency stop
- audit events
- financial accounting

No external miner or accelerator is allowed to bypass that boundary.
