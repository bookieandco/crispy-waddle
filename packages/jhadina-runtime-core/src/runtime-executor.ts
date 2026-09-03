import {
  assertExecutionRequest,
  type ExecutionPolicy,
  type ExecutionRequest,
  type ExecutionResult,
  type RuntimeAdapterPort,
  type RuntimeAuditEvent,
  type RuntimeAuditSink,
} from './index.js';

export interface RuntimeExecutionClock {
  now(): string;
}

const systemClock: RuntimeExecutionClock = { now: () => new Date().toISOString() };

/**
 * Canonical runtime orchestration boundary.
 * Validation and policy happen before an adapter is permitted to execute.
 * The adapter receives no credentials or authorization authority from this class.
 */
export class GovernedRuntimeExecutor {
  constructor(
    private readonly policy: ExecutionPolicy,
    private readonly adapter: RuntimeAdapterPort,
    private readonly audit: RuntimeAuditSink,
    private readonly clock: RuntimeExecutionClock = systemClock,
  ) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    try {
      assertExecutionRequest(request);
    } catch (error) {
      await this.appendAudit(request, 'denied', { reason: 'invalid_execution_request' });
      throw error;
    }

    let decision: Awaited<ReturnType<ExecutionPolicy['evaluate']>>;
    try {
      decision = await this.policy.evaluate(request);
    } catch (error) {
      await this.appendAudit(request, 'denied', { reason: 'policy_evaluation_failed' });
      throw error;
    }

    if (decision !== 'allow') {
      await this.appendAudit(request, 'denied', { reason: 'policy_denied' });
      throw new Error(`Runtime execution denied: ${request.executionId}`);
    }

    // This is the last governed point before an adapter can cause execution.
    // If the durable allow record cannot be written, execution must not start.
    await this.appendAudit(request, 'allowed');

    try {
      const result = await this.adapter.execute(request, this.policy);
      await this.appendAudit(request, result.status === 'completed' ? 'completed' : 'failed');
      return result;
    } catch (error) {
      await this.appendAudit(request, 'failed', {
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async appendAudit(
    request: ExecutionRequest,
    status: RuntimeAuditEvent['status'],
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.audit.append({
      executionId: request.executionId,
      actorId: request.actorId,
      artifactDigestSha256: request.artifact.digestSha256,
      status,
      occurredAt: this.clock.now(),
      metadata,
    });
  }
}
