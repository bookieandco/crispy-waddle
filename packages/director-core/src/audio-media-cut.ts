import type { TimelineClip } from './timeline-model.js';

export type AudioCutRange = {
  startSeconds: number;
  endSeconds: number;
};

/**
 * Converts a timeline cut into source-aware clip segments. The original asset is
 * never modified; each returned segment points at its corresponding source range.
 */
export function splitAudioClipForCut(clip: TimelineClip, cut: AudioCutRange): TimelineClip[] {
  const clipEnd = clip.startSeconds + clip.durationSeconds;
  if (cut.startSeconds < clip.startSeconds || cut.endSeconds > clipEnd || cut.endSeconds <= cut.startSeconds) return [clip];

  const sourceIn = clip.sourceInSeconds ?? 0;
  const sourceOut = clip.sourceOutSeconds ?? (sourceIn + clip.durationSeconds);
  const leftDuration = cut.startSeconds - clip.startSeconds;
  const rightDuration = clipEnd - cut.endSeconds;
  const cutOffsetStart = cut.startSeconds - clip.startSeconds;
  const cutOffsetEnd = cut.endSeconds - clip.startSeconds;

  const left = leftDuration > 0 ? {
    ...clip,
    id: crypto.randomUUID(),
    durationSeconds: leftDuration,
    sourceInSeconds: sourceIn,
    sourceOutSeconds: sourceIn + leftDuration,
  } : null;

  const right = rightDuration > 0 ? {
    ...clip,
    id: crypto.randomUUID(),
    startSeconds: cut.startSeconds,
    durationSeconds: rightDuration,
    sourceInSeconds: sourceIn + cutOffsetEnd,
    sourceOutSeconds: sourceOut,
  } : null;

  return [left, right].filter((value): value is TimelineClip => value !== null);
}
