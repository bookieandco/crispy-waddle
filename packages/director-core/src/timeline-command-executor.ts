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
  switch (command.operation) {
    case 'move-clip': return command;
    case 'trim-clip': return command;
    case 'split-clip': return command;
    case 'ripple-delete': return command;
    case 'generative-region': return command;
    default: return assertNever(command);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported timeline command: ${JSON.stringify(value)}`);
}

/** Converts an approved TimelineCommand into the existing governed action boundary. */
export function createGovernedTimelineRequest(command: TimelineCommand, context: TimelineCommandExecutionContext): ActionRequest<ReturnType<typeof createTimelineAction>['action']> {
  return createTimelineAction(context.userId, toMutation(command), context.projectId, context.timeline, context.reason);
}

/** Executes only an already-approved command; this function does not interpret natural language. */
export async function executeApprovedTimelineCommand(
  command: TimelineCommand,
  context: TimelineCommandExecutionContext,
  executor: ActionExecutor<ReturnType<typeof createTimelineAction>['action'], GovernedTimelineResult>,
): Promise<GovernedTimelineResult> {
  const request = createGovernedTimelineRequest(command, context);
  return executeGovernedTimelineAction(executor, request);
}
