import type { GenerationModality } from './generation-registry';
import type { GenerationService, GenerationJob } from './generation-service';
import type { TakeRequest } from './generation-orchestrator';

export type PlannedGeneration = {
  modelId: string;
  modality: GenerationModality;
  negativePrompt?: string;
  parameters?: Record<string, unknown>;
  loras?: Array<{ loraId: string; weight?: number }>;
};

/**
 * Bridges DirectorOS's non-destructive directing plan to the provider-neutral
 * generation service. It deliberately does not know anything about ComfyUI.
 */
export class GenerationPlanAdapter {
  constructor(private readonly generation: GenerationService) {}

  async submitTake(request: TakeRequest, generation: PlannedGeneration): Promise<GenerationJob> {
    const references = [
      ...(request.referenceCharacterIds ?? []).map((assetId) => ({ assetId, role: 'character' as const })),
      ...(request.referenceAssetIds ?? []).map((assetId) => ({ assetId, role: 'image' as const })),
    ];

    return this.generation.submit({
      requestId: `${request.projectId}:${request.sceneId}:${Date.now()}`,
      projectId: request.projectId,
      modality: generation.modality,
      prompt: request.prompt,
      negativePrompt: generation.negativePrompt,
      model: { id: generation.modelId } as never,
      loras: generation.loras?.map((selected) => ({
        lora: { id: selected.loraId } as never,
        weight: selected.weight,
      })),
      references,
      parameters: {
        ...(generation.parameters ?? {}),
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
