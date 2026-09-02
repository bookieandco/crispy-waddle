import type { GenerationProvider, GenerationResult } from './generation-provider';
import type { GenerationExecution } from './generation-execution';
import type { GenerationTask } from './generation-task';
import type { GenerationRepository, GenerationSubmissionOutbox } from './generation-repository';

export class GenerationSubmissionCoordinator {
  constructor(
    private readonly repository: GenerationRepository,
    private readonly workerId: string,
    private readonly leaseMs = 30_000,
  ) {}

  private startHeartbeat(submission: GenerationSubmissionOutbox): { stop: () => void; lost: () => boolean } {
    if (!submission.leaseToken || !submission.leaseExpiresAt) return { stop: () => undefined, lost: () => false };
    let lost = false;
    const intervalMs = Math.max(10, Math.floor(this.leaseMs / 3));
    const timer = setInterval(() => {
      void this.repository
        .renewSubmissionLease(submission.id, this.workerId, submission.leaseToken!, this.leaseMs)
        .then((renewed) => { if (!renewed) lost = true; })
        .catch(() => { lost = true; });
    }, intervalMs);
    return { stop: () => clearInterval(timer), lost: () => lost };
  }

  async submit(task: GenerationTask, execution: GenerationExecution, provider: GenerationProvider): Promise<{ result?: GenerationResult; submission: GenerationSubmissionOutbox }> {
    if (provider.submissionGuarantee === 'non-idempotent') {
      throw new Error(`Provider ${provider.descriptor.id} is non-idempotent and cannot use the durable submission outbox`);
    }
    if (provider.submissionGuarantee === 'recoverable' && !provider.findByIdempotencyKey) {
      throw new Error(`Provider ${provider.descriptor.id} declares recoverable submission but has no idempotency-key recovery method`);
    }

    let submission = await this.repository.reserveSubmission(task, execution, provider.descriptor.id, task.idempotencyKey);
    if (!submission) throw new Error(`Unable to reserve provider submission: ${task.id}`);
    if (submission.status === 'submitted' && submission.providerJobId) return { submission };

    const claimed = await this.repository.claimSubmission(submission.id, this.workerId, this.leaseMs);
    if (!claimed) {
      const existing = await this.repository.getSubmissionByIdempotencyKey(provider.descriptor.id, task.idempotencyKey);
      if (existing?.status === 'submitted' && existing.providerJobId) return { submission: existing };
      throw new Error(`Unable to claim provider submission: ${submission.id}`);
    }
    submission = claimed;

    let heartbeat: { stop: () => void; lost: () => boolean } | undefined;
    try {
      heartbeat = this.startHeartbeat(submission);
      const result = await provider.submit(task.request, { idempotencyKey: task.idempotencyKey });
      if (heartbeat.lost()) {
        const recovered = provider.findByIdempotencyKey ? await provider.findByIdempotencyKey(task.idempotencyKey) : undefined;
        if (recovered) return { result: recovered, submission };
        return { result, submission };
      }

      if (!result.providerJobId) {
        await this.repository.markSubmissionRecoveryRequired(submission.id, this.workerId, submission.leaseToken!, 'Provider returned no provider job ID');
        return { result, submission: (await this.repository.getSubmissionByIdempotencyKey(provider.descriptor.id, task.idempotencyKey)) ?? submission };
      }

      const completedAt = new Date().toISOString();
      const acknowledged = await this.repository.acknowledgeSubmissionAndSaveState(
        submission.id,
        this.workerId,
        submission.leaseToken!,
        execution.leaseToken!,
        result.providerJobId,
        { ...task, status: result.status, error: result.error, updatedAt: completedAt },
        { ...execution, providerJobId: result.providerJobId, status: result.status, error: result.error, updatedAt: completedAt },
      );
      if (!acknowledged) {
        const existing = await this.repository.getSubmissionByIdempotencyKey(provider.descriptor.id, task.idempotencyKey);
        if (existing?.status === 'submitted' && existing.providerJobId) return { result, submission: existing };
        return { result, submission: existing ?? submission };
      }
      return { result, submission: acknowledged.submission };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!heartbeat?.lost()) {
        await this.repository.markSubmissionRecoveryRequired(submission.id, this.workerId, submission.leaseToken!, message).catch(() => undefined);
      }
      throw error;
    } finally {
      heartbeat?.stop();
    }
  }
}
