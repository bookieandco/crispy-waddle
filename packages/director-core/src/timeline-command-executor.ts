import type { EditableTimeline } from './timeline-model.js';
import type { TimelineCommand } from './timeline-command.js';
import { createTimelineAction, executeGovernedTimelineAction, type GovernedTimelineResult, type TimelineMutation } from './timeline-governed-action.js';
import type { ActionExecutor, ActionRequest } from '@jhadina/action-core';

export type TimelineCommandExecutionContext = {
  userId: string;
  projectId: string;
  timeline: EditableTimeline;
  reason?: string;
};

function toMutation(command: TimelineCommand): TimelineMutation {
  switch (command.type) {
    case 'move': return { operation: 'move-clip', clipId: command.clipId, startSeconds: command.startSeconds };
    case 'trim': return { operation: 'trim-clip', clipId: command.clipId, startSeconds: command.startSeconds, durationSeconds: command.durationSeconds };
    case 'split': return { operation: 'split-clip', clipId: command.clipId, atSeconds: command.atSeconds };
    case 'ripple-delete': return { operation: 'ripple-delete', clipIds: [command.clipId] };
    case 'generative-region': return { operation: 'generative-region', region: command.region };
    default: throw new Error(`Timeline command is not supported by the governed boundary: ${command.type}`);
  }
}

export function createGovernedTimelineRequest(command: TimelineCommand, context: TimelineCommandExecutionContext): ActionRequest<ReturnType<typeof createTimelineAction>['action']> {
  return createTimelineAction(context.userId, toMutation(command), context.projectId, context.timeline, context.reason);
}

/** Executes only an already-approved command; this function does not interpret natural language. */
export async function executeApprovedTimelineCommand(
  command: TimelineCommand,
  context: TimelineCommandExecutionContext,
  executor: ActionExecutor<ReturnType<typeof createTimelineAction>['action'], GovernedTimelineResult>,
): Promise<GovernedTimelineResult> {
  return executeGovernedTimelineAction(executor, createGovernedTimelineRequest(command, context));
}
