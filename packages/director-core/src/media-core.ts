export type MediaKind = 'video' | 'audio';
export type TrackRole = 'video' | 'audio';

export type MediaAsset = {
  id: string;
  kind: MediaKind;
  uri: string;
  durationSeconds?: number;
  frameRate?: number;
  sampleRate?: number;
  channels?: number;
  width?: number;
  height?: number;
  proxyUri?: string;
  metadata?: Record<string, unknown>;
};

export type MediaClip = {
  id: string;
  assetId: string;
  trackId: string;
  startSeconds: number;
  durationSeconds: number;
  sourceInSeconds?: number;
  sourceOutSeconds?: number;
  linkedClipId?: string;
  enabled?: boolean;
};

export type MediaTrack = {
  id: string;
  name: string;
  role: TrackRole;
  index: number;
  muted?: boolean;
  solo?: boolean;
  locked?: boolean;
  clips: MediaClip[];
};

export type MediaProject = {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  durationSeconds: number;
  assets: MediaAsset[];
  videoTracks: MediaTrack[];
  audioTracks: MediaTrack[];
};

export type ProxyProfile = 'preview-540p' | 'preview-720p' | 'edit-1080p';

export type ProxyJob = {
  id: string;
  assetId: string;
  profile: ProxyProfile;
  status: 'queued' | 'running' | 'completed' | 'failed';
  outputUri?: string;
  error?: string;
};

export function createMediaProject(input: Omit<MediaProject, 'assets' | 'videoTracks' | 'audioTracks'> & Partial<Pick<MediaProject, 'assets' | 'videoTracks' | 'audioTracks'>>): MediaProject {
  return {
    ...input,
    assets: input.assets ?? [],
    videoTracks: input.videoTracks ?? [],
    audioTracks: input.audioTracks ?? [],
  };
}

export function addMediaAsset(project: MediaProject, asset: MediaAsset): MediaProject {
  return { ...project, assets: [...project.assets.filter(a => a.id !== asset.id), asset] };
}

export function addVideoTrack(project: MediaProject, track: MediaTrack): MediaProject {
  if (track.role !== 'video') throw new Error('Video track must have role=video');
  return { ...project, videoTracks: [...project.videoTracks.filter(t => t.id !== track.id), track] };
}

export function addAudioTrack(project: MediaProject, track: MediaTrack): MediaProject {
  if (track.role !== 'audio') throw new Error('Audio track must have role=audio');
  return { ...project, audioTracks: [...project.audioTracks.filter(t => t.id !== track.id), track] };
}

export function linkMediaClips(project: MediaProject, videoClipId: string, audioClipId: string): MediaProject {
  return {
    ...project,
    videoTracks: project.videoTracks.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === videoClipId ? { ...clip, linkedClipId: audioClipId } : clip) })),
    audioTracks: project.audioTracks.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === audioClipId ? { ...clip, linkedClipId: videoClipId } : clip) })),
  };
}

export function unlinkMediaClip(project: MediaProject, clipId: string): MediaProject {
  return {
    ...project,
    videoTracks: project.videoTracks.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === clipId ? { ...clip, linkedClipId: undefined } : clip) })),
    audioTracks: project.audioTracks.map(track => ({ ...track, clips: clip.id === clipId ? { ...clip, linkedClipId: undefined } : clip) as MediaTrack),
  };
}
