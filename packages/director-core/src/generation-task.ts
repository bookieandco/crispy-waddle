import type { GenerationRequest } from './generation-provider';

export type GenerationTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Canonical Director-level work item.
 *
 * A task describes what Director wants generated. It intentionally does not
 * contain provider-specific execution identifiers or provider state.
 */
export type GenerationTask = {
  id: string;
  request: GenerationRequest;
  projectId: string;
  editPlanId?: string;
  operationId?: string;
  idempotencyKey: string;
  status: GenerationTaskStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export function generationTaskFromRequest(
  request: GenerationRequest,
  options: {
    editPlanId?: string;
    operationId?: string;
    idempotencyKey?: string;
  } = {},
): GenerationTask {
  return {
    id: request.requestId,
    request,
    projectId: request.projectId,
    editPlanId: options.editPlanId,
    operationId: options.operationId,
    idempotencyKey: options.idempotencyKey ?? request.requestId,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
