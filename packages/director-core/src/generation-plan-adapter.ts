import type { GenerationModality, GenerationRegistry } from './generation-registry';
import type { GenerationService, GenerationJob } from './generation-service';
import type { TakeRequest } from './generation-orchestrator';
import type { DirectorGenerationGateInput } from './creative-gate-adapter';
import { evaluateDirectorGenerationGate } from './creative-gate-adapter';
import type { DirectorStoryboardLineageResolver } from './storyboard-lineage-resolver';

export type PlannedGeneration = {
  modelId: string;
  modality: GenerationModality;
  negativePrompt?: string;
  parameters?: Record<string, unknown>;
  loras?: Array<{ loraId: string; weight?: number }>;
};

/** Provider submission boundary for Director takes. Canonical storyboard lineage is resolved here. */
export class GenerationPlanAdapter {
  constructor(
    private readonly generation: GenerationService,
    private readonly registry: GenerationRegistry,
    private readonly lineageResolver: DirectorStoryboardLineageResolver,
  ) {}

  async submitTake(
    request: TakeRequest,
    plan: PlannedGeneration,
    gateInput: DirectorGenerationGateInput,
  ): Promise<GenerationJob> {
    if (gateInput.run.projectId !== request.projectId) {
      throw new Error('Generation gate project does not match the take request project.');
    }
    if (gateInput.generationStage.projectId !== request.projectId) {
      throw new Error('Generation stage project does not match the take request project.');
    }

    let storyboardLineage;
    try {
      storyboardLineage = await this.lineageResolver.resolve(request.storyboardBoardId, request.projectId);
    } catch (error) {
      throw new Error(`Generation submission blocked: ${error instanceof Error ? error.message : 'Unable to resolve canonical storyboard lineage.'}`);
    }

    if (gateInput.storyboardLineage.board.id !== storyboardLineage.board.id) {
      throw new Error('Generation submission blocked: supplied storyboard lineage does not match the canonical board ID.');
    }

    const authoritativeGateInput: DirectorGenerationGateInput = {
      ...gateInput,
      storyboardLineage,
    };
    const decision = evaluateDirectorGenerationGate(authoritativeGateInput);
    if (!decision.allowed) throw new Error(`Generation submission blocked: ${decision.reason}`);

    const model = this.registry.getModel(plan.modelId);
    if (!model) throw new Error(`Model is not registered: ${plan.modelId}`);

    const loras = plan.loras?.map((selected) => {
      const lora = this.registry.getLoRA(selected.loraId);
      if (!lora) throw new Error(`LoRA is not registered: ${selected.loraId}`);
      return { lora, weight: selected.weight };
    });

    const references = [
      ...(request.referenceCharacterIds ?? []).map((assetId) => ({ assetId, role: 'character' as const })),
      ...(request.referenceAssetIds ?? []).map((assetId) => ({ assetId, role: 'image' as const })),
    ];

    const requestId = `director:${request.projectId}:take:${request.takeId}`;
    const creativeProvenance = {
      ...authoritativeGateInput.creativeProvenance,
      generationJobId: requestId,
    };

    return this.generation.submit({
      requestId,
      projectId: request.projectId,
      modality: plan.modality,
      prompt: request.prompt,
      negativePrompt: plan.negativePrompt,
      model,
      loras,
      references,
      parameters: {
        ...(plan.parameters ?? {}),
        targetRuntimeSeconds: request.targetRuntimeSeconds,
        sceneCount: request.sceneCount,
        takeCount: request.takeCount,
        parentTakeId: request.parentTakeId,
        storyboardBoardId: request.storyboardBoardId,
        continuityLocks: request.locked,
        cinematography: request.cinematography,
      },
      creativeProvenance,
    });
  }
}
