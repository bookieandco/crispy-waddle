# JLLM-18R — Asynchronous Upload Finalization + Quarantine Lifecycle

JLLM-18R moves large-file scanner/hash/promotion work out of the user-facing finalization request.

## Canonical large-file flow

```text
issue signed session
  -> browser TUS upload to private quarantine
  -> POST finalize request
  -> durable finalize_queued
  -> HTTP 202 immediately
  -> leased finalization worker
       -> exact stored size/MIME verification
       -> media-security scan + SHA-256
       -> durable scan receipt on session
       -> quarantine -> trusted promotion
       -> deterministic Intelligence Asset registration
       -> perception job enqueue
       -> finalized
  -> browser session polling sees perceptionJobId
  -> normal asynchronous perception pipeline
```

The two-hour signed upload-token expiration controls whether a **new** finalization request may be created. A finalization request durably queued before token expiry remains eligible for worker execution after expiry.

## Finalization state machine

```text
issued
  -> finalize_queued
      -> finalizing
          -> finalized
          -> finalize_retry -> finalizing
          -> rejected
  -> expired
```

Workers claim finalization with `FOR UPDATE SKIP LOCKED`, an expiring lease, and a random fencing token.

Every scan receipt, completion, retry, and rejection transition requires the live worker ID + fencing token + unexpired lease.

If a worker dies:

- the expired lease may be reclaimed while attempts remain;
- a crash on the last allowed attempt is terminalized to `rejected` instead of remaining stuck forever;
- transient failures receive deterministic exponential backoff;
- integrity/security failures reject immediately.

## Retry-safe checkpoints

Finalization is intentionally restartable across partial success:

- once a clean SHA-256 scan receipt exists, later attempts do not re-egress the file to the scanner;
- trusted promotion is idempotent if a prior attempt already moved the object;
- Intelligence Asset registration is deterministic/idempotent;
- perception-job identity is deterministic per actor + asset.

This makes crashes after scan/promotion/registration recoverable without duplicating durable evidence.

## Quarantine lifecycle

Rejected and expired sessions are never silently left in quarantine.

Their cleanup lifecycle is separate from finalization:

```text
cleanup none
  -> pending
  -> running
      -> cleaned
      -> pending (retry)
```

Cleanup uses its own lease/fencing token. The worker only removes paths under `quarantine/`.

A durable `jhadina_quarantine_cleanup_receipts` record is written for terminal-session cleanup.

## True orphan sweep

A second cleanup path discovers Storage objects that:

- are in `jhadina-intake-private/quarantine/...`;
- are older than six hours;
- have no matching `jhadina_upload_sessions.quarantine_path`.

The six-hour grace window prevents races with session issuance. These objects are deleted idempotently and receive an `orphan` cleanup receipt.

Trusted objects are outside this sweep. Cleanup code cannot use the quarantine deletion method against `trusted/` paths.

## HTTP / worker surfaces

User-facing:

- `POST /api/jhadina/upload/session` — issue signed/resumable upload capability.
- `POST /api/jhadina/upload/session/[sessionId]` — request durable finalization; returns immediately.
- `GET /api/jhadina/upload/session/[sessionId]` — actor-scoped finalization + cleanup status.

Worker:

- `GET /api/internal/jhadina/upload/run`
  - `CRON_SECRET` protected;
  - processes bounded finalization batch;
  - processes rejected/expired cleanup batch;
  - processes orphan cleanup batch.

The same production worker composition can run on Homebase or another long-running worker instead of the HTTP runner.

## Configuration

```text
JHADINA_UPLOAD_FINALIZE_BATCH_SIZE=2
JHADINA_UPLOAD_FINALIZE_LEASE_MS=300000
JHADINA_UPLOAD_FINALIZE_MAX_ATTEMPTS=4
JHADINA_UPLOAD_CLEANUP_BATCH_SIZE=5
JHADINA_UPLOAD_ORPHAN_CLEANUP_BATCH_SIZE=5
```

Scanner configuration remains:

```text
JHADINA_MEDIA_SCANNER_URL=
JHADINA_MEDIA_SCANNER_TOKEN=
JHADINA_MEDIA_SCANNER_PRIVACY_CEILING=
```

## Authority boundary

Finalization workers transform already-uploaded untrusted bytes into governed evidence. They do not receive:

- ActionExecutor authority;
- subsystem execution authority;
- betting/trading/payment authority;
- publishing/contact authority;
- JANET durable-memory authority;
- OverageOS claimant/claim promotion authority.

The output of successful finalization is only a trusted Intelligence Asset plus a queued perception job.
