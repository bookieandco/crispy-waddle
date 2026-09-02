import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerationExecution } from '@jhadina/director-core/generation-execution';
import type { GenerationRepository } from '@jhadina/director-core/generation-repository';
import type { GenerationTask } from '@jhadina/director-core/generation-task';

type TaskRow = {
  id: string;
  project_id: string;
  edit_plan_id: string | null;
  operation_id: string | null;
  idempotency_key: string;
  request: GenerationTask['request'];
  status: GenerationTask['status'];
  error: string | null;
  created_at: string;
  updated_at: string;
};

type ExecutionRow = {
  id: string;
  task_id: string;
  provider_id: string;
  provider_job_id: string | null;
  attempt: number;
  status: GenerationExecution['status'];
  error: string | null;
  created_at: string;
  updated_at: string;
};

function toTask(row: TaskRow): GenerationTask {
  return {
    id: row.id,
    request: row.request,
    projectId: row.project_id,
    editPlanId: row.edit_plan_id ?? undefined,
    operationId: row.operation_id ?? undefined,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toExecution(row: ExecutionRow): GenerationExecution {
  return {
    id: row.id,
    taskId: row.task_id,
    providerId: row.provider_id,
    providerJobId: row.provider_job_id ?? undefined,
    attempt: row.attempt,
    status: row.status,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Privileged repository for Director generation records.
 *
 * The backing tables are intentionally internal/RLS-protected, so this
 * repository must only receive a server-side service-role client.
 */
export function createSupabaseGenerationRepository(client: SupabaseClient): GenerationRepository {
  return {
    async saveTask(task) {
      const { error } = await client.from('director_generation_tasks').upsert({
        id: task.id,
        project_id: task.projectId,
        edit_plan_id: task.editPlanId ?? null,
        operation_id: task.operationId ?? null,
        idempotency_key: task.idempotencyKey,
        request: task.request,
        status: task.status,
        error: task.error ?? null,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      }, { onConflict: 'id' });
      if (error) throw error;
    },

    async getTask(id) {
      const { data, error } = await client
        .from('director_generation_tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? toTask(data as TaskRow) : undefined;
    },

    async getTaskByIdempotencyKey(idempotencyKey) {
      const { data, error } = await client
        .from('director_generation_tasks')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (error) throw error;
      return data ? toTask(data as TaskRow) : undefined;
    },

    async saveExecution(execution) {
      const { error } = await client.from('director_generation_executions').upsert({
        id: execution.id,
        task_id: execution.taskId,
        provider_id: execution.providerId,
        provider_job_id: execution.providerJobId ?? null,
        attempt: execution.attempt,
        status: execution.status,
        error: execution.error ?? null,
        created_at: execution.createdAt,
        updated_at: execution.updatedAt,
      }, { onConflict: 'id' });
      if (error) throw error;
    },

    async getExecution(id) {
      const { data, error } = await client
        .from('director_generation_executions')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? toExecution(data as ExecutionRow) : undefined;
    },

    async getExecutionByProviderJob(providerId, providerJobId) {
      const { data, error } = await client
        .from('director_generation_executions')
        .select('*')
        .eq('provider_id', providerId)
        .eq('provider_job_id', providerJobId)
        .maybeSingle();
      if (error) throw error;
      return data ? toExecution(data as ExecutionRow) : undefined;
    },

    async listExecutions(taskId) {
      const { data, error } = await client
        .from('director_generation_executions')
        .select('*')
        .eq('task_id', taskId)
        .order('attempt', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => toExecution(row as ExecutionRow));
    },
  };
}
