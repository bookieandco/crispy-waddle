# JHADINA-ONE-RUNTIME.6 — event replay and consumer checkpoints

## Why

Publishing an event once is not enough for the multi-core runtime.

A consumer may crash after an event is durably recorded but before it finishes processing it. ONE-RUNTIME therefore needs replay semantics that preserve work instead of pretending in-memory delivery is sufficient.

## Semantics

The source-level contract now supports:

- monotonic journal offsets;
- WorkSession-scoped reads after an offset;
- bounded replay pages;
- consumer + WorkSession checkpoints;
- compare-and-swap checkpoint commits;
- at-least-once replay.

Processing order is:

```text
read next event
  -> consumer handles event
  -> checkpoint advances
```

If the consumer throws, the checkpoint does not advance.

On restart, the same event is delivered again.

Consumers must therefore keep their own mutations idempotent using the event id / runtime idempotency lineage already present in ONE-RUNTIME.1.

## Concurrency

Checkpoint writes require the caller's expected current offset.

A stale concurrent consumer cannot jump the checkpoint forward and silently skip events.

## Scope

Offsets are journal positions. Replay filters by WorkSession while retaining monotonic journal ordering.

## Production boundary

The current in-memory journal/checkpoint implementations prove semantics only.

Production admission still requires:

- durable journal/outbox storage;
- durable checkpoint rows;
- atomic append + dedupe;
- atomic compare-and-swap checkpoint commit;
- retention/replay policy;
- multi-process race tests;
- database failure/restart drills.

This layer does not grant task or Action Core authority.
