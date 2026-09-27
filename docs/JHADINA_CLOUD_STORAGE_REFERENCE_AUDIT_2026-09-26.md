# Jhadina Cloud Storage Reference Audit — 2026-09-26

Status: CLOUD.3 source-level synthesis.

## References reviewed

1. **Ceph / Vultr — “Architecting Cloud Storage for AI Native Applications”**
   - YouTube: `NYqBu8E_QT8`
   - Useful concepts: keep storage adjacent to accelerator compute; expose object,
     block and shared-file interfaces according to workload; shared read/write file
     access for distributed AI; region/data-governance locality; high-bandwidth
     networking between GPU workers and storage; models as immutable deployment
     artifacts.

2. **Storage Bites — “The AI Storage Blueprint: A 4-Stage Guide for Google Cloud”**
   - YouTube: `2gZ72Qebiww`
   - Useful concepts: PREPARE / TRAIN / SERVE / ARCHIVE are materially different
     I/O phases; large sequential training sets can use object storage plus local
     cache; small/random or shared-writer training favors parallel POSIX storage;
     checkpoints should land quickly on local fast storage then drain to durable
     shared/object storage; serving should prefetch/cache immutable model weights;
     archive is write-once/read-rarely and cost/durability dominated.

3. **Shade**
   - Product patterns reviewed: mounted cloud-NAS experience, range/byte-oriented
     streaming for large media, pinning/shared caches, offline work, automatic
     proxies, metadata/AI search, transcription, review/approval, versioning,
     client delivery, workflow automations and MCP.
   - Shade is useful as both a UX benchmark and an optional external media tier.
     It is not promoted to Jhadina authority.

4. **rclone**
   - rclone VFS supports sparse partial-file caching, read-ahead and chunked
     parallel reads. This is the existing open/provider-neutral path closest to
     the "open a huge cloud file without first downloading all of it" behavior
     needed by NLE/media workflows.
   - rclone has a first-class Shade backend. Therefore Shade can plug into the
     existing federation layer without a new bespoke storage client.
   - Important Shade-backend limitations: no native hashes or writable modtimes;
     deletes through rclone are immediate rather than trash/recoverable; one
     rclone config is required per Shade drive. Jhadina must never use a Shade
     rclone remote as the sole provenance/integrity authority.

5. **Seafile / SeaDrive**
   - SeaDrive remains valuable for the human-facing private cloud drive:
     placeholder files, on-demand download, local cache control and offline pinning.
   - SeaDrive generally downloads a file when it is opened. That is not the same
     as Shade-style byte-level media streaming. For very large NLE assets, use
     CephFS locally or rclone VFS sparse/chunked reads; SeaDrive remains excellent
     for project files, artwork, documents, deliverables and explicitly pinned
     media.

## Architectural conclusions

### A. One durable core, several access shapes

Do not create separate "AI storage", "Director storage", "Pupson storage" and
"JLLM storage" systems.

Homebase uses one durable storage estate with multiple interfaces:

- **Ceph RGW/object** — datasets, immutable assets, generated media, model objects,
  long-lived blobs and archive pools.
- **CephFS** — shared POSIX/RWX data needed by multi-node training, render farms,
  applications that expect normal filesystem semantics and high-concurrency
  shared project data.
- **RBD/block** — VM/database/single-writer volumes where block semantics are the
  correct fit.
- **node-local NVMe** — disposable scratch, model cache, read-through cache,
  temporary frame/audio buffers and fast checkpoint landing zone.
- **Seafile/SeaDrive** — human virtual-drive/library UX over approved Jhadina
  assets.
- **rclone VFS** — provider-neutral sparse/range/chunked access bridge for remote
  object/file backends.
- **Shade via rclone** — optional external collaboration/media tier only after an
  explicit storage/privacy decision.

### B. Storage lifecycle must be explicit

Every substantial workload should declare the storage lifecycle stage and access
pattern alongside compute requirements.

| Stage | Dominant requirement | Jhadina default |
| --- | --- | --- |
| PREPARE | capacity + ingest throughput + durable object namespace | Ceph object |
| TRAIN large/sequential | accelerator feed rate + local repeat-read cache | object/CephFS + NVMe cache |
| TRAIN small/random/shared | POSIX + RWX + low latency | CephFS + NVMe |
| SERVE | model-load time + read-mostly fanout | durable model store + NVMe prefetch |
| ARCHIVE | durability + capacity + lowest operational cost | Ceph archive/erasure-coded object pool |
| MEDIA INGEST | durable landing + proxy/index fanout | object/CephFS |
| MEDIA EDIT | range reads + seekability + local sparse cache | CephFS locally; rclone VFS / approved media mount remotely |
| MEDIA REVIEW | proxies + annotations + versions | Director review authority over proxy/delivery storage |
| MEDIA DELIVERY | controlled links/exports | approved delivery copy; never canonical authority |

### C. Checkpoints are two-phase

Training checkpoint semantics:

1. write checkpoint to local NVMe/RAM-backed fast landing zone;
2. record local completion evidence;
3. asynchronously flush to durable CephFS/object storage;
4. only the durable receipt is restart-safe;
5. local checkpoint may be deleted after durable verification/retention policy.

This minimizes accelerator stalls without pretending ephemeral storage is
durable.

### D. Model serving uses immutable versions + prefetch

Model/LoRA artifacts remain immutable/version-addressed. A serving deployment:

1. resolves the approved model version;
2. prefetches it to node NVMe/RAM cache before accepting traffic;
3. verifies the expected artifact digest from Jhadina provenance;
4. starts serving;
5. retains the durable model copy independently of the warm cache.

### E. Shade patterns we should reproduce vs. buy

**Reproduce/provider-neutral:**
- storage intent + lifecycle planning;
- local/pinned/read-through cache;
- proxy generation triggers;
- semantic media indexing hooks;
- durable review/approval links to Director authority;
- version/asset lineage;
- automations as governed events;
- natural-language Jhadina asset search.

**Potentially buy/use Shade for:**
- polished remote creative-team mount/stream UX;
- external guest/client review and delivery;
- remote NLE workflows when its commercial service is preferable to operating
  our own edge/media gateway.

Using Shade should be optional. The private system must continue functioning
without it.

## Authority boundaries

- Director still owns creative project state, review, QC and approval.
- Memory still owns memory admission.
- Compute owns neither storage authority nor content approval.
- Storage backends hold bytes; Supabase/Postgres + asset/provenance records hold
  identity, policy and lineage.
- External storage never becomes the only copy of a private approved asset by
  scheduler convenience.
- Destructive federation operations require an explicit action boundary.

## CLOUD.3 implementation

`@jhadina/compute-core` now gains:

- storage lifecycle stages;
- access-pattern and durability contracts;
- storage backend capability inventory;
- independent primary-storage and cache selection;
- fail-closed sensitive/external-storage policy;
- inferred POSIX/RWX requirements for random/small shared-writer training;
- range-stream + offline-pinning requirements for active media edit;
- archive-tier requirement;
- stage-specific strategies for prefetch, read-through, pinning and
  local-then-durable checkpoints.

This remains pure planning. It does not mount a drive, copy bytes, provision
Shade, delete files, authorize external transfer or spend money.
