import type { GenerationModality, GenerationRegistry } from './generation-registry';
import type { GenerationService, GenerationJob } from './generation-service';
import type { TakeRequest } from './generation-orchestrator';

export type PlannedGeneration = {
  modelId: string;
  modality: GenerationModality;
  negativePrompt?: string;
  parameters?: Record<string, unknown>;
  loras?: Array<{ loraId: string; weight?: number }>;
};

/** Bridges a non-destructive directing take plan to the provider-neutral generation service. */
export class GenerationPlanAdapter {
  constructor(
    private readonly generation: GenerationService,
    private readonly registry: GenerationRegistry,
  ) {}

  async submitTake(request: TakeRequest, plan: PlannedGeneration): Promise<GenerationJob> {
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

    return this.generation.submit({
      requestId: `${request.projectId}:${request.sceneId}:${Date.now()}`,
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
    });
  }
}
