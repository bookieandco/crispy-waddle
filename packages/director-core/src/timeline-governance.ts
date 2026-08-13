import type { EditableTimeline, GenerativeRegion } from './timeline-model.js';

export type TimelineApproval = {
  id: string;
  projectId: string;
  operation: 'generative-edit' | 'timeline-edit';
  regionId?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: 'user' | 'jhadina';
  requestedAt: string;
  instruction: string;
  proposedTimelineVersion?: number;
};

export function requestGenerativeApproval(timeline: EditableTimeline, region: GenerativeRegion, requestedBy: 'user' | 'jhadina' = 'user'): { timeline: EditableTimeline; approval: TimelineApproval } {
  const approval: TimelineApproval = { id: crypto.randomUUID(), projectId: timeline.projectId, operation: 'generative-edit', regionId: region.id, status: 'pending', requestedBy, requestedAt: new Date().toISOString(), instruction: region.instruction, proposedTimelineVersion: timeline.versions.length + 1 };
  return { timeline, approval };
}

export function resolveGenerativeApproval(timeline: EditableTimeline, approval: TimelineApproval, decision: 'approved' | 'rejected'): TimelineApproval {
  return { ...approval, status: decision };
}
