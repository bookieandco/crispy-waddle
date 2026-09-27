# Jhadina Cloud Storage Data-Path Runbook

Status: CLOUD.3 source configuration guide. No production storage or external
provider is provisioned by this file.

## Goal

Give every compute/media workload a predictable route:

```text
authoritative asset/model record
          |
          v
 durable Homebase storage
   Ceph RGW / CephFS
          |
          +--------------------+
          |                    |
          v                    v
  node-local NVMe       human/editor mount
  cache / scratch       SeaDrive / rclone VFS
          |                    |
          v                    v
 GPU/CPU worker           NLE / workstation
```

Optional external media providers can sit beside the human/editor mount, but
never replace the durable authority.

## Canonical backend roles

### 1. Ceph RGW / object

Use for:

- immutable source media;
- generated media masters;
- training data shards;
- model/LoRA/checkpoint durable copies;
- print masters;
- large audio libraries;
- archive pools.

Properties expected by the storage planner:

- provider: `homebase`
- kind: `object`
- durability: `durable` or `archive`
- object API: yes
- range reads: yes
- read-mostly fanout: yes

### 2. CephFS

Use for:

- distributed training that needs POSIX;
- millions of small/random files;
- multi-writer/shared project state;
- render/3D workflows expecting a filesystem;
- trusted Homebase workstations and worker pods.

Expected planner properties:

- provider: `homebase`
- kind: `shared-posix`
- durability: `durable`
- POSIX: yes
- ReadWriteMany: yes
- range/seek reads: yes

Kubernetes should expose CephFS through Ceph-CSI for RWX consumers. Do not use a
raw shared RBD volume as a generic multi-writer filesystem.

### 3. node-local NVMe

Use for:

- model warm cache;
- repeated dataset reads;
- checkpoint landing zone;
- temporary frames;
- waveforms/stems;
- render scratch;
- rclone VFS sparse cache.

Expected planner properties:

- kind: `local-nvme`
- durability: `ephemeral`
- cache: yes
- sparse cache: yes
- offline pinning where the local mount layer supports it

Never store the only approved copy here.

## Human/editor access

### SeaDrive

Use SeaDrive as the private human virtual drive for ordinary project assets,
documents, artwork, approved exports and explicitly pinned/offline folders.

SeaDrive provides a placeholder/cloud-only model and downloads files when they
are opened. This is convenient and space-efficient, but it is not our primary
high-performance path for scrubbing huge camera originals.

Recommended uses:

- browsing project libraries;
- artwork/reference files;
- scripts/project documents;
- print-ready POD assets;
- approved deliverables;
- medium-size media that can be pinned before editing.

### rclone VFS media mount

For large remote media where the editor/NLE reads only parts of a file, use
rclone mount with full VFS caching so the local cache can remain sparse.

Baseline shape (values are deployment tuning knobs, not certified defaults):

```bash
rclone mount <remote>:<path> <mountpoint> \
  --read-only \
  --vfs-cache-mode full \
  --cache-dir <fast-nvme-cache> \
  --vfs-read-ahead <tuned-size> \
  --vfs-read-chunk-size <tuned-size> \
  --vfs-read-chunk-streams <tuned-count>
```

For editable/write-back workflows, remove `--read-only` only after the target
backend and application's file semantics have been tested. Generated/edit
outputs should preferably land in a dedicated write path instead of mutating
camera originals in place.

## Optional Shade federation

rclone supports Shade directly. If the owner chooses Shade later, configure it
as an **external media/collaboration backend**, not as Jhadina's canonical
storage authority.

Required secrets/config are deployment-only:

- Shade Drive ID
- Shade API key

Never commit either to the repo.

Suggested role:

- remote creative-team media access;
- guest/client collaboration;
- a selected non-sensitive delivery/edit mirror;
- temporary project exchange.

Do not default private Director/JLLM/character/Memory/Pupson source data into
Shade.

### Shade/rclone limitations to enforce

The rclone Shade backend currently reports:

- no native hashes;
- no writable modification times;
- delete through rclone is immediate rather than trash/recoverable;
- one rclone configuration per Shade drive.

Therefore:

1. keep SHA-256/digests in Jhadina's own asset/provenance records;
2. never treat Shade-side metadata as the canonical integrity receipt;
3. disable destructive `sync --delete`/purge workflows by default;
4. use copy/mirror-out semantics unless a separately authorized destructive
   action exists;
5. verify downloaded/returned assets against the Jhadina digest when integrity
   matters.

## AI lifecycle

### PREPARE

1. ingest raw data/media into durable object storage;
2. hash/register the canonical artifact;
3. normalize/curate into larger efficient shards when appropriate;
4. build indexes/proxies/features asynchronously;
5. keep temporary transforms on NVMe only until durable outputs are registered.

### TRAIN

Two paths:

**large/sequential dataset**
- durable object or CephFS source;
- prefetch/read-through NVMe cache;
- accelerators consume local cached copies where practical.

**small/random/shared**
- CephFS RWX/POSIX;
- NVMe cache for hot repeated reads where semantics permit.

Periodic checkpoint:

```text
GPU state
   |
   v
local NVMe checkpoint
   |
   +--> training resumes
   |
   v
async durable flush -> CephFS/RGW
   |
   v
digest + durable receipt
```

A checkpoint is restart-safe only after durable verification.

### SERVE

1. resolve immutable approved model/checkpoint;
2. prefetch to node NVMe/RAM;
3. verify digest;
4. mark worker warm;
5. accept inference traffic;
6. retain durable source independent of cache eviction.

### ARCHIVE

Use write-once/read-rarely object pools with durable retention/snapshots and
erasure coding when the physical Ceph cluster is large enough for the chosen
failure domain.

## Media lifecycle

### INGEST

- durable camera/source object first;
- checksum and provenance registration;
- proxy/transcode/index jobs can fan out after durable ingest.

### EDIT

- local CephFS when the editor is on trusted Homebase LAN;
- rclone VFS sparse/range cache for remote/object-backed media;
- pin working set to NVMe before unreliable/low-bandwidth sessions;
- proxies are acceleration artifacts, not source replacements.

### REVIEW

Director remains the review/approval authority. Review proxies, comments,
versions and annotations may be served through a collaboration provider, but an
external "approved" flag cannot self-approve a Director asset.

### DELIVERY

Create delivery copies/links from approved artifacts. Delivery storage is not
the canonical project source.

## Telemetry required before live certification

Collect per workload:

- durable-read/write bytes;
- cache hit/miss bytes;
- cache fill time;
- model load time;
- checkpoint local-write time;
- durable checkpoint flush time;
- storage throughput and IOPS;
- range-read amplification;
- proxy generation duration;
- editor mount open-to-first-frame time;
- external egress/cost where applicable;
- data-path failures/retries.

These metrics should feed resource-profile/storage-profile tuning; do not
hard-code provider-specific numbers into Director or JLLM.
