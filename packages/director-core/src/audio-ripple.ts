import type { EditableTimeline, TimelineClip } from './timeline-model.js';

export type AudioRippleScope = 'track' | 'role' | 'linked';

export type AudioRippleRequest = {
  trackId: string;
  cutStartSeconds: number;
  cutEndSeconds: number;
  scope?: AudioRippleScope;
};

/**
 * Closes an audio-only gap and shifts later clips in the selected scope.
 * Video and unrelated audio tracks remain stationary unless explicitly linked.
 */
export function rippleAudioGap(timeline: EditableTimeline, request: AudioRippleRequest): EditableTimeline {
  const amount = request.cutEndSeconds - request.cutStartSeconds;
  if (amount <= 0) return timeline;

  const sourceTrack = timeline.tracks.find(track => track.id === request.trackId);
  if (!sourceTrack) return timeline;
  const scope = request.scope ?? 'track';
  const sourceRole = sourceTrack.clips.find(clip => clip.startSeconds <= request.cutStartSeconds && clip.startSeconds + clip.durationSeconds >= request.cutEndSeconds)?.metadata?.role;

  const shouldShift = (trackId: string, clips: TimelineClip[]) => {
    if (scope === 'linked') return true;
    if (scope === 'track') return trackId === request.trackId;
    if (scope === 'role') return clips.some(clip => clip.metadata?.role === sourceRole);
    return false;
  };

  return {
    ...timeline,
    tracks: timeline.tracks.map(track => {
      if (!shouldShift(track.id, track.clips)) return track;
      return {
        ...track,
        clips: track.clips.map(clip => {
          if (clip.startSeconds < request.cutEndSeconds) return clip;
          return { ...clip, startSeconds: Math.max(0, clip.startSeconds - amount) };
        }),
      };
    }),
  };
}
