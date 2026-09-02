import type { GenerationResult } from './generation-provider';
import type { GenerationTaskStatus } from './generation-task';

/**
 * Provider execution state for a Director generation task.
 *
 * A lease identifies the worker currently allowed to advance an execution.
 * It is recovery metadata, not a guarantee of exactly-once execution at an
 * external provider boundary.
 */
export type GenerationExecution = {
  id: string;
  taskId: string;
  providerId: string;
  providerJobId?: string;
  attempt: number;
  status: GenerationTaskStatus;
  error?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function generationExecutionFromResult(
  taskId: string,
  providerId: string,
  result: GenerationResult,
  options: {
    id?: string;
    attempt?: number;
    now?: string;
    leaseOwner?: string;
    leaseExpiresAt?: string;
  } = {},
): GenerationExecution {
  const now = options.now ?? new Date().toISOString();
  return {
    id: options.id ?? `${taskId}:attempt:${options.attempt ?? 1}`,
    taskId,
    providerId,
    providerJobId: result.providerJobId,
    attempt: options.attempt ?? 1,
    status: result.status,
    error: result.error,
    leaseOwner: options.leaseOwner,
    leaseExpiresAt: options.leaseExpiresAt,
    createdAt: now,
    updatedAt: now,
  };
}
