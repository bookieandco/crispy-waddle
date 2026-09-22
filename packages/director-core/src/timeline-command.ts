import type {
  AudioRole,
  ClipCrop,
  ClipTransform,
  EditableTimeline,
  GenerativeRegion,
  SfxGenerationRequest,
  TimelineClip,
  TimelineKeyframe,
  TimelineTrack,
  TrackKind,
} from './timeline-model.js';
import { addGenerativeRegion } from './timeline-model.js';
import { splitClip, setClipFade, addTransition, updateClip } from './timeline-editing.js';

export type GeneratedAssetInsertion = {
  assetId: string;
  generationJobId: string;
  uri: string;
  mimeType?: string;
  mediaType: 'image' | 'video' | 'audio' | '3d' | 'motion' | 'subtitle' | 'unknown';
  operationId?: string;
  sourceId?: string;
  startSeconds: number;
  endSeconds: number;
  metadata?: Record<string, unknown>;
};

export type TimelineCommand =
  | { type: 'move'; clipId: string; startSeconds: number }
  | { type: 'move-to-track'; clipId: string; trackId: string; startSeconds: number }
  | { type: 'trim'; clipId: string; startSeconds: number; durationSeconds: number }
  | { type: 'extend-source'; clipId: string; direction: 'start' | 'end'; seconds: number }
  | { type: 'set-speed'; clipId: string; speed: number }
  | { type: 'set-reverse'; clipId: string; reverse: boolean }
  | { type: 'set-transform'; clipId: string; transform: Partial<ClipTransform> }
  | { type: 'set-crop'; clipId: string; crop: Partial<ClipCrop> }
  | { type: 'set-keyframes'; clipId: string; keyframes: TimelineKeyframe[] }
  | { type: 'set-text'; clipId: string; text: string }
  | { type: 'set-audio-role'; clipId: string; role: AudioRole }
  | { type: 'set-volume'; clipId: string; volume: number }
  | { type: 'set-opacity'; clipId: string; opacity: number }
  | { type: 'link-clips'; clipIds: string[] }
  | { type: 'unlink-clip'; clipId: string }
  | { type: 'add-track'; track: { id: string; name: string; kind: TrackKind; role?: AudioRole } }
  | { type: 'set-track-state'; trackId: string; muted?: boolean; solo?: boolean; locked?: boolean; hidden?: boolean; role?: AudioRole }
  | { type: 'remove-track'; trackId: string }
  | { type: 'split'; clipId: string; atSeconds: number }
  | { type: 'ripple-delete'; clipId: string }
  | { type: 'fade'; clipId: string; fadeInSeconds?: number; fadeOutSeconds?: number; curve?: 'linear' | 'equal-power' | 'exponential' }
  | { type: 'transition'; transition: Parameters<typeof addTransition>[1] }
  | { type: 'generative-region'; region: GenerativeRegion }
  | { type: 'generate-sfx'; request: SfxGenerationRequest }
  | { type: 'insert-generated-asset'; asset: GeneratedAssetInsertion };

export function applyTimelineCommand(timeline: EditableTimeline, command: TimelineCommand): EditableTimeline {
  switch (command.type) {
    case 'move':
      return updateUnlockedClip(timeline, command.clipId, clip => ({ ...clip, startSeconds: Math.max(0, command.startSeconds) }));
    case 'move-to-track':
      return moveClipToTrack(timeline, command.clipId, command.trackId, command.startSeconds);
    case 'trim':
      return updateUnlockedClip(timeline, command.clipId, clip => ({
        ...clip,
        startSeconds: Math.max(0, command.startSeconds),
        durationSeconds: Math.max(0.1, command.durationSeconds),
      }));
    case 'extend-source':
      return extendClipFromSource(timeline, command.clipId, command.direction, command.seconds);
    case 'set-speed':
      return setClipSpeed(timeline, command.clipId, command.speed);
    case 'set-reverse':
      return updateUnlockedClip(timeline, command.clipId, clip => ({ ...clip, reverse: command.reverse }));
    case 'set-transform':
      return updateUnlockedClip(timeline, command.clipId, clip => ({
        ...clip,
        transform: normalizeTransform({ ...defaultTransform(), ...(clip.transform ?? {}), ...command.transform }),
      }));
    case 'set-crop':
      return updateUnlockedClip(timeline, command.clipId, clip => ({
        ...clip,
        crop: normalizeCrop({ ...defaultCrop(), ...(clip.crop ?? {}), ...command.crop }),
      }));
    case 'set-keyframes':
      return updateUnlockedClip(timeline, command.clipId, clip => ({
        ...clip,
        keyframes: normalizeKeyframes(command.keyframes, clip.durationSeconds),
      }));
    case 'set-text':
      return updateUnlockedClip(timeline, command.clipId, clip => ({ ...clip, text: command.text }));
    case 'set-audio-role':
      return updateUnlockedClip(timeline, command.clipId, clip => ({ ...clip, audioRole: command.role }));
    case 'set-volume':
      return updateUnlockedClip(timeline, command.clipId, clip => ({ ...clip, volume: Math.max(0, Math.min(2, command.volume)) }));
    case 'set-opacity':
      return updateUnlockedClip(timeline, command.clipId, clip => ({ ...clip, opacity: Math.max(0, Math.min(1, command.opacity)) }));
    case 'link-clips':
      return linkClips(timeline, command.clipIds);
    case 'unlink-clip':
      return unlinkClip(timeline, command.clipId);
    case 'add-track':
      return addTrack(timeline, command.track);
    case 'set-track-state':
      return setTrackState(timeline, command);
    case 'remove-track':
      return removeTrack(timeline, command.trackId);
    case 'split':
      return splitUnlockedClip(timeline, command.clipId, command.atSeconds);
    case 'ripple-delete':
      return rippleDelete(timeline, command.clipId);
    case 'fade':
      return assertClipUnlockedAndApply(timeline, command.clipId, current => setClipFade(current, command.clipId, command));
    case 'transition':
      return addTransition(timeline, command.transition);
    case 'generative-region':
      return addGenerativeRegion(timeline, command.region);
    case 'generate-sfx':
      return addSfxRequest(timeline, command.request);
    case 'insert-generated-asset':
      return insertGeneratedAsset(timeline, command.asset);
  }
}

function updateUnlockedClip(
  timeline: EditableTimeline,
  clipId: string,
  updater: (clip: TimelineClip) => TimelineClip,
): EditableTimeline {
  assertClipUnlocked(timeline, clipId);
  return updateClip(timeline, clipId, updater);
}

function assertClipUnlocked(timeline: EditableTimeline, clipId: string): void {
  const track = timeline.tracks.find(item => item.clips.some(clip => clip.id === clipId));
  if (!track) throw new Error('DIRECTOR_TIMELINE_CLIP_NOT_FOUND');
  if (track.locked) throw new Error('DIRECTOR_TIMELINE_TRACK_LOCKED');
}

function assertClipUnlockedAndApply(
  timeline: EditableTimeline,
  clipId: string,
  apply: (timeline: EditableTimeline) => EditableTimeline,
): EditableTimeline {
  assertClipUnlocked(timeline, clipId);
  return apply(timeline);
}

function moveClipToTrack(
  timeline: EditableTimeline,
  clipId: string,
  targetTrackId: string,
  startSeconds: number,
): EditableTimeline {
  const sourceTrack = timeline.tracks.find(track => track.clips.some(clip => clip.id === clipId));
  const targetTrack = timeline.tracks.find(track => track.id === targetTrackId);
  if (!sourceTrack) throw new Error('DIRECTOR_TIMELINE_CLIP_NOT_FOUND');
  if (!targetTrack) throw new Error('DIRECTOR_TIMELINE_TRACK_NOT_FOUND');
  if (sourceTrack.locked || targetTrack.locked) throw new Error('DIRECTOR_TIMELINE_TRACK_LOCKED');

  const clip = sourceTrack.clips.find(item => item.id === clipId)!;
  if (!trackAcceptsClip(targetTrack, clip)) throw new Error('DIRECTOR_TIMELINE_TRACK_KIND_INCOMPATIBLE');

  const moved = { ...clip, trackId: targetTrack.id, startSeconds: Math.max(0, startSeconds) };
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => {
      if (track.id === sourceTrack.id && track.id === targetTrack.id) {
        return { ...track, clips: track.clips.map(item => item.id === clipId ? moved : item) };
      }
      if (track.id === sourceTrack.id) return { ...track, clips: track.clips.filter(item => item.id !== clipId) };
      if (track.id === targetTrack.id) return { ...track, clips: [...track.clips, moved].sort((a, b) => a.startSeconds - b.startSeconds) };
      return track;
    }),
  };
}

function trackAcceptsClip(track: TimelineTrack, clip: TimelineClip): boolean {
  if (track.kind === 'audio') return clip.audioRole !== undefined || clip.assetId.toLowerCase().match(/\.(wav|mp3|aac|m4a|flac)$/) !== null;
  if (track.kind === 'subtitle') return Boolean(clip.text) || clip.assetId.toLowerCase().endsWith('.srt') || clip.assetId.toLowerCase().endsWith('.vtt');
  return track.kind === 'video' || track.kind === 'overlay' || track.kind === 'effect';
}

function extendClipFromSource(
  timeline: EditableTimeline,
  clipId: string,
  direction: 'start' | 'end',
  seconds: number,
): EditableTimeline {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('DIRECTOR_SOURCE_HANDLE_EXTENSION_INVALID');
  assertClipUnlocked(timeline, clipId);

  const clip = timeline.tracks.flatMap(track => track.clips).find(item => item.id === clipId);
  if (!clip) throw new Error('DIRECTOR_TIMELINE_CLIP_NOT_FOUND');
  if (!Number.isFinite(clip.sourceDurationSeconds) || (clip.sourceDurationSeconds ?? 0) <= 0) {
    throw new Error('DIRECTOR_SOURCE_DURATION_REQUIRED');
  }

  const sourceIn = clip.sourceInSeconds ?? 0;
  const sourceOut = clip.sourceOutSeconds ?? Math.min(clip.sourceDurationSeconds!, sourceIn + clip.durationSeconds * (clip.speed ?? 1));
  const speed = clip.speed ?? 1;

  if (direction === 'start') {
    const sourceSeconds = seconds * speed;
    if (sourceIn - sourceSeconds < -1e-9) throw new Error('DIRECTOR_SOURCE_HANDLE_EXTENSION_EXCEEDS_MEDIA');
    if (clip.startSeconds - seconds < -1e-9) throw new Error('DIRECTOR_SOURCE_HANDLE_EXTENSION_BEFORE_TIMELINE');
    return updateClip(timeline, clipId, current => ({
      ...current,
      startSeconds: current.startSeconds - seconds,
      durationSeconds: current.durationSeconds + seconds,
      sourceInSeconds: sourceIn - sourceSeconds,
      sourceOutSeconds: sourceOut,
    }));
  }

  const sourceSeconds = seconds * speed;
  if (sourceOut + sourceSeconds > clip.sourceDurationSeconds! + 1e-9) {
    throw new Error('DIRECTOR_SOURCE_HANDLE_EXTENSION_EXCEEDS_MEDIA');
  }

  const next = updateClip(timeline, clipId, current => ({
    ...current,
    durationSeconds: current.durationSeconds + seconds,
    sourceInSeconds: sourceIn,
    sourceOutSeconds: sourceOut + sourceSeconds,
  }));
  const nextEnd = clip.startSeconds + clip.durationSeconds + seconds;
  return nextEnd > next.durationSeconds ? { ...next, durationSeconds: nextEnd } : next;
}

function setClipSpeed(timeline: EditableTimeline, clipId: string, speed: number): EditableTimeline {
  if (!Number.isFinite(speed) || speed < 0.05 || speed > 16) throw new Error('DIRECTOR_TIMELINE_SPEED_INVALID');
  assertClipUnlocked(timeline, clipId);
  const clip = timeline.tracks.flatMap(track => track.clips).find(item => item.id === clipId);
  if (!clip) throw new Error('DIRECTOR_TIMELINE_CLIP_NOT_FOUND');

  const previousSpeed = clip.speed ?? 1;
  const sourceIn = clip.sourceInSeconds ?? 0;
  const sourceOut = clip.sourceOutSeconds;
  const durationSeconds = sourceOut !== undefined
    ? Math.max(0.1, (sourceOut - sourceIn) / speed)
    : Math.max(0.1, clip.durationSeconds * previousSpeed / speed);

  const next = updateClip(timeline, clipId, current => ({ ...current, speed, durationSeconds }));
  const nextEnd = clip.startSeconds + durationSeconds;
  return nextEnd > next.durationSeconds ? { ...next, durationSeconds: nextEnd } : next;
}

function normalizeTransform(transform: ClipTransform): ClipTransform {
  if (![transform.positionX, transform.positionY, transform.scaleX, transform.scaleY, transform.rotationDegrees].every(Number.isFinite)) {
    throw new Error('DIRECTOR_TIMELINE_TRANSFORM_INVALID');
  }
  if (transform.scaleX <= 0 || transform.scaleY <= 0) throw new Error('DIRECTOR_TIMELINE_SCALE_INVALID');
  return transform;
}

function normalizeCrop(crop: ClipCrop): ClipCrop {
  const values = [crop.left, crop.right, crop.top, crop.bottom];
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error('DIRECTOR_TIMELINE_CROP_INVALID');
  if (crop.left + crop.right >= 1 || crop.top + crop.bottom >= 1) throw new Error('DIRECTOR_TIMELINE_CROP_COLLAPSES_FRAME');
  return crop;
}

function normalizeKeyframes(keyframes: TimelineKeyframe[], clipDurationSeconds: number): TimelineKeyframe[] {
  const ids = new Set<string>();
  return [...keyframes].sort((a, b) => a.timeSeconds - b.timeSeconds).map(keyframe => {
    if (!keyframe.id.trim() || ids.has(keyframe.id)) throw new Error('DIRECTOR_TIMELINE_KEYFRAME_ID_INVALID');
    ids.add(keyframe.id);
    if (!Number.isFinite(keyframe.timeSeconds) || keyframe.timeSeconds < 0 || keyframe.timeSeconds > clipDurationSeconds) {
      throw new Error('DIRECTOR_TIMELINE_KEYFRAME_TIME_INVALID');
    }
    if (!Number.isFinite(keyframe.value)) throw new Error('DIRECTOR_TIMELINE_KEYFRAME_VALUE_INVALID');
    return keyframe;
  });
}

function defaultTransform(): ClipTransform {
  return { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotationDegrees: 0 };
}

function defaultCrop(): ClipCrop {
  return { left: 0, right: 0, top: 0, bottom: 0 };
}

function linkClips(timeline: EditableTimeline, clipIds: string[]): EditableTimeline {
  const unique = [...new Set(clipIds)];
  if (unique.length < 2) throw new Error('DIRECTOR_TIMELINE_LINK_REQUIRES_MULTIPLE_CLIPS');
  for (const id of unique) {
    if (!timeline.tracks.some(track => track.clips.some(clip => clip.id === id))) throw new Error('DIRECTOR_TIMELINE_CLIP_NOT_FOUND');
  }
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => unique.includes(clip.id)
        ? { ...clip, linkedClipIds: unique.filter(id => id !== clip.id) }
        : clip),
    })),
  };
}

function unlinkClip(timeline: EditableTimeline, clipId: string): EditableTimeline {
  const linked = timeline.tracks.flatMap(track => track.clips).find(clip => clip.id === clipId)?.linkedClipIds ?? [];
  const all = new Set([clipId, ...linked]);
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => all.has(clip.id)
        ? { ...clip, linkedClipIds: (clip.linkedClipIds ?? []).filter(id => id !== clipId) }
        : clip),
    })),
  };
}

function addTrack(
  timeline: EditableTimeline,
  input: { id: string; name: string; kind: TrackKind; role?: AudioRole },
): EditableTimeline {
  if (!input.id.trim() || !input.name.trim()) throw new Error('DIRECTOR_TIMELINE_TRACK_IDENTITY_REQUIRED');
  if (timeline.tracks.some(track => track.id === input.id)) throw new Error('DIRECTOR_TIMELINE_TRACK_EXISTS');
  const track: TimelineTrack = {
    id: input.id,
    name: input.name,
    kind: input.kind,
    index: timeline.tracks.length,
    ...(input.role ? { role: input.role } : {}),
    clips: [],
  };
  return { ...timeline, tracks: [...timeline.tracks, track] };
}

function setTrackState(
  timeline: EditableTimeline,
  command: Extract<TimelineCommand, { type: 'set-track-state' }>,
): EditableTimeline {
  if (!timeline.tracks.some(track => track.id === command.trackId)) throw new Error('DIRECTOR_TIMELINE_TRACK_NOT_FOUND');
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => track.id === command.trackId
      ? {
          ...track,
          ...(command.muted !== undefined ? { muted: command.muted } : {}),
          ...(command.solo !== undefined ? { solo: command.solo } : {}),
          ...(command.locked !== undefined ? { locked: command.locked } : {}),
          ...(command.hidden !== undefined ? { hidden: command.hidden } : {}),
          ...(command.role !== undefined ? { role: command.role } : {}),
        }
      : track),
  };
}

function removeTrack(timeline: EditableTimeline, trackId: string): EditableTimeline {
  const track = timeline.tracks.find(item => item.id === trackId);
  if (!track) throw new Error('DIRECTOR_TIMELINE_TRACK_NOT_FOUND');
  if (track.clips.length) throw new Error('DIRECTOR_TIMELINE_TRACK_NOT_EMPTY');
  return {
    ...timeline,
    tracks: timeline.tracks
      .filter(item => item.id !== trackId)
      .map((item, index) => ({ ...item, index })),
  };
}

function splitUnlockedClip(timeline: EditableTimeline, clipId: string, atSeconds: number): EditableTimeline {
  assertClipUnlocked(timeline, clipId);
  return splitClip(timeline, clipId, atSeconds);
}

function insertGeneratedAsset(timeline: EditableTimeline, asset: GeneratedAssetInsertion): EditableTimeline {
  const startSeconds = Math.max(0, asset.startSeconds);
  const endSeconds = Math.max(startSeconds + 0.1, asset.endSeconds);
  const durationSeconds = Math.max(0.1, endSeconds - startSeconds);

  const trackKind = asset.mediaType === 'subtitle' ? 'subtitle' : asset.mediaType === 'audio' ? 'audio' : asset.mediaType === 'image' || asset.mediaType === 'video' || asset.mediaType === 'motion' ? 'overlay' : 'effect';
  const existingTrack = timeline.tracks.find(track => track.kind === trackKind && !track.locked);
  const trackId = existingTrack?.id ?? `generated-${trackKind}`;

  const generativeRegion: GenerativeRegion = {
    id: `${asset.assetId}:region`,
    startSeconds,
    durationSeconds,
    operation: 'insert',
    instruction: `Insert generated ${asset.mediaType} asset ${asset.assetId}`,
    sourceClipId: asset.sourceId,
    resultAssetId: asset.assetId,
    metadata: {
      assetId: asset.assetId,
      generationJobId: asset.generationJobId,
      uri: asset.uri,
      mimeType: asset.mimeType,
      operationId: asset.operationId,
      sourceId: asset.sourceId,
      ...asset.metadata,
    },
  };

  const clip: TimelineClip = {
    id: `generated:${asset.assetId}`,
    assetId: asset.assetId,
    trackId,
    startSeconds,
    durationSeconds,
    effects: [],
    generativeRegions: [generativeRegion],
  };

  let next: EditableTimeline;
  if (existingTrack) {
    next = {
      ...timeline,
      tracks: timeline.tracks.map(track => track.id === existingTrack.id ? { ...track, clips: [...track.clips, clip].sort((a, b) => a.startSeconds - b.startSeconds) } : track),
    };
  } else {
    const nextIndex = timeline.tracks.length;
    const newTrack: TimelineTrack = {
      id: trackId,
      name: `Generated ${trackKind}`,
      kind: trackKind,
      index: nextIndex,
      clips: [clip],
    };
    next = { ...timeline, tracks: [...timeline.tracks, newTrack] };
  }

  const clipEnd = startSeconds + durationSeconds;
  return clipEnd > next.durationSeconds ? { ...next, durationSeconds: clipEnd } : next;
}

function addSfxRequest(timeline: EditableTimeline, request: SfxGenerationRequest): EditableTimeline {
  const region: GenerativeRegion = {
    id: request.id,
    startSeconds: Math.max(0, request.startSeconds),
    durationSeconds: Math.max(0.1, request.durationSeconds),
    operation: 'insert',
    instruction: request.prompt,
    sourceClipId: request.sourceClipId,
    approved: request.status === 'approved',
    metadata: {
      kind: 'sfx',
      requestId: request.id,
      action: request.action,
      materials: request.materials,
      perspective: request.perspective,
      intensity: request.intensity,
      status: request.status,
      candidateAssetIds: request.candidateAssetIds,
    },
  };
  return addGenerativeRegion(timeline, region);
}

function rippleDelete(timeline: EditableTimeline, clipId: string): EditableTimeline {
  assertClipUnlocked(timeline, clipId);
  const target = timeline.tracks.flatMap(track => track.clips).find(clip => clip.id === clipId);
  if (!target) return timeline;
  const end = target.startSeconds + target.durationSeconds;
  const linked = new Set([clipId, ...(target.linkedClipIds ?? [])]);
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => ({
      ...track,
      clips: track.clips
        .filter(clip => !linked.has(clip.id))
        .map(clip => clip.startSeconds >= end ? { ...clip, startSeconds: Math.max(0, clip.startSeconds - target.durationSeconds) } : clip),
    })),
    transitions: timeline.transitions.filter(transition => !linked.has(transition.fromClipId) && !linked.has(transition.toClipId)),
  };
}

export function timelineCommandReason(command: TimelineCommand): string {
  if (command.type === 'generative-region') return `Generative edit: ${command.region.instruction}`;
  if (command.type === 'generate-sfx') return `Generate SFX: ${command.request.prompt}`;
  if (command.type === 'insert-generated-asset') return `Insert generated ${command.asset.mediaType} asset: ${command.asset.assetId}`;
  if (command.type === 'transition') return 'Add timeline transition';
  if (command.type === 'extend-source') return `Extend clip from source handles: ${command.direction} +${command.seconds}s`;
  if (command.type === 'move-to-track') return `Move clip to track ${command.trackId}`;
  if (command.type === 'set-track-state') return `Update track state: ${command.trackId}`;
  return `Timeline ${command.type}`;
}
