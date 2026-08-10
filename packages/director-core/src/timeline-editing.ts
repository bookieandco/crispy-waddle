import type { EditableTimeline, EffectInstance, TimelineClip, Transition } from './timeline-model.js';

export type FadeCurve = 'linear' | 'equal-power' | 'exponential';
export type EditOperation = 'fade-in' | 'fade-out' | 'crossfade' | 'split' | 'trim' | 'ripple-delete' | 'duplicate' | 'slip' | 'slide' | 'speed' | 'freeze-frame' | 'reverse' | 'mute' | 'normalize';

export type ClipFade = {
  fadeInSeconds: number;
  fadeOutSeconds: number;
  curve: FadeCurve;
};

export type EditableClip = TimelineClip & {
  fade?: ClipFade;
  speed?: number;
  reverse?: boolean;
};

export type EditCommand = {
  id: string;
  operation: EditOperation;
  clipId?: string;
  trackId?: string;
  parameters: Record<string, unknown>;
  createdAt: string;
  createdBy: 'user' | 'jhadina';
};

export function setClipFade(timeline: EditableTimeline, clipId: string, fade: Partial<ClipFade>): EditableTimeline {
  return updateClip(timeline, clipId, clip => ({
    ...clip,
    fade: {
      fadeInSeconds: Math.max(0, fade.fadeInSeconds ?? (clip as EditableClip).fade?.fadeInSeconds ?? 0),
      fadeOutSeconds: Math.max(0, fade.fadeOutSeconds ?? (clip as EditableClip).fade?.fadeOutSeconds ?? 0),
      curve: fade.curve ?? (clip as EditableClip).fade?.curve ?? 'linear',
    },
  } as EditableClip));
}

export function addTransition(timeline: EditableTimeline, transition: Transition): EditableTimeline {
  const duration = Math.max(0, transition.durationSeconds);
  return { ...timeline, transitions: [...timeline.transitions.filter(t => t.id !== transition.id), { ...transition, durationSeconds: duration }] };
}

export function updateClip(timeline: EditableTimeline, clipId: string, updater: (clip: TimelineClip) => TimelineClip): EditableTimeline {
  return { ...timeline, tracks: timeline.tracks.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === clipId ? updater(clip) : clip) })) };
}

export function splitClip(timeline: EditableTimeline, clipId: string, atSeconds: number): EditableTimeline {
  for (const track of timeline.tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) continue;
    const local = atSeconds - clip.startSeconds;
    if (local <= 0 || local >= clip.durationSeconds) return timeline;
    const left: TimelineClip = { ...clip, id: `${clip.id}:a`, durationSeconds: local, sourceOutSeconds: clip.sourceInSeconds != null ? clip.sourceInSeconds + local : clip.sourceOutSeconds };
    const right: TimelineClip = { ...clip, id: `${clip.id}:b`, startSeconds: atSeconds, durationSeconds: clip.durationSeconds - local, sourceInSeconds: clip.sourceInSeconds != null ? clip.sourceInSeconds + local : clip.sourceInSeconds };
    return { ...timeline, tracks: timeline.tracks.map(t => t.id === track.id ? { ...t, clips: t.clips.flatMap(c => c.id === clipId ? [left, right] : [c]) } : t) };
  }
  return timeline;
}

export function setClipEffect(timeline: EditableTimeline, clipId: string, effect: EffectInstance): EditableTimeline {
  return updateClip(timeline, clipId, clip => ({ ...clip, effects: [...clip.effects.filter(e => e.id !== effect.id), effect] }));
}
