# Jhadina Cloud live certification runbook

Status: operator runbook for CLOUD.12 live-runtime certification.

This document defines evidence required to move Jhadina Cloud from source/shadow
readiness to infrastructure/live certification. It does not certify hardware by
itself.

## Non-negotiable rule

A live PASS must be tied to:

- exact deployed Git SHA;
- exact cluster/Homebase identity;
- UTC timestamps;
- WorkSession/task/idempotency lineage where a workload is involved;
- durable receipt/reference that can be independently re-read;
- explicit failure evidence for denial/recovery drills.

Screenshots, handwritten hardware specs, synthetic receipts and unit-test
fixtures do not count as physical live evidence.

## 1. Hardware evidence

For every compute node:

1. collect fresh hardware evidence;
2. normalize it into the canonical `ComputeNode` contract;
3. record observed/expires timestamps;
4. preserve proof gaps/coverage limitations;
5. prove the evidence is still fresh when the workload is admitted.

Windows/workstation nodes may use the Hardware Truth Scanner adapter.
Kubernetes/Linux workers should use cluster/device/metrics evidence.

Required fields include:

- CPU allocatable/free;
- RAM available;
- local scratch/NVMe available;
- accelerator vendor/model/count;
- total and available VRAM when the workload depends on it;
- requested network-fabric state/bandwidth;
- node readiness;
- evidence source, observed time and expiry.

Do not infer PSU margin, rack power, cables, cooling, reboot-memory health or
switch health from software-visible scanner data.

## 2. K3s/Kubernetes health

Capture a durable receipt showing:

- API server reachable;
- all required control-plane/system pods healthy;
- required compute nodes Ready;
- no unexpected MemoryPressure/DiskPressure/PIDPressure;
- intended taints/labels/resource classes visible;
- the deployed SHA/configuration identifier.

A cluster with no usable GPU/storage path is not infrastructure PASS merely
because the API server responds.

## 3. Kueue health

Capture:

- Kueue controller healthy;
- ResourceFlavors present;
- ClusterQueues/LocalQueues present;
- priority classes mapped as expected;
- an admitted interactive job;
- a queued/lower-priority competing job when capacity is constrained;
- evidence that priority/admission behavior matches the canonical queue model.

Required queue order:

1. interactive
2. creative
3. render
4. background
5. maintenance

## 4. GPU device smoke

Run a digest-pinned worker through the real Action Core -> compute.submit ->
Kueue/Kubernetes path.

Receipt must show:

- Action request/permit lineage;
- Kubernetes Job identity;
- planned node;
- actual scheduled node;
- visible GPU resource;
- non-zero GPU work;
- accelerator model/count;
- VRAM telemetry where available;
- terminal result and durable output/telemetry reference.

A direct `kubectl run` smoke can diagnose the cluster but does not by itself
satisfy Jhadina's end-to-end execution gate.

## 5. Ceph/storage health

Capture independent evidence for:

- Ceph cluster health;
- RGW/object path if enabled;
- CephFS/RWX path if enabled;
- free capacity;
- read/write smoke from a real worker;
- range/stream read where Director media uses it;
- node-local NVMe used only as cache/scratch;
- durable output visible after the worker exits.

Do not count NVMe-only output as durable.

## 6. Storage restart recovery drill

1. start a workload that writes a checkpoint locally then flushes it durably;
2. verify the durable checkpoint receipt;
3. interrupt/restart the worker/node after durable flush;
4. recover from the durable checkpoint;
5. confirm no duplicate authoritative output is created;
6. confirm WorkSession retry budget and idempotency are preserved.

A local-only checkpoint is intentionally not restart-safe.

## 7. Worker crash recovery drill

1. submit through Action Core;
2. force a retryable worker crash;
3. observe Kubernetes/ONE-RUNTIME failure evidence;
4. retry within the canonical task retry budget;
5. confirm the same task/idempotency lineage;
6. confirm no duplicate durable business result;
7. capture the successful terminal receipt.

Invalid input, policy denial and exhausted retry budget must remain fail-closed.

## 8. Submission crash-window drill

Exercise the specific window:

```text
Kubernetes Job created
-> process crashes before durable submission receipt write
-> caller retries
-> deterministic Job name returns HTTP 409
-> existing Job annotations are verified
-> the canonical receipt is recovered/written
-> no duplicate Job is launched
```

Also run a negative collision test: an existing same-name Job with different
WorkSession/task/idempotency/workload annotations must be rejected.

## 9. Private cloud-burst denial

Submit a sensitive workload with no explicit cloud-burst authorization while a
public-cloud node is otherwise eligible.

Required result:

- cloud node rejected;
- reason includes the canonical sensitive/cloud-burst denial;
- no provider submission;
- no private input transferred off the trusted boundary.

## 10. Cost-limit denial

Submit a cloud-eligible workload whose candidate node exceeds the explicit
hourly cost limit.

Required result:

- candidate rejected;
- no public-cloud job launched;
- no spend generated;
- denial recorded with workload lineage.

## 11. Whole-ecosystem simultaneous scenario

Run these as one contention window:

- JLLM interactive inference;
- Director media generation/edit analysis/render;
- Social creative;
- Growth creative;
- PupsonStuff creative;
- generalized POD creative;
- Music/audio/Foley;
- Memory embedding/index maintenance;
- Money analysis/simulation;
- SHARK analysis/simulation;
- Sports analysis;
- Opportunity/SAM analysis;
- Jhadina TV transcode/playback preparation.

Consequential domain effects remain outside Compute Cloud. For example,
Money/SHARK compute may analyze or simulate; real trade/bet/payment/publish
actions still require their canonical domain authorization/executor.

For every source, capture:

- WorkSession/task;
- compute workload;
- storage intent/plan;
- admission result;
- submission receipt;
- terminal result;
- actual node;
- durable output reference;
- telemetry reference.

## 12. Telemetry acceptance

At minimum, prove collection/retrieval of:

- queue wait;
- runtime;
- CPU/RAM;
- GPU utilization/VRAM where applicable;
- cache hit/miss;
- model load time where applicable;
- durable read/write;
- checkpoint local write + durable flush latency;
- estimated provider cost when external compute is used.

## Final CLOUD.12 verdict

CLOUD.12 is fully certified only when all of these are true on the same deployed
release line:

- source PASS;
- infrastructure PASS;
- simultaneous shadow-runtime PASS;
- live-runtime PASS;
- recovery/denial drills PASS.

If physical infrastructure is not provisioned, the correct verdict is
**source/shadow ready; infrastructure/live BLOCKED**, not a synthetic full PASS.
