import type { GenerationExecution } from './generation-execution';
import type { GenerationTask } from './generation-task';

/** Durable persistence boundary for Director generation work. */
export interface GenerationRepository {
  saveTask(task: GenerationTask): Promise<void>;
  getTask(id: string): Promise<GenerationTask | undefined>;
  getTaskByIdempotencyKey(idempotencyKey: string): Promise<GenerationTask | undefined>;

  saveExecution(execution: GenerationExecution): Promise<void>;
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

  async saveExecution(execution: GenerationExecution): Promise<void> {
    this.executions.set(execution.id, clone(execution));
  }

  async getExecution(id: string): Promise<GenerationExecution | undefined> {
    const execution = this.executions.get(id);
    return execution ? clone(execution) : undefined;
  }

  async getExecutionByProviderJob(providerId: string, providerJobId: string): Promise<GenerationExecution | undefined> {
    for (const execution of this.executions.values()) {
      if (execution.providerId === providerId && execution.providerJobId === providerJobId) {
        return clone(execution);
      }
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
