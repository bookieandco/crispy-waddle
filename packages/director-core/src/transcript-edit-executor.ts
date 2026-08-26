import type { EditableTimeline } from './timeline-model.js';
import type { TranscriptSelection } from './transcript-editor-bridge.js';
import { splitAudioClipForCut } from './audio-media-cut.js';

export type TranscriptCutResult = {
  timeline: EditableTimeline;
  affectedClipIds: string[];
};

/** Applies a transcript-selected range to matching audio clips without mutating source media. */
export function executeTranscriptCut(
  timeline: EditableTimeline,
  selection: TranscriptSelection,
): TranscriptCutResult {
  const affected = new Set<string>();
  const tracks = timeline.tracks.map(track => {
    const clips = track.clips.flatMap(clip => {
      if (!selection.clipIds.includes(clip.id) || clip.type === 'video') return [clip];
      const clipStart = clip.startSeconds;
      const clipEnd = clip.startSeconds + clip.durationSeconds;
      const start = Math.max(selection.startSeconds, clipStart);
      const end = Math.min(selection.endSeconds, clipEnd);
      if (end <= start) return [clip];
      affected.add(clip.id);
      return splitAudioClipForCut(clip, { startSeconds: start, endSeconds: end });
    });
    return { ...track, clips };
  });

  return { timeline: { ...timeline, tracks }, affectedClipIds: [...affected] };
}
