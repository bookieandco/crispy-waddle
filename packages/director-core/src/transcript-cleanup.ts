import type { EditableTimeline } from './timeline-model.js';
import type { TranscriptSegment, TranscriptCutPolicy } from './transcript-audio-bridge.js';
import { createPauseCutIntents } from './transcript-audio-bridge.js';
import { detectFalseStarts, type FalseStartPolicy } from './false-start-detector.js';
import { applyAudioEditIntent } from './audio-timeline-operations.js';
import { rippleAudioGap } from './audio-ripple.js';

export type TranscriptCleanupPolicy = {
  pauses: TranscriptCutPolicy;
  falseStarts: FalseStartPolicy;
};

export type TranscriptCleanupResult = {
  timeline: EditableTimeline;
  pauseCuts: number;
  falseStartCuts: number;
  removedSeconds: number;
};

/** Produces one conservative, dialogue-only cleanup from transcript candidates. */
export function applyTranscriptCleanup(
  timeline: EditableTimeline,
  clipId: string,
  segments: TranscriptSegment[],
  policy: TranscriptCleanupPolicy,
): TranscriptCleanupResult {
  const pauseIntents = createPauseCutIntents(clipId, segments, policy.pauses);
  const falseStarts = detectFalseStarts(segments, policy.falseStarts);
  const cuts = [
    ...pauseIntents.map(intent => intent.command.type === 'audio-cut' ? intent.command : null),
    ...falseStarts.map(candidate => ({ type: 'audio-cut' as const, clipId, startSeconds: candidate.startSeconds, endSeconds: candidate.endSeconds })),
  ].filter((cut): cut is { type: 'audio-cut'; clipId: string; startSeconds: number; endSeconds: number } => Boolean(cut));

  const unique = [...new Map(cuts.map(cut => [`${cut.startSeconds}:${cut.endSeconds}`, cut])).values()]
    .sort((a, b) => b.startSeconds - a.startSeconds);

  let next = timeline;
  let removedSeconds = 0;
  for (const cut of unique) {
    const duration = cut.endSeconds - cut.startSeconds;
    if (duration <= 0) continue;
    const intent = { command: cut, reason: 'Approved transcript cleanup', requiresApproval: true };
    next = applyAudioEditIntent(next, intent);
    next = rippleAudioGap(next, {
      trackId: findTrackId(next, clipId),
      cutStartSeconds: cut.startSeconds,
      cutEndSeconds: cut.endSeconds,
      scope: 'track',
    });
    removedSeconds += duration;
  }

  return { timeline: next, pauseCuts: pauseIntents.length, falseStartCuts: falseStarts.length, removedSeconds };
}

function findTrackId(timeline: EditableTimeline, clipId: string): string {
  const track = timeline.tracks.find(candidate => candidate.clips.some(clip => clip.id === clipId));
  if (!track) throw new Error(`Audio clip not found: ${clipId}`);
  return track.id;
}
