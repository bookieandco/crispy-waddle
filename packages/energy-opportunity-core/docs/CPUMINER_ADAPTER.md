# cpuminer sandbox adapter

Reference implementation: `pooler/cpuminer`.

Jhadina does not vendor or execute cpuminer in the Energy Opportunity Core. The adapter currently produces a **dry-run execution plan only**.

## Flow

```text
resource telemetry
      +
market/electricity estimate
      |
      v
Energy Opportunity policy
      |
  +---+---+
  |       |
 deny    start
          |
          v
 CPUMiner dry-run adapter
          |
     sanitized argv
          |
       audit/test
```

## Current guarantees

- no `child_process` or process spawning
- no network sockets
- no pool authentication
- no wallet access
- pool credentials embedded in a URL are stripped from the dry-run argv
- non-CPU resources are rejected by the adapter
- non-Bitcoin workloads are rejected by the adapter
- invalid thread counts are rejected
- policy decisions other than `start` produce no execution arguments

## Real execution gate

A future worker may execute cpuminer only after the following are implemented outside this pure adapter:

1. explicit resource authorization from Safeguard
2. bounded CPU/power/thermal limits
3. live telemetry and watchdog
4. emergency stop
5. credential injection without exposing secrets to the LLM
6. auditable lifecycle events
7. CI coverage for the worker
8. explicit operator enablement

The dry-run adapter is therefore a compatibility boundary, not a background miner.
