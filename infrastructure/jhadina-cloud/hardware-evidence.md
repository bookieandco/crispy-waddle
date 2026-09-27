# Homebase hardware evidence admission

CLOUD.5 does not permit handwritten hardware specifications to become scheduling
truth.

## Evidence sources

### Windows / workstation nodes

`Michaelunkai/hardware-truth-scanner` can supply read-only evidence for:

- CPU logical processors/topology;
- available RAM and memory pressure;
- NVIDIA VRAM/free VRAM/utilization/temperature when `nvidia-smi` exists;
- volumes/storage health;
- network speed/error evidence;
- diagnostics and proof gaps.

The Compute Core adapter converts this report into an expiring `ComputeNode`.

### Linux/K3s GPU workers

Production GPU nodes should report the same canonical fields using the native
cluster/device/metrics stack:

- Kubernetes Node allocatable CPU/RAM/ephemeral storage;
- NVIDIA/AMD device plugin inventory;
- GPU operator/DCGM or vendor-equivalent VRAM/utilization/thermal metrics;
- local NVMe capacity;
- named network-fabric health/bandwidth;
- node Ready/pressure/taint state.

A Linux agent may implement this contract later. It must not bypass the same
freshness rules.

## Freshness

Every node record has:

- evidence source;
- observed timestamp;
- expiry timestamp;
- current free resources;
- proof/coverage limitations.

Expired evidence is rejected by the placement planner even if a stale database
row still says the node is ready.

## Hardware Truth Scanner limitations retained

The scanner explicitly cannot prove every physical property. These remain
separate admission evidence where relevant:

- PSU load margin;
- cable/transceiver integrity;
- rack power/cooling;
- reboot-based RAM testing;
- vendor diagnostics;
- physical disk/cable inspection;
- switch fabric health;
- Linux/K3s/GPU-driver state on a different OS.

CLOUD.12 therefore distinguishes **fresh scheduling evidence** from **physical
live certification under load**.
