import type {
  BlendMode,
  ClipCrop,
  ClipTransform,
  EditableTimeline,
  EffectInstance,
  TimelineClip,
  TimelineKeyframe,
  TimelineTrack,
  Transition,
} from './timeline-model.js';

export type FadeCurve = 'linear' | 'equal-power' | 'exponential';
export type EditOperation =
  | 'fade-in'
  | 'fade-out'
  | 'crossfade'
  | 'split'
  | 'trim'
  | 'ripple-delete'
  | 'lift'
  | 'duplicate'
  | 'slip'
  | 'slide'
  | 'roll'
  | 'speed'
  | 'freeze-frame'
  | 'reverse'
  | 'mute'
  | 'normalize';

export type ClipFade = {
  fadeInSeconds: number;
  fadeOutSeconds: number;
  curve: FadeCurve;
};

export type EditableClip = TimelineClip & {
  fade?: ClipFade;
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

const MIN_CLIP_SECONDS = 0.1;

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

export function updateTrack(timeline: EditableTimeline, trackId: string, updater: (track: TimelineTrack) => TimelineTrack): EditableTimeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => track.id === trackId ? updater(track) : track),
  };
}

export function splitClip(timeline: EditableTimeline, clipId: string, atSeconds: number): EditableTimeline {
  for (const track of timeline.tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) continue;
    const local = atSeconds - clip.startSeconds;
    if (local <= 0 || local >= clip.durationSeconds) return timeline;
    const speed = clip.speed ?? 1;
    const sourceSplit = clip.sourceInSeconds != null ? clip.sourceInSeconds + local * speed : undefined;
    const left: TimelineClip = {
      ...clip,
      id: `${clip.id}:a`,
      durationSeconds: local,
      sourceOutSeconds: sourceSplit ?? clip.sourceOutSeconds,
    };
    const right: TimelineClip = {
      ...clip,
      id: `${clip.id}:b`,
      startSeconds: atSeconds,
      durationSeconds: clip.durationSeconds - local,
      sourceInSeconds: sourceSplit ?? clip.sourceInSeconds,
    };
    return {
      ...timeline,
      tracks: timeline.tracks.map(t => t.id === track.id
        ? { ...t, clips: t.clips.flatMap(c => c.id === clipId ? [left, right] : [c]) }
        : t),
    };
  }
  return timeline;
}

export function setClipEffect(timeline: EditableTimeline, clipId: string, effect: EffectInstance): EditableTimeline {
  return updateClip(timeline, clipId, clip => ({
    ...clip,
    effects: [...clip.effects.filter(e => e.id !== effect.id), effect],
  }));
}

export function setClipTransform(timeline: EditableTimeline, clipId: string, transform: Partial<ClipTransform>): EditableTimeline {
  return updateClip(timeline, clipId, clip => ({
    ...clip,
    transform: {
      positionX: transform.positionX ?? clip.transform?.positionX ?? 0,
      positionY: transform.positionY ?? clip.transform?.positionY ?? 0,
      scaleX: Math.max(0.01, transform.scaleX ?? clip.transform?.scaleX ?? 1),
      scaleY: Math.max(0.01, transform.scaleY ?? clip.transform?.scaleY ?? 1),
      rotationDegrees: transform.rotationDegrees ?? clip.transform?.rotationDegrees ?? 0,
    },
  }));
}

export function setClipCrop(timeline: EditableTimeline, clipId: string, crop: Partial<ClipCrop>): EditableTimeline {
  return updateClip(timeline, clipId, clip => {
    const next: ClipCrop = {
      left: clamp01(crop.left ?? clip.crop?.left ?? 0),
      right: clamp01(crop.right ?? clip.crop?.right ?? 0),
      top: clamp01(crop.top ?? clip.crop?.top ?? 0),
      bottom: clamp01(crop.bottom ?? clip.crop?.bottom ?? 0),
    };
    if (next.left + next.right >= 0.99 || next.top + next.bottom >= 0.99) return clip;
    return { ...clip, crop: next };
  });
}

export function setClipBlendMode(timeline: EditableTimeline, clipId: string, blendMode: BlendMode): EditableTimeline {
  return updateClip(timeline, clipId, clip => ({ ...clip, blendMode }));
}

export function setClipSpeed(timeline: EditableTimeline, clipId: string, speed: number): EditableTimeline {
  if (!Number.isFinite(speed) || speed <= 0) return timeline;
  return updateClip(timeline, clipId, clip => {
    const sourceIn = clip.sourceInSeconds ?? 0;
    const sourceOut = sourceIn + clip.durationSeconds * speed;
    if (clip.sourceDurationSeconds !== undefined && sourceOut > clip.sourceDurationSeconds + 1e-6) return clip;
    return { ...clip, speed, sourceOutSeconds: clip.sourceInSeconds !== undefined ? sourceOut : clip.sourceOutSeconds };
  });
}

export function setTimelineKeyframe(timeline: EditableTimeline, clipId: string, keyframe: TimelineKeyframe): EditableTimeline {
  return updateClip(timeline, clipId, clip => ({
    ...clip,
    keyframes: [
      ...(clip.keyframes ?? []).filter(item => item.id !== keyframe.id),
      keyframe,
    ].sort((a, b) => a.timeSeconds - b.timeSeconds),
  }));
}

export function removeTimelineKeyframe(timeline: EditableTimeline, clipId: string, keyframeId: string): EditableTimeline {
  return updateClip(timeline, clipId, clip => ({
    ...clip,
    keyframes: (clip.keyframes ?? []).filter(item => item.id !== keyframeId),
  }));
}

export function sourceAwareTrim(
  timeline: EditableTimeline,
  clipId: string,
  startSeconds: number,
  durationSeconds: number,
): EditableTimeline {
  return updateClip(timeline, clipId, clip => {
    const nextStart = Math.max(0, startSeconds);
    const requestedDuration = Math.max(MIN_CLIP_SECONDS, durationSeconds);
    const speed = clip.speed ?? 1;
    const sourceDelta = (nextStart - clip.startSeconds) * speed;
    const sourceIn = Math.max(0, (clip.sourceInSeconds ?? 0) + sourceDelta);
    let nextDuration = requestedDuration;
    let sourceOut = sourceIn + requestedDuration * speed;

    if (clip.sourceDurationSeconds !== undefined && sourceOut > clip.sourceDurationSeconds) {
      sourceOut = clip.sourceDurationSeconds;
      nextDuration = Math.max(MIN_CLIP_SECONDS, (sourceOut - sourceIn) / speed);
    }
    if (sourceOut <= sourceIn) return clip;

    return {
      ...clip,
      startSeconds: nextStart,
      durationSeconds: nextDuration,
      ...(clip.sourceInSeconds !== undefined || clip.sourceOutSeconds !== undefined || clip.sourceDurationSeconds !== undefined
        ? { sourceInSeconds: sourceIn, sourceOutSeconds: sourceOut }
        : {}),
    };
  });
}

export function slipClip(timeline: EditableTimeline, clipId: string, deltaSourceSeconds: number): EditableTimeline {
  return updateClip(timeline, clipId, clip => {
    const speed = clip.speed ?? 1;
    const span = clip.durationSeconds * speed;
    const currentIn = clip.sourceInSeconds ?? 0;
    const sourceDuration = clip.sourceDurationSeconds;
    let nextIn = currentIn + deltaSourceSeconds;
    if (sourceDuration !== undefined) nextIn = Math.min(sourceDuration - span, nextIn);
    nextIn = Math.max(0, nextIn);
    const nextOut = nextIn + span;
    if (sourceDuration !== undefined && nextOut > sourceDuration + 1e-6) return clip;
    return { ...clip, sourceInSeconds: nextIn, sourceOutSeconds: nextOut };
  });
}

export function moveClipToTrack(
  timeline: EditableTimeline,
  clipId: string,
  targetTrackId: string,
  startSeconds?: number,
): EditableTimeline {
  const sourceTrack = timeline.tracks.find(track => track.clips.some(clip => clip.id === clipId));
  const targetTrack = timeline.tracks.find(track => track.id === targetTrackId);
  if (!sourceTrack || !targetTrack || targetTrack.locked) return timeline;
  const clip = sourceTrack.clips.find(item => item.id === clipId);
  if (!clip || !compatibleTrack(clip, sourceTrack, targetTrack)) return timeline;

  const moved = {
    ...clip,
    trackId: targetTrackId,
    startSeconds: startSeconds === undefined ? clip.startSeconds : Math.max(0, startSeconds),
  };
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => {
      if (sourceTrack.id === targetTrack.id && track.id === sourceTrack.id) {
        return { ...track, clips: track.clips.map(item => item.id === clipId ? moved : item) };
      }
      if (track.id === sourceTrack.id) return { ...track, clips: track.clips.filter(item => item.id !== clipId) };
      if (track.id === targetTrack.id) return { ...track, clips: [...track.clips, moved].sort((a, b) => a.startSeconds - b.startSeconds) };
      return track;
    }),
  };
}

function compatibleTrack(clip: TimelineClip, sourceTrack: TimelineTrack, targetTrack: TimelineTrack): boolean {
  if (sourceTrack.kind === targetTrack.kind) return true;
  if ((sourceTrack.kind === 'video' || sourceTrack.kind === 'overlay') && (targetTrack.kind === 'video' || targetTrack.kind === 'overlay')) return true;
  void clip;
  return false;
}

export function rollEdit(
  timeline: EditableTimeline,
  leftClipId: string,
  rightClipId: string,
  deltaSeconds: number,
): EditableTimeline {
  const leftInfo = findClip(timeline, leftClipId);
  const rightInfo = findClip(timeline, rightClipId);
  if (!leftInfo || !rightInfo || leftInfo.track.id !== rightInfo.track.id || leftInfo.track.locked) return timeline;

  const left = leftInfo.clip;
  const right = rightInfo.clip;
  const boundary = left.startSeconds + left.durationSeconds;
  if (Math.abs(boundary - right.startSeconds) > 0.001) return timeline;

  const nextLeftDuration = left.durationSeconds + deltaSeconds;
  const nextRightDuration = right.durationSeconds - deltaSeconds;
  if (nextLeftDuration < MIN_CLIP_SECONDS || nextRightDuration < MIN_CLIP_SECONDS) return timeline;

  const leftSpeed = left.speed ?? 1;
  const rightSpeed = right.speed ?? 1;
  const leftSourceIn = left.sourceInSeconds ?? 0;
  const rightSourceIn = right.sourceInSeconds ?? 0;
  const nextLeftOut = leftSourceIn + nextLeftDuration * leftSpeed;
  const nextRightIn = rightSourceIn + deltaSeconds * rightSpeed;
  if (left.sourceDurationSeconds !== undefined && nextLeftOut > left.sourceDurationSeconds + 1e-6) return timeline;
  if (nextRightIn < 0) return timeline;

  return {
    ...timeline,
    tracks: timeline.tracks.map(track => track.id !== leftInfo.track.id ? track : {
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id === leftClipId) {
          return {
            ...clip,
            durationSeconds: nextLeftDuration,
            ...(clip.sourceInSeconds !== undefined || clip.sourceOutSeconds !== undefined || clip.sourceDurationSeconds !== undefined
              ? { sourceOutSeconds: nextLeftOut }
              : {}),
          };
        }
        if (clip.id === rightClipId) {
          return {
            ...clip,
            startSeconds: right.startSeconds + deltaSeconds,
            durationSeconds: nextRightDuration,
            ...(clip.sourceInSeconds !== undefined || clip.sourceOutSeconds !== undefined || clip.sourceDurationSeconds !== undefined
              ? {
                  sourceInSeconds: nextRightIn,
                  sourceOutSeconds: nextRightIn + nextRightDuration * rightSpeed,
                }
              : {}),
          };
        }
        return clip;
      }),
    }),
  };
}

export function slideClip(timeline: EditableTimeline, clipId: string, deltaSeconds: number): EditableTimeline {
  const info = findClip(timeline, clipId);
  if (!info || info.track.locked) return timeline;
  const clips = [...info.track.clips].sort((a, b) => a.startSeconds - b.startSeconds);
  const index = clips.findIndex(clip => clip.id === clipId);
  const previous = clips[index - 1];
  const next = clips[index + 1];
  if (!previous || !next) return timeline;
  if (Math.abs(previous.startSeconds + previous.durationSeconds - info.clip.startSeconds) > 0.001) return timeline;
  if (Math.abs(info.clip.startSeconds + info.clip.durationSeconds - next.startSeconds) > 0.001) return timeline;

  const nextPreviousDuration = previous.durationSeconds + deltaSeconds;
  const nextNextDuration = next.durationSeconds - deltaSeconds;
  if (nextPreviousDuration < MIN_CLIP_SECONDS || nextNextDuration < MIN_CLIP_SECONDS) return timeline;

  const previousSpeed = previous.speed ?? 1;
  const nextSpeed = next.speed ?? 1;
  const previousSourceIn = previous.sourceInSeconds ?? 0;
  const nextSourceIn = next.sourceInSeconds ?? 0;
  const nextPreviousOut = previousSourceIn + nextPreviousDuration * previousSpeed;
  const shiftedNextSourceIn = nextSourceIn + deltaSeconds * nextSpeed;
  if (previous.sourceDurationSeconds !== undefined && nextPreviousOut > previous.sourceDurationSeconds + 1e-6) return timeline;
  if (shiftedNextSourceIn < 0) return timeline;

  return {
    ...timeline,
    tracks: timeline.tracks.map(track => track.id !== info.track.id ? track : {
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id === previous.id) {
          return {
            ...clip,
            durationSeconds: nextPreviousDuration,
            ...(clip.sourceInSeconds !== undefined || clip.sourceOutSeconds !== undefined || clip.sourceDurationSeconds !== undefined
              ? { sourceOutSeconds: nextPreviousOut }
              : {}),
          };
        }
        if (clip.id === info.clip.id) return { ...clip, startSeconds: clip.startSeconds + deltaSeconds };
        if (clip.id === next.id) {
          return {
            ...clip,
            startSeconds: clip.startSeconds + deltaSeconds,
            durationSeconds: nextNextDuration,
            ...(clip.sourceInSeconds !== undefined || clip.sourceOutSeconds !== undefined || clip.sourceDurationSeconds !== undefined
              ? {
                  sourceInSeconds: shiftedNextSourceIn,
                  sourceOutSeconds: shiftedNextSourceIn + nextNextDuration * nextSpeed,
                }
              : {}),
          };
        }
        return clip;
      }),
    }),
  };
}

export function duplicateClip(
  timeline: EditableTimeline,
  clipId: string,
  duplicateId: string,
  offsetSeconds = 0,
): EditableTimeline {
  const info = findClip(timeline, clipId);
  if (!info || info.track.locked || !duplicateId.trim()) return timeline;
  if (timeline.tracks.some(track => track.clips.some(clip => clip.id === duplicateId))) return timeline;
  const duplicate: TimelineClip = {
    ...info.clip,
    id: duplicateId,
    startSeconds: Math.max(0, info.clip.startSeconds + offsetSeconds),
  };
  return updateTrack(timeline, info.track.id, track => ({
    ...track,
    clips: [...track.clips, duplicate].sort((a, b) => a.startSeconds - b.startSeconds),
  }));
}

export function addTrack(timeline: EditableTimeline, track: TimelineTrack): EditableTimeline {
  if (timeline.tracks.some(item => item.id === track.id)) return timeline;
  return {
    ...timeline,
    tracks: [...timeline.tracks, { ...track, index: timeline.tracks.length }]
      .sort((a, b) => a.index - b.index)
      .map((item, index) => ({ ...item, index })),
  };
}

export function removeTrack(timeline: EditableTimeline, trackId: string): EditableTimeline {
  const track = timeline.tracks.find(item => item.id === trackId);
  if (!track || track.locked || track.clips.length) return timeline;
  return {
    ...timeline,
    tracks: timeline.tracks
      .filter(item => item.id !== trackId)
      .map((item, index) => ({ ...item, index })),
  };
}

export function reorderTrack(timeline: EditableTimeline, trackId: string, index: number): EditableTimeline {
  const track = timeline.tracks.find(item => item.id === trackId);
  if (!track) return timeline;
  const rest = timeline.tracks.filter(item => item.id !== trackId);
  const nextIndex = Math.max(0, Math.min(rest.length, Math.round(index)));
  rest.splice(nextIndex, 0, track);
  return {
    ...timeline,
    tracks: rest.map((item, itemIndex) => ({ ...item, index: itemIndex })),
  };
}

export function removeClipWithoutRipple(timeline: EditableTimeline, clipId: string): EditableTimeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.id !== clipId),
    })),
    transitions: timeline.transitions.filter(transition => transition.fromClipId !== clipId && transition.toClipId !== clipId),
  };
}

export function rippleDeleteClip(timeline: EditableTimeline, clipId: string): EditableTimeline {
  const target = timeline.tracks.flatMap(track => track.clips).find(clip => clip.id === clipId);
  if (!target) return timeline;
  const end = target.startSeconds + target.durationSeconds;
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => ({
      ...track,
      clips: track.clips
        .filter(clip => clip.id !== clipId)
        .map(clip => clip.startSeconds >= end ? { ...clip, startSeconds: Math.max(0, clip.startSeconds - target.durationSeconds) } : clip),
    })),
    transitions: timeline.transitions.filter(transition => transition.fromClipId !== clipId && transition.toClipId !== clipId),
  };
}

function findClip(timeline: EditableTimeline, clipId: string): { track: TimelineTrack; clip: TimelineClip } | undefined {
  for (const track of timeline.tracks) {
    const clip = track.clips.find(item => item.id === clipId);
    if (clip) return { track, clip };
  }
  return undefined;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
