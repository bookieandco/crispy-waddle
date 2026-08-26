import type { EditableTimeline, GenerativeRegion } from './timeline-model.js';
import type { ActionHandler, ActionRequest } from '@jhadina/action-core';

export type TimelineMutation =
  | { operation: 'move-clip'; clipId: string; startSeconds: number }
  | { operation: 'trim-clip'; clipId: string; startSeconds: number; durationSeconds: number }
  | { operation: 'split-clip'; clipId: string; atSeconds: number }
  | { operation: 'ripple-delete'; clipIds: string[] }
  | { operation: 'generative-region'; region: GenerativeRegion };

export type GovernedTimelineAction = {
  projectId: string;
  timeline: EditableTimeline;
  mutation: TimelineMutation;
  reason?: string;
};

export type GovernedTimelineResult = {
  timeline: EditableTimeline;
  version: number;
  versionId: string;
  auditMetadata: Record<string, unknown>;
};

export function createTimelineAction<T extends TimelineMutation>(userId: string, mutation: T, projectId: string, timeline: EditableTimeline, reason?: string): ActionRequest<GovernedTimelineAction> {
  return { id: crypto.randomUUID(), userId, type: `director.timeline.${mutation.operation}`, requestedAt: new Date().toISOString(), action: { projectId, timeline, mutation, reason } };
}

export function createTimelineHandler(apply: (action: GovernedTimelineAction) => Promise<EditableTimeline> | EditableTimeline): ActionHandler<GovernedTimelineAction, GovernedTimelineResult> {
  return {
    supports: type => type.startsWith('director.timeline.'),
    async execute(action, request) {
      const nextTimeline = await apply(action);
      const previous = action.timeline.versions.at(-1);
      const version = (previous?.version ?? 0) + 1;
      const versionId = crypto.randomUUID();
      const versionEntry = { id: versionId, version, parentVersionId: previous?.id, createdAt: new Date().toISOString(), createdBy: request.userId === 'jhadina' ? 'jhadina' as const : 'user' as const, message: action.reason ?? action.mutation.operation, snapshotHash: `${request.id}:${version}` };
      const timeline = { ...nextTimeline, versions: [...nextTimeline.versions, versionEntry] };
      return { timeline, version, versionId, auditMetadata: { projectId: action.projectId, operation: action.mutation.operation, mutation: action.mutation, versionId, version } };
    },
  };
}
