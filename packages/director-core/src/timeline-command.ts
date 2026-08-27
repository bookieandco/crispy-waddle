import type { EditableTimeline, GenerativeRegion, SfxGenerationRequest, TimelineClip, TimelineTrack } from './timeline-model.js';
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
  | { type: 'trim'; clipId: string; startSeconds: number; durationSeconds: number }
  | { type: 'set-volume'; clipId: string; volume: number }
  | { type: 'set-opacity'; clipId: string; opacity: number }
  | { type: 'split'; clipId: string; atSeconds: number }
  | { type: 'ripple-delete'; clipId: string }
  | { type: 'fade'; clipId: string; fadeInSeconds?: number; fadeOutSeconds?: number; curve?: 'linear' | 'equal-power' | 'exponential' }
  | { type: 'transition'; transition: Parameters<typeof addTransition>[1] }
  | { type: 'generative-region'; region: GenerativeRegion }
  | { type: 'generate-sfx'; request: SfxGenerationRequest }
  | { type: 'insert-generated-asset'; asset: GeneratedAssetInsertion };

export function applyTimelineCommand(timeline: EditableTimeline, command: TimelineCommand): EditableTimeline {
  switch (command.type) {
    case 'move': return updateClip(timeline, command.clipId, clip => ({ ...clip, startSeconds: Math.max(0, command.startSeconds) }));
    case 'trim': return updateClip(timeline, command.clipId, clip => ({ ...clip, startSeconds: Math.max(0, command.startSeconds), durationSeconds: Math.max(0.1, command.durationSeconds) }));
    case 'set-volume': return updateClip(timeline, command.clipId, clip => ({ ...clip, volume: Math.max(0, Math.min(2, command.volume)) }));
    case 'set-opacity': return updateClip(timeline, command.clipId, clip => ({ ...clip, opacity: Math.max(0, Math.min(1, command.opacity)) }));
    case 'split': return splitClip(timeline, command.clipId, command.atSeconds);
    case 'ripple-delete': return rippleDelete(timeline, command.clipId);
    case 'fade': return setClipFade(timeline, command.clipId, command);
    case 'transition': return addTransition(timeline, command.transition);
    case 'generative-region': return addGenerativeRegion(timeline, command.region);
    case 'generate-sfx': return addSfxRequest(timeline, command.request);
    case 'insert-generated-asset': return insertGeneratedAsset(timeline, command.asset);
  }
}

function insertGeneratedAsset(timeline: EditableTimeline, asset: GeneratedAssetInsertion): EditableTimeline {
  const startSeconds = Math.max(0, asset.startSeconds);
  const endSeconds = Math.max(startSeconds + 0.1, asset.endSeconds);
  const durationSeconds = Math.min(timeline.durationSeconds - startSeconds, endSeconds - startSeconds);
  if (durationSeconds <= 0) return timeline;

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

  if (existingTrack) {
    return {
      ...timeline,
      tracks: timeline.tracks.map(track => track.id === existingTrack.id ? { ...track, clips: [...track.clips, clip].sort((a, b) => a.startSeconds - b.startSeconds) } : track),
    };
  }

  const nextIndex = timeline.tracks.length;
  const newTrack: TimelineTrack = {
    id: trackId,
    name: `Generated ${trackKind}`,
    kind: trackKind,
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

function rippleDelete(timeline: EditableTimeline, clipId: string): EditableTimeline {
  const target = timeline.tracks.flatMap(track => track.clips).find(clip => clip.id === clipId);
  if (!target) return timeline;
  const end = target.startSeconds + target.durationSeconds;
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.id !== clipId).map(clip => clip.startSeconds >= end ? { ...clip, startSeconds: Math.max(0, clip.startSeconds - target.durationSeconds) } : clip),
    })),
    transitions: timeline.transitions.filter(transition => transition.fromClipId !== clipId && transition.toClipId !== clipId),
  };
}

export function timelineCommandReason(command: TimelineCommand): string {
  if (command.type === 'generative-region') return `Generative edit: ${command.region.instruction}`;
  if (command.type === 'generate-sfx') return `Generate SFX: ${command.request.prompt}`;
  if (command.type === 'insert-generated-asset') return `Insert generated ${command.asset.mediaType} asset: ${command.asset.assetId}`;
  if (command.type === 'transition') return 'Add timeline transition';
  return `Timeline ${command.type}`;
}
