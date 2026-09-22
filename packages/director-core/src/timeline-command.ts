import type {
  AudioRole,
  BlendMode,
  ClipCrop,
  ClipTransform,
  EditableTimeline,
  GenerativeRegion,
  SfxGenerationRequest,
  TimelineKeyframe,
  TimelineTrack,
} from './timeline-model.js';
import { addGenerativeRegion } from './timeline-model.js';
import {
  addTrack,
  addTransition,
  duplicateClip,
  moveClipToTrack,
  removeClipWithoutRipple,
  removeTimelineKeyframe,
  removeTrack,
  reorderTrack,
  rippleDeleteClip,
  rollEdit,
  setClipBlendMode,
  setClipCrop,
  setClipEffect,
  setClipFade,
  setClipSpeed,
  setClipTransform,
  setTimelineKeyframe,
  slideClip,
  slipClip,
  sourceAwareTrim,
  splitClip,
  updateClip,
  updateTrack,
} from './timeline-editing.js';

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
  | { type: 'move-to-track'; clipId: string; trackId: string; startSeconds?: number }
  | { type: 'trim'; clipId: string; startSeconds: number; durationSeconds: number }
  | { type: 'slip'; clipId: string; deltaSourceSeconds: number }
  | { type: 'slide'; clipId: string; deltaSeconds: number }
  | { type: 'roll'; leftClipId: string; rightClipId: string; deltaSeconds: number }
  | { type: 'set-volume'; clipId: string; volume: number }
  | { type: 'set-opacity'; clipId: string; opacity: number }
  | { type: 'set-speed'; clipId: string; speed: number }
  | { type: 'set-blend-mode'; clipId: string; blendMode: BlendMode }
  | { type: 'set-transform'; clipId: string; transform: Partial<ClipTransform> }
  | { type: 'set-crop'; clipId: string; crop: Partial<ClipCrop> }
  | { type: 'set-clip-name'; clipId: string; name: string }
  | { type: 'set-clip-state'; clipId: string; muted?: boolean; reverse?: boolean; audioRole?: AudioRole }
  | { type: 'set-keyframe'; clipId: string; keyframe: TimelineKeyframe }
  | { type: 'remove-keyframe'; clipId: string; keyframeId: string }
  | { type: 'set-effect'; clipId: string; effect: Parameters<typeof setClipEffect>[2] }
  | { type: 'split'; clipId: string; atSeconds: number }
  | { type: 'ripple-delete'; clipId: string }
  | { type: 'lift-delete'; clipId: string }
  | { type: 'duplicate'; clipId: string; duplicateId: string; offsetSeconds?: number }
  | { type: 'fade'; clipId: string; fadeInSeconds?: number; fadeOutSeconds?: number; curve?: 'linear' | 'equal-power' | 'exponential' }
  | { type: 'transition'; transition: Parameters<typeof addTransition>[1] }
  | { type: 'add-track'; track: TimelineTrack }
  | { type: 'remove-track'; trackId: string }
  | { type: 'reorder-track'; trackId: string; index: number }
  | { type: 'set-track-state'; trackId: string; name?: string; muted?: boolean; solo?: boolean; locked?: boolean; relationship?: TimelineTrack['relationship']; connectedToClipId?: string }
  | { type: 'generative-region'; region: GenerativeRegion }
  | { type: 'generate-sfx'; request: SfxGenerationRequest }
  | { type: 'insert-generated-asset'; asset: GeneratedAssetInsertion };

export function applyTimelineCommand(timeline: EditableTimeline, command: TimelineCommand): EditableTimeline {
  switch (command.type) {
    case 'move':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return updateClip(timeline, command.clipId, clip => ({ ...clip, startSeconds: Math.max(0, command.startSeconds) }));
    case 'move-to-track':
      return moveClipToTrack(timeline, command.clipId, command.trackId, command.startSeconds);
    case 'trim':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return sourceAwareTrim(timeline, command.clipId, command.startSeconds, command.durationSeconds);
    case 'slip':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return slipClip(timeline, command.clipId, command.deltaSourceSeconds);
    case 'slide':
      return slideClip(timeline, command.clipId, command.deltaSeconds);
    case 'roll':
      return rollEdit(timeline, command.leftClipId, command.rightClipId, command.deltaSeconds);
    case 'set-volume':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return updateClip(timeline, command.clipId, clip => ({ ...clip, volume: Math.max(0, Math.min(2, command.volume)) }));
    case 'set-opacity':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return updateClip(timeline, command.clipId, clip => ({ ...clip, opacity: Math.max(0, Math.min(1, command.opacity)) }));
    case 'set-speed':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return setClipSpeed(timeline, command.clipId, command.speed);
    case 'set-blend-mode':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return setClipBlendMode(timeline, command.clipId, command.blendMode);
    case 'set-transform':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return setClipTransform(timeline, command.clipId, command.transform);
    case 'set-crop':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return setClipCrop(timeline, command.clipId, command.crop);
    case 'set-clip-name':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return updateClip(timeline, command.clipId, clip => ({ ...clip, name: command.name.trim() || clip.name }));
    case 'set-clip-state':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return updateClip(timeline, command.clipId, clip => ({
        ...clip,
        ...(command.muted !== undefined ? { muted: command.muted } : {}),
        ...(command.reverse !== undefined ? { reverse: command.reverse } : {}),
        ...(command.audioRole !== undefined ? { audioRole: command.audioRole } : {}),
      }));
    case 'set-keyframe':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return setTimelineKeyframe(timeline, command.clipId, command.keyframe);
    case 'remove-keyframe':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return removeTimelineKeyframe(timeline, command.clipId, command.keyframeId);
    case 'set-effect':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return setClipEffect(timeline, command.clipId, command.effect);
    case 'split':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return splitClip(timeline, command.clipId, command.atSeconds);
    case 'ripple-delete':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return rippleDeleteClip(timeline, command.clipId);
    case 'lift-delete':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return removeClipWithoutRipple(timeline, command.clipId);
    case 'duplicate':
      return duplicateClip(timeline, command.clipId, command.duplicateId, command.offsetSeconds ?? 0);
    case 'fade':
      if (clipTrackLocked(timeline, command.clipId)) return timeline;
      return setClipFade(timeline, command.clipId, command);
    case 'transition':
      return addTransition(timeline, command.transition);
    case 'add-track':
      return addTrack(timeline, command.track);
    case 'remove-track':
      return removeTrack(timeline, command.trackId);
    case 'reorder-track':
      return reorderTrack(timeline, command.trackId, command.index);
    case 'set-track-state':
      return updateTrack(timeline, command.trackId, track => ({
        ...track,
        ...(command.name !== undefined ? { name: command.name.trim() || track.name } : {}),
        ...(command.muted !== undefined ? { muted: command.muted } : {}),
        ...(command.solo !== undefined ? { solo: command.solo } : {}),
        ...(command.locked !== undefined ? { locked: command.locked } : {}),
        ...(command.relationship !== undefined ? { relationship: command.relationship } : {}),
        ...(command.connectedToClipId !== undefined ? { connectedToClipId: command.connectedToClipId || undefined } : {}),
      }));
    case 'generative-region':
      return addGenerativeRegion(timeline, command.region);
    case 'generate-sfx':
      return addSfxRequest(timeline, command.request);
    case 'insert-generated-asset':
      return insertGeneratedAsset(timeline, command.asset);
  }
}

function clipTrackLocked(timeline: EditableTimeline, clipId: string): boolean {
  return Boolean(timeline.tracks.find(track => track.locked && track.clips.some(clip => clip.id === clipId)));
}

function insertGeneratedAsset(timeline: EditableTimeline, asset: GeneratedAssetInsertion): EditableTimeline {
  const startSeconds = Math.max(0, asset.startSeconds);
  const endSeconds = Math.max(startSeconds + 0.1, asset.endSeconds);
  const durationSeconds = Math.min(timeline.durationSeconds - startSeconds, endSeconds - startSeconds);
  if (durationSeconds <= 0) return timeline;

  const trackKind = asset.mediaType === 'subtitle'
    ? 'subtitle'
    : asset.mediaType === 'audio'
      ? 'audio'
      : asset.mediaType === 'image' || asset.mediaType === 'video' || asset.mediaType === 'motion'
        ? 'overlay'
        : 'effect';
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

  const clip = {
    id: `generated:${asset.assetId}`,
    assetId: asset.assetId,
    trackId,
    name: typeof asset.metadata?.name === 'string' ? asset.metadata.name : `Generated ${asset.mediaType}`,
    startSeconds,
    durationSeconds,
    sourceInSeconds: 0,
    sourceOutSeconds: durationSeconds,
    sourceDurationSeconds: durationSeconds,
    effects: [],
    generativeRegions: [generativeRegion],
  };

  if (existingTrack) {
    return {
      ...timeline,
      tracks: timeline.tracks.map(track => track.id === existingTrack.id
        ? { ...track, clips: [...track.clips, clip].sort((a, b) => a.startSeconds - b.startSeconds) }
        : track),
    };
  }

  const nextIndex = timeline.tracks.length;
  const newTrack: TimelineTrack = {
    id: trackId,
    name: `Generated ${trackKind}`,
    kind: trackKind,
    relationship: trackKind === 'audio' || trackKind === 'overlay' ? 'connected' : 'lane',
    index: nextIndex,
    clips: [clip],
  };

  return { ...timeline, tracks: [...timeline.tracks, newTrack] };
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

export function timelineCommandReason(command: TimelineCommand): string {
  if (command.type === 'generative-region') return `Generative edit: ${command.region.instruction}`;
  if (command.type === 'generate-sfx') return `Generate SFX: ${command.request.prompt}`;
  if (command.type === 'insert-generated-asset') return `Insert generated ${command.asset.mediaType} asset: ${command.asset.assetId}`;
  if (command.type === 'transition') return 'Add timeline transition';
  if (command.type === 'set-track-state') return 'Update track controls';
  if (command.type === 'add-track') return `Add ${command.track.kind} track`;
  if (command.type === 'remove-track') return 'Remove empty track';
  if (command.type === 'move-to-track') return 'Move clip between tracks';
  if (command.type === 'roll') return 'Roll edit';
  if (command.type === 'slide') return 'Slide edit';
  if (command.type === 'slip') return 'Slip edit';
  return `Timeline ${command.type}`;
}
