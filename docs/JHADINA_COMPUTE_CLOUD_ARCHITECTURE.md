# Jhadina Compute Cloud Architecture

Status: CLOUD.1 source-level control plane foundation.

This document defines one compute plane for Jhadina. It is deliberately not a
second memory system, second generation authority, second policy engine, or
second audit ledger. Existing domain systems keep ownership of intent,
authorization, durable job state, asset approval, memory admission and audit.
The compute plane answers a narrower question:

> Given an already-authorized workload, what trusted resources can execute it
> efficiently, and where should its inputs/outputs live while it runs?

## Goals

The plane must support:

- interactive JLLM and AI-character inference;
- image generation and ad creatives;
- video generation, replacement, animation and upscaling;
- voice, music, Foley and sound-effect generation;
- FFmpeg render/transcode/QC;
- Blender/3D/product generation;
- LoRA/model training;
- embeddings, memory indexing and batch analysis;
- PupsonStuff and generalized POD creative production;
- local-first operation with explicit, governed cloud burst;
- durable asset storage, hot caching and reproducible provenance.

## Non-goals

- It does not approve actions or external data movement.
- It does not replace Director generation tasks/executions.
- It does not replace Memory Core.
- It does not automatically spend money on cloud GPUs.
- It does not make generated media approved merely because a worker finished.
- It does not treat Seafile, rclone, Ceph, Ray, Kubernetes or a model server as
  a policy authority.

## Layer model

```text
Jhadina / Ask Jhadina / Director / Social / Growth / PupsonStuff / POD / Music
                                  |
                         governed domain intent
                                  |
             existing durable task + policy + audit boundaries
                                  |
                      @jhadina/compute-core request
                                  |
                  +---------------+----------------+
                  | Compute admission / priorities |
                  | Kueue + Jhadina resource rules |
                  +---------------+----------------+
                                  |
                  Kubernetes / K3s scheduling layer
                    |          |            |
              CPU/media     GPU local     Ray/KubeRay
               workers       workers      distributed jobs
                    |          |            |
                    +----------+------------+
                               |
                    hot node-local NVMe cache
                               |
                         Ceph durable storage
                               |
                 Seafile (human file UX) / rclone
                  (backup, migration, federation)
```

## Scheduling stack

### Kubernetes/K3s

Kubernetes owns pod/container lifecycle, node health and base placement. K3s is
the preferred Homebase distribution because this is intended to begin as a
small private cluster and grow without changing the workload contract.

GPU resources are exposed through vendor device plugins / NVIDIA GPU Operator.
Jhadina code must not hard-code a physical GPU into Director, PupsonStuff,
Social, JLLM or Character Core.

### Kueue

Kueue owns admission, quota and priority between classes of work. It should
prevent a two-hour background upscale or training run from starving an
interactive JLLM response.

Canonical queues:

| Queue | Purpose | Examples |
| --- | --- | --- |
| interactive | latency-sensitive | JLLM, active character, live voice |
| creative | short/medium GPU jobs | images, ads, clips, Foley, TTS |
| render | throughput jobs | final video render, FFmpeg, 3D |
| background | long jobs | LoRA training, batch generation |
| maintenance | lowest urgency | embeddings, memory re-index, cache warming |

The TypeScript priority floors in `@jhadina/compute-core` mirror these
classes. Cluster manifests should map them to Kubernetes PriorityClasses and
Kueue LocalQueues/ClusterQueues.

### Ray/KubeRay

Ray is an execution backend, not the universal job authority. Use it when a
workload gains from distributed actors, multi-GPU inference, model serving or
parallel pipelines. Single-machine ComfyUI, FFmpeg, Blender and small model
workers can remain ordinary Kubernetes Deployments/Jobs.

That keeps simple work simple while allowing large LLM/video workloads to span
nodes later.

## Storage hierarchy

### Tier 0 — VRAM/RAM

Only active model tensors, active inference state and short-lived execution
buffers. Never the durable copy.

### Tier 1 — node-local NVMe

Hot model cache, current scene assets, temporary frames, waveform intermediates
and render scratch. Fast but disposable.

Cache keys should be content-addressed/model-version-addressed so a worker can
rebuild its cache after node loss.

### Tier 2 — Ceph durable cluster storage

Planned durable source for:

- approved/generated media;
- model weights and LoRAs;
- character identity/voice/body assets;
- Director project media;
- PupsonStuff/POD source and print masters;
- large audio/foley libraries;
- backups of approved memory artifacts where applicable.

Use replicated pools for hot metadata/small frequently-mutated data and
erasure-coded pools for large colder media/model objects once the cluster is
large enough to make erasure coding operationally sensible.

### Tier 3 — encrypted off-site / external cloud

Disaster recovery and explicitly-authorized burst staging. rclone may copy or
sync between approved backends. External storage is not the primary authority
for private memory by default.

Seafile is a human-facing sync/library layer. It does not replace the object
registry or database records that bind a generated asset to its provenance,
approval and project.

## Memory

Memory remains owned by the existing Jhadina memory architecture.

Compute Cloud provides resources for:

- embedding generation;
- semantic index maintenance;
- summarization/compaction jobs;
- multimodal feature extraction;
- backup/snapshot work.

The compute scheduler never decides that an observation becomes memory.

Postgres/Supabase remains the durable metadata/authority plane; pgvector can
remain colocated with authoritative records where vector search is required.
Large source blobs belong in object storage, referenced by immutable IDs.

## Media and Foley

Director should decompose a production into independent work packets when
possible:

```text
shot generation ----+
dialogue/TTS --------+
Foley/SFX -----------+--> mix/render --> FFmpeg QC --> asset approval
music/stems ---------+
captions ------------+
```

The scheduler can run independent packets concurrently when resource capacity
permits. Director remains responsible for continuity, timing, mix intent and
approval.

Foley workers may be:

- retrieval workers selecting licensed/local library sounds;
- generative audio models;
- procedural DSP;
- recorded/user-supplied assets.

All return assets plus provenance; none bypass the Director audio/mix authority.

## Provider routing

Local is preferred.

A cloud node is eligible only when the workload resource request explicitly
sets `allowCloudBurst: true`. Sensitive work is denied on cloud by the current
CLOUD.1 planner even if burst is requested. Later policy may support explicitly
approved encrypted remote execution, but that is a separate human-gated
decision.

Cost ceilings are part of the resource request so a provider cannot be chosen
merely because it is faster.

## Existing repo mapping

- `packages/director-core/src/generation-*.ts`: durable generation intent and
  execution fencing; remains authoritative.
- `services/studio-render`: render worker candidate.
- `services/voice-sync`: voice/lip-sync worker candidate.
- `services/director-character-training`: training queue candidate.
- `services/physics-service`, `rig-service`, `tracking-service`,
  `replacement-service`: specialized Director workers.
- `services/pupson-background-remover`, `pupson-upscaler`: shared creative
  worker candidates rather than separate cloud infrastructure.
- `apps/pupsonstuff`: submits creative workloads; still owns commerce and
  print certification.
- JLLM/Character Core: interactive inference workloads.
- Social/Growth: image/video/ad-generation workloads.
- Music/Director audio: audio, Foley, stems, mix and render workloads.

## Efficiency rules

1. Load once, reuse often: warm model workers for frequently used models.
2. Content-address large assets so identical inputs are not recopied.
3. Prefer data-local execution when the correct accelerator is available.
4. Keep final/approved objects durable; treat render scratch as disposable.
5. Batch compatible background jobs but never at the expense of interactive
   work.
6. Separate model serving from one-shot batch generation.
7. Track GPU utilization, queue wait, model-load time, cache-hit rate,
   generation duration, failed/retried jobs and cost per completed asset.
8. Use idempotency keys already present in Director and equivalent domain
   contracts so retries do not duplicate expensive work.
9. Scale out only after profiling shows a bottleneck; do not distribute a
   workload merely because the cluster exists.
10. A worker completion is evidence, not creative approval.

## Deployment stages

### Stage A — single Homebase

- one K3s control/worker node;
- one or more local GPUs;
- local NVMe hot cache;
- existing Supabase/Postgres;
- existing ComfyUI/FFmpeg/Blender/services containerized behind providers.

This is enough to exercise the compute contract without Ceph.

### Stage B — resilient Homebase cluster

- three storage-capable nodes;
- Ceph;
- Kueue quotas;
- dedicated GPU worker nodes;
- model-cache warming;
- Prometheus/OpenTelemetry + GPU metrics.

### Stage C — remote Homebase

- trusted second site;
- explicit replication rules;
- scheduler understands site/data locality;
- failover for selected workloads.

### Stage D — governed public-cloud burst

- separate cloud resource flavor/queue;
- no sensitive jobs by default;
- hard spend ceiling and policy approval;
- encrypted staged inputs;
- ephemeral worker teardown;
- output/provenance returned to durable Jhadina storage.

## CLOUD.1 acceptance boundary

CLOUD.1 is source-level architecture and deterministic scheduling logic.
It does not certify any physical cluster as live. Live certification requires
actual node inventory, GPU drivers, K3s/Kubernetes health, storage health,
real workload execution and failure/recovery tests on the hardware.
