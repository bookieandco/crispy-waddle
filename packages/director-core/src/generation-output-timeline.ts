import type { GenerationResult } from './generation-provider.js';
import type { GenerativeRegion, TimelineClip } from './timeline-model.js';

export type GeneratedTimelinePlacement = {
  clip: TimelineClip;
  assetId: string;
  regionId: string;
  operation: GenerativeRegion['operation'];
};

/**
 * Converts a completed generation result into a deterministic timeline clip.
 * This is intentionally a pure placement step: it does not mutate timeline state.
 */
export function placeGeneratedOutput(
  region: GenerativeRegion,
  result: GenerationResult,
  targetTrackId: string,
  clipId = `generated-${region.id}`,
): GeneratedTimelinePlacement {
  if (!region.approved) throw new Error(`Generative region ${region.id} is not approved`);
  if (result.status !== 'completed') throw new Error(`Generation ${result.requestId} is not completed`);

  const assetId = result.assetIds[0];
  if (!assetId) throw new Error(`Generation ${result.requestId} completed without an asset`);

  const clip: TimelineClip = {
    id: clipId,
    assetId,
    trackId: targetTrackId,
    startSeconds: region.startSeconds,
    durationSeconds: region.durationSeconds,
    effects: [],
    generativeRegions: [],
  };

  return {
    clip,
    assetId,
    regionId: region.id,
    operation: region.operation,
  };
}
