# Jhadina Cloud deployment runbook

These are deployment templates, not evidence that a cluster is live.

Recommended install order for a Homebase GPU cluster:

1. Ubuntu LTS on homogeneous GPU workers.
2. K3s/Kubernetes.
3. NVIDIA GPU Operator (or the vendor-equivalent device plugin).
4. Kueue.
5. KubeRay only if distributed Ray workloads are needed.
6. Ceph once there are enough independent storage nodes/disks for the desired
   failure domain.
7. Observability: OpenTelemetry/Prometheus plus GPU metrics.
8. Jhadina workers: ComfyUI/image/video, JLLM model serving, Director services,
   FFmpeg/render, audio/Foley, Blender/3D, embedding/index workers.

Do not put provider API keys or storage secrets in these manifests. Use the
cluster secret mechanism selected during deployment.

## Required node labels

- `jhadina.ai/provider=homebase|remote-homebase|cloud`
- `jhadina.ai/zone=<site>`
- `jhadina.ai/cache=nvme|none`

GPU model/capability labels should come from the GPU/device discovery layer,
not handwritten application assumptions.

## Required queues

- `jhadina-interactive`
- `jhadina-creative`
- `jhadina-render`
- `jhadina-background`
- `jhadina-maintenance`

See `priority-classes.yaml` and `kueue.example.yaml`.

## Live certification

A deployment is not "Jhadina Compute Cloud live" until all of these are
observed on real hardware:

- node Ready state and clock/network health;
- GPU discovery and a CUDA/device smoke workload;
- queue admission and priority ordering;
- one image generation;
- one video generation;
- one LLM/character request;
- one audio/Foley workload;
- one FFmpeg final render/QC workload;
- durable asset write/read and loss/restart recovery;
- worker crash followed by idempotent retry/reconciliation;
- telemetry for queue wait, GPU utilization, VRAM, cache hit, latency and
  failure count;
- explicit cloud-burst denial for a private workload;
- explicit cost-limit denial for an over-budget cloud candidate.
