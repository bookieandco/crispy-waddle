import type { EditableTimeline, TimelineClip } from './timeline-model';
import type { Transcript, TranscriptWord } from './transcript-core';

export type TranscriptTimelineMatch = { word: TranscriptWord; clipId: string; trackId: string; timelineStartSeconds: number; timelineEndSeconds: number };
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

export function mapTranscriptToTimeline(timeline: EditableTimeline, transcript: Transcript): TranscriptTimelineMatch[] {
  const matches: TranscriptTimelineMatch[] = [];
  for (const segment of transcript.segments) for (const word of segment.words ?? []) for (const track of timeline.tracks) for (const clip of track.clips) {
    const clipStart = clip.startSeconds, clipEnd = clip.startSeconds + clip.durationSeconds;
    if (overlaps(word.startSeconds, word.endSeconds, clipStart, clipEnd)) matches.push({ word, clipId: clip.id, trackId: track.id, timelineStartSeconds: Math.max(word.startSeconds, clipStart), timelineEndSeconds: Math.min(word.endSeconds, clipEnd) });
  }
  return matches;
}

export function findTranscriptTextRange(transcript: Transcript, text: string): { startSeconds: number; endSeconds: number } | null {
  const needle = text.trim().toLowerCase(); if (!needle) return null;
  for (const segment of transcript.segments) {
    const words = segment.words ?? [];
    for (let i = 0; i < words.length; i++) { let combined = '';
      for (let j = i; j < words.length; j++) { combined = `${combined} ${words[j].text}`.trim();
        if (combined.toLowerCase() === needle) return { startSeconds: words[i].startSeconds, endSeconds: words[j].endSeconds };
        if (combined.length > needle.length) break;
      }
    }
  }
  return null;
}

export function clipsIntersectingTranscriptRange(timeline: EditableTimeline, startSeconds: number, endSeconds: number): Array<{ trackId: string; clip: TimelineClip }> {
  return timeline.tracks.flatMap(track => track.clips.filter(clip => overlaps(startSeconds, endSeconds, clip.startSeconds, clip.startSeconds + clip.durationSeconds)).map(clip => ({ trackId: track.id, clip })));
}
