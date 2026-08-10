import type { EditableTimeline, GenerativeRegion } from './timeline-model.js';
import { addGenerativeRegion } from './timeline-model.js';
import { splitClip, setClipFade, addTransition, updateClip } from './timeline-editing.js';

export type TimelineCommand =
  | { type: 'move'; clipId: string; startSeconds: number }
  | { type: 'trim'; clipId: string; startSeconds: number; durationSeconds: number }
  | { type: 'split'; clipId: string; atSeconds: number }
  | { type: 'fade'; clipId: string; fadeInSeconds?: number; fadeOutSeconds?: number; curve?: 'linear' | 'equal-power' | 'exponential' }
  | { type: 'transition'; transition: Parameters<typeof addTransition>[1] }
  | { type: 'generative-region'; region: GenerativeRegion };

export function applyTimelineCommand(timeline: EditableTimeline, command: TimelineCommand): EditableTimeline {
  switch (command.type) {
    case 'move': return updateClip(timeline, command.clipId, clip => ({ ...clip, startSeconds: Math.max(0, command.startSeconds) }));
    case 'trim': return updateClip(timeline, command.clipId, clip => ({ ...clip, startSeconds: Math.max(0, command.startSeconds), durationSeconds: Math.max(0.1, command.durationSeconds) }));
    case 'split': return splitClip(timeline, command.clipId, command.atSeconds);
    case 'fade': return setClipFade(timeline, command.clipId, command);
    case 'transition': return addTransition(timeline, command.transition);
    case 'generative-region': return addGenerativeRegion(timeline, command.region);
  }
}

export function timelineCommandReason(command: TimelineCommand): string {
  return command.type === 'generative-region' ? `Generative edit: ${command.region.instruction}` : `Timeline ${command.type}`;
}
