import type { EditableTimeline, TimelineClip } from './timeline-model.js';
import { insertClip, removeClip } from './timeline-operations.js';

export type ReplaceVideoPolicy = {
  targetClipId: string;
  replacement: TimelineClip;
  preserveAudio?: boolean;
};

/** Replaces only the target media clip while preserving the target clip's editorial timing. */
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
    durationSeconds: policy.replacement.durationSeconds > 0
      ? policy.replacement.durationSeconds
      : target.durationSeconds,
  };

  // Audio tracks and link groups are intentionally left untouched. A future explicit
  // audio-edit command can opt into dialogue/music/SFX/foley changes.
  const withoutTarget = removeClip(timeline, targetTrackId, target.id);
  return insertClip(withoutTarget, targetTrackId, replacement);
}
