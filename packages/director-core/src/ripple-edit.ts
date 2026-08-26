import type { EditableTimeline, TimelineClip } from './timeline-model';
export type RippleScope = 'track' | 'group' | 'all';
export type RippleOptions = { startSeconds: number; endSeconds: number; scope: RippleScope; trackIds?: string[]; };
const intersects = (c: TimelineClip, s: number, e: number) => c.startSeconds < e && s < c.startSeconds + c.durationSeconds;
const selected = (id: string, scope: RippleScope, ids?: string[]) => scope === 'all' || !!ids?.includes(id);
export function rippleDelete(timeline: EditableTimeline, options: RippleOptions): EditableTimeline {
  const { startSeconds: s, endSeconds: e } = options; if (s < 0 || e <= s) return timeline; const delta = e - s;
  return { ...timeline, tracks: timeline.tracks.map(track => {
    if (!selected(track.id, options.scope, options.trackIds)) return track;
    const clips: TimelineClip[] = [];
    for (const clip of track.clips) {
      const end = clip.startSeconds + clip.durationSeconds;
      if (!intersects(clip, s, e)) { clips.push(clip.startSeconds >= e ? { ...clip, startSeconds: clip.startSeconds - delta } : clip); continue; }
      if (clip.startSeconds < s) clips.push({ ...clip, durationSeconds: s - clip.startSeconds });
      if (end > e) clips.push({ ...clip, id: `${clip.id}:ripple-right`, startSeconds: s, durationSeconds: end - e, sourceInSeconds: (clip.sourceInSeconds ?? 0) + (e - clip.startSeconds) });
    }
    return { ...track, clips: clips.sort((a,b) => a.startSeconds - b.startSeconds) };
  }) };
}
