import type { GenerationExecution } from './generation-execution';
import type { GenerationTask } from './generation-task';

export type GenerationSubmissionOutboxStatus = 'pending' | 'submitting' | 'submitted' | 'recovery_required' | 'failed';

export type GenerationSubmissionOutbox = {
  id: string;
  taskId: string;
  executionId: string;
  providerId: string;
  idempotencyKey: string;
  requestPayload: GenerationTask['request'];
  status: GenerationSubmissionOutboxStatus;
  providerJobId?: string;
  attempt: number;
  leaseOwner?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

/** Durable persistence boundary for Director generation work. */
export interface GenerationRepository {
  claimTask(task: GenerationTask): Promise<GenerationTask>;
  saveTask(task: GenerationTask): Promise<void>;
  getTask(id: string): Promise<GenerationTask | undefined>;
  getTaskByIdempotencyKey(idempotencyKey: string): Promise<GenerationTask | undefined>;
  claimExecution(taskId: string, providerId: string, workerId: string, leaseMs: number): Promise<GenerationExecution | undefined>;
  saveExecution(execution: GenerationExecution): Promise<boolean>;
  saveState(task: GenerationTask, execution: GenerationExecution): Promise<boolean>;
  getExecution(id: string): Promise<GenerationExecution | undefined>;
  getExecutionByProviderJob(providerId: string, providerJobId: string): Promise<GenerationExecution | undefined>;
  listExecutions(taskId: string): Promise<GenerationExecution[]>;
  renewExecutionLease(executionId: string, workerId: string, leaseToken: string, leaseMs: number): Promise<GenerationExecution | undefined>;
  reserveSubmission(task: GenerationTask, execution: GenerationExecution, providerId: string, idempotencyKey: string): Promise<GenerationSubmissionOutbox | undefined>;
  claimSubmission(submissionId: string, workerId: string, leaseMs: number): Promise<GenerationSubmissionOutbox | undefined>;
  renewSubmissionLease(submissionId: string, workerId: string, leaseToken: string, leaseMs: number): Promise<GenerationSubmissionOutbox | undefined>;
  acknowledgeSubmission(submissionId: string, workerId: string, leaseToken: string, providerJobId: string): Promise<GenerationSubmissionOutbox | undefined>;
  markSubmissionRecoveryRequired(submissionId: string, workerId: string, leaseToken: string, error: string): Promise<GenerationSubmissionOutbox | undefined>;
  getSubmissionByIdempotencyKey(providerId: string, idempotencyKey: string): Promise<GenerationSubmissionOutbox | undefined>;
}

function clone<T>(value: T): T { return structuredClone(value); }
function newLeaseToken(): string { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
function newSubmissionId(): string { return `submission:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }

export class InMemoryGenerationRepository implements GenerationRepository {
  private readonly tasks = new Map<string, GenerationTask>();
  private readonly tasksByIdempotencyKey = new Map<string, string>();
  private readonly executions = new Map<string, GenerationExecution>();
  private readonly submissions = new Map<string, GenerationSubmissionOutbox>();
  private readonly submissionsByKey = new Map<string, string>();

  async claimTask(task: GenerationTask): Promise<GenerationTask> {
    const existingId = this.tasksByIdempotencyKey.get(task.idempotencyKey);
    if (existingId) { const existing = this.tasks.get(existingId); if (existing) return clone(existing); }
    this.tasks.set(task.id, clone(task)); this.tasksByIdempotencyKey.set(task.idempotencyKey, task.id); return clone(task);
  }
  async saveTask(task: GenerationTask): Promise<void> { const existingId = this.tasksByIdempotencyKey.get(task.idempotencyKey); if (existingId && existingId !== task.id) throw new Error(`Generation task idempotency key already belongs to task: ${existingId}`); this.tasks.set(task.id, clone(task)); this.tasksByIdempotencyKey.set(task.idempotencyKey, task.id); }
  async getTask(id: string): Promise<GenerationTask | undefined> { const task = this.tasks.get(id); return task ? clone(task) : undefined; }
  async getTaskByIdempotencyKey(idempotencyKey: string): Promise<GenerationTask | undefined> { const id = this.tasksByIdempotencyKey.get(idempotencyKey); return id ? this.getTask(id) : undefined; }
  async claimExecution(taskId: string, providerId: string, workerId: string, leaseMs: number): Promise<GenerationExecution | undefined> { const id = `${taskId}:attempt:1`; const now = Date.now(); const existing = this.executions.get(id); if (existing && existing.status !== 'queued' && existing.status !== 'running') return clone(existing); const leaseExpiry = existing?.leaseExpiresAt ? Date.parse(existing.leaseExpiresAt) : 0; if (existing && leaseExpiry > now && existing.leaseOwner !== workerId) return undefined; const updated: GenerationExecution = existing ? { ...existing, providerId, leaseOwner: workerId, leaseToken: newLeaseToken(), leaseExpiresAt: new Date(now + leaseMs).toISOString(), updatedAt: new Date(now).toISOString() } : { id, taskId, providerId, attempt: 1, status: 'queued', leaseOwner: workerId, leaseToken: newLeaseToken(), leaseExpiresAt: new Date(now + leaseMs).toISOString(), createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() }; this.executions.set(id, clone(updated)); return clone(updated); }
  async renewExecutionLease(executionId: string, workerId: string, leaseToken: string, leaseMs: number): Promise<GenerationExecution | undefined> { const existing = this.executions.get(executionId); if (!existing || existing.leaseOwner !== workerId || existing.leaseToken !== leaseToken || (existing.leaseExpiresAt ? Date.parse(existing.leaseExpiresAt) <= Date.now() : true)) return undefined; const now = Date.now(); const updated = { ...existing, leaseExpiresAt: new Date(now + leaseMs).toISOString(), updatedAt: new Date(now).toISOString() }; this.executions.set(executionId, clone(updated)); return clone(updated); }
  async saveExecution(execution: GenerationExecution): Promise<boolean> { const existing = this.executions.get(execution.id); if (existing?.leaseToken && existing.leaseToken !== execution.leaseToken) return false; if (existing?.leaseOwner && existing.leaseOwner !== execution.leaseOwner) return false; this.executions.set(execution.id, clone(execution)); return true; }
  async saveState(task: GenerationTask, execution: GenerationExecution): Promise<boolean> { const existingTask = this.tasks.get(task.id); if (!existingTask) return false; const existingExecution = this.executions.get(execution.id); if (existingExecution?.taskId !== task.id) return false; if (existingExecution?.leaseToken && existingExecution.leaseToken !== execution.leaseToken) return false; if (existingExecution?.leaseOwner && existingExecution.leaseOwner !== execution.leaseOwner) return false; const existingId = this.tasksByIdempotencyKey.get(task.idempotencyKey); if (existingId && existingId !== task.id) throw new Error(`Generation task idempotency key already belongs to task: ${existingId}`); this.executions.set(execution.id, clone(execution)); this.tasks.set(task.id, clone(task)); this.tasksByIdempotencyKey.set(task.idempotencyKey, task.id); return true; }
  async reserveSubmission(task: GenerationTask, execution: GenerationExecution, providerId: string, idempotencyKey: string): Promise<GenerationSubmissionOutbox | undefined> { const durableTask = this.tasks.get(task.id); const durableExecution = this.executions.get(execution.id); if (!durableTask || !durableExecution || durableExecution.taskId !== task.id) return undefined; if (durableExecution.leaseOwner !== execution.leaseOwner || durableExecution.leaseToken !== execution.leaseToken) return undefined; if (!durableExecution.leaseExpiresAt || Date.parse(durableExecution.leaseExpiresAt) <= Date.now()) return undefined; const key = `${providerId}:${idempotencyKey}`; const existingId = this.submissionsByKey.get(key); if (existingId) { const existing = this.submissions.get(existingId); if (!existing) return undefined; if (existing.taskId !== task.id) throw new Error('Submission idempotency key belongs to another generation task'); if (existing.status === 'submitted') return clone(existing); const rebound = { ...existing, executionId: execution.id, requestPayload: clone(task.request), leaseOwner: execution.leaseOwner, leaseToken: execution.leaseToken, leaseExpiresAt: execution.leaseExpiresAt, updatedAt: new Date().toISOString() }; this.submissions.set(existing.id, clone(rebound)); return clone(rebound); } const now = new Date().toISOString(); const submission: GenerationSubmissionOutbox = { id: newSubmissionId(), taskId: task.id, executionId: execution.id, providerId, idempotencyKey, requestPayload: clone(task.request), status: 'pending', attempt: 0, leaseOwner: execution.leaseOwner, leaseToken: execution.leaseToken, leaseExpiresAt: execution.leaseExpiresAt, createdAt: now, updatedAt: now }; this.submissions.set(submission.id, clone(submission)); this.submissionsByKey.set(key, submission.id); return clone(submission); }
  async claimSubmission(submissionId: string, workerId: string, leaseMs: number): Promise<GenerationSubmissionOutbox | undefined> { const existing = this.submissions.get(submissionId); if (!existing || existing.status === 'submitted') return existing ? clone(existing) : undefined; const now = Date.now(); if (existing.status === 'submitting' && existing.leaseExpiresAt && Date.parse(existing.leaseExpiresAt) > now && existing.leaseOwner !== workerId) return undefined; const updated: GenerationSubmissionOutbox = { ...existing, status: 'submitting', attempt: existing.attempt + 1, leaseOwner: workerId, leaseToken: newLeaseToken(), leaseExpiresAt: new Date(now + leaseMs).toISOString(), updatedAt: new Date(now).toISOString() }; this.submissions.set(submissionId, clone(updated)); return clone(updated); }
  async renewSubmissionLease(submissionId: string, workerId: string, leaseToken: string, leaseMs: number): Promise<GenerationSubmissionOutbox | undefined> { const existing = this.submissions.get(submissionId); if (!existing || existing.status !== 'submitting' || existing.leaseOwner !== workerId || existing.leaseToken !== leaseToken || !existing.leaseExpiresAt || Date.parse(existing.leaseExpiresAt) <= Date.now()) return undefined; const now = Date.now(); const updated = { ...existing, leaseExpiresAt: new Date(now + leaseMs).toISOString(), updatedAt: new Date(now).toISOString() }; this.submissions.set(submissionId, clone(updated)); return clone(updated); }
  async acknowledgeSubmission(submissionId: string, workerId: string, leaseToken: string, providerJobId: string): Promise<GenerationSubmissionOutbox | undefined> { const existing = this.submissions.get(submissionId); if (!existing || existing.status !== 'submitting' || existing.leaseOwner !== workerId || existing.leaseToken !== leaseToken || !existing.leaseExpiresAt || Date.parse(existing.leaseExpiresAt) <= Date.now()) return undefined; const updated = { ...existing, status: 'submitted' as const, providerJobId, leaseOwner: undefined, leaseToken: undefined, leaseExpiresAt: undefined, updatedAt: new Date().toISOString() }; this.submissions.set(submissionId, clone(updated)); return clone(updated); }
  async markSubmissionRecoveryRequired(submissionId: string, workerId: string, leaseToken: string, error: string): Promise<GenerationSubmissionOutbox | undefined> { const existing = this.submissions.get(submissionId); if (!existing || existing.status !== 'submitting' || existing.leaseOwner !== workerId || existing.leaseToken !== leaseToken || !existing.leaseExpiresAt || Date.parse(existing.leaseExpiresAt) <= Date.now()) return undefined; const updated = { ...existing, status: 'recovery_required' as const, lastError: error, leaseOwner: undefined, leaseToken: undefined, leaseExpiresAt: undefined, updatedAt: new Date().toISOString() }; this.submissions.set(submissionId, clone(updated)); return clone(updated); }
  async getSubmissionByIdempotencyKey(providerId: string, idempotencyKey: string): Promise<GenerationSubmissionOutbox | undefined> { const id = this.submissionsByKey.get(`${providerId}:${idempotencyKey}`); if (!id) return undefined; const submission = this.submissions.get(id); return submission ? clone(submission) : undefined; }
  async getExecution(id: string): Promise<GenerationExecution | undefined> { const execution = this.executions.get(id); return execution ? clone(execution) : undefined; }
  async getExecutionByProviderJob(providerId: string, providerJobId: string): Promise<GenerationExecution | undefined> { for (const execution of this.executions.values()) if (execution.providerId === providerId && execution.providerJobId === providerJobId) return clone(execution); return undefined; }
  async listExecutions(taskId: string): Promise<GenerationExecution[]> { return [...this.executions.values()].filter((execution) => execution.taskId === taskId).sort((a, b) => a.attempt - b.attempt).map(clone); }
}
