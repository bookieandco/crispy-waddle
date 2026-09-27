# JHADINA-ONE-RUNTIME.2 — worker lease semantics

## Purpose

Define the worker-coordination behavior that every background runtime must obey before Director, SHARK, Sports, PupsonStuff, Growth, SAM, JhadinaTV or any other subsystem is connected.

This is scheduling infrastructure, not execution authority.

## Contract

A worker claim is bound to:

- WorkSession ID;
- task ID;
- owner user ID;
- worker ID;
- opaque lease token;
- claim timestamp;
- heartbeat timestamp;
- expiry timestamp.

A worker may only claim tasks that are:

- dependency-ready;
- in a claimable state;
- below their max-attempt ceiling;
- compatible with the worker's declared capability set;
- not already covered by an unexpired lease.

Claims transition a task into `running` and increment the attempt counter.

## Heartbeats

Only the worker/token pair holding the lease may renew it.

Heartbeats extend expiry but do not:

- change task authority;
- alter Action Core policy;
- approve a consequential action;
- modify capability health.

## Completion

Only the active lease holder may finish the task.

Worker completion may move a running task to:

- completed;
- failed;
- retrying;
- paused;
- blocked;
- cancelled.

Outputs remain references. A completed task does not imply that another domain may consume the output without its own admission/governance rules.

## Crash recovery

Expired running work is recovered deterministically:

- if attempts remain: `retrying`;
- if max attempts are exhausted: `failed`.

Another compatible worker may reclaim a retrying task.

This is how ONE-RUNTIME prevents a crashed render/SAM/Sports/SHARK worker from leaving a task permanently stuck in `running`.

## Current implementation boundary

`InMemoryWorkSessionTaskLeaseManager` exists to prove behavior and let subsystem adapters integrate before production persistence lands.

It is explicitly **not production durable**. Process death loses leases.

Production admission requires an atomic Postgres/Supabase implementation with compare-and-swap/row-lock semantics so two distributed workers cannot both win the same claim.

## Next

ONE-RUNTIME.3 should add the production persistence/claim primitive, including:

- normalized task rows;
- atomic claim;
- lease expiry indexes;
- optimistic version check;
- heartbeat;
- recovery query;
- owner/session scoping;
- RLS/privilege review;
- live two-worker race test.
