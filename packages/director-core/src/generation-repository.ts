import type { GenerationExecution } from './generation-execution';
import type { GenerationTask } from './generation-task';

/** Durable persistence boundary for Director generation work. */
export interface GenerationRepository {
  /** Atomically create-or-return the canonical task for an idempotency key. */
  claimTask(task: GenerationTask): Promise<GenerationTask>;
  saveTask(task: GenerationTask): Promise<void>;
  getTask(id: string): Promise<GenerationTask | undefined>;
  getTaskByIdempotencyKey(idempotencyKey: string): Promise<GenerationTask | undefined>;

  /** Atomically acquire an execution lease, creating attempt 1 when absent. */
  claimExecution(taskId: string, providerId: string, workerId: string, leaseMs: number): Promise<GenerationExecution | undefined>;
  /** Persist only if the worker still owns the execution lease. Returns false for stale workers. */
  saveExecution(execution: GenerationExecution): Promise<boolean>;
  getExecution(id: string): Promise<GenerationExecution | undefined>;
  getExecutionByProviderJob(providerId: string, providerJobId: string): Promise<GenerationExecution | undefined>;
  listExecutions(taskId: string): Promise<GenerationExecution[]>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Reference implementation for unit tests and local runtimes. */
export class InMemoryGenerationRepository implements GenerationRepository {
  private readonly tasks = new Map<string, GenerationTask>();
  private readonly tasksByIdempotencyKey = new Map<string, string>();
  private readonly executions = new Map<string, GenerationExecution>();

  async claimTask(task: GenerationTask): Promise<GenerationTask> {
    const existingId = this.tasksByIdempotencyKey.get(task.idempotencyKey);
    if (existingId) {
      const existing = this.tasks.get(existingId);
      if (existing) return clone(existing);
    }
    this.tasks.set(task.id, clone(task));
    this.tasksByIdempotencyKey.set(task.idempotencyKey, task.id);
    return clone(task);
  }

  async saveTask(task: GenerationTask): Promise<void> {
    const existingId = this.tasksByIdempotencyKey.get(task.idempotencyKey);
    if (existingId && existingId !== task.id) {
      throw new Error(`Generation task idempotency key already belongs to task: ${existingId}`);
    }
    this.tasks.set(task.id, clone(task));
    this.tasksByIdempotencyKey.set(task.idempotencyKey, task.id);
  }

  async getTask(id: string): Promise<GenerationTask | undefined> {
    const task = this.tasks.get(id);
    return task ? clone(task) : undefined;
  }

  async getTaskByIdempotencyKey(idempotencyKey: string): Promise<GenerationTask | undefined> {
    const id = this.tasksByIdempotencyKey.get(idempotencyKey);
    return id ? this.getTask(id) : undefined;
  }

  async claimExecution(taskId: string, providerId: string, workerId: string, leaseMs: number): Promise<GenerationExecution | undefined> {
    const id = `${taskId}:attempt:1`;
    const now = Date.now();
    const existing = this.executions.get(id);
    if (existing && existing.status !== 'queued' && existing.status !== 'running') return clone(existing);
    const leaseExpiry = existing?.leaseExpiresAt ? Date.parse(existing.leaseExpiresAt) : 0;
    if (existing && leaseExpiry > now && existing.leaseOwner !== workerId) return undefined;
    const updated: GenerationExecution = existing
      ? { ...existing, providerId, leaseOwner: workerId, leaseExpiresAt: new Date(now + leaseMs).toISOString(), updatedAt: new Date(now).toISOString() }
      : { id, taskId, providerId, attempt: 1, status: 'queued', leaseOwner: workerId, leaseExpiresAt: new Date(now + leaseMs).toISOString(), createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
    this.executions.set(id, clone(updated));
    return clone(updated);
  }

  async saveExecution(execution: GenerationExecution): Promise<boolean> {
    const existing = this.executions.get(execution.id);
    if (existing && existing.leaseOwner && existing.leaseOwner !== execution.leaseOwner) return false;
    if (existing && existing.leaseExpiresAt && Date.parse(existing.leaseExpiresAt) < Date.now() && existing.leaseOwner !== execution.leaseOwner) return false;
    this.executions.set(execution.id, clone(execution));
    return true;
  }

  async getExecution(id: string): Promise<GenerationExecution | undefined> {
    const execution = this.executions.get(id);
    return execution ? clone(execution) : undefined;
  }

  async getExecutionByProviderJob(providerId: string, providerJobId: string): Promise<GenerationExecution | undefined> {
    for (const execution of this.executions.values()) {
      if (execution.providerId === providerId && execution.providerJobId === providerJobId) return clone(execution);
    }
    return undefined;
  }

  async listExecutions(taskId: string): Promise<GenerationExecution[]> {
    return [...this.executions.values()]
      .filter((execution) => execution.taskId === taskId)
      .sort((a, b) => a.attempt - b.attempt)
      .map(clone);
  }
}
