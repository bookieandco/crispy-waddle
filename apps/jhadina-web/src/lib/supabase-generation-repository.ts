import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerationExecution } from '@jhadina/director-core/generation-execution';
import type { GenerationRepository, GenerationSubmissionOutbox } from '@jhadina/director-core/generation-repository';
import type { GenerationTask } from '@jhadina/director-core/generation-task';

type TaskRow = { id: string; project_id: string; edit_plan_id: string | null; operation_id: string | null; idempotency_key: string; request: GenerationTask['request']; status: GenerationTask['status']; error: string | null; created_at: string; updated_at: string };
type ExecutionRow = { id: string; task_id: string; provider_id: string; provider_job_id: string | null; attempt: number; status: GenerationExecution['status']; error: string | null; lease_owner: string | null; lease_token: string | null; lease_expires_at: string | null; created_at: string; updated_at: string };
type SubmissionRow = { id: string; task_id: string; execution_id: string; provider_id: string; idempotency_key: string; request_payload: GenerationTask['request']; status: GenerationSubmissionOutbox['status']; provider_job_id: string | null; attempt: number; lease_owner: string | null; lease_token: string | null; lease_expires_at: string | null; last_error: string | null; created_at: string; updated_at: string };
type AtomicStateResult = { saved: boolean; task: TaskRow | null; execution: ExecutionRow | null };

function toTask(row: TaskRow): GenerationTask { return { id: row.id, request: row.request, projectId: row.project_id, editPlanId: row.edit_plan_id ?? undefined, operationId: row.operation_id ?? undefined, idempotencyKey: row.idempotency_key, status: row.status, error: row.error ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }
function toExecution(row: ExecutionRow): GenerationExecution { return { id: row.id, taskId: row.task_id, providerId: row.provider_id, providerJobId: row.provider_job_id ?? undefined, attempt: row.attempt, status: row.status, error: row.error ?? undefined, leaseOwner: row.lease_owner ?? undefined, leaseToken: row.lease_token ?? undefined, leaseExpiresAt: row.lease_expires_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }
function toSubmission(row: SubmissionRow): GenerationSubmissionOutbox { return { id: row.id, taskId: row.task_id, executionId: row.execution_id, providerId: row.provider_id, idempotencyKey: row.idempotency_key, requestPayload: row.request_payload, status: row.status, providerJobId: row.provider_job_id ?? undefined, attempt: row.attempt, leaseOwner: row.lease_owner ?? undefined, leaseToken: row.lease_token ?? undefined, leaseExpiresAt: row.lease_expires_at ?? undefined, lastError: row.last_error ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }

export function createSupabaseGenerationRepository(client: SupabaseClient): GenerationRepository {
  return {
    async claimTask(task) {
      const { data, error } = await client.rpc('claim_director_generation_task', { p_id: task.id, p_project_id: task.projectId, p_edit_plan_id: task.editPlanId ?? null, p_operation_id: task.operationId ?? null, p_idempotency_key: task.idempotencyKey, p_request: task.request, p_now: task.createdAt });
      if (error) throw error;
      if (!data) throw new Error(`Failed to claim generation task: ${task.idempotencyKey}`);
      return toTask(data as TaskRow);
    },
    async claimExecution(taskId, providerId, workerId, leaseMs) {
      const { data, error } = await client.rpc('claim_director_generation_execution', { p_task_id: taskId, p_provider_id: providerId, p_worker_id: workerId, p_lease_ms: leaseMs });
      if (error) throw error;
      if (!data) return undefined;
      return toExecution(data as ExecutionRow);
    },
    async renewExecutionLease(executionId, workerId, leaseToken, leaseMs) {
      const { data, error } = await client.rpc('renew_director_generation_execution_lease', { p_execution_id: executionId, p_worker_id: workerId, p_lease_token: leaseToken, p_lease_ms: leaseMs });
      if (error) throw error;
      return data ? toExecution(data as ExecutionRow) : undefined;
    },
    async saveTask(task) {
      const { error } = await client.from('director_generation_tasks').upsert({ id: task.id, project_id: task.projectId, edit_plan_id: task.editPlanId ?? null, operation_id: task.operationId ?? null, idempotency_key: task.idempotencyKey, request: task.request, status: task.status, error: task.error ?? null, created_at: task.createdAt, updated_at: task.updatedAt }, { onConflict: 'id' });
      if (error) throw error;
    },
    async getTask(id) { const { data, error } = await client.from('director_generation_tasks').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data ? toTask(data as TaskRow) : undefined; },
    async getTaskByIdempotencyKey(idempotencyKey) { const { data, error } = await client.from('director_generation_tasks').select('*').eq('idempotency_key', idempotencyKey).maybeSingle(); if (error) throw error; return data ? toTask(data as TaskRow) : undefined; },
    async saveExecution(execution) { const { error } = await client.from('director_generation_executions').upsert({ id: execution.id, task_id: execution.taskId, provider_id: execution.providerId, provider_job_id: execution.providerJobId ?? null, attempt: execution.attempt, status: execution.status, error: execution.error ?? null, lease_owner: execution.leaseOwner ?? null, lease_token: execution.leaseToken ?? null, lease_expires_at: execution.leaseExpiresAt ?? null, created_at: execution.createdAt, updated_at: execution.updatedAt }, { onConflict: 'id' }); if (error) throw error; return true; },
    async saveState(task, execution) {
      const { data, error } = await client.rpc('save_director_generation_state', { p_task_id: task.id, p_project_id: task.projectId, p_edit_plan_id: task.editPlanId ?? null, p_operation_id: task.operationId ?? null, p_idempotency_key: task.idempotencyKey, p_request: task.request, p_task_status: task.status, p_task_error: task.error ?? null, p_task_updated_at: task.updatedAt, p_execution_id: execution.id, p_execution_task_id: execution.taskId, p_provider_id: execution.providerId, p_provider_job_id: execution.providerJobId ?? null, p_attempt: execution.attempt, p_execution_status: execution.status, p_execution_error: execution.error ?? null, p_lease_owner: execution.leaseOwner ?? null, p_lease_token: execution.leaseToken ?? null, p_lease_expires_at: execution.leaseExpiresAt ?? null, p_execution_created_at: execution.createdAt, p_execution_updated_at: execution.updatedAt });
      if (error) throw error;
      const result = data as AtomicStateResult | null;
      if (!result) return false;
      return result.saved === true;
    },
    async reserveSubmission(task, execution, providerId, idempotencyKey) {
      const { data, error } = await client.rpc('reserve_director_generation_submission', { p_task_id: task.id, p_execution_id: execution.id, p_provider_id: providerId, p_idempotency_key: idempotencyKey, p_request_payload: task.request, p_lease_owner: execution.leaseOwner ?? null, p_lease_token: execution.leaseToken ?? null });
      if (error) throw error;
      return data ? toSubmission(data as SubmissionRow) : undefined;
    },
    async getExecution(id) { const { data, error } = await client.from('director_generation_executions').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data ? toExecution(data as ExecutionRow) : undefined; },
    async getExecutionByProviderJob(providerId, providerJobId) { const { data, error } = await client.from('director_generation_executions').select('*').eq('provider_id', providerId).eq('provider_job_id', providerJobId).maybeSingle(); if (error) throw error; return data ? toExecution(data as ExecutionRow) : undefined; },
    async listExecutions(taskId) { const { data, error } = await client.from('director_generation_executions').select('*').eq('task_id', taskId).order('attempt', { ascending: true }); if (error) throw error; return (data ?? []).map((row) => toExecution(row as ExecutionRow)); },
  };
}
