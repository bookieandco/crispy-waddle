import type { TranscriptSegment } from './transcript-core.js';
import type { EditableTimeline, TimelineClip } from './timeline-model.js';

export type TranscriptSelection = {
  segmentId: string;
  assetId: string;
  startSeconds: number;
  endSeconds: number;
  clipIds: string[];
};

/** Resolves a transcript segment to the timeline clips containing its media range. */
export function resolveTranscriptSelection(
  timeline: EditableTimeline,
  transcript: { assetId: string; segments: TranscriptSegment[] },
  segmentId: string,
): TranscriptSelection | null {
  const segment = transcript.segments.find(candidate => candidate.id === segmentId);
  if (!segment) return null;

  const clipIds: string[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId !== transcript.assetId) continue;
      const clipStart = clip.startSeconds;
      const clipEnd = clip.startSeconds + clip.durationSeconds;
      if (segment.startSeconds < clipEnd && segment.endSeconds > clipStart) clipIds.push(clip.id);
    }
  }

  return {
    segmentId,
    assetId: transcript.assetId,
    startSeconds: segment.startSeconds,
    endSeconds: segment.endSeconds,
    clipIds,
  };
}

export type TranscriptEditAction =
  | { type: 'select'; selection: TranscriptSelection }
  | { type: 'cut'; selection: TranscriptSelection }
  | { type: 'delete'; selection: TranscriptSelection }
  | { type: 'keep'; selection: TranscriptSelection };

export function createTranscriptEditAction(
  timeline: EditableTimeline,
  transcript: { assetId: string; segments: TranscriptSegment[] },
  segmentId: string,
  action: Exclude<TranscriptEditAction['type'], 'select'>,
): TranscriptEditAction | null {
  const selection = resolveTranscriptSelection(timeline, transcript, segmentId);
  return selection ? { type: action, selection } : null;
}
