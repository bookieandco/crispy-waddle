import type {
  ApprovalRequest,
  AuditEntry,
  CapabilityRequest,
  CapabilityResult,
  DomainId,
} from './contracts';
import { JhadinaOrchestrator, type ApprovalSink, type AuditSink, type CapabilityExecutor, type PolicyBoundary } from './orchestrator';
import type { EventBus } from './event-bus';

export interface MemoryGateway {
  createCandidate(params: {
    userId: string;
    content: string;
    type: 'PREFERENCE' | 'IDENTITY' | 'GOAL' | 'CONTEXT';
    confidence: number;
    reasoningEventId: string;
  }): Promise<{ id: string }>;
  getContext(userId: string): Promise<unknown[]>;
}

export interface ReasoningGateway {
  create(params: {
    userId: string;
    userMessage: string;
    observation: { raw: string; extracted: string; timestamp: string };
    classification: { type: 'PREFERENCE' | 'IDENTITY' | 'GOAL' | 'CONTEXT'; confidence: number; reasoning?: string };
    systemResponse: string;
    confidence: number;
    candidateId?: string;
  }): Promise<{ id: string }>;
}

export interface TimelineGateway {
  recordReasoning(params: { userId: string; reasoningEventId: string; userMessage: string; systemResponse: string }): Promise<unknown>;
}

export interface CoreMemoryAdapter {
  memory: MemoryGateway;
  reasoning: ReasoningGateway;
  timeline: TimelineGateway;
}

export interface ApprovalRepository {
  create(request: ApprovalRequest): Promise<void>;
}

export interface ActionHandler {
  supports(domain: DomainId, capability: string): boolean;
  execute<TInput, TOutput>(request: CapabilityRequest<TInput>): Promise<CapabilityResult<TOutput>>;
}

/** Bridges the provider-neutral integration spine to the existing Jhadina core services. */
export class CoreCapabilityExecutor implements CapabilityExecutor {
  constructor(private readonly handlers: readonly ActionHandler[]) {}

  async execute<TInput, TOutput>(request: CapabilityRequest<TInput>): Promise<CapabilityResult<TOutput>> {
    const handler = this.handlers.find((candidate) => candidate.supports(request.domain, request.capability));
    if (!handler) {
      return {
        requestId: request.id,
        ok: false,
        error: { code: 'CAPABILITY_NOT_REGISTERED', message: `No handler registered for ${request.domain}:${request.capability}.` },
        completedAt: new Date().toISOString(),
      };
    }
    return handler.execute<TInput, TOutput>(request);
  }
}

export class CoreAuditSink implements AuditSink {
  constructor(private readonly sink: (entry: AuditEntry) => Promise<void>) {}
  record(entry: AuditEntry): Promise<void> { return this.sink(entry); }
}

export class CoreApprovalSink implements ApprovalSink {
  constructor(private readonly repository: ApprovalRepository) {}
  create(request: ApprovalRequest): Promise<void> { return this.repository.create(request); }
}

export interface CorePolicy {
  authorize(request: CapabilityRequest): Promise<{ allowed: boolean; requiresApproval: boolean; reason?: string }>;
}

export class CorePolicyBoundary implements PolicyBoundary {
  constructor(private readonly policy: CorePolicy) {}
  authorize(request: CapabilityRequest): Promise<{ allowed: boolean; requiresApproval: boolean; reason?: string }> {
    return this.policy.authorize(request);
  }
}

export function createCoreOrchestrator(params: {
  policy: CorePolicy;
  executor: CapabilityExecutor;
  audit: AuditSink;
  approvals: ApprovalSink;
  events: EventBus;
}): JhadinaOrchestrator {
  return new JhadinaOrchestrator(
    new CorePolicyBoundary(params.policy),
    params.executor,
    params.audit,
    params.approvals,
    params.events,
  );
}
