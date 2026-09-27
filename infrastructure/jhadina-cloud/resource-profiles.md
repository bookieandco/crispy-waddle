# Jhadina Compute Resource Profiles

CLOUD.2 makes resource sizing deployment-owned. Product/domain code names the
semantic workload; Homebase deployment configuration supplies concrete CPU,
RAM, NVMe and accelerator requirements.

No profile in this document is a hardware claim. The IDs below are the
canonical names expected by the current adapters. Concrete values must be
measured against the actual model/checkpoint and Homebase hardware before live
submission.

| Profile ID | Consumer | Work kind |
| --- | --- | --- |
| `director.image.default` | Director | image generation |
| `director.video.default` | Director | video/motion generation |
| `director.audio.default` | Director | soundtrack/audio generation |
| `director.foley.default` | Director | video-conditioned Foley/SFX |
| `director.voice.default` | Director | generated dialogue/performance |
| `director.render.default` | Director | final render/composite |
| `director.training.default` | Director | character LoRA training |
| `director.upscale.default` | Director | video upscale/finishing |
| `pupson.image.default` | PupsonStuff | pet artwork generation |
| `pod.image.default` | generalized POD Shop | artwork generation |
| `jllm.interactive.default` | JLLM | conversational inference |
| `jllm.voice.realtime` | JLLM | live speech generation |
| `character.runtime.default` | Character Core | persistent character inference |
| `memory.embedding.default` | Memory | embedding generation |
| `memory.index.default` | Memory | semantic/index maintenance |

## Why profiles are not hard-coded

The same semantic job may have very different requirements depending on:

- model family and quantization;
- resolution, frame count and context length;
- batch size;
- LoRA/control modules loaded at the same time;
- precision and attention implementation;
- whether the worker supports CPU/RAM offload;
- GPU model and available VRAM;
- whether a job is single-GPU or distributed.

Embedding values such as "24 GB VRAM" directly in Director would turn a
deployment choice into business logic. CLOUD.2 instead resolves a profile
before placement.

## Profile admission rules

A profile must declare:

- one or more allowed compute workload kinds;
- positive CPU cores and RAM;
- non-negative scratch space;
- valid GPU count/VRAM when an accelerator is required.

A draft fails closed if:

- its profile is missing;
- the profile is malformed;
- the profile is not allowed for the workload kind;
- its durable authority lineage or idempotency key is missing.

Privacy and spend constraints do **not** live in the resource profile. They
travel with each workload because the same hardware profile can be used for a
public POD artwork job and a private character/voice job with different data
rules.

## Initial privacy posture

- Director work: sensitive/local-first by default.
- PupsonStuff source pet photos: always sensitive in the current adapter.
- JLLM, live voice and character runtime: sensitive/local-first.
- Memory embedding/index maintenance: sensitive/local-first.
- Generalized POD: sensitive by default; a caller may explicitly mark
  non-sensitive input as cloud-burst eligible, but this still does not
  authorize spend or submit a remote job.

## Next deployment step

CLOUD.3 should introduce a versioned runtime profile catalog loaded from
deployment configuration plus a scheduler/submission adapter that translates a
resolved `ComputeWorkload` into Kubernetes/Kueue work while retaining the
original authority reference and idempotency key in labels/annotations and
receipts.
