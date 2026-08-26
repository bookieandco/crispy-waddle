import type { EditableTimeline } from './timeline-model.js';
import type { TranscriptSegment, TranscriptCutPolicy } from './transcript-audio-bridge.js';
import { createPauseCutIntents } from './transcript-audio-bridge.js';
import { applyAudioEditIntent } from './audio-timeline-operations.js';
import { rippleAudioGap } from './audio-ripple.js';

export type TranscriptPauseEditResult = {
  timeline: EditableTimeline;
  cutsApplied: number;
  rippleSeconds: number;
};

/** Applies approved pause removals as one scoped dialogue edit. */
export function applyTranscriptPauseEdit(
  timeline: EditableTimeline,
  clipId: string,
  segments: TranscriptSegment[],
  policy: TranscriptCutPolicy,
): TranscriptPauseEditResult {
  const intents = createPauseCutIntents(clipId, segments, policy);
  let next = timeline;
  let rippleSeconds = 0;

  // Work backwards so source timestamps remain stable while edits are applied.
  for (const intent of [...intents].reverse()) {
    if (intent.command.type !== 'audio-cut') continue;
    next = applyAudioEditIntent(next, intent);
    rippleSeconds += intent.command.endSeconds - intent.command.startSeconds;
    next = rippleAudioGap(next, {
      trackId: findTrackId(next, clipId),
      cutStartSeconds: intent.command.startSeconds,
      cutEndSeconds: intent.command.endSeconds,
      scope: 'track',
    });
  }

  return { timeline: next, cutsApplied: intents.length, rippleSeconds };
}

function findTrackId(timeline: EditableTimeline, clipId: string): string {
  const track = timeline.tracks.find(candidate => candidate.clips.some(clip => clip.id === clipId));
  if (!track) throw new Error(`Audio clip not found: ${clipId}`);
  return track.id;
}
