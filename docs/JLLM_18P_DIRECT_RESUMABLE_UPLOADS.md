# JLLM-18P — Direct / Resumable Private Upload Sessions

Large uploads no longer pass through the Next.js request body.

Supabase recommends TUS resumable upload for files larger than 6 MiB and supports signed upload tokens for resumable uploads. Jhadina uses that mechanism only for one random private quarantine object.

## Flow

```text
authenticated user
  -> POST /api/jhadina/upload/session
  -> server validates declared MIME + byte size + scanner privacy ceiling
  -> server creates random actor-scoped quarantine path
  -> server creates signed Storage upload token
  -> browser uploads directly to Supabase Storage with TUS
  -> POST /api/jhadina/upload/session/:sessionId
  -> server verifies stored object size + MIME
  -> server gives scanner a short-lived signed read URL
  -> clean scan returns SHA-256
  -> server records scan receipt
  -> quarantine object is promoted into trusted/
  -> immutable Intelligence Asset registration
  -> durable perception job enqueue
  -> HTTP 202
```

The signed upload token does not admit an asset to Jhadina. Storage completion is only evidence that bytes arrived in quarantine.

## Session issuance

Request:

```json
{
  "filename": "fight.mp4",
  "mediaType": "video/mp4",
  "byteLength": 314572800,
  "privacyClass": "sensitive",
  "intent": "analyze this boxing match"
}
```

Response includes:

- private bucket and exact quarantine object path;
- signed upload token;
- optional SDK signed upload URL;
- direct Supabase TUS endpoint;
- `x-signature` header containing the signed upload token;
- required 6 MiB chunk size;
- TUS metadata containing bucket, object name, content type and cache control;
- session expiration and finalize path.

Signed upload sessions expire after two hours, matching Supabase signed upload token lifetime.

## Resumable client contract

Use a standards-compliant TUS client. Configure it with the returned values rather than constructing a path client-side:

```text
endpoint = data.upload.resumable.endpoint
headers["x-signature"] = data.upload.resumable.headers["x-signature"]
chunkSize = data.upload.resumable.chunkSizeBytes
metadata = data.upload.resumable.metadata
uploadDataDuringCreation = true
upsert = false
```

Supabase currently requires 6 MiB chunks for its documented TUS client flow. The direct storage hostname is returned for hosted `*.supabase.co` projects.

## Finalization safety

Finalization has its own expiring lease and fencing token.

Before scan:

- session belongs to the authenticated actor;
- session is unexpired;
- scanner privacy ceiling still permits the asset;
- exact quarantine object exists;
- stored byte size equals the issued byte size;
- stored MIME equals the issued MIME.

The scanner is responsible for content/file-type validation, malware/media safety and SHA-256 calculation. A clean scanner result is durably recorded before promotion.

After a clean scan, retries are idempotent:

- scan hash is reused instead of re-egressing the file;
- quarantine -> trusted promotion tolerates a prior successful move;
- asset registration returns the existing deterministic asset;
- perception enqueue uses deterministic actor/asset identity;
- finalized sessions return the existing asset/job.

Non-clean scanner verdicts and integrity mismatches reject the session. Temporary scanner/service failures release the finalization lease and can be retried.

## HTTP surfaces

- `POST /api/jhadina/upload` — legacy/inline path, now limited to 6 MiB.
- `POST /api/jhadina/upload/session` — issue direct/resumable private session.
- `GET /api/jhadina/upload/session/[sessionId]` — actor-scoped session status.
- `POST /api/jhadina/upload/session/[sessionId]` — finalize after direct upload.
- `GET /api/jhadina/perception/[jobId]` — asynchronous perception status/results.

## Authority boundary

A signed upload token is a narrow Storage write capability for one quarantine object. It is not a Jhadina capability grant and cannot:

- write trusted Intelligence Assets directly;
- bypass media security;
- choose a subsystem;
- write durable JANET memory;
- execute Director/Creative/Overage/Sports actions;
- publish, contact, bet, trade or spend.

Only server-side finalization can move clean evidence into the trusted asset graph.
