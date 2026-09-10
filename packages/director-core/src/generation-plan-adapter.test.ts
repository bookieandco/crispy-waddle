import { describe, expect, it } from 'vitest';
import { GenerationPlanAdapter } from './generation-plan-adapter';
import { GenerationRegistry } from './generation-registry';
import { GenerationService } from './generation-service';
import type { GenerationProvider } from './generation-provider';
import type { GenerationRequest } from './generation-provider';
import type { GenerationResult } from './generation-provider';
import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { CreativeStage } from './creative-stage-graph.js';

describe('GenerationPlanAdapter', () => {
  const run: ProductionRun = {
    id: 'run-1', projectId: 'p', status: 'awaiting_approval',
    createdAt: '2026-09-09T00:00:00Z', updatedAt: '2026-09-09T00:00:00Z', shotIds: ['shot-1'], gateIds: ['gate-1'],
  };
  const gate: CreativeGate = {
    id: 'gate-1', runId: 'run-1', kind: 'generation', decision: 'approved', requestedAt: '2026-09-09T00:00:00Z',
  };
  const storyboardStage: CreativeStage = {
    id: 'storyboard-1', projectId: 'p', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 7,
  };
  const generationStage: CreativeStage = {
    id: 'generation-1', projectId: 'p', kind: 'generation', dependsOn: ['storyboard-1'], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 3,
  };
  const creativeProvenance = {
    projectId: 'p', storyboardBoardIds: ['board-1', 'board-2'], storyboardVersion: 7,
    generationStageId: 'generation-1', generationStageVersion: 3,
  };

  function request(): Parameters<GenerationPlanAdapter['submitTake']>[0] {
    return {
      takeId: 'take-001', projectId: 'p', sceneId: 's1', prompt: 'Maya walks home after the argument',
      locked: ['character', 'location', 'performance'], referenceCharacterIds: ['maya'], referenceAssetIds: ['apartment'], targetRuntimeSeconds: 8,
    };
  }

  function plan(): Parameters<GenerationPlanAdapter['submitTake']>[1] {
    return { modelId: 'video-model', modality: 'video', loras: [{ loraId: 'character-maya', weight: 0.9 }], parameters: { seed: 42 } };
  }

  function gateInput(overrides: Partial<{ gate: CreativeGate; storyboardStage: CreativeStage; generationStage: CreativeStage; creativeProvenance: typeof creativeProvenance }> = {}) {
    return {
      run,
      gate: overrides.gate ?? gate,
      generationStage: overrides.generationStage ?? generationStage,
      storyboardStage: overrides.storyboardStage,
      creativeProvenance: overrides.creativeProvenance ?? creativeProvenance,
    };
  }

  function makeAdapter(submitted: { requests: GenerationRequest[] } = { requests: [] }) {
    const registry = new GenerationRegistry();
    registry.registerProvider({ id: 'comfy-local', name: 'ComfyUI Local', kind: 'comfyui', capabilities: ['text-to-video', 'image-to-video'], models: ['video-model'], health: 'healthy' });
    registry.registerModel({ id: 'video-model', providerId: 'comfy-local', name: 'Video Model', version: '1', modalities: ['video'], capabilities: ['text-to-video', 'image-to-video'], baseModel: 'video-base' });
    registry.registerLoRA({ id: 'character-maya', name: 'Maya', version: '1', baseModel: 'video-base', modalities: ['video'], weight: { min: 0, max: 1.5, recommended: 0.8 } });
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(input) { submitted.requests.push(input); return { requestId: input.requestId, providerId: 'comfy-local', status: 'queued', assetIds: [], providerJobId: 'p1' }; },
      async status(providerJobId): Promise<GenerationResult> { return { requestId: providerJobId, providerId: 'comfy-local', status: 'completed', assetIds: [] }; },
      async cancel() {},
    };
    return new GenerationPlanAdapter(new GenerationService(registry, new Map([['comfy-local', provider]])), registry);
  }

  it('submits only after the approved Director generation gate', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const job = await makeAdapter(submitted).submitTake(request(), plan(), gateInput());
    expect(job.status).toBe('queued');
    expect(submitted.requests[0]?.model.id).toBe('video-model');
  });

  it('carries the approved storyboard lineage into the generated asset request', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const job = await makeAdapter(submitted).submitTake(request(), plan(), gateInput({ storyboardStage }));
    expect(submitted.requests[0]?.creativeProvenance).toMatchObject(creativeProvenance);
    expect(submitted.requests[0]?.creativeProvenance?.generationJobId).toBe(job.id);
  });

  it('uses the same idempotency key when the same Director take is retried', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const adapter = makeAdapter(submitted);
    await adapter.submitTake(request(), plan(), gateInput());
    await adapter.submitTake({ ...request(), prompt: 'same take retry with updated transport payload' }, plan(), gateInput());
    expect(submitted.requests).toHaveLength(2);
    expect(submitted.requests[0]?.requestId).toBe('director:p:take:take-001');
    expect(submitted.requests[1]?.requestId).toBe(submitted.requests[0]?.requestId);
  });

  it('does not reach the provider when provenance is missing', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const unsafeInput = { ...gateInput(), creativeProvenance: undefined } as unknown as Parameters<GenerationPlanAdapter['submitTake']>[2];
    await expect(makeAdapter(submitted).submitTake(request(), plan(), unsafeInput)).rejects.toThrow('Cannot read properties of undefined');
    expect(submitted.requests).toHaveLength(0);
  });

  it('does not reach the provider when the gate is pending', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    await expect(makeAdapter(submitted).submitTake(request(), plan(), gateInput({ gate: { ...gate, decision: 'pending' } }))).rejects.toThrow('Generation submission blocked');
    expect(submitted.requests).toHaveLength(0);
  });

  it('does not reach the provider for stale generation state', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    await expect(makeAdapter(submitted).submitTake(request(), plan(), gateInput({ generationStage: { ...generationStage, status: 'stale' } }))).rejects.toThrow('Generation submission blocked');
    expect(submitted.requests).toHaveLength(0);
  });

  it('rejects a cross-project gate before model/provider work', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    await expect(makeAdapter(submitted).submitTake(request(), plan(), gateInput({ gate: { ...gate, runId: 'other-run' } }))).rejects.toThrow('Generation requires');
    expect(submitted.requests).toHaveLength(0);
  });
});
