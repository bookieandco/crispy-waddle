import type { GenerationProvider } from './generation-provider';
import type { GenerationRepository, GenerationSubmissionOutbox } from './generation-repository';
import { GenerationSubmissionCoordinator } from './generation-submission-coordinator';

export type GenerationSubmissionReconciliationResult = {
  scanned: number;
  claimed: number;
  recovered: number;
  resubmitted: number;
  deferred: number;
  failed: number;
};

/**
 * Durable sweeper for submission intents left behind by crashed or expired workers.
 * It is deliberately safe to run concurrently: durable submission/execution leases fence each worker.
 */
export class GenerationSubmissionReconciler {
  constructor(
    private readonly repository: GenerationRepository,
    private readonly providers: ReadonlyMap<string, GenerationProvider>,
    private readonly workerId: string,
    private readonly leaseMs = 30_000,
  ) {}

  async runOnce(limit = 25): Promise<GenerationSubmissionReconciliationResult> {
    const candidates = await this.repository.listSubmissionRecoveryCandidates(limit);
    const result: GenerationSubmissionReconciliationResult = {
      scanned: candidates.length,
      claimed: 0,
      recovered: 0,
      resubmitted: 0,
      deferred: 0,
      failed: 0,
    };

    for (const candidate of candidates) {
      const claimed = await this.repository.claimSubmission(candidate.id, this.workerId, this.leaseMs);
      if (!claimed || claimed.status !== 'submitting' || claimed.leaseOwner !== this.workerId || !claimed.leaseToken) {
        result.deferred += 1;
        continue;
      }
      result.claimed += 1;

      try {
        const provider = this.providers.get(claimed.providerId);
        const task = await this.repository.getTask(claimed.taskId);
        if (!provider || !task) {
          await this.repository.markSubmissionRecoveryRequired(
            claimed.id,
            this.workerId,
            claimed.leaseToken,
            !provider ? `Unknown generation provider: ${claimed.providerId}` : `Generation task not found: ${claimed.taskId}`,
          );
          result.failed += 1;
          continue;
        }

        let execution = await this.repository.getExecution(claimed.executionId);
        if (!execution || execution.taskId !== task.id || execution.providerId !== provider.descriptor.id) {
          execution = undefined;
        }
        if (!execution || !execution.leaseToken || execution.leaseOwner !== this.workerId || !execution.leaseExpiresAt || Date.parse(execution.leaseExpiresAt) <= Date.now()) {
          execution = await this.repository.claimExecution(task.id, provider.descriptor.id, this.workerId, this.leaseMs);
        }
        if (!execution?.leaseToken) {
          // Another worker currently owns the execution. Leave the submission durable for the next sweep.
          result.deferred += 1;
          continue;
        }

        // Always reconcile provider-side existence before considering a new external submission.
        const recovered = provider.findByIdempotencyKey
          ? await provider.findByIdempotencyKey(claimed.idempotencyKey)
          : undefined;
        if (recovered?.providerJobId) {
          const completedAt = new Date().toISOString();
          const acknowledged = await this.repository.acknowledgeSubmissionAndSaveState(
            claimed.id,
            this.workerId,
            claimed.leaseToken,
            execution.leaseToken,
            recovered.providerJobId,
            { ...task, status: recovered.status, error: recovered.error, updatedAt: completedAt },
            { ...execution, providerJobId: recovered.providerJobId, status: recovered.status, error: recovered.error, updatedAt: completedAt },
          );
          if (acknowledged) result.recovered += 1;
          else result.deferred += 1;
          continue;
        }

        if (provider.submissionGuarantee === 'non-idempotent') {
          await this.repository.markSubmissionRecoveryRequired(
            claimed.id,
            this.workerId,
            claimed.leaseToken,
            `Provider ${provider.descriptor.id} has no safe retry guarantee and no recoverable provider job was found`,
          );
          result.deferred += 1;
          continue;
        }
        if (provider.submissionGuarantee === 'recoverable' && !provider.findByIdempotencyKey) {
          await this.repository.markSubmissionRecoveryRequired(
            claimed.id,
            this.workerId,
            claimed.leaseToken,
            `Provider ${provider.descriptor.id} declares recoverable submission but has no idempotency-key recovery method`,
          );
          result.failed += 1;
          continue;
        }

        const coordinator = new GenerationSubmissionCoordinator(this.repository, this.workerId, this.leaseMs);
        const submitted = await coordinator.submit(task, execution, provider);
        if (submitted.submission.status === 'submitted' && submitted.submission.providerJobId) result.resubmitted += 1;
        else result.deferred += 1;
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        await this.repository.markSubmissionRecoveryRequired(claimed.id, this.workerId, claimed.leaseToken, message).catch(() => undefined);
      }
    }

    return result;
  }
}

export function isSubmissionRecoveryCandidate(submission: GenerationSubmissionOutbox, now = Date.now()): boolean {
  return submission.status === 'pending'
    || submission.status === 'recovery_required'
    || (submission.status === 'submitting' && !!submission.leaseExpiresAt && Date.parse(submission.leaseExpiresAt) <= now);
}
