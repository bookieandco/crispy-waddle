# REF-PROV-08 — Runtime Lease Enforcement + Revocation Distribution

REF-PROV-08 closes the gap between a deployment session existing and a model
invocation actually checking that session.

## Runtime invariant

Every governed model call must pass:

```text
durable deployment
-> active REF-PROV-07 session
-> unexpired heartbeat
-> current/bounded-stale revocation snapshot
-> no matching revocation
-> provider/model invocation
```

A provider object being constructed successfully is not sufficient.

## Distributed revocation view

`RevocationDistributionSnapshot` is deterministic and content hashed. It has:

- monotonic epoch;
- generatedAt;
- expiresAt;
- sorted revocation receipts;
- snapshotHash.

Workers reject malformed hashes, future snapshots, epoch rollback, expired
snapshots, and cache age beyond the configured `maxStaleMs`.

If the distribution endpoint is temporarily unavailable, a worker may use its
last verified snapshot only while BOTH its snapshot expiry and configured
stale-cache bound remain valid. After either boundary, invocation fails closed.

`HttpRevocationDistributionSource` provides the production network boundary.
Non-local remote endpoints must use HTTPS.

## Director / ComfyUI

The canonical Director provider factory now requires a `RuntimeLeaseGuard`
alongside REF-PROV-06 deployment proof. The constructed provider is wrapped so
lease/revocation verification runs before:

- submit;
- idempotency recovery lookup;
- status;
- cancel.

This prevents reconciliation/status paths from bypassing the same artifact
lease required for generation.

The async composition root and reconciliation route are also corrected to
await governed provider construction.

## SAM2

The isolated Python tracking worker validates runtime lease material before
every inference:

- session ID/hash;
- heartbeat expiry;
- revocation snapshot hash/expiry;
- existing artifact/admission/attestation proof.

The request body cannot supply this proof; the host owns it. Expired lease or
revocation snapshot blocks inference before the model engine runs.

## Durable session adapter

`PostgresDeploymentSessionLedger` implements the REF-PROV-07 session ledger
against the durable tables introduced by migration 002. Session mutation uses
compare-and-swap on `session_hash`; revocations and lifecycle events preserve
immutable identity/hash semantics.

## Security boundary

A revocation snapshot is runtime safety evidence, not policy authority or
factual authority. It cannot authorize a model, financial action, coaching
decision, bet, personality mutation, or provider side effect.

## Current production blocker

This enforcement still does not make unresolved model artifacts admissible.
SAM2, ComfyUI, VoiceFixer, NeuralNote, and ACE-Step require real artifact bytes,
source verification, pinning, compatibility admission, and attestation before
their runtime sessions can exist.

## Certification

The isolated Reference Provenance workflow now runs
`verify:ref-prov-08`, covering:

- live session + snapshot proof;
- remote revocation ahead of local-ledger refresh;
- bounded disconnected-cache operation;
- stale cache rejection;
- snapshot expiry rejection;
- epoch rollback rejection.

Director tests prove distributed revocation is checked before provider calls.
SAM2 tests prove expired runtime leases reject before inference.

## Next

REF-PROV-09 — Revocation Publisher + Runtime Health Receipts: produce the
canonical revocation feed from durable storage, add worker acknowledgement and
health receipts, and make fleet coverage/revocation lag observable.
