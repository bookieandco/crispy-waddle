# JH-026 — Director Studio subsystem audit

## Scope decision
The Studio AI actor/video pipeline is an official Director/Jhadina subsystem capability. PR #7 is historical source material only; it must not be merged wholesale.

## PR #7 inventory
The old branch contains more than 100 Studio/media files spanning character replacement and Character DNA; tracking/segmentation; lip/voice sync; appearance/behavior/continuity; rigging, animation, cloth/physics, QC and mastering; GPU video runtime and native Swift AV/GPU pipelines; and multiple Python media services. PR #7 itself is 216 commits / 225 changed files and predates current-main architecture.

## What remains valuable
The pure contracts in character-dna.ts, video-character-replacement.ts, video-tracking.ts and voice-sync.ts remain useful concepts. Character replacement models detect -> segment -> track -> replace -> composite -> QA -> export with review required. Tracking distinguishes model, human and hybrid output and carries confidence/approval.

Tracking, rig, physics, lip-sync and rendering should remain replaceable provider capabilities. GPU-heavy work belongs behind adapters and may run locally or in workers without gaining Jhadina authority. The Swift AV/GPU implementation can become an optimized Apple-device backend, not a new application shell or orchestration layer.

## What must not be ported as authority
StudioProviderOrchestrator, StudioHandlerRegistry and executeStudioAction from the old branch cannot become a parallel execution spine. They select/invoke providers directly and predate the current identity -> policy/approval -> ActionExecutor -> audit/evidence boundary. Provider selection may survive only as an internal implementation detail after a governed Director action authorizes the capability.

## Current-main integration target
Ask/Director intent -> Director/Shotlist proposal -> Jhadina policy + explicit approval where required -> canonical ActionRequest/ActionExecutor -> Director Studio capability handler -> provider selection -> tracking/replacement/voice-sync/rig/physics/render worker -> QC evidence -> generated media asset -> explicit approval before Workstation/timeline use -> durable audit/evidence.

## Reconstruction order
1. Studio contracts: current-main Director-owned Character DNA, replacement-job, tracking and voice-sync contracts.
2. Governed capability bridge behind existing ActionExecutor.
3. Tracking + segmentation adapter.
4. Character replacement compositor.
5. Voice/lip-sync adapter.
6. Rig/animation + physics adapters.
7. QC/evidence for sync, continuity, appearance and render quality.
8. Native/GPU backends after contracts/governance stabilize.
9. Workstation integration through the existing approval-gated generated-asset flow.

## Immediate build boundary
The first implementation PR after this audit should contain only pure Director Studio contracts and tests. It should not deploy Python services, add credentials, call external models, or introduce a second orchestrator.


## Closure audit — 2026-09-18

JH-026 reconstruction is complete at the governed subsystem boundary.

### Landed architecture
- Director-owned Studio contracts and Character DNA.
- Canonical ActionRequest / ActionExecutor capability bridge; no parallel Studio authority.
- Approved tracking and SAM2 worker/runtime boundary.
- Character-replacement compositor and GPU-ready compositor backend boundary.
- Voice/lip-sync worker routing plus MuseTalk, Wav2Lip and Rhubarb runtime adapters.
- Rig/animation worker/runtime boundary.
- Secondary physics for cloth, hair, fur, puppet-fabric and accessories.
- Final governed render assembly requiring composite, voice-sync, animation and physics lineage.
- Machine QC followed by explicit durable asset approval before Workstation/timeline use.

### Closure invariants
1. Model/media workers cannot approve their own output.
2. Third-party runtimes receive bounded media inputs, not Jhadina policy or approval authority.
3. Tracking, continuity, frame and upstream artifact lineage are preserved across worker boundaries.
4. Final render does not bypass Studio QC.
5. Workstation use remains behind explicit generated-asset approval.
6. Historical PR #7 remains source material only and is not a merge target.

### Deferred deployment work
Concrete model checkpoints, CUDA/Metal/Blender implementations, production worker deployment, credentials and capacity configuration are deployment concerns behind the landed interfaces. They do not block closure of the subsystem architecture and must not be treated as authorization to bypass the canonical governance spine.
