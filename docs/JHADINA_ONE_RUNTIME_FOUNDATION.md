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

## ONE-RUNTIME.2/3 source persistence now included

The same branch now also establishes the production persistence boundary:

- service-role-only `jhadina_work_session_tasks` table;
- optimistic task versions plus unique WorkSession-scoped idempotency;
- atomic claim / renew / release RPCs with expiring worker leases;
- task lease state remains coordination only and never execution authority;
- Supabase WorkSession task repository for durable reads/writes and lease RPCs;
- append-only `jhadina_runtime_events` journal;
- unique WorkSession-scoped event idempotency;
- ordered WorkSession/correlation indexes for replay;
- Supabase event-journal adapter with Postgres duplicate suppression.

These are source-level persistence contracts. Applying the migration and proving lease takeover/replay against the live production database are separate environment-admission receipts.

## Intentionally deferred

This slice does not yet:

- claim the new task/event migration is applied in production;
- run live crash/lease-expiry/replay drills against Supabase;
- submit Kubernetes/Kueue jobs;
- wire Director, SHARK, Sports, PupsonStuff, Growth, SAM or JhadinaTV into the task graph;
- expose the Command Center runtime projection;
- claim background-worker or chaos-test certification.

## Next sequence

- ONE-RUNTIME.2 — **SOURCE COMPLETE; live DB admission pending**
- ONE-RUNTIME.3 — **SOURCE COMPLETE; live replay/admission pending**
- ONE-RUNTIME.4 — **SOURCE COMPLETE** truthful subsystem health projection, including stale-evidence expiry; live capability evidence adapters remain subsystem work
- ONE-RUNTIME.5 — **SOURCE COMPLETE** runnable WorkSession task -> ComputeWorkload description bridge; Kubernetes/Kueue submission remains deployment work
- ONE-RUNTIME.6 — subsystem adapters
- ONE-RUNTIME.7 — Command Center / "what needs me?" projection
- ONE-RUNTIME.8 — parallel chaos/idempotency certification
- JHADINA-ONE-RUNTIME.FINAL


## ONE-RUNTIME.4/5 shared runtime projection

The foundation now also includes:

- a subsystem-level runtime projection that aggregates registered capability truth without converting configuration into health;
- stale runtime evidence expiry so READY cannot persist forever after a provider/device disappears;
- a provider-neutral task-to-ComputeWorkload bridge;
- WorkSession ID, task ID and idempotency lineage preserved into Compute authority metadata;
- a hard rejection for tasks that are not runnable;
- no permission for Compute placement to claim or authorize the originating task.

At this point the remaining shared-runtime work is less about inventing core contracts and more about production admission plus thin adapters from each existing subsystem.
