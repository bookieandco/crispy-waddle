import type {
  ApprovalRequest,
  AuditEntry,
  CapabilityRequest,
  CapabilityResult,
  DomainId,
  JhadinaEvent,
} from './contracts';
import type { EventBus } from './event-bus';

export interface PolicyBoundary {
  authorize(request: CapabilityRequest): Promise<{ allowed: boolean; requiresApproval: boolean; reason?: string }>;
}

export interface CapabilityExecutor {
  execute<TInput, TOutput>(request: CapabilityRequest<TInput>): Promise<CapabilityResult<TOutput>>;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

export interface ApprovalSink {
  create(request: ApprovalRequest): Promise<void>;
}

export class JhadinaOrchestrator {
  constructor(
    private readonly policy: PolicyBoundary,
    private readonly executor: CapabilityExecutor,
    private readonly audit: AuditSink,
    private readonly approvals: ApprovalSink,
    private readonly events: EventBus,
  ) {}

  async request<TInput, TOutput>(request: CapabilityRequest<TInput>): Promise<CapabilityResult<TOutput>> {
    const decision = await this.policy.authorize(request);

    if (!decision.allowed) {
      await this.audit.record({
        id: crypto.randomUUID(),
        actor: 'jhadina',
        action: request.capability,
        domain: request.domain,
        projectId: request.projectId,
        outcome: 'denied',
        occurredAt: new Date().toISOString(),
        metadata: { reason: decision.reason },
      });
      return {
        requestId: request.id,
        ok: false,
        error: { code: 'POLICY_DENIED', message: decision.reason ?? 'Capability denied by policy.' },
        completedAt: new Date().toISOString(),
      };
    }

    if (decision.requiresApproval || request.requiresApproval) {
      await this.approvals.create({
        id: crypto.randomUUID(),
        action: request.capability,
        domain: request.domain,
        projectId: request.projectId,
        reason: decision.reason ?? 'This action requires user approval.',
        createdAt: new Date().toISOString(),
        state: 'pending',
      });
      return {
        requestId: request.id,
        ok: false,
        error: { code: 'APPROVAL_REQUIRED', message: 'User approval is required before execution.' },
        completedAt: new Date().toISOString(),
      };
    }

    const result = await this.executor.execute<TInput, TOutput>(request);
    await this.audit.record({
      id: crypto.randomUUID(),
      actor: 'jhadina',
      action: request.capability,
      domain: request.domain,
      projectId: request.projectId,
      outcome: result.ok ? 'completed' : 'failed',
      occurredAt: result.completedAt,
      metadata: result.error,
    });

    await this.events.publish<JhadinaEvent['payload']>({
      id: crypto.randomUUID(),
      type: result.ok ? 'ACTION_COMPLETED' : 'ACTION_FAILED',
      source: request.domain,
      occurredAt: result.completedAt,
      projectId: request.projectId,
      payload: { requestId: request.id, capability: request.capability },
    });

    return result;
  }
}

export function domainIsAllowed(domain: DomainId, allowedDomains: readonly DomainId[]): boolean {
  return allowedDomains.includes(domain);
}
