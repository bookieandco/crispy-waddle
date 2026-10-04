# SHADOW-RUNPOD.FINAL — source receipt — 2026-10-03

## Goal

Run SHARK paper/shadow learning independently of SWLC so database outages cannot stop observation, paper decisions, outcome grading, or calibration.

This runtime is intentionally incapable of real-money execution.

## Runtime topology

```text
DEX Screener live market discovery
        |
        v
RunPod shadow policy
        |
        +--> PAPER_TRADE twin
        |
        +--> NO_TRADE twin
        |
        v
execution realism simulation
        |
        v
15m / 1h / 4h / 24h / 3d / 7d repricing
        |
        v
counterfactual lessons
        |
        v
Performance MIMS + pattern memory
        |
        v
RunPod PostgreSQL durable ledger
        |
        v
idempotent sync queue --> SWLC import staging after recovery
```

## Authority boundary

Every runtime receipt is non-executing.

- `canExecute=false`
- `canSign=false`
- `canBroadcast=false`
- `canAuthorizeLive=false`

RunPod import records enter SWLC as `SHADOW_IMPORT_EVIDENCE_ONLY`.
They are not automatically converted into mandates, permits, live intents, or orders.

## SHADOW-RUNPOD.1 — Direct PostgreSQL ledger

Implemented in:

- `packages/money-core/migrations/032_shark_shadow_runpod_final.sql`
- `packages/money-core/src/shark-shadow-runpod-store.ts`

Standalone tables have no dependency on SWLC foreign keys.

## SHADOW-RUNPOD.2 — Standalone live worker

Implemented in:

- `packages/money-core/src/shark-shadow-runpod-runtime.ts`
- `packages/money-core/src/shark-shadow-runpod-cli.ts`

Current bootstrap discovery source is DEX Screener.

The worker records liquid/high-quality candidates as paper-trade twins and weak/thin candidates as NO_TRADE twins so rejected opportunities remain part of the training sample.

## SHADOW-RUNPOD.3 — Persistent state

Bootstrap state defaults to:

`/workspace/jhadina/shark-shadow`

PostgreSQL defaults to loopback-only port `55432`.

The runtime never exposes the PostgreSQL port publicly.

For durability across deleting/replacing a Pod, attach a RunPod Network Volume to the workspace/state path. The software does not falsely infer that a local Pod volume is cross-Pod durable.

## SHADOW-RUNPOD.4 — Continuous runtime

Command:

```bash
pnpm --filter @jhadina/money-core shadow:runpod:serve
```

Default cycle:

`300 seconds`

Health:

- `GET http://127.0.0.1:8094/health/live`
- `GET http://127.0.0.1:8094/health`

## SHADOW-RUNPOD.5 — Historical replay

Command:

```bash
pnpm --filter @jhadina/money-core shadow:runpod:replay -- /path/to/replay.ndjson
```

Accepted records are point-in-time market snapshots. Replay preserves their original observation clock, applies the same decision policy, and grades decisions only from later imported samples inside the configured horizon windows.

Replay never calls live execution.

## SHADOW-RUNPOD.6 — Commissioning

Remote entrypoints:

- `scripts/shark-shadow-runpod-bootstrap.sh`
- `scripts/shark-shadow-runpod-commission.py`
- `.github/workflows/shark-shadow-runpod-commission.yml`

The workflow targets a dedicated CPU RunPod supplied through `RUNPOD_SHADOW_POD_ID` (or a manual `pod_id`) and refuses to create or start compute. It also rejects the existing Director Pod when it is in RunPod's zero-GPU recovery state. This prevents a source push from silently enabling billable compute or abusing a recovery-only host.

When the existing Pod is already running, commissioning:

1. reconciles the repository ref;
2. installs PostgreSQL only if absent;
3. initializes the ledger under the persistent state path;
4. applies the standalone schema;
5. installs the workspace;
6. replaces only the prior shadow-service process;
7. verifies local health;
8. writes a runtime receipt.

## SHADOW-RUNPOD.7 — SWLC resync

Pod-side queue:

`runpod_shark_shadow_sync_queue`

Export/ack tool:

`scripts/shark-shadow-runpod-sync.py`

SWLC staging:

`money_shark_shadow_runpod_imports`

Protected importer:

`POST /api/internal/money/shark-shadow-runpod-import`

Canonical scheduler option:

`money-shark-shadow-runpod-sync`

The queue is acknowledged only after SWLC reports a successful idempotent import. If SWLC is unavailable, local RunPod evidence remains retryable.

## Useful environment variables

```text
SHARK_SHADOW_DATABASE_URL
SHARK_SHADOW_DATA_DIR
SHARK_SHADOW_POSTGRES_PORT=55432
SHARK_SHADOW_POSTGRES_USER=jhadina_shadow_pg
SHARK_SHADOW_POSTGRES_DB=jhadina_shadow
SHARK_SHADOW_HEALTH_PORT=8094
SHARK_SHADOW_INTERVAL_SECONDS=300
SHARK_SHADOW_DISCOVERY_LIMIT=12
SHARK_SHADOW_TOKEN_COOLDOWN_MINUTES=60
SHARK_SHADOW_DEFAULT_NOTIONAL_MINOR=1000
SHARK_SHADOW_MIN_LIQUIDITY_USD=25000
SHARK_SHADOW_MIN_VOLUME_24H_USD=10000
SHARK_SHADOW_MIN_TXNS_24H=20
SHARK_SHADOW_MIN_CONFIDENCE=0.55
```

## External blocker separation

SWLC disk exhaustion no longer blocks RunPod paper learning.

SWLC is still required for canonical production resync and eventual use by the main Jhadina application. Do not weaken the SWLC production admission gate merely because the RunPod learner is healthy.

## FINAL

Source completion requires:

- Money Core type-check;
- full Money tests;
- RunPod scoring/horizon/replay tests;
- Jhadina Web type-check;
- protected import route build;
- non-execution authority invariants.

A healthy RunPod shadow learner is evidence that paper learning is operating. It is **not** evidence that real-money trading is commissioned.


## Current RunPod admission finding

The existing Director Pod `xn73vwwekavcc6` was observed with `runtimeStatus=running` and `gpuCount=0`.
RunPod documents this zero-GPU state as a data-recovery mode with limited CPU resources rather than a compute host.
SHADOW-RUNPOD therefore no longer targets that Pod.

Required deployment target:

- one existing CPU Pod;
- SSH enabled;
- persistent storage mounted at `/workspace` (prefer a Network Volume for cross-Pod durability);
- repository variable `RUNPOD_SHADOW_POD_ID` set to that Pod id, or manual workflow dispatch with `pod_id`.

The commissioning workflow will not create or start that billable resource automatically.


## Explicit CPU Pod provisioning path

The commissioning workflow now supports two owner-controlled billable actions, available only through manual `workflow_dispatch`:

- `create_cpu_pod=true`: create a dedicated `jhadina-shark-shadow` CPU Pod using `ubuntu:24.04`, 20 GB persistent volume mounted at `/workspace`, SSH, port 8094, and a 24-hour automatic stop.
- `start_existing_pod=true`: start an already resolved dedicated shadow CPU Pod.

Both default to `false`. Push-triggered commissioning remains read-only with respect to compute creation/start.

Optional `network_volume_id` attaches an existing RunPod Network Volume for cross-Pod durability.

Once a unique Pod named `jhadina-shark-shadow` exists, both commissioning and the later SWLC sync path can discover it automatically; setting `RUNPOD_SHADOW_POD_ID` remains an explicit override.
