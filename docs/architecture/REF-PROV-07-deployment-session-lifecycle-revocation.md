# REF-PROV-07 — Deployment Session Lifecycle + Revocation

REF-PROV-06 proves an artifact was durably admitted and loaded. REF-PROV-07
prevents that proof from becoming permanent authority to keep running.

The lifecycle is:

```text
durable deployment proof
-> STARTED session
-> bounded heartbeat lease
-> repeated usability/revocation checks
-> STOPPED or INVALIDATED
```

## Revocation

Append-only revocation receipts can target an admission ID, artifact pin ID, or
artifact digest. A revocation may identify a superseding artifact, but
supersession never silently promotes the replacement.

A revocation effective before session startup blocks startup. A revocation
that becomes effective while a session is active causes the next heartbeat or
usability check to fail closed. Heartbeat processing persists INVALIDATED state
and an immutable invalidation event.

## Heartbeat lease

Every session has `heartbeatExpiresAt`. An active state alone is insufficient:
if the heartbeat lease expires, runtime use fails closed.

Heartbeat state replacement uses an expected session hash, providing an
optimistic-concurrency boundary so concurrent lifecycle mutations cannot both
win.

## Persistence

Migration `002_deployment_sessions_revocations.sql` adds:

- append-only artifact revocations;
- deployment session current state;
- append-only session events;
- indexes for target/runtime lookups;
- lineage to the durable admission table.

Revocation and session-event history cannot be updated or deleted.

## Authority

Deployment sessions are provenance/runtime safety state only. They do not grant
policy, factual, financial, coaching, betting, or general execution authority.

## Current artifact state

This lifecycle does not make unresolved artifacts deployable. SAM2, ComfyUI,
VoiceFixer, NeuralNote, and ACE-Step still require real pinned bytes and valid
REF-PROV-05/06 proof before a session can start.

## Certification

The isolated Reference Provenance workflow now includes
`verify:ref-prov-07`, covering:

- successful startup and heartbeat;
- heartbeat expiry;
- admission revocation;
- artifact-pin revocation;
- artifact-digest revocation;
- active-session invalidation;
- new-session rejection after revocation.

## Next

REF-PROV-08 — Runtime Lease Enforcement + Revocation Distribution: connect
session usability to every model invocation, distribute revocation state across
workers, and define bounded stale-cache behavior for temporarily disconnected
runtimes.
