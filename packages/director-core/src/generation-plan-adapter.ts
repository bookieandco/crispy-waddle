import type { GenerationModality, GenerationRegistry } from './generation-registry';
import type { GenerationService, GenerationJob } from './generation-service';
import type { TakeRequest } from './generation-orchestrator';
import type { DirectorGenerationGateInput } from './creative-gate-adapter';
import { evaluateDirectorGenerationGate } from './creative-gate-adapter';

export type PlannedGeneration = {
  modelId: string;
  modality: GenerationModality;
  negativePrompt?: string;
  parameters?: Record<string, unknown>;
  loras?: Array<{ loraId: string; weight?: number }>;
};

/** Provider submission boundary for Director takes. An approved creative gate is mandatory. */
export class GenerationPlanAdapter {
  constructor(
    private readonly generation: GenerationService,
    private readonly registry: GenerationRegistry,
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

    const decision = evaluateDirectorGenerationGate(gateInput);
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

    const requestId = `${request.projectId}:${request.sceneId}:${Date.now()}`;
    const creativeProvenance = gateInput.creativeProvenance
      ? { ...gateInput.creativeProvenance, generationJobId: requestId }
      : undefined;

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
        continuityLocks: request.locked,
        cinematography: request.cinematography,
      },
      creativeProvenance,
    });
  }
}
