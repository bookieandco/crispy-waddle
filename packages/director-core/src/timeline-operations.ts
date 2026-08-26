import type { EditableTimeline, TimelineClip } from './timeline-model';

function withClips(timeline: EditableTimeline, trackId: string, clips: TimelineClip[]): EditableTimeline {
  return { ...timeline, tracks: timeline.tracks.map(track => track.id === trackId ? { ...track, clips } : track) };
}

export function splitClip(timeline: EditableTimeline, trackId: string, clipId: string, atSeconds: number): EditableTimeline {
  const track = timeline.tracks.find(t => t.id === trackId);
  const clip = track?.clips.find(c => c.id === clipId);
  if (!clip || atSeconds <= clip.startSeconds || atSeconds >= clip.startSeconds + clip.durationSeconds) return timeline;
  const offset = atSeconds - clip.startSeconds;
  const left: TimelineClip = { ...clip, id: `${clip.id}:a`, durationSeconds: offset, sourceOutSeconds: (clip.sourceInSeconds ?? 0) + offset };
  const right: TimelineClip = { ...clip, id: `${clip.id}:b`, startSeconds: atSeconds, durationSeconds: clip.durationSeconds - offset, sourceInSeconds: (clip.sourceInSeconds ?? 0) + offset };
  return withClips(timeline, trackId, track!.clips.flatMap(c => c.id === clipId ? [left, right] : [c]));
}

export function trimClip(timeline: EditableTimeline, trackId: string, clipId: string, startSeconds: number, endSeconds: number): EditableTimeline {
  const track = timeline.tracks.find(t => t.id === trackId);
  const clip = track?.clips.find(c => c.id === clipId);
  if (!clip || endSeconds <= startSeconds || startSeconds < clip.startSeconds || endSeconds > clip.startSeconds + clip.durationSeconds) return timeline;
  const sourceIn = (clip.sourceInSeconds ?? 0) + (startSeconds - clip.startSeconds);
  return withClips(timeline, trackId, track!.clips.map(c => c.id === clipId ? { ...c, startSeconds, durationSeconds: endSeconds - startSeconds, sourceInSeconds: sourceIn, sourceOutSeconds: sourceIn + endSeconds - startSeconds } : c));
}

export function moveClip(timeline: EditableTimeline, trackId: string, clipId: string, startSeconds: number): EditableTimeline {
  if (startSeconds < 0) return timeline;
  return withClips(timeline, trackId, timeline.tracks.find(t => t.id === trackId)?.clips.map(c => c.id === clipId ? { ...c, startSeconds } : c) ?? []);
}

export function removeClip(timeline: EditableTimeline, trackId: string, clipId: string): EditableTimeline {
  const track = timeline.tracks.find(t => t.id === trackId);
  if (!track?.clips.some(c => c.id === clipId)) return timeline;
  return withClips(timeline, trackId, track.clips.filter(c => c.id !== clipId));
}

export function insertClip(timeline: EditableTimeline, trackId: string, clip: TimelineClip): EditableTimeline {
  const track = timeline.tracks.find(t => t.id === trackId);
  if (!track) return timeline;
  return withClips(timeline, trackId, [...track.clips, clip].sort((a, b) => a.startSeconds - b.startSeconds));
}
