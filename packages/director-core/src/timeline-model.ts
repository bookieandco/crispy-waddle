export type TrackKind = 'video' | 'audio' | 'overlay' | 'subtitle' | 'effect';
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
export type GenerativeOperation = 'extend' | 'replace' | 'remove' | 'insert' | 'fill' | 'reframe' | 'retime';

export type TimelineClip = {
  id: string;
  assetId: string;
  trackId: string;
  startSeconds: number;
  durationSeconds: number;
  sourceInSeconds?: number;
  sourceOutSeconds?: number;
  muted?: boolean;
  volume?: number;
  opacity?: number;
  blendMode?: BlendMode;
  effects: EffectInstance[];
  generativeRegions: GenerativeRegion[];
};

export type TimelineTrack = {
  id: string;
  name: string;
  kind: TrackKind;
  index: number;
  muted?: boolean;
  solo?: boolean;
  locked?: boolean;
  clips: TimelineClip[];
};

export type Transition = { id: string; fromClipId: string; toClipId: string; type: string; durationSeconds: number; parameters?: Record<string, unknown> };
export type Marker = { id: string; timeSeconds: number; label: string; color?: string; notes?: string };
export type EffectInstance = { id: string; type: string; enabled: boolean; parameters: Record<string, unknown> };
export type GenerativeRegion = { id: string; startSeconds: number; durationSeconds: number; operation: GenerativeOperation; instruction: string; sourceClipId?: string; approved?: boolean; resultAssetId?: string };

export type TimelineSnapshot = {
  tracks: TimelineTrack[];
  transitions: Transition[];
  markers: Marker[];
  playheadSeconds: number;
};

export type TimelineVersion = {
  id: string;
  version: number;
  parentVersionId?: string;
  createdAt: string;
  createdBy: 'user' | 'jhadina' | 'system';
  message: string;
  snapshotHash: string;
  snapshot?: TimelineSnapshot;
  revertsVersionId?: string;
  restoresVersionId?: string;
};

export type EditableTimeline = {
  version: 1;
  projectId: string;
  fps: number;
  width: number;
  height: number;
  durationSeconds: number;
  playheadSeconds: number;
  tracks: TimelineTrack[];
  transitions: Transition[];
  markers: Marker[];
  versions: TimelineVersion[];
};

export function createTimeline(input: Omit<EditableTimeline, 'version' | 'versions'>): EditableTimeline {
  return { version: 1, ...input, versions: [] };
}

export function addGenerativeRegion(timeline: EditableTimeline, region: GenerativeRegion): EditableTimeline {
  return { ...timeline, tracks: timeline.tracks.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === region.sourceClipId ? { ...clip, generativeRegions: [...clip.generativeRegions, region] } : clip) })) };
}
