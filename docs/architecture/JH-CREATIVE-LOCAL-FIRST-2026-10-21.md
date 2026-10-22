# JH-CREATIVE-LOCAL-FIRST.01–.05 — shared image/video source integration (2026-10-21)

## Verified upstream and existing code
- **Comfy-Org/ComfyUI**, GPL-3.0: preferred local media inference workflow engine. API graph queue, local image edit, upscale, video model workflows. A local API *can* be free of metered vendor charges; installed GPU and model weights are not proven.
- **AUTOMATIC1111/stable-diffusion-webui**, AGPL-3.0: optional separate still-image fallback. Do not fold AGPL server source into proprietary app bundles without reviewing obligations.
- **unslothai/unsloth**, Apache-2.0: model management/adaptation, LoRA training. The existing Pupson protocol calls itself 'unsloth' but its Python worker **already uses ComfyUI**; retain v1 wire compatibility until coordinated migration.
- **calesthio/OpenMontage**, AGPL-3.0: Director-owned storyboarding, licensed real-footage montage, editing, captioning and rendering. Source project advertises paid integrations; they must be disabled in the free-local path.

Canonically preserve:
- `packages/director-core/src/{generation-provider,comfyui-http,generation-service,workflow-registry}.ts`, the execution/job/asset/provenance pipeline.
- `services/pupson-image-worker` — private Qwen-Image-Edit -> loopback ComfyUI server, with asset cleanup.
- `apps/pupsonstuff/lib/{creative-jobs,creative-provider,local-image-worker,print-master}.ts`, including consent, private storage, idempotency, print QA.
- `packages/jhadina-compute-core`, `infrastructure/jhadina-cloud/worker-catalog.md` and `resource-profiles.md`.
- JLLM **delegates** creative requests to Director. PupsonStuff and generalized POD **own** their image jobs/approvals. One Compute scheduler; no duplicate store, no duplicate Director.

## Changes proposed in this branch
1. Shared pure `planFreeFirstCreative` admission and consumer-specific Compute profile mapping. It chooses only pre-certified *owned private* runtimes without metered external-provider calls and blocks missing owner authorization, job identity, reference assets, consent, source-media usage rights, runtime receipts and model/workflow rights. It never executes.
2. PupsonStuff opt-in `PUPSON_CREATIVE_COST_POLICY=local_only` routes **every non-ASCII style** through the *existing private ComfyUI-backed worker*. Legacy `PUPSON_OPENAI_STYLE_BACKEND=local_worker` remains compatible. Paid OpenAI/Muapi routes stay unchanged until the new local-only setting is intentionally enabled following an actual canary; there is no paid fallback in local-only mode.
3. Regression tests for provider routing and no silent metered fallback. Catalog entries do not establish model health, installed weights, licensing or free compute.

## Wiring still required (NO live execution in this PR)
- **JLLM:** add explicit image/video intent -> owner-authorized Director GenerationService request with requestId, projectId, approval gate and canonical asset result. Do not place ComfyUI calls in chat/LLM prompts.
- **Director:** commission a specific reviewed ComfyUI API workflow + digest-pinned commercially permitted image checkpoint, and a separately reviewed local video workflow; maintain scene-level review/QC and normal output repository. OpenMontage should be a subprocess/service adapter behind Director, with allowed free/local providers, rights provenance, disabled outbound paid API calls and review before final render.
- **PupsonStuff:** certify real one-/three-reference likeness, output alpha, print master DPI, iPhone preview, storage/delete; migrate v1 worker protocol name 'unsloth' only after atomic server/client compatibility tests.
- **1000s of Shirts/general POD:** reuse `pod.image.default`, existing creative authority and Printify/publisher approval guards; source-generated art must pass print-area and license QA independently. No marketing or Printify order submission.
- **AUTOMATIC1111:** optional bridge using separate managed process/API, no second queue authority.
- **Unsloth:** optional local model fine-tuning after dataset owner permission, rights and GPU training acceptance. Do not assume it is a no-cost hosted inference endpoint.

## Required runtime release gates
1. Check actual Homebase/host GPU, RAM/VRAM, disk and queue capacity. An iPhone PWA is only a remote frontend, not the GPU worker.
2. Pin upstream revision, checkpoint hashes, VAE/LoRA/custom nodes, dependencies and *model-specific commercial* terms.
3. Prove private TLS gateway, auth, owner isolation, upload/output purging, no public ComfyUI exposure; guard against oversized/hostile workflows.
4. Real local image and video canaries, output bytes, latency, cost receipts, source provenance, cross-tenant checks, rerun/idempotency/unknown-submit reconciliation and failures.
5. Existing CI, private iPhone acceptance, rights and print/sample verification; explicit approval before enabling/deploying or spending.

**Status:** source-only proposal. No models downloaded, GPUs provisioned, endpoint connected, provider credentials set, migrations applied, customer images processed, videos rendered, PR merged, Printify order submitted or production deployment made. Open-source code is not a promise of free power, storage, GPUs, compatible weights, or unrestricted commercial usage.
