import { createHash } from 'node:crypto';
import type { ExecutionAction } from './execution-permit.js';

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
    actionFingerprint: createHash('sha256')
      .update(`jhadina-provider-execution:v1:${input.executionId}:${input.action.actionId}:${input.idempotencyKey}`)
      .digest('hex'),
    provider: input.action.provider,
    operation: input.operation,
  };
}

export function assertProviderExecutionIdentity(identity: ProviderExecutionIdentity, expected: { executionId: string; provider: string; operation: string }): void {
  if (identity.executionId !== expected.executionId) throw new Error('MONEY_PROVIDER_EXECUTION_ID_MISMATCH');
  if (identity.provider !== expected.provider) throw new Error('MONEY_PROVIDER_PROVIDER_MISMATCH');
  if (identity.operation !== expected.operation) throw new Error('MONEY_PROVIDER_OPERATION_MISMATCH');
  if (!identity.idempotencyKey || !identity.actionFingerprint) throw new Error('MONEY_PROVIDER_EXECUTION_IDENTITY_INVALID');
}
