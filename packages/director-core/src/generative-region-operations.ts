import type { GenerativeRegion, TimelineClip } from './timeline-model.js';
import type { GenerationResult } from './generation-service.js';
import { placeGeneratedOutput } from './generation-output-timeline.js';

export type GenerativeRegionOperation = 'insert' | 'replace' | 'extend' | 'fill' | 'reframe' | 'retime';

export type GenerativeRegionOperationPlan = {
  operation: GenerativeRegionOperation;
  generatedClip: TimelineClip;
  targetClipId?: string;
  sourceRegionId: string;
  destructive: boolean;
};

/** Plans how a completed generation result should be applied without mutating timeline state. */
export function planGenerativeRegionOperation(
  region: GenerativeRegion,
  result: GenerationResult,
  targetTrackId: string,
): GenerativeRegionOperationPlan {
  const generatedClip = placeGeneratedOutput(region, result, targetTrackId).clip;
  const operation = region.operation as GenerativeRegionOperation;
  if (!['insert', 'replace', 'extend', 'fill', 'reframe', 'retime'].includes(operation)) {
    throw new Error(`Unsupported generative region operation: ${region.operation}`);
  }

  return {
    operation,
    generatedClip,
    targetClipId: region.sourceClipId,
    sourceRegionId: region.id,
    destructive: operation === 'replace' || operation === 'retime' || operation === 'reframe',
  };
}
