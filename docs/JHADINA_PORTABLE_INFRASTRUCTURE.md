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

## Proven plain-PostgreSQL replay

`.github/workflows/jhadina-portable-postgres-ci.yml` now certifies two existing
state domains against an unmodified PostgreSQL 17 service:

- Jhadina Memory lifecycle tables and correction/retirement functions;
- Money/SHARK/Coffer migrations through the current package migration chain.

The Money replay needs two historical prerequisites that hosted environments
previously supplied outside the numbered package chain: the base
`money_execution_attempts` table before migration 003 and the literal
`postgres` database role referenced by a recovery-function grant. Portable
bootstrap files reproduce those prerequisites without renumbering or rewriting
Money's canonical migrations.

This proves schema portability. It does not by itself prove that every existing
application repository has already stopped using the Supabase client API.
Those adapters can be moved incrementally while preserving the same PostgreSQL
state and domain semantics.

## RunPod staging database commission

The next portable layer is a **manual-only** RunPod staging database
commissioner:

- workflow: `.github/workflows/jhadina-portable-runpod-postgres.yml`;
- remote commissioner: `scripts/jhadina-portable-runpod-postgres.py`;
- safety contract: `scripts/jhadina-portable-runpod-postgres-contract.py`.

The workflow will not create or start billable compute unless the dispatch
explicitly authorizes that action. A newly created staging Pod requires an
existing RunPod Network Volume. An existing Pod is admitted only when its
reported `networkVolumeId` is non-empty and its volume mount path is exactly
`/workspace`.

Only SSH is exposed by the Pod workflow. PostgreSQL is reconfigured on every
commission to listen on `127.0.0.1:5432`, and the commissioner verifies the
effective PostgreSQL setting after restart. Public PostgreSQL, MinIO, Valkey,
or NATS ports are not part of the staging boundary.

The database stores generated admin/runtime credentials only beneath
`/workspace/jhadina-portable/secrets` with restrictive file permissions.
Those credentials are not printed in the commissioning receipt and are not
uploaded to GitHub Actions artifacts.

Schema replay is restart-safe and evidence-preserving. Each migration is
content-hashed and recorded in `jhadina_portable_migration_ledger`. A
migration and its ledger row commit in one PostgreSQL transaction. Reusing a
migration identifier with different contents fails closed as
`PORTABLE_RUNPOD_MIGRATION_DRIFT`.

The initial commission replays the canonical Memory lifecycle plus the Money
Core migration chain (including SHARK/Coffer/DEX state) and verifies their
required tables. Its receipt is explicitly
`STAGING_DATABASE_EVIDENCE_ONLY` with `canExecute=false`.

This does **not** make RunPod the permanent Jhadina database and does not yet
give Vercel direct database access. Web/runtime access must come through a
bounded private gateway or private overlay path; port 5432 must not be exposed
to the public Internet. Homebase later replaces the staging endpoint without
changing the domain schemas or authority model.

The staging commissioner now also installs the bounded portable Memory gateway
from `services/jhadina-portable-memory-gateway`. PostgreSQL still listens only
on `127.0.0.1:5432`; the only application-facing staging port is
`8095/http`, surfaced by RunPod's HTTPS proxy. The gateway accepts the same
MemoryStorage actions already used by Jhadina and cryptographically admits only
the production `crispy-waddle-jhadina-web` Vercel OIDC identity.

To cut Memory over without deleting legacy Supabase configuration, set the
Jhadina Web production environment to:

```env
JHADINA_MEMORY_STORAGE_PROVIDER=oidc_gateway
JHADINA_MEMORY_GATEWAY_URL=https://<pod-id>-8095.proxy.runpod.net/v1/memory
```

`oidc_gateway` is intentionally provider-neutral: the current endpoint can be
RunPod staging, and Homebase can later expose the same authenticated protocol.
The explicit provider setting takes precedence over legacy Supabase service-role
configuration, making migration reversible and observable rather than implicit.

Plain PostgreSQL needs the narrow compatibility grant file
`020_memory_runtime_grants.sql` because hosted Supabase normally supplies
service-role table privileges outside this repository's Memory migration chain.
CI now creates a non-owner runtime login that inherits only the dedicated
`jhadina_memory_gateway` capability role and exercises the complete
MemoryStorage flow through the actual HTTP gateway against PostgreSQL. The same
test requires a real PostgreSQL permission denial when that login attempts to
read protected Money state.

## PORTABLE.8 encrypted backup and restore

The portable layer now includes two separate backup paths:

- `.github/workflows/jhadina-portable-backup-ci.yml` creates an encrypted
  logical backup from one PostgreSQL 17 cluster and restores it into a
  completely separate PostgreSQL 17 cluster on every relevant source change.
- `.github/workflows/jhadina-portable-backup-restore.yml` is a manual-only
  live staging certification for the dedicated `jhadina-portable-staging`
  RunPod CPU Pod.

The backup tool is `scripts/jhadina-portable-backup.py`. It uses a PostgreSQL
custom-format logical dump, computes a SHA-256 of the plaintext dump, encrypts
the dump symmetrically with GnuPG AES-256 using a passphrase file, computes the
encrypted SHA-256, and then deletes the plaintext dump before returning.

The live workflow requires a GitHub Actions secret named
`JHADINA_PORTABLE_BACKUP_PASSPHRASE` with at least 24 characters. The secret
is copied to a restrictive temporary file on the Pod only for encryption and
is removed on success or cleanup. It is never written to the backup manifest
or uploaded as an artifact.

A same-Network-Volume backup does **not** satisfy disaster recovery. The live
workflow copies the encrypted dump and non-secret manifest off the Pod with
SCP, decrypts and hash-verifies it only on the ephemeral CI runner, restores it
into a fresh PostgreSQL 17 service, validates critical table row-count
fingerprints, Memory lifecycle functions, Memory gateway grants, and
Money/SHARK schema presence, then uploads only:

- the encrypted `.dump.gpg`;
- the non-secret manifest;
- the bounded restore receipt.

The independent GitHub Actions artifact is retained for seven days. That is a
temporary low-cost staging safety copy, not the final Homebase backup strategy.
Homebase can reuse the same backup tool and redirect the encrypted copy to an
owner-controlled disk or approved off-site target without changing the database
format or restore proof.

The live receipt is
`BACKUP_RESTORE_EVIDENCE_ONLY`, `canExecute=false`. Backup success grants no
Memory approval, Money execution, publishing, or external-action authority.

With an actual live RunPod backup/restore receipt, PORTABLE.8 is satisfied for
the temporary staging topology. Source code and CI certification alone do not
claim that a live RunPod backup has occurred.

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
