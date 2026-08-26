import type { GenerationService, GenerationJob } from './generation-service.js';
import type { GenerationRequest } from './generation-provider.js';
import type { GenerativeRegion } from './timeline-model.js';

export type GenerationRegionResult = {
  regionId: string;
  job: GenerationJob;
};

/** Builds a generation request from an approved timeline generative region. */
export function generationRequestFromRegion(input: {
  region: GenerativeRegion;
  request: Omit<GenerationRequest, 'requestId' | 'prompt'> & { requestId?: string };
}): GenerationRequest {
  const { region, request } = input;
  if (!region.approved) throw new Error(`Generative region is not approved: ${region.id}`);
  if (!region.instruction.trim()) throw new Error(`Generative region has no instruction: ${region.id}`);
  return {
    ...request,
    requestId: request.requestId ?? `generation-region-${region.id}`,
    prompt: region.instruction,
    parameters: {
      ...request.parameters,
      timelineRegionId: region.id,
      operation: region.operation,
      startSeconds: region.startSeconds,
      durationSeconds: region.durationSeconds,
      sourceClipId: region.sourceClipId,
    },
  };
}

/** Submits an approved region without mutating timeline state. */
export async function submitGenerationRegion(input: {
  service: GenerationService;
  region: GenerativeRegion;
  request: Omit<GenerationRequest, 'requestId' | 'prompt'> & { requestId?: string };
}): Promise<GenerationRegionResult> {
  const request = generationRequestFromRegion(input);
  const job = await input.service.submit(request);
  return { regionId: input.region.id, job };
}
