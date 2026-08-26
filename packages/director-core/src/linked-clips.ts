import type { EditableTimeline, TimelineClip } from './timeline-model';

export type LinkGroup = { id: string; clipIds: string[]; label?: string };

export function linkClips(timeline: EditableTimeline, clipIds: string[], groupId: string): EditableTimeline {
  const ids = new Set(clipIds);
  return { ...timeline, tracks: timeline.tracks.map(track => ({ ...track, clips: track.clips.map(clip => ids.has(clip.id) ? { ...clip, linkGroupId: groupId } : clip) })) };
}

export function unlinkClips(timeline: EditableTimeline, clipIds: string[]): EditableTimeline {
  const ids = new Set(clipIds);
  return { ...timeline, tracks: timeline.tracks.map(track => ({ ...track, clips: track.clips.map(clip => ids.has(clip.id) ? { ...clip, linkGroupId: undefined } : clip) })) };
}

export function getLinkedClips(timeline: EditableTimeline, clipId: string): TimelineClip[] {
  const clip = timeline.tracks.flatMap(track => track.clips).find(candidate => candidate.id === clipId);
  if (!clip?.linkGroupId) return clip ? [clip] : [];
  return timeline.tracks.flatMap(track => track.clips).filter(candidate => candidate.linkGroupId === clip.linkGroupId);
}

export function getLinkGroup(timeline: EditableTimeline, groupId: string): LinkGroup {
  return { id: groupId, clipIds: timeline.tracks.flatMap(track => track.clips).filter(clip => clip.linkGroupId === groupId).map(clip => clip.id) };
}
