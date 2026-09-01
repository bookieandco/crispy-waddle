import type { GenerationResult } from './generation-provider';
import type { GenerationTaskStatus } from './generation-task';

/**
 * Provider execution state for a Director generation task.
 *
 * This is deliberately separate from GenerationTask so provider retries,
 * provider job IDs, and provider failures cannot redefine Director's work
 * identity.
 */
export type GenerationExecution = {
  id: string;
  taskId: string;
  providerId: string;
  providerJobId?: string;
  attempt: number;
  status: GenerationTaskStatus;
  error?: string;
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
    createdAt: now,
    updatedAt: now,
  };
}
