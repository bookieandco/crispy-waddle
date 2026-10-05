# JHADINA-HOMEBASE.1 → .10

Status: **source architecture complete; live Homebase hardware certification remains evidence-gated**

This sequence formalizes the portable/cloud work already present in the repo into one
owner-controlled Homebase contract. It does not create a second policy engine,
memory system, or domain authority.

## HOMEBASE.1 — Canonical Runtime Contract

`homebase-runtime.ts` makes Homebase the only canonical infrastructure authority.
PostgreSQL, S3-compatible object storage, NATS JetStream and encrypted backup remain
local. RunPod is explicitly `RESEARCH_AND_BURST_ONLY` and may not own canonical
state or grant domain authority.

## HOMEBASE.2 — Local Service Registry

`homebase-service-registry.ts` provides deterministic registration, dependency
validation and startup ordering. Canonical database/object/queue/backup roles must
resolve to exactly one local ready service.

## HOMEBASE.3 — Canonical Storage

`homebase-storage.ts` binds Homebase to local PostgreSQL plus S3-compatible durable
objects and requires a separate encrypted backup target. Cache is acceleration only.

`infrastructure/homebase/docker-compose.yml` supplies the canonical local foundation:
PostgreSQL 17, MinIO, Valkey and NATS JetStream. All service ports bind to loopback.

## HOMEBASE.3A — Canonical Compute Gateway Contract

`homebase-compute-gateway.ts` exposes the canonical admission contract that remote
clients such as Director may bind to once a real Homebase runtime exists:

- `GET /health`;
- `POST /v1/director/post-submissions`;
- authority = `CANONICAL_COMPUTE_SUBMISSION`;
- trust domain = `homebase` or `remote-homebase`.

The gateway validates active ONE-RUNTIME lease lineage, exact task/descriptor
identity, sensitive/local-first Director post bindings, and returned Kubernetes
submission receipts. It remains fail-closed when physical Homebase/K3s/Kueue
readiness is absent. This source contract is not evidence that Homebase hardware is
live.

## HOMEBASE.4 — Job / Compute Router

`homebase-router.ts` routes workloads without moving authority. Local/sensitive jobs
remain on Homebase. Public research and batch jobs prefer RunPod while it is
reachable and cloud burst is explicitly allowed. Every decision returns
`canonicalCommitTarget: HOMEBASE`.

## HOMEBASE.5 — RunPod Worker Adapter

`runpod-worker-adapter.ts` produces execution-only CPU Pod and GPU Serverless
dispatch contracts. It stores only a `secret:RUNPOD_API_KEY` reference, never the
credential. CPU Pod proxy URLs and Serverless endpoint IDs are validated before use.

The existing repository RunPod commissioning scripts and GitHub workflows remain the
live provider layer; this module is the shared control-plane contract above them.

## HOMEBASE.6 — Research Worker Fleet

`homebase-worker-fleet.ts` defines RunPod CPU research workers for crawl/PDF/OCR/
document/entity/bulk-analysis work. RunPod workers are disposable and cannot write
canonical state.

## HOMEBASE.7 — GPU Worker Fleet

The same fleet contract defines RunPod GPU burst for vision, transcription,
embeddings, large-model batch work, image/video/audio generation and training.
Homebase GPU workers remain available for private and interactive workloads.

## HOMEBASE.8 — Result / Evidence Return Protocol

`homebase-result-envelope.ts` admits remote results only as `EVIDENCE_ONLY`.
Every result carries job/subsystem/idempotency lineage, hashes and
`canonicalCommitRequired: true`. A successful worker does not self-admit output into
Memory, Money, OverageOS, Director or any other domain.

## HOMEBASE.9 — Offline / Fallback Mode

`homebase-offline.ts` keeps healthy canonical services writable during Internet
loss while disabling cloud jobs. Partial durable-service loss degrades to a
read-only-safe or stopped state instead of silently writing to an incomplete
authority.

## HOMEBASE.10 — Subsystem Migration

`homebase-subsystem-migration.ts` maps the current major Jhadina domains to Homebase
authority. RunPod is allowed only as research/GPU execution according to each
subsystem's workload. External action authority remains owned by the existing domain
governance.

Covered domains include JLLM, Memory, Director, Music, Money, SHARK, Sports,
Opportunity/SAM, OverageOS, CRM, PupsonStuff, Campaign, Safety, Social/Growth and
JhadinaTV.

## HOMEBASE.FINAL

`homebase-final.ts` separates two truths:

- `sourceComplete`: all HOMEBASE.1-.10 contracts and tests are present and coherent.
- `liveReady`: sourceComplete **plus** real Homebase hardware evidence, a live
  RunPod execution/return receipt, and a successful encrypted backup/restore drill.

Repository CI may close source architecture. It must not fabricate the three physical
or provider receipts.

## Canonical operating rule

```text
domain intent
  -> Homebase job/router
  -> local execution OR RunPod research/GPU burst
  -> evidence/result envelope
  -> Homebase validation
  -> owning subsystem canonical commit
```

RunPod never becomes Jhadina's memory, case ledger, financial ledger, CRM, or
creative approval authority.

## What the owner will need to do for live certification

1. bring up the physical Homebase and select durable `JHADINA_DATA_ROOT` and a
   separate backup target;
2. place real local infrastructure passwords in a non-committed Homebase secret file;
3. keep `RUNPOD_API_KEY` in the Homebase/GitHub secret store;
4. identify or create the RunPod CPU research Pod proxy and GPU Serverless endpoint;
5. run one public research job and verify its evidence returns to Homebase;
6. run one encrypted backup/restore drill.

Until then, RunPod can continue to carry research-heavy work from the existing
commissioned workflows while Homebase remains a source-level target rather than a
fabricated live machine.
