# JHADINA-PORTABLE.1-.10

Status: source-level portable infrastructure foundation.

## Purpose

Jhadina must keep moving before Homebase exists without making temporary SaaS
or RunPod infrastructure permanent architectural authority. The portability
layer therefore treats provider selection as deployment configuration while
preserving existing domain authority, provenance, idempotency and approval
boundaries.

## Sequence

1. **PORTABLE.1 — topology contract**: one typed manifest describes database,
   object storage, cache, queue, compute and backup roles.
2. **PORTABLE.2 — PostgreSQL authority**: canonical metadata is plain
   PostgreSQL, addressed by `DATABASE_URL`; Supabase is an optional adapter,
   not the database contract.
3. **PORTABLE.3 — object portability**: large artifacts use an S3-compatible
   boundary. MinIO is the staging/Homebase implementation; Ceph RGW remains a
   future clustered implementation.
4. **PORTABLE.4 — cache portability**: Valkey/Redis-compatible cache is
   acceleration only and never canonical evidence.
5. **PORTABLE.5 — queue portability**: NATS JetStream is the portable durable
   work/event transport. Existing domain job records remain authoritative.
6. **PORTABLE.6 — compute portability**: Homebase/K3s is preferred; RunPod is
   explicit burst compute. No provider receives domain authorization merely
   because it can execute a workload.
7. **PORTABLE.7 — research provenance**: research requires source URL,
   observation time, content hash and owning subsystem before durable
   admission. Raw research is evidence, not truth or Memory by itself.
8. **PORTABLE.8 — backup requirement**: no canonical topology is admitted
   without a durable encrypted backup target.
9. **PORTABLE.9 — staging guard**: a RunPod PostgreSQL instance may be
   canonical for an isolated staging environment but is rejected as production
   authority unless a separate explicit policy override is made.
10. **PORTABLE.10 — Homebase handoff**: moving from staging to Homebase changes
    endpoints and data location, not domain code or authority semantics.

## Current portable staging stack

`infrastructure/portable/docker-compose.yml` supplies:

- PostgreSQL 17
- MinIO
- Valkey
- NATS JetStream

All durable paths are rooted beneath `JHADINA_DATA_ROOT`. On RunPod this root
must point at an attached persistent Network Volume. On a future Homebase it
points at local durable storage.

The Compose stack intentionally binds service ports to loopback. Exposing
Postgres, MinIO, Valkey or NATS directly to the public Internet is not part of
this design.

## RunPod role before Homebase

RunPod may host the portable **staging** stack and burst workers so research,
SHARK shadow learning, Director, Music, voice, model evaluation and other work
can continue. It is not the permanent owner of Jhadina's irreplaceable data.

A RunPod pod without an attached persistent volume is never an admissible
database/object/queue authority.

GPU workers should remain independently disposable. Durable outputs and
provenance return to PostgreSQL/object storage before a worker can be treated
as complete.

## Research path

The canonical research flow is:

```text
discover -> fetch/watch/read -> normalize source
         -> hash + observed-at + provenance
         -> extract claims/evidence
         -> contradiction/alternative checks
         -> MAKE IT MAKE SENSE
         -> subsystem-owned research record
         -> optional downstream Memory proposal
```

Research may feed SHARK, Money, Opportunity/SAM, Music, Growth, Director,
OverageOS, commerce and other systems. It never bypasses those systems'
existing validation or authority boundaries.

## Supabase transition

The immediate goal is not to recreate all Supabase-specific repositories in
one change. Existing repositories remain valid while they are progressively
moved behind PostgreSQL/provider-neutral adapters.

The order is:

1. restore a working staging PostgreSQL authority;
2. replay canonical migrations into that database;
3. move Memory gateway persistence;
4. move Money/Coffer durable stores;
5. move shared evidence/provenance stores;
6. move remaining subsystem repositories;
7. certify backup/restore;
8. switch Homebase endpoints;
9. retire hosted Supabase as a required runtime dependency.

The current failed SWLC project must not be treated as a migration source until
it can accept connections again. If it becomes available, export/reconciliation
is an evidence-preserving recovery operation, not an excuse to overwrite newer
portable state.

## Acceptance boundary

PORTABLE.1-.10 is complete at the **source architecture/tooling** layer when:

- the manifest validator is green;
- staging and Homebase manifests are admitted;
- accidental RunPod-production authority is rejected;
- no canonical topology can omit durable encrypted backup;
- research provenance cannot be weakened;
- the portable Compose stack is present;
- compute-core CI exercises the contract.

This does not claim a RunPod or Homebase instance is live. Live certification
requires real persistent volumes, service health, migration replay,
backup/restore evidence and subsystem-specific commissioning.
