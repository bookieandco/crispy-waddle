import { createHash } from 'node:crypto';
import type { ExecutionAction } from './execution-permit.js';

export type ExecutionAttemptState =
  | 'STARTED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'RECOVERY_REQUIRED';

export interface ExecutionAttempt {
  attemptId: string;
  requestId: string;
  permitId: string;
  actionFingerprint: string;
  provider: string;
  operation: string;
  idempotencyKey: string;
  state: ExecutionAttemptState;
  providerReference?: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  recoveryRequired: boolean;
}

export interface ExecutionAttemptStore {
  start(attempt: ExecutionAttempt): Promise<void> | void;
  complete(
    attemptId: string,
    outcome: Pick<ExecutionAttempt, 'state' | 'providerReference' | 'errorCode' | 'errorMessage' | 'recoveryRequired'>,
    completedAt?: string,
  ): Promise<void> | void;
  get(attemptId: string): Promise<ExecutionAttempt | undefined> | ExecutionAttempt | undefined;
}

/** Stable across retries of the same authorized economic action. */
export function executionIdempotencyKey(
  permitId: string,
  actionFingerprint: string,
): string {
  return createHash('sha256')
    .update(`jhadina-money-execution:v1:${permitId}:${actionFingerprint}`, 'utf8')
    .digest('hex');
}

export function createExecutionAttempt(input: {
  attemptId: string;
  requestId: string;
  permitId: string;
  action: ExecutionAction;
  operation: string;
  now: string;
}): ExecutionAttempt {
  const actionFingerprint = createHash('sha256')
    .update(JSON.stringify(input.action), 'utf8')
    .digest('hex');
  return {
    attemptId: input.attemptId,
    requestId: input.requestId,
    permitId: input.permitId,
    actionFingerprint,
    provider: input.action.provider,
    operation: input.operation,
    idempotencyKey: executionIdempotencyKey(input.permitId, actionFingerprint),
    state: 'STARTED',
    startedAt: input.now,
    recoveryRequired: false,
  };
}
