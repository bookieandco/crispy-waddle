import type { EditableTimeline, TimelineClip } from './timeline-model.js';
import type { GenerationResult } from './generation-service.js';
import { placeGeneratedOutput } from './generation-output-timeline.js';
import { insertClip, removeClip } from './timeline-operations.js';
import type { GenerativeRegionOperationPlan } from './generative-region-operations.js';

function findClip(timeline: EditableTimeline, clipId?: string): { trackId: string; clip: TimelineClip } | null {
  if (!clipId) return null;
  for (const track of timeline.tracks) {
    const clip = track.clips.find(candidate => candidate.id === clipId);
    if (clip) return { trackId: track.id, clip };
  }
  return null;
}

/** Applies a completed generated result to the target video/overlay track only. */
export function applyGeneratedRegion(
  timeline: EditableTimeline,
  plan: GenerativeRegionOperationPlan,
  result: GenerationResult,
  targetTrackId: string,
): EditableTimeline {
  const placed = placeGeneratedOutput({
    id: plan.sourceRegionId,
    startSeconds: plan.generatedClip.startSeconds,
    durationSeconds: plan.generatedClip.durationSeconds,
    operation: plan.operation,
    instruction: plan.generatedClip.assetId,
    sourceClipId: plan.targetClipId,
  }, result, targetTrackId).clip;

  const target = findClip(timeline, plan.targetClipId);
  switch (plan.operation) {
    case 'insert':
    case 'fill':
    case 'extend':
      return insertClip(timeline, targetTrackId, placed);
    case 'replace': {
      if (!target) return insertClip(timeline, targetTrackId, placed);
      const withoutTarget = removeClip(timeline, target.trackId, target.clip.id);
      return insertClip(withoutTarget, targetTrackId, placed);
    }
    case 'reframe':
    case 'retime':
      return insertClip(timeline, targetTrackId, placed);
    default:
      throw new Error(`Unsupported generated region operation: ${plan.operation}`);
  }
}
