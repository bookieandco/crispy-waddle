import type { ApprovalReceiptVerifier } from './approval-receipt.js';

export type ActionPolicyDecision = 'allow' | 'deny' | 'approval_required';

export interface ActionRequest<TAction = unknown> {
  id: string;
  userId: string;
  type: string;
  action: TAction;
  requestedAt: string;
  approvalReceiptId?: string;
}

export interface ActionAuditEvent {
  id: string;
  actionId: string;
  userId: string;
  type: string;
  status: 'started' | 'approval_required' | 'completed' | 'denied' | 'failed';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ActionLedger {
  append(event: ActionAuditEvent): Promise<void>;
}

export interface ActionPolicy<TAction = unknown> {
  evaluate(request: ActionRequest<TAction>): Promise<ActionPolicyDecision>;
}

export interface ActionHandler<TAction = unknown, TResult = unknown> {
  supports(type: string): boolean;
  execute(action: TAction, request: ActionRequest<TAction>): Promise<TResult>;
}

export class InMemoryActionLedger implements ActionLedger {
  private readonly events: ActionAuditEvent[] = [];

  async append(event: ActionAuditEvent): Promise<void> {
    this.events.push(Object.freeze({ ...event }));
  }

  list(): readonly ActionAuditEvent[] {
    return this.events;
  }
}

export class AllowAllActionPolicy<TAction = unknown> implements ActionPolicy<TAction> {
  async evaluate(_request: ActionRequest<TAction>): Promise<ActionPolicyDecision> {
    return 'allow';
  }
}

export class ActionExecutor<TAction = unknown, TResult = unknown> {
  constructor(
    private readonly policy: ActionPolicy<TAction>,
    private readonly ledger: ActionLedger,
    private readonly handlers: readonly ActionHandler<TAction, TResult>[],
    private readonly approvalReceipts?: ApprovalReceiptVerifier<TAction>,
  ) {}

  async execute(request: ActionRequest<TAction>): Promise<TResult> {
    const now = () => new Date().toISOString();
    // Fail closed: if the start event can't be durably recorded, this throws
    // here and nothing below — policy, handler, side effects — ever runs.
    await this.ledger.append({
      id: `${request.id}:started`,
      actionId: request.id,
      userId: request.userId,
      type: request.type,
      status: 'started',
      timestamp: now(),
    });

    const decision = await this.policy.evaluate(request);

    if (decision === 'approval_required') {
      if (!request.approvalReceiptId || !this.approvalReceipts) {
        await this.ledger.append({
          id: `${request.id}:approval-required`,
          actionId: request.id,
          userId: request.userId,
          type: request.type,
          status: 'approval_required',
          timestamp: now(),
        });
        throw new Error(`Approval required: ${request.type}`);
      }

      const valid = await this.approvalReceipts.verifyAndConsume(request.approvalReceiptId, request);
      if (!valid) {
        await this.ledger.append({
          id: `${request.id}:denied`,
          actionId: request.id,
          userId: request.userId,
          type: request.type,
          status: 'denied',
          timestamp: now(),
          metadata: { reason: 'invalid_or_expired_approval_receipt' },
        });
        throw new Error(`Invalid approval receipt: ${request.type}`);
      }
    } else if (decision === 'deny') {
      await this.ledger.append({
        id: `${request.id}:denied`,
        actionId: request.id,
        userId: request.userId,
        type: request.type,
        status: 'denied',
        timestamp: now(),
      });
      throw new Error(`Action denied: ${request.type}`);
    }

    const handler = this.handlers.find((candidate) => candidate.supports(request.type));
    if (!handler) {
      await this.ledger.append({
        id: `${request.id}:failed`,
        actionId: request.id,
        userId: request.userId,
        type: request.type,
        status: 'failed',
        timestamp: now(),
        metadata: { reason: 'handler_not_found' },
      });
      throw new Error(`No action handler registered for ${request.type}`);
    }

    let result: TResult;
    try {
      result = await handler.execute(request.action, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await this.ledger.append({
          id: `${request.id}:failed`,
          actionId: request.id,
          userId: request.userId,
          type: request.type,
          status: 'failed',
          timestamp: now(),
          metadata: { error: message },
        });
      } catch (auditError) {
        // Don't let a failed audit append swallow the original handler error.
        throw new Error(
          `ACTION_FAILED_AND_AUDIT_FAILED:${message}:${auditError instanceof Error ? auditError.message : String(auditError)}`,
        );
      }
      throw error;
    }

    // The handler's side effect already happened successfully — never report
    // it as a failure just because the durable completion-audit append
    // afterward failed. The caller still needs to know the audit trail may be
    // incomplete, so this still throws, but with a distinct, tagged error
    // rather than a misleading 'failed' status recorded against a successful
    // action.
    try {
      await this.ledger.append({
        id: `${request.id}:completed`,
        actionId: request.id,
        userId: request.userId,
        type: request.type,
        status: 'completed',
        timestamp: now(),
      });
    } catch (auditError) {
      throw new Error(
        `ACTION_COMPLETED_AUDIT_FAILED:${auditError instanceof Error ? auditError.message : String(auditError)}`,
      );
    }

    return result;
  }
}
