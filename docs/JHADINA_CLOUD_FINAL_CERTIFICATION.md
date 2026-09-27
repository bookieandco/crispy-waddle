# Jhadina Cloud FINAL certification

Workstream: CLOUD.3 through CLOUD.12  
Pull request: #721  
Certification model: source -> infrastructure -> shadow runtime -> live runtime -> full certification

## Executive verdict

Jhadina Cloud now has one governed compute/storage control plane that preserves
ONE-RUNTIME WorkSession authority, Action Core authorization, Director/media
authority, domain-specific consequential executors, and durable storage
lineage.

The repository may only claim **FULL CLOUD.12** when the current PR/deployed SHA
has all four lower-stage passes at the same time.

Physical infrastructure evidence is intentionally not fabricated. Until real
Homebase/K3s/Kueue/GPU/Ceph receipts and recovery drills are attached, the
correct production verdict remains:

> **Source/shadow ready; infrastructure/live BLOCKED.**

## Stage matrix

| Stage | Acceptance | Current source state |
| --- | --- | --- |
| source pass | type-check/tests for Compute Core, Jhadina Web compute boundary, Director compute adapters; migration/schema review; canonical authority boundaries preserved | **Implemented; must be backed by the current-head Jhadina Compute Core CI success before merge/freeze** |
| infrastructure pass | fresh hardware evidence + K3s/Kubernetes + Kueue + GPU smoke + Ceph health on real Homebase/cluster | **BLOCKED — no physical/live receipts are claimed by this PR** |
| shadow runtime pass | all canonical subsystem sources simultaneously admissible with storage lineage and priority isolation in deterministic shadow scenario | **Implemented; must be backed by the current-head Compute Core test success** |
| live runtime pass | real workload receipts for every required source plus storage restart, worker crash, telemetry, private-cloud denial and cost-denial drills | **BLOCKED — requires the live runbook** |
| full CLOUD.12 | all stages PASS on one release line | **BLOCKED until infrastructure/live evidence exists** |

## CLOUD.3 — intelligent data path

PASS criteria implemented:

- storage intent is separate from compute placement;
- durable primary store is distinct from acceleration cache;
- Ceph object/RGW, CephFS, local NVMe, SeaDrive/rclone and optional external
  collaboration tiers have explicit roles;
- PREPARE/TRAIN/SERVE/ARCHIVE and media INGEST/EDIT/REVIEW/DELIVERY patterns are
  modeled;
- sensitive/private data cannot silently burst to public cloud;
- cost limits are explicit and fail closed;
- compute/storage authority and idempotency lineage must match.

No external storage/provider becomes memory authority, creative approval
authority or business/job authority.

## CLOUD.4 — authorized execution substrate

Implemented:

- ComputeExecutionBundle;
- short-lived ComputeExecutionPermit;
- WorkSession/task/idempotency validation;
- compute.submit Action Core handler;
- Kubernetes/Kueue Job manifest generation;
- live digest-pinned worker requirement;
- deterministic Kubernetes job names;
- 409 restart recovery with annotation lineage verification;
- planned node vs actual observed node separation;
- create/observe/cancel Kubernetes API transport;
- owner-scoped durable submission/result receipts;
- Supabase service-role-only RPC adapter;
- production composition root that joins Action Core, Kubernetes transport and
  receipt persistence.

The receipt table is evidence/reconciliation state only. It grants no execution
authority.

## CLOUD.5 — hardware truth

Implemented:

- CPU/RAM/NVMe/GPU/network-fabric node vocabulary;
- observed free VRAM/utilization/temperature fields;
- expiring evidence timestamps;
- stale evidence rejected at placement time;
- Hardware Truth Scanner adapter;
- explicit confidence and coverage-limit preservation;
- freshness-aware node inventory;
- named fabrics: converged/frontend/storage/gpu-backend.

The Hardware Truth Scanner is an evidence adapter, not an oracle. PSU margin,
rack power/cooling, cables, reboot-memory tests, switch health and
Linux/Kubernetes/GPU-driver state require separate evidence.

## CLOUD.6 — storage fabric

Implemented source contracts establish:

- Ceph as planned private durable bulk/object/file/block substrate;
- CephFS for shared POSIX/RWX;
- object storage for durable model/media/archive paths;
- local NVMe as cache/scratch/checkpoint landing only;
- durable checkpoint proof before restart safety.

Physical Ceph deployment/health remains a live gate.

## CLOUD.7 — worker factory

Implemented:

- deployment-owned resource profiles;
- deployment-owned worker catalog;
- combined versioned runtime catalog;
- semantic workers for JLLM/characters, image/video, voice/audio/Foley,
  render/transcode/3D, training, memory and batch analysis;
- live images require immutable digest;
- workload kind/profile mismatch fails closed.

Domain code cannot provide an arbitrary image and bypass the deployment-owned
worker catalog.

## CLOUD.8 — efficiency

Implemented:

- priority-aware multi-workload admission;
- interactive jobs outrank background GPU jobs under contention;
- NVMe cache warming;
- dedupe by digest;
- pinned/active assets protected from eviction;
- undurable checkpoints protected from eviction;
- queue/GPU/VRAM/cache/model-load/durable-I/O/cost telemetry summaries.

## CLOUD.9 — media intelligence

Director remains the media truth/creative authority.

Existing Director surfaces cover governed generated assets, edit manifests,
transcript spans, A-roll/B-roll classification, Quick Cut proposals, quality
evidence, annotations/provenance and timeline mutation rules.

The Cloud layer adds only compute acceleration:

- proxy analysis;
- transcript analysis;
- scene detection;
- visual annotation;
- semantic embedding;
- quality checks;
- Quick Cut analysis.

These enter shared compute as Director-owned batch-analysis workloads with
asset/evidence locality. Storage does not become a second media index or editing
authority.

## CLOUD.10 — whole ecosystem

Canonical shared compute sources:

1. JLLM
2. Director
3. Social
4. Growth
5. PupsonStuff
6. generalized POD
7. Music/Foley
8. Memory
9. Money
10. SHARK
11. Sports
12. Opportunity/SAM
13. Jhadina TV

Compute accelerates Money/SHARK/Sports/Opportunity intelligence only. It does
not convert money.trade.submit, shark.trade, bets, payments, publication or
other consequential domain effects into generic compute jobs.

## CLOUD.11 — failure/recovery

Implemented:

- retryable failure classification;
- canonical retry budget enforcement;
- non-retryable invalid-input/policy outcomes;
- durable checkpoint restart-safety check;
- execution receipt idempotency;
- terminal-result conflict detection;
- Kubernetes create-success/409 recovery;
- negative same-name lineage-collision rejection.

The live runbook requires worker-crash and storage-restart drills before live
PASS.

## CLOUD.12 — final simultaneous certification

The deterministic source/shadow scenario requires all 13 canonical sources in
one contention window and verifies:

- storage plan admissibility;
- compute/storage lineage;
- resource admission;
- priority isolation;
- no missing subsystem source.

The live gate additionally requires durable evidence for:

- hardware inventory;
- K3s/Kubernetes health;
- Kueue health;
- GPU device smoke;
- Ceph health;
- one real workload receipt per required source;
- storage restart recovery;
- worker crash recovery;
- telemetry;
- denied private cloud burst;
- denied over-budget cloud candidate.

See:

- infrastructure/jhadina-cloud/live-certification-runbook.md
- infrastructure/jhadina-cloud/hardware-evidence.md
- infrastructure/jhadina-cloud/network-fabric.md
- infrastructure/jhadina-cloud/storage-data-path.md
- infrastructure/jhadina-cloud/worker-catalog.md

## External references

Folded as concepts/adapters without importing parallel authority:

- Ceph — durable private distributed storage;
- rclone — federation/import/export/sparse VFS patterns;
- SeaDrive — human on-demand/pinned file access;
- Shade — optional external media/collaboration tier;
- CloudTask — independent-job distribution/session-resume lesson;
- Juniper AI cluster storage-rack examples — fabric-role/scaling lesson;
- Hardware Truth Scanner — read-only hardware evidence and proof-gap discipline.

## What this PR does not claim

It does not claim:

- Homebase physical nodes have been provisioned;
- K3s/Kueue is installed and healthy on physical hardware;
- NVIDIA/AMD devices have passed a real job smoke;
- Ceph has been deployed or passed a live restart drill;
- public-cloud GPU spending is authorized;
- private media has been moved to an external provider;
- every subsystem has completed a real simultaneous workload.

Those are the remaining **live commissioning** gates, not source-code defects.

## Merge/freeze rule

Before merging/final freezing this workstream:

1. current branch must be forward-ported onto current main;
2. PR must be mergeable;
3. current-head Jhadina Compute Core CI must succeed;
4. relevant repo-wide gates triggered by the diff must be reviewed;
5. any infrastructure/live field lacking real evidence remains BLOCKED.

A green source CI is not permission to relabel missing physical evidence as
live certification.
