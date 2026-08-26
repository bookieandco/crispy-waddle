import type { EditableTimeline, TimelineClip } from './timeline-model.js';
import type { RenderRequest } from './media-renderer.js';

export type FFmpegRenderInput = {
  clipId: string;
  assetId: string;
  inputIndex: number;
  sourceInSeconds: number;
  sourceOutSeconds: number;
  timelineStartSeconds: number;
  durationSeconds: number;
  trackType: 'video' | 'audio';
  role?: string;
};

export type FFmpegAudioTrack = {
  trackId: string;
  role?: string;
  clipIds: string[];
  outputLabel: string;
};

export type FFmpegRenderPlan = {
  inputs: FFmpegRenderInput[];
  videoClipIds: string[];
  audioTracks: FFmpegAudioTrack[];
  filterComplex: string;
  outputArgs: string[];
};

/** Compiles the editorial timeline into an inspectable FFmpeg plan without executing FFmpeg. */
export function compileFFmpegRenderPlan(timeline: EditableTimeline, request: RenderRequest): FFmpegRenderPlan {
  const inputs: FFmpegRenderInput[] = [];
  const videoClipIds: string[] = [];
  const audioTracks: FFmpegAudioTrack[] = [];
  const filters: string[] = [];
  let inputIndex = 0;

  for (const track of timeline.tracks) {
    if (track.type !== 'video' && track.type !== 'audio') continue;
    const trackClipIds: string[] = [];
    for (const clip of track.clips) {
      const input = toInput(clip, inputIndex, track.type);
      inputs.push(input);
      trackClipIds.push(clip.id);
      if (track.type === 'video') videoClipIds.push(clip.id);
      inputIndex += 1;
    }
    if (track.type === 'audio') {
      const label = `a${audioTracks.length}`;
      audioTracks.push({ trackId: track.id, role: track.clips[0]?.metadata?.role, clipIds: trackClipIds, outputLabel: label });
    }
  }

  for (const input of inputs) {
    const trim = input.trackType === 'video'
      ? `[${input.inputIndex}:v]trim=start=${input.sourceInSeconds}:end=${input.sourceOutSeconds},setpts=PTS-STARTPTS+${input.timelineStartSeconds}/TB[v_${safe(input.clipId)}]`
      : `[${input.inputIndex}:a]atrim=start=${input.sourceInSeconds}:end=${input.sourceOutSeconds},asetpts=PTS-STARTPTS,adelay=${Math.round(input.timelineStartSeconds * 1000)}:all=1[a_${safe(input.clipId)}]`;
    filters.push(trim);
  }

  if (videoClipIds.length) {
    const videoLabels = videoClipIds.map(id => `[v_${safe(id)}]`).join('');
    filters.push(`${videoLabels}concat=n=${videoClipIds.length}:v=1:a=0[vout]`);
  }

  for (const track of audioTracks) {
    const labels = track.clipIds.map(id => `[a_${safe(id)}]`).join('');
    if (track.clipIds.length === 1) filters.push(`${labels}anull[${track.outputLabel}]`);
    else filters.push(`${labels}amix=inputs=${track.clipIds.length}:duration=longest:dropout_transition=0[${track.outputLabel}]`);
  }

  const mixLabels = audioTracks.map(track => `[${track.outputLabel}]`).join('');
  if (audioTracks.length) filters.push(`${mixLabels}amix=inputs=${audioTracks.length}:duration=longest:dropout_transition=0[aout]`);

  const outputArgs = [
    '-map', videoClipIds.length ? '[vout]' : '0:v?',
    ...(audioTracks.length ? ['-map', '[aout]'] : ['-an']),
    '-c:v', request.videoCodec ?? 'libx264',
    '-c:a', request.audioCodec ?? 'aac',
    '-movflags', '+faststart',
    request.outputPath,
  ];

  return { inputs, videoClipIds, audioTracks, filterComplex: filters.join(';'), outputArgs };
}

function toInput(clip: TimelineClip, inputIndex: number, trackType: 'video' | 'audio'): FFmpegRenderInput {
  return {
    clipId: clip.id,
    assetId: clip.assetId,
    inputIndex,
    sourceInSeconds: clip.sourceInSeconds,
    sourceOutSeconds: clip.sourceOutSeconds,
    timelineStartSeconds: clip.startSeconds,
    durationSeconds: clip.durationSeconds,
    trackType,
    role: clip.metadata?.role,
  };
}

function safe(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}
