import type { GenerationProvider, GenerationProviderRecord, GenerationRequest, GenerationResult } from './generation-provider';
import type { GenerationRepository } from './generation-repository';
import { GenerationSubmissionCoordinator } from './generation-submission-coordinator';

/**
 * Production boundary that prevents GenerationService from reaching an external
 * provider without first creating and claiming durable submission intent.
 */
export class OutboxGenerationProvider implements GenerationProvider {
  readonly descriptor: GenerationProviderRecord;
  readonly submissionGuarantee: GenerationProvider['submissionGuarantee'];

  constructor(
    private readonly provider: GenerationProvider,
    private readonly repository: GenerationRepository,
    private readonly workerId: string,
    private readonly leaseMs = 30_000,
  ) {
    this.descriptor = provider.descriptor;
    this.submissionGuarantee = provider.submissionGuarantee;
  }

  async submit(request: GenerationRequest): Promise<GenerationResult> {
    const task = await this.repository.getTaskByIdempotencyKey(request.requestId);
    if (!task) throw new Error(`Durable generation task not found for submission: ${request.requestId}`);
    const executions = await this.repository.listExecutions(task.id);
    const execution = executions.at(-1);
    if (!execution) throw new Error(`Durable generation execution not found for task: ${task.id}`);

    const coordinator = new GenerationSubmissionCoordinator(this.repository, this.workerId, this.leaseMs);
    const { result, submission } = await coordinator.submit(task, execution, this.provider);
    if (result) return result;
    if (submission.providerJobId) return this.provider.status(submission.providerJobId);
    throw new Error(`Provider submission requires reconciliation: ${submission.id}`);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<GenerationResult | undefined> {
    return this.provider.findByIdempotencyKey?.(idempotencyKey);
  }

  async status(providerJobId: string): Promise<GenerationResult> {
    return this.provider.status(providerJobId);
  }

  async cancel(providerJobId: string): Promise<void> {
    return this.provider.cancel(providerJobId);
  }
}
