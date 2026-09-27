# Jhadina Cloud External Reference Audit — CLOUD.4–12

Date: 2026-09-26

## CloudTask

Reference: `cloudtask.github.io/cloudtask` / TurnKey CloudTask documentation.

Useful mechanics:

- decompose a task into independent jobs;
- distribute jobs across several workers;
- retain a session so interrupted work can be resumed;
- worker-local files are not durable and must be moved to durable storage;
- faster workers naturally consume more queued jobs.

Adoption decision:

- **concept accepted** for batch decomposition and resumable execution;
- **implementation not adopted**. Jhadina already has stronger canonical
  WorkSession task graphs, durable leases, idempotency, event replay, Kueue
  admission, Action Core authorization and governed storage.
- no SSH shell-command execution path is introduced.

## Juniper AI cluster storage rack examples

Reference: `Juniper/terraform-apstra-examples/ai-cluster-designs/storage_racks.tf`.

Useful mechanics:

- L3 Clos storage fabrics;
- explicit distinction between storage-node and accelerator/server attachment;
- 200GbE and 400GbE access examples;
- multiple 400G spine-uplink profiles;
- separate Weka storage-node rack profiles;
- fabric shape changes as GPU/node scale changes.

Adoption decision:

Jhadina now models a named network fabric on resource requests and live node
inventory:

- `converged`
- `frontend`
- `storage`
- `gpu-backend`

Small Homebase deployments may use a converged network. Dedicated storage/GPU
fabrics are introduced only when measured throughput, latency or failure-domain
requirements justify them. The Juniper port counts and speeds are reference
scale designs, not a claim that Homebase owns or needs 200/400GbE today.

Kubernetes/Kueue remains the scheduling layer; fabric labels are placement
constraints/evidence, not authorization.

## Hardware Truth Scanner

Reference: `Michaelunkai/hardware-truth-scanner`.

Useful mechanics:

- read-only evidence collection;
- generated timestamp + host identity;
- CPU logical processors/topology;
- live RAM pressure/available memory;
- NVIDIA `nvidia-smi` VRAM/utilization/temperature/link telemetry;
- storage/volume health and free-space evidence;
- network link/error evidence;
- diagnostics and explicit proof-coverage gaps;
- clear distinction between software-visible evidence and physical tests that
  still require reboot, load testing, vendor tools or inspection.

Adoption decision:

`@jhadina/compute-core` includes a Hardware Truth adapter that converts a scan
into expiring node evidence. A scan can support scheduling, but:

- stale evidence makes a node unschedulable;
- critical evidence makes the node unavailable;
- warning evidence drains the node rather than calling it healthy;
- coverage limits stay attached to evidence;
- Windows Hardware Truth Scanner is one evidence adapter, not the universal
  Linux/Kubernetes node agent;
- scheduler truth still combines runtime reservations, storage capacity and
  Kubernetes-observed state.

A Windows scan cannot certify rack power, PSU load margin, cables, switch
fabric, Linux drivers, K3s health or Ceph health. Those require separate live
receipts.

## Shade / rclone / SeaDrive / Ceph

The earlier CLOUD.3 audit remains authoritative:

- Ceph RGW/object: private durable object/model/media/archive;
- CephFS: shared POSIX/RWX;
- node NVMe: disposable cache/scratch/checkpoint landing;
- SeaDrive: private human virtual drive/on-demand/pinned access;
- rclone VFS: sparse/chunked/range-oriented remote media bridge;
- Shade: optional external media/collaboration tier only.

No external tier becomes canonical provenance, memory authority or creative
approval authority.

## Resulting final stack

```text
WorkSession task
  -> active lease
  -> Action Core authorization
  -> ComputeWorkload + StorageIntent
  -> fresh hardware/storage evidence
  -> batch/Kueue admission
  -> Kubernetes or Ray worker
  -> NVMe acceleration
  -> Ceph durable output
  -> result + telemetry receipt
  -> WorkSession reconciliation
```

This stack retains the useful parallel-worker idea from CloudTask, the
high-throughput fabric lesson from Juniper, and the evidence-discipline of
Hardware Truth Scanner without introducing a second scheduler or authority.
