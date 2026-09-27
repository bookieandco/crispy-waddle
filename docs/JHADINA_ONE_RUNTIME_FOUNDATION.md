# JHADINA-ONE-RUNTIME.1 — foundation

## Objective

Make the existing Jhadina control plane the shared runtime contract for every subsystem without creating a second orchestrator.

Canonical authority remains:

```text
Ask Jhadina
  -> governed ContextPacket / WorkSession
  -> intelligence / planning
  -> policy + approval
  -> Action Core
  -> domain executor/provider
  -> durable audit/evidence
```

Compute placement, task state, capability health and event delivery are support planes. None of them grants execution authority.

## Landed in this slice

### WorkSession task graph

`@jhadina/core-spine` now defines a subsystem-neutral task envelope with:

- WorkSession, task, parent-task and dependency identity;
- domain + capability routing;
- authority reference for traceability only;
- idempotency, correlation and causation lineage;
- input/output references;
- retry attempt ceilings;
- optimistic versioning;
- explicit task states;
- legal transition validation;
- dependency-cycle and cross-scope rejection;
- deterministic ready-task discovery;
- an in-memory optimistic repository for subsystem integration tests before the production adapter exists.

The graph deliberately does not execute work.

### Event fabric boundary

`@jhadina/event-bus` keeps the existing EventBus interface and adds:

- WorkSession/task/correlation/causation metadata;
- domain/capability/authority/idempotency lineage;
- an EventJournal contract;
- a journal-before-dispatch DurableEventBus implementation;
- duplicate-idempotency suppression;
- an in-memory journal for tests.

This does not claim the production journal is durable yet. A Postgres/Supabase adapter remains a later runtime-admission slice.

### Capability truth state

`@jhadina/capability-registry` now distinguishes:

- unknown;
- ready;
- degraded;
- blocked;
- simulation-only;
- paper-only;
- disabled.

A capability cannot claim `ready` without live-runtime evidence. Source/CI evidence alone is insufficient.

These states are descriptive. They do not authorize actions.

### Action lineage

The canonical Action Core request can now carry optional WorkSession runtime lineage. Action audit events preserve that lineage through started/approval/denied/failed/completed outcomes.

Runtime lineage never changes Action Core policy, approval or handler authority.

## Integration contract for subsystems

A subsystem plugging into ONE-RUNTIME should:

1. Create or join the active WorkSession.
2. Register its capability definitions in the canonical Capability Registry.
3. Create tasks with stable idempotency + correlation lineage.
4. Publish cross-core events with WorkSession runtime context.
5. Convert consequential effects into canonical ActionRequest objects.
6. Preserve the WorkSession/task lineage on the ActionRequest.
7. Report outputs as references rather than silently mutating another subsystem.
8. Never treat capability health, task readiness, event receipt or compute placement as execution permission.

## Intentionally deferred

This slice does not yet:

- create the production Postgres/Supabase task table;
- create the production durable event journal/outbox;
- implement leases/worker claims/heartbeats;
- submit Kubernetes/Kueue jobs;
- wire Director, SHARK, Sports, PupsonStuff, Growth, SAM or JhadinaTV into the task graph;
- expose the Command Center runtime projection;
- claim background-worker or chaos-test certification.

Those are the next ONE-RUNTIME slices.

## Next sequence

- ONE-RUNTIME.2 — production task persistence + lease/claim/heartbeat/recovery
- ONE-RUNTIME.3 — durable event journal/outbox + replay/offsets
- ONE-RUNTIME.4 — runtime capability evidence adapters and health projection
- ONE-RUNTIME.5 — ComputeWorkload bridge from ready tasks
- ONE-RUNTIME.6 — subsystem adapters
- ONE-RUNTIME.7 — Command Center / "what needs me?" projection
- ONE-RUNTIME.8 — parallel chaos/idempotency certification
- JHADINA-ONE-RUNTIME.FINAL
