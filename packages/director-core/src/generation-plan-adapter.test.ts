import { describe, expect, it } from 'vitest';
import { GenerationPlanAdapter } from './generation-plan-adapter';
import { GenerationRegistry } from './generation-registry';
import { GenerationService } from './generation-service';
import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';
import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { CreativeStage } from './creative-stage-graph.js';
import type { StoryboardStageBinding } from './storyboard-stage-binding';
import type { DirectorStoryboardLineage, DirectorStoryboardLineageResolver } from './storyboard-lineage-resolver';
import type { DirectorCastResolver } from './cast-bible';
import type { DirectorCharacterReferenceAssetResolver } from './generation-plan-adapter';

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
  const binding: StoryboardStageBinding = {
    projectId: 'p', storyboardBoardId: 'board-1',
    stageIds: { storyboard: 'storyboard-1', shotlist: 'shotlist-1', generation: 'generation-1' },
    version: 1,
  };
  const lineage: DirectorStoryboardLineage = {
    sequence: { id: 'sequence-1', projectId: 'p', sceneId: 's1', boardIds: ['board-1', 'board-2'], version: 7, updatedAt: '2026-09-09T00:00:00Z' },
    board: { id: 'board-1', sequenceId: 'sequence-1', projectId: 'p', shotId: 'shot-1', order: 1, status: 'approved', referenceAssetIds: [], continuityAnchorIds: [], version: 2, artifactIds: [], updatedAt: '2026-09-09T00:00:00Z' },
    binding,
  };

  function request(): Parameters<GenerationPlanAdapter['submitTake']>[0] {
    return {
      takeId: 'take-001', projectId: 'p', sceneId: 's1', storyboardBoardId: 'board-1', prompt: 'Maya walks home after the argument',
      locked: ['character', 'location', 'performance'], referenceCharacterIds: ['maya'], referenceAssetIds: ['apartment'], targetRuntimeSeconds: 8,
    };
  }

  function plan(): Parameters<GenerationPlanAdapter['submitTake']>[1] {
    return { modelId: 'video-model', modality: 'video', loras: [{ loraId: 'character-maya', weight: 0.9 }], parameters: { seed: 42 } };
  }

  function gateInput(overrides: Partial<{ gate: CreativeGate; storyboardStage: CreativeStage; generationStage: CreativeStage }> = {}): Parameters<GenerationPlanAdapter['submitTake']>[2] {
    return {
      run,
      gate: overrides.gate ?? gate,
      generationStage: overrides.generationStage ?? generationStage,
      storyboardStage: overrides.storyboardStage ?? storyboardStage,
    };
  }

  function makeAdapter(
    submitted: { requests: GenerationRequest[] } = { requests: [] },
    resolvedLineage: DirectorStoryboardLineage = lineage,
  ) {
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
    const resolver = { resolve: async () => resolvedLineage } as unknown as DirectorStoryboardLineageResolver;
    const castResolver: DirectorCastResolver = {
      async resolve(characterId, projectId, sceneId) {
        if (characterId !== 'maya' || projectId !== 'p') throw new Error('cast not found');
        return {
          projectId,
          characterId,
          continuityRef: 'cast:maya:v4',
          canonicalAppearanceVariantId: 'maya-base',
          sceneAppearanceVariantId: sceneId === 's1' ? 'maya-red-coat' : 'maya-base',
          referenceAssetIds: ['maya-face-v4', 'maya-red-coat-ref'],
          referenceSha256s: ['sha-face', 'sha-coat'],
          voiceIdentityId: 'voice:maya',
          voiceVariantId: 'voice:maya:en',
          language: 'en',
          behaviorDnaRef: 'behavior:maya:v2',
          rigAssetId: 'rig:maya:v3',
          lockedTraits: ['oval face', 'scar above left eyebrow'],
        };
      },
    };
    const characterReferenceAssetResolver: DirectorCharacterReferenceAssetResolver = {
      async resolve(assetId, projectId) {
        if (projectId !== 'p') throw new Error('wrong project');
        return {
          uri: `https://private.test/${encodeURIComponent(assetId)}?signed=1`,
          sha256: assetId === 'maya-face-v4' ? 'sha-face' : 'sha-coat',
          mimeType: 'image/png',
        };
      },
    };
    return new GenerationPlanAdapter(
      new GenerationService(registry, new Map([['comfy-local', provider]])),
      registry,
      resolver,
      castResolver,
      characterReferenceAssetResolver,
    );
  }

  it('submits only after the approved Director generation gate', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const job = await makeAdapter(submitted).submitTake(request(), plan(), gateInput());
    expect(job.status).toBe('queued');
    expect(submitted.requests[0]?.model.id).toBe('video-model');
  });

  it('compiles structured direction into the provider prompt and retains the plans as parameters', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const directed = {
      ...request(),
      cameraPlan: {
        version: 1 as const,
        target: 'generative-video' as const,
        intent: { narrativeFunction: 'close emotional distance', emotionalEffect: 'unease' },
        composition: { shotSize: 'medium-close-up' as const, angle: 'eye-level' as const },
        movements: [{ kind: 'dolly-in' as const, motivation: 'pressure builds as Maya realizes she is watched' }],
      },
      performancePlan: {
        version: 1 as const,
        sceneFunction: 'show delayed recognition',
        actors: [{ actorId: 'maya', startingState: 'distracted', endingState: 'alert' }],
        beats: [{
          id: 'notice',
          kind: 'reaction' as const,
          actorId: 'maya',
          trigger: 'a sound behind her',
          action: 'stop walking and look back',
          endState: 'body still, eyes fixed behind her',
        }],
      },
      realismPlan: {
        version: 1 as const,
        goal: 'keep the take physically grounded',
        naturalismCues: ['weight-shift' as const, 'breathing' as const],
        physicalResponses: [{
          trigger: 'Maya stops walking',
          subjectResponse: 'momentum settles through one corrective step',
        }],
      },
      animationPlan: {
        version: 1 as const,
        narrativeGoal: 'make the stop-and-look reaction readable',
        primaryAction: 'Maya stops and turns toward the sound',
        method: 'pose-to-pose' as const,
        poseHierarchy: { keys: ['walking', 'anticipation stop', 'turned reaction'] },
        anticipation: { cues: ['eyes shift before the head and shoulders turn'] },
        staging: {
          primaryRead: 'Maya notices the sound',
          audienceAttentionTarget: 'Maya face and shoulders',
          competingActionPolicy: 'subordinate' as const,
        },
        timing: { fps: 24, exposure: 'twos' as const, primaryActionFrames: 18 },
      },
    };

    await makeAdapter(submitted).submitTake(directed, plan(), gateInput());
    expect(submitted.requests[0]?.prompt).toContain('[CAMERA DIRECTION]');
    expect(submitted.requests[0]?.prompt).toContain('[PERFORMANCE DIRECTION]');
    expect(submitted.requests[0]?.prompt).toContain('[REALISM / SOURCE PRESERVATION]');
    expect(submitted.requests[0]?.prompt).toContain('[ANIMATION PRINCIPLES]');
    expect(submitted.requests[0]?.parameters).toMatchObject({
      cameraPlan: { target: 'generative-video' },
      performancePlan: { sceneFunction: 'show delayed recognition' },
      realismPlan: { goal: 'keep the take physically grounded' },
      animationPlan: { method: 'pose-to-pose' },
    });
  });

  it('preserves exact provider reference order when a manifest is present', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const directed = {
      ...request(),
      referenceAssetIds: ['apartment'],
      referenceManifest: {
        id: 'refs:take-001',
        projectId: 'p',
        shotId: 'shot-1',
        authority: 'DIRECTOR_REFERENCE_MANIFEST' as const,
        references: [
          {
            slot: 1,
            assetId: 'apartment',
            media: 'image' as const,
            role: 'location' as const,
            semanticLabel: 'approved apartment location',
            promptToken: 'LOCATION',
            required: true,
            evidenceIds: ['e:apartment'],
          },
          {
            slot: 2,
            assetId: 'maya-face-v4',
            media: 'image' as const,
            role: 'character-identity' as const,
            semanticLabel: 'Maya canonical face reference',
            promptToken: 'MAYA_FACE',
            required: true,
            evidenceIds: ['e:maya-face'],
          },
          {
            slot: 3,
            assetId: 'maya-red-coat-ref',
            media: 'image' as const,
            role: 'character-identity' as const,
            semanticLabel: 'Maya scene wardrobe reference',
            promptToken: 'MAYA_WARDROBE',
            required: true,
            evidenceIds: ['e:maya-coat'],
          },
        ],
      },
    };

    await makeAdapter(submitted).submitTake(directed, plan(), gateInput());

    expect(submitted.requests[0]?.references?.map((reference) => reference.assetId)).toEqual([
      'apartment',
      'maya-face-v4',
      'maya-red-coat-ref',
    ]);
    expect(submitted.requests[0]?.references?.[1]).toMatchObject({
      assetId: 'maya-face-v4',
      role: 'character',
      media: 'image',
      uri: 'https://private.test/maya-face-v4?signed=1',
    });
    expect(submitted.requests[0]?.prompt).toContain('[REFERENCE MANIFEST]');
    expect(submitted.requests[0]?.parameters).toMatchObject({
      referenceManifest: { id: 'refs:take-001' },
    });
  });

  it('fails closed if a resolved character reference would shift a declared manifest', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const incompleteManifest = {
      ...request(),
      referenceAssetIds: ['apartment'],
      referenceManifest: {
        id: 'refs:incomplete',
        projectId: 'p',
        shotId: 'shot-1',
        authority: 'DIRECTOR_REFERENCE_MANIFEST' as const,
        references: [{
          slot: 1,
          assetId: 'apartment',
          media: 'image' as const,
          role: 'location' as const,
          semanticLabel: 'approved apartment location',
          required: true,
          evidenceIds: ['e:apartment'],
        }],
      },
    };

    await expect(makeAdapter(submitted).submitTake(incompleteManifest, plan(), gateInput()))
      .rejects.toThrow('DIRECTOR_REFERENCE_MANIFEST_CHARACTER_ASSET_MISSING');
    expect(submitted.requests).toHaveLength(0);
  });

  it('derives creative provenance from the canonical resolver result', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const job = await makeAdapter(submitted).submitTake(request(), plan(), gateInput());
    expect(submitted.requests[0]?.creativeProvenance).toMatchObject({
      projectId: 'p',
      storyboardBoardIds: ['board-1', 'board-2'],
      storyboardVersion: 7,
      generationStageId: 'generation-1',
      generationStageVersion: 3,
    });
    expect(submitted.requests[0]?.creativeProvenance?.generationJobId).toBe(job.id);
  });

  it('ignores forged caller lineage and provenance fields at runtime', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const unsafeGateInput = {
      ...gateInput(),
      storyboardLineage: {
        ...lineage,
        sequence: { ...lineage.sequence, boardIds: ['attacker-board'], version: 999 },
      },
      creativeProvenance: {
        projectId: 'p',
        storyboardBoardIds: ['attacker-board'],
        storyboardVersion: 999,
        generationStageId: 'attacker-stage',
        generationStageVersion: 999,
      },
    } as Parameters<GenerationPlanAdapter['submitTake']>[2];

    await makeAdapter(submitted).submitTake(request(), plan(), unsafeGateInput);

    expect(submitted.requests[0]?.creativeProvenance).toMatchObject({
      storyboardBoardIds: ['board-1', 'board-2'],
      storyboardVersion: 7,
      generationStageId: 'generation-1',
      generationStageVersion: 3,
    });
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

  it('rejects a gate bound to another production run before provider work', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    await expect(makeAdapter(submitted).submitTake(request(), plan(), gateInput({ gate: { ...gate, runId: 'other-run' } }))).rejects.toThrow('Generation submission blocked');
    expect(submitted.requests).toHaveLength(0);
  });

  it('rejects when the resolver returns a different canonical board', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const wrongBoard = { ...lineage, board: { ...lineage.board, id: 'board-2' } };
    await expect(makeAdapter(submitted, wrongBoard).submitTake(request(), plan(), gateInput())).rejects.toThrow('requested canonical board ID');
    expect(submitted.requests).toHaveLength(0);
  });

  it('rejects cross-project canonical lineage from the resolver', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const crossProject = { ...lineage, sequence: { ...lineage.sequence, projectId: 'other-project' } };
    await expect(makeAdapter(submitted, crossProject).submitTake(request(), plan(), gateInput())).rejects.toThrow('Generation submission blocked');
    expect(submitted.requests).toHaveLength(0);
  });

  it('rejects a stale canonical storyboard board before provider work', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const staleLineage = { ...lineage, board: { ...lineage.board, status: 'stale' as const } };
    await expect(makeAdapter(submitted, staleLineage).submitTake(request(), plan(), gateInput())).rejects.toThrow('Storyboard board is not ready: stale');
    expect(submitted.requests).toHaveLength(0);
  });

  it('rejects canonical lineage with a mismatched generation binding', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const mismatched = {
      ...lineage,
      binding: { ...lineage.binding, stageIds: { ...lineage.binding.stageIds, generation: 'other-generation' } },
    };
    await expect(makeAdapter(submitted, mismatched).submitTake(request(), plan(), gateInput())).rejects.toThrow('Generation submission blocked');
    expect(submitted.requests).toHaveLength(0);
  });
  it('resolves semantic character IDs to approved cast reference assets', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    await makeAdapter(submitted).submitTake(request(), plan(), gateInput());

    const generated = submitted.requests[0]!;
    expect(generated.references).toEqual(expect.arrayContaining([
      { assetId: 'maya-face-v4', role: 'character', uri: 'https://private.test/maya-face-v4?signed=1' },
      { assetId: 'maya-red-coat-ref', role: 'character', uri: 'https://private.test/maya-red-coat-ref?signed=1' },
      { assetId: 'apartment', role: 'image' },
    ]));
    expect(generated.references).not.toContainEqual({ assetId: 'maya', role: 'character' });
    expect(generated.parameters).toMatchObject({
      characterContinuity: [{
        characterId: 'maya',
        continuityRef: 'cast:maya:v4',
        canonicalAppearanceVariantId: 'maya-base',
        sceneAppearanceVariantId: 'maya-red-coat',
        voiceIdentityId: 'voice:maya',
        voiceVariantId: 'voice:maya:en',
        rigAssetId: 'rig:maya:v3',
      }],
    });
  });

  it('fails closed when resolved character media lacks a reference asset resolver', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const registry = new GenerationRegistry();
    registry.registerProvider({ id: 'comfy-local', name: 'ComfyUI Local', kind: 'comfyui', capabilities: ['image-to-video'], models: ['video-model'], health: 'healthy' });
    registry.registerModel({ id: 'video-model', providerId: 'comfy-local', name: 'Video Model', version: '1', modalities: ['video'], capabilities: ['image-to-video'], baseModel: 'video-base' });
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(input) { submitted.requests.push(input); return { requestId: input.requestId, providerId: 'comfy-local', status: 'queued', assetIds: [], providerJobId: 'p1' }; },
      async status(providerJobId): Promise<GenerationResult> { return { requestId: providerJobId, providerId: 'comfy-local', status: 'completed', assetIds: [] }; },
      async cancel() {},
    };
    const resolver = { resolve: async () => lineage } as unknown as DirectorStoryboardLineageResolver;
    const castResolver: DirectorCastResolver = {
      async resolve() {
        return {
          projectId: 'p',
          characterId: 'maya',
          continuityRef: 'cast:maya:v4',
          canonicalAppearanceVariantId: 'maya-base',
          sceneAppearanceVariantId: 'maya-base',
          referenceAssetIds: ['maya-face-v4'],
          referenceSha256s: ['sha-face'],
          lockedTraits: [],
        };
      },
    };
    const adapter = new GenerationPlanAdapter(
      new GenerationService(registry, new Map([['comfy-local', provider]])),
      registry,
      resolver,
      castResolver,
    );
    await expect(adapter.submitTake(
      { ...request(), referenceAssetIds: [] },
      { modelId: 'video-model', modality: 'video' },
      gateInput(),
    )).rejects.toThrow('DIRECTOR_CHARACTER_REFERENCE_ASSET_RESOLVER_REQUIRED');
    expect(submitted.requests).toHaveLength(0);
  });

  it('fails closed when a character is requested without a cast resolver', async () => {
    const submitted = { requests: [] as GenerationRequest[] };
    const registry = new GenerationRegistry();
    registry.registerProvider({ id: 'comfy-local', name: 'ComfyUI Local', kind: 'comfyui', capabilities: ['text-to-video'], models: ['video-model'], health: 'healthy' });
    registry.registerModel({ id: 'video-model', providerId: 'comfy-local', name: 'Video Model', version: '1', modalities: ['video'], capabilities: ['text-to-video'], baseModel: 'video-base' });
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(input) { submitted.requests.push(input); return { requestId: input.requestId, providerId: 'comfy-local', status: 'queued', assetIds: [], providerJobId: 'p1' }; },
      async status(providerJobId): Promise<GenerationResult> { return { requestId: providerJobId, providerId: 'comfy-local', status: 'completed', assetIds: [] }; },
      async cancel() {},
    };
    const resolver = { resolve: async () => lineage } as unknown as DirectorStoryboardLineageResolver;
    const adapter = new GenerationPlanAdapter(new GenerationService(registry, new Map([['comfy-local', provider]])), registry, resolver);
    await expect(adapter.submitTake(request(), { modelId: 'video-model', modality: 'video' }, gateInput()))
      .rejects.toThrow('DIRECTOR_CAST_RESOLVER_REQUIRED');
    expect(submitted.requests).toHaveLength(0);
  });

});
