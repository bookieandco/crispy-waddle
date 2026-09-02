import type { GenerationExecution } from './generation-execution';
import type { GenerationTask } from './generation-task';
import type { GenerationSubmissionOutbox } from './generation-repository';

/** Durable lifecycle boundary for provider submission intents. */
export interface GenerationSubmissionRepository {
  reserveSubmission(task: GenerationTask, execution: GenerationExecution, providerId: string, idempotencyKey: string): Promise<GenerationSubmissionOutbox | undefined>;
  claimSubmission(submissionId: string, workerId: string, leaseMs: number): Promise<GenerationSubmissionOutbox | undefined>;
  renewSubmissionLease(submissionId: string, workerId: string, leaseToken: string, leaseMs: number): Promise<GenerationSubmissionOutbox | undefined>;
  acknowledgeSubmission(submissionId: string, workerId: string, leaseToken: string, providerJobId: string): Promise<GenerationSubmissionOutbox | undefined>;
  markSubmissionRecoveryRequired(submissionId: string, workerId: string, leaseToken: string, error: string): Promise<GenerationSubmissionOutbox | undefined>;
  getSubmissionByIdempotencyKey(providerId: string, idempotencyKey: string): Promise<GenerationSubmissionOutbox | undefined>;
}

export type GenerationSubmissionRepositoryHost = GenerationSubmissionRepository;
