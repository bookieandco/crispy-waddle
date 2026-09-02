import {
  assertExecutionRequest,
  type ExecutionPolicy,
  type ExecutionRequest,
  type ExecutionResult,
  type ResourceEnforcerPort,
  type RuntimeAdapterPort,
  type RuntimeAuditEvent,
  type RuntimeAuditSink,
  type RuntimeResourceLease,
} from './index.js';
import { assertResourceEnforcementReceipt } from './resource-enforcement.js';

export interface RuntimeExecutionClock { now(): string; }
const systemClock: RuntimeExecutionClock = { now: () => new Date().toISOString() };

/**
 * Canonical runtime orchestration boundary. No adapter is reachable until
 * request validation, policy, and physically attested resource enforcement have passed.
 */
export class GovernedRuntimeExecutor {
  constructor(
    private readonly policy: ExecutionPolicy,
    private readonly adapter: RuntimeAdapterPort,
    private readonly audit: RuntimeAuditSink,
    private readonly resourceEnforcer: ResourceEnforcerPort,
    private readonly clock: RuntimeExecutionClock = systemClock,
  ) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    try { assertExecutionRequest(request); }
    catch (error) { await this.appendAudit(request, 'denied', { reason: 'invalid_execution_request' }); throw error; }

    let decision: Awaited<ReturnType<ExecutionPolicy['evaluate']>>;
    try { decision = await this.policy.evaluate(request); }
    catch (error) { await this.appendAudit(request, 'denied', { reason: 'policy_evaluation_failed' }); throw error; }
    if (decision !== 'allow') {
      await this.appendAudit(request, 'denied', { reason: 'policy_denied' });
      throw new Error(`Runtime execution denied: ${request.executionId}`);
    }

    let lease: RuntimeResourceLease;
    try {
      lease = await this.resourceEnforcer.acquire(request);
    } catch (error) {
      await this.appendAudit(request, 'denied', { reason: 'resource_enforcement_unavailable' });
      throw error;
    }

    try {
      assertResourceEnforcementReceipt(request, lease);
    } catch (error) {
      await this.safeRelease(lease);
      await this.appendAudit(request, 'denied', { reason: 'invalid_resource_attestation' });
      throw error;
    }

    // The durable allow record is the final governed point before execution.
    try { await this.appendAudit(request, 'allowed', { resourceLimits: request.manifest.resourceLimits, resourceAttestation: lease.enforcement }); }
    catch (error) { await this.safeRelease(lease); throw error; }

    try {
      const result = await this.adapter.execute(request, lease);
      await this.appendAudit(request, result.status === 'completed' ? 'completed' : 'failed');
      return result;
    } catch (error) {
      await this.appendAudit(request, 'failed', { reason: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      await lease.release();
    }
  }

  private async safeRelease(lease: RuntimeResourceLease): Promise<void> {
    try { await lease.release(); } catch { /* original fail-closed error wins */ }
  }

  private async appendAudit(request: ExecutionRequest, status: RuntimeAuditEvent['status'], metadata?: Readonly<Record<string, unknown>>): Promise<void> {
    await this.audit.append({ executionId: request.executionId, actorId: request.actorId, artifactDigestSha256: request.artifact.digestSha256, status, occurredAt: this.clock.now(), metadata });
  }
}