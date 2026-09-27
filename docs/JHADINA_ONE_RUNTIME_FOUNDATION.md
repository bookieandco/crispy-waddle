# JHADINA-ONE-RUNTIME.1–5 — shared runtime foundation

## Objective

Make the existing Jhadina control plane the shared runtime contract for every subsystem without creating a second orchestrator, memory authority, policy engine, action executor, scheduler authority or compute authority.

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

Task state, event delivery, capability health, compute placement and UI projections are support planes. None grants execution authority.

---

## ONE-RUNTIME.1 — WorkSession task graph + action lineage

`@jhadina/core-spine` now defines a subsystem-neutral task envelope with:

- WorkSession ID, task ID and optional parent task;
- domain + capability routing;
- dependency graph;
- correlation + causation lineage;
- stable idempotency key;
- authority reference for traceability only;
- input/output references;
- retry ceilings;
- optimistic versioning;
- explicit lifecycle states;
- legal transition validation;
- missing dependency, cycle and scope rejection;
- deterministic readiness discovery.

The canonical Action Core request can carry optional WorkSession/task runtime lineage. Started, approval-required, denied, failed and completed audit records preserve that lineage. Runtime lineage never changes policy or approval outcomes.

---

## ONE-RUNTIME.2 — durable tasks, leases, recovery and readiness

Source-level production persistence is included:

- service-role-only `public.jhadina_work_session_tasks`;
- WorkSession owner binding enforced by database foreign key;
- parent task remains inside the same WorkSession;
- WorkSession-scoped idempotency uniqueness;
- optimistic version compare-and-swap repository writes;
- production repository re-runs graph validation before create/update;
- atomic worker claim RPC;
- atomic lease heartbeat/renew RPC;
- atomic release RPC;
- expired `running` leases are reclaimable while retry budget remains;
- exhausted retry budget fails closed instead of silently looping;
- dependency-satisfied queued/waiting tasks can be promoted to `ready`;
- lease state remains concurrency control only and never action authority.

A generic WorkSession runtime projection separates:

- explicit human approval / blocked / retry-exhausted attention;
- recoverable system work such as expired leases and automatic retries;
- task counts by status and domain.

This is the foundation for Ask Jhadina's future **"what needs me?"** response and Command Center projection.

---

## ONE-RUNTIME.3 — durable event fabric + replay checkpoints

`@jhadina/event-bus` now carries:

- WorkSession/task/correlation/causation context;
- actor/domain/capability lineage;
- authority reference for traceability only;
- event-level idempotency key.

The durable boundary includes:

- journal-before-dispatch `DurableEventBus`;
- append-only `public.jhadina_runtime_events`;
- unique event IDs;
- WorkSession-scoped idempotency suppression;
- ordered global sequence IDs;
- WorkSession/task foreign-key binding;
- replay by sequence;
- per-consumer, per-WorkSession durable checkpoints;
- compare-and-swap checkpoint advancement;
- in-memory and Supabase implementations;
- generic at-least-once replay consumer.

Replay acknowledgement happens **after** the handler succeeds. A crash after a side effect but before checkpoint advancement can replay the event, therefore subsystem handlers must use canonical event/task idempotency and remain safe under duplicate delivery.

Event delivery is coordination, never authorization.

---

## ONE-RUNTIME.4 — truthful capability/runtime health

`@jhadina/capability-registry` distinguishes:

- `unknown`;
- `ready`;
- `degraded`;
- `blocked`;
- `simulation-only`;
- `paper-only`;
- `disabled`.

Rules:

- `ready` requires live-runtime evidence;
- source/CI evidence cannot masquerade as a live provider/device;
- degraded, simulation-only and paper-only states require evidence;
- expiring evidence can decay a capability back to `unknown`;
- subsystem projections aggregate capability truth without inventing health;
- persistence must pass the same canonical validation before becoming current truth;
- failed persistence does not mutate in-memory truth.

Source-level persistence is included through service-role-only
`public.jhadina_capability_runtime_status` and a Supabase repository adapter.

Capability health is descriptive only. It cannot authorize an action or provider call.

---

## ONE-RUNTIME.5 — claimed task -> shared ComputeWorkload

The existing CLOUD.1/CLOUD.2 compute contracts remain canonical.

`@jhadina/compute-core` now has one provider-neutral ONE-RUNTIME bridge that:

- accepts a task descriptor carrying WorkSession/task/idempotency lineage;
- requires the task to be `running`;
- requires a live worker lease;
- rejects expired/unclaimed tasks;
- binds WorkSession ID into Compute authority metadata;
- uses deployment-owned resource profile IDs;
- resolves through the existing ComputeWorkload/resource-profile contracts;
- preserves cloud-burst, sensitivity and cost constraints;
- does not claim, authorize, execute or spend.

The duplicate web-level bridge was removed. There is one canonical bridge in Compute Core.

Existing Director, JLLM, voice, memory, PupsonStuff and POD compute adapters remain intact and can be attached to ONE-RUNTIME through thin subsystem adapters later.

---

## Integration contract for subsystems

A subsystem plugging into ONE-RUNTIME should:

1. Create or join the active WorkSession.
2. Register its capability definitions in the canonical Capability Registry.
3. Persist truthful runtime health separately from authorization.
4. Create tasks with stable idempotency + correlation lineage.
5. Express dependencies rather than directly driving another subsystem.
6. Let the runtime promote dependency-satisfied work to `ready`.
7. Atomically claim work before doing provider/compute execution.
8. Publish cross-core events with WorkSession runtime context.
9. Use replay checkpoints for durable event consumers.
10. Convert consequential effects into canonical ActionRequest objects.
11. Preserve WorkSession/task lineage on ActionRequest and receipts.
12. Report outputs as references instead of silently mutating another subsystem.
13. Never treat capability health, task readiness, event receipt, worker lease or compute placement as permission to act.

---

## Source-level verification targets

The branch includes tests for:

- dependency cycles and missing dependencies;
- legal task transitions;
- task idempotency and optimistic versions;
- double-claim prevention;
- lease heartbeat/release;
- expired-worker recovery;
- dependency readiness promotion;
- human-vs-system attention projection;
- Action Core lineage preservation;
- event journaling before dispatch;
- event duplicate suppression;
- replay after sequence;
- checkpoint CAS;
- failed-handler replay behavior;
- capability READY evidence requirements;
- stale capability evidence expiry;
- persistence failure behavior;
- claimed-task compute binding;
- rejection of unclaimed/expired compute tasks.

---

## Deliberate non-claims / remaining admission gates

This branch does **not** claim:

- the new Supabase migrations are applied to production;
- live lease takeover has been drilled against production Postgres;
- live event replay/checkpoint recovery has been drilled against production Postgres;
- Kubernetes/Kueue submission exists;
- real Homebase/GPU inventory is commissioned;
- Director, SHARK, Sports, PupsonStuff, Growth, SAM or JhadinaTV are plugged into the task graph;
- the Command Center UI consumes the runtime projection;
- browser-close/restart background-worker continuity is certified;
- cross-subsystem chaos/idempotency certification has passed;
- JHADINA-ONE-RUNTIME.FINAL is complete.

---

## Next sequence

- **ONE-RUNTIME.2/3 production admission** — apply migrations in the intended environment and run lease/replay crash drills.
- **ONE-RUNTIME.4 live evidence adapters** — each subsystem reports truthful runtime evidence through the shared capability contract.
- **ONE-RUNTIME.6 subsystem adapters** — Director, SHARK, Sports, Pupson/POD, Growth/Social, SAM and JhadinaTV attach to the common task/event/action lineage.
- **ONE-RUNTIME.7 operator surface** — Command Center + Ask Jhadina "what needs me?" projection.
- **ONE-RUNTIME.8 parallel chaos/idempotency certification** — concurrent workloads, killed workers/providers, replay, duplicate suppression and recovery.
- **JHADINA-ONE-RUNTIME.FINAL** — real simultaneous end-to-end certification.
