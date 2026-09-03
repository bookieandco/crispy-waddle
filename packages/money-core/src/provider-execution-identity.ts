import { fingerprintAction, type ExecutionAction } from './execution-permit.js';
import type { ExecutionAttempt } from './execution-attempt.js';

export type ProviderExecutionIdentity = {
  executionId: string;
  idempotencyKey: string;
  actionFingerprint: string;
  provider: string;
  operation: string;
  providerReference?: string;
};

export function createProviderExecutionIdentity(input: {
  executionId: string;
  idempotencyKey: string;
  action: ExecutionAction;
  operation: string;
}): ProviderExecutionIdentity {
  if (!input.executionId || !input.idempotencyKey || !input.operation) {
    throw new Error('MONEY_PROVIDER_EXECUTION_IDENTITY_INVALID');
  }
  return {
    executionId: input.executionId,
    idempotencyKey: input.idempotencyKey,
    actionFingerprint: fingerprintAction(input.action),
    provider: input.action.provider,
    operation: input.operation,
  };
}

export function createProviderExecutionIdentityFromAttempt(attempt: ExecutionAttempt): ProviderExecutionIdentity {
  if (!attempt.attemptId || !attempt.idempotencyKey || !attempt.operation) {
    throw new Error('MONEY_PROVIDER_EXECUTION_IDENTITY_INVALID');
  }
  return {
    executionId: attempt.attemptId,
    idempotencyKey: attempt.idempotencyKey,
    actionFingerprint: attempt.actionFingerprint,
    provider: attempt.provider,
    operation: attempt.operation,
    providerReference: attempt.providerReference,
  };
}

export function assertProviderExecutionIdentity(identity: ProviderExecutionIdentity, expected: { executionId: string; provider: string; operation: string }): void {
  if (identity.executionId !== expected.executionId) throw new Error('MONEY_PROVIDER_EXECUTION_ID_MISMATCH');
  if (identity.provider !== expected.provider) throw new Error('MONEY_PROVIDER_PROVIDER_MISMATCH');
  if (identity.operation !== expected.operation) throw new Error('MONEY_PROVIDER_OPERATION_MISMATCH');
  if (!identity.idempotencyKey || !identity.actionFingerprint) throw new Error('MONEY_PROVIDER_EXECUTION_IDENTITY_INVALID');
}
