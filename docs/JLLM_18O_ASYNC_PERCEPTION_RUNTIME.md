# JLLM-18O — Asynchronous Perception Job Runtime

Universal upload no longer waits for OCR, transcription, video analysis, routing, or subsystem delivery.

## Request lifecycle

1. Authenticated upload request validates bytes, MIME, size, privacy, and media-security scan.
2. Clean media is promoted from private quarantine to actor-scoped trusted storage.
3. The immutable Intelligence Asset is registered.
4. A durable `jhadina_perception_jobs` row is enqueued.
5. The upload API returns HTTP 202 with the asset and job receipt.

The upload request does not invoke semantic perception or subsystem dispatch.

## Worker lifecycle

A worker claims the oldest eligible job using `FOR UPDATE SKIP LOCKED`.

```text
queued
  -> running
      -> completed
      -> needs_selection
      -> retry_wait -> running
      -> failed
```

A running job owns:

- worker ID
- random lease/fencing token
- lease expiration
- attempt number

The worker renews the lease while perception is active. Completion, retry, failure, and human-selection transitions require the current worker ID + token + unexpired lease. A stale worker cannot commit.

Transient failures use deterministic exponential retry delay, capped at 15 minutes. Attempts are bounded by `JHADINA_PERCEPTION_MAX_ATTEMPTS`.

## Human route selection

When routing is ambiguous, the worker persists the perception packet as `needs_selection` and performs no subsystem dispatch.

The authenticated status endpoint exposes only the proposed routes and evidence needed for the user to choose. Resume accepts explicit subsystem IDs, not free-text routing hints. The database verifies every chosen subsystem was among the routes previously proposed for that exact job.

On the next claim, the worker recomputes perception/routing, verifies the selection is still valid, filters the packet to exactly those selected routes, and only then dispatches.

## HTTP surfaces

- `POST /api/jhadina/upload` — secure upload + enqueue, returns 202.
- `GET /api/jhadina/perception/[jobId]` — actor-scoped status/result.
- `POST /api/jhadina/perception/[jobId]` — actor-scoped explicit route selection when status is `needs_selection`.
- `GET /api/internal/jhadina/perception/run` — `CRON_SECRET` protected worker runner.

The runner is only one host for the worker library. The same `createProductionPerceptionJobWorker()` composition can run in a dedicated long-running worker/Homebase process without changing job semantics.

## Safety / authority

Perception jobs are analysis jobs, not action jobs. They do not grant:

- policy or capability authority
- ActionExecutor authority
- financial/betting authority
- publishing/contact authority
- durable Jhadina memory mutation
- media mutation/render approval
- OverageOS opportunity/claim promotion

Subsystem delivery remains the immutable intelligence inbox boundary established in JLLM-18M.
