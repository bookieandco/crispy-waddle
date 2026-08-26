import type { EditableTimeline, TimelineClip } from './timeline-model.js';
import { insertClip, removeClip } from './timeline-operations.js';

export type ReplaceVideoPolicy = {
  targetClipId: string;
  replacement: TimelineClip;
  preserveAudio?: boolean;
};

/** Replaces only the target media clip. Independent audio tracks remain untouched by default. */
export function replaceVideoClip(
  timeline: EditableTimeline,
  policy: ReplaceVideoPolicy,
): EditableTimeline {
  let targetTrackId: string | undefined;
  let target: TimelineClip | undefined;

  for (const track of timeline.tracks) {
    const candidate = track.clips.find(clip => clip.id === policy.targetClipId);
    if (candidate) {
      targetTrackId = track.id;
      target = candidate;
      break;
    }
  }

  if (!target || !targetTrackId) return timeline;

  const replacement = {
    ...policy.replacement,
    trackId: targetTrackId,
    startSeconds: target.startSeconds,
  };

  // Deliberately operate on the target track only. Audio tracks and their link groups
  // are not removed or rewritten unless a future explicit audio-edit command requests it.
  const withoutTarget = removeClip(timeline, targetTrackId, target.id);
  return insertClip(withoutTarget, targetTrackId, replacement);
}
