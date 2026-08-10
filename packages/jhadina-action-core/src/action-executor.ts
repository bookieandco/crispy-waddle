export type ActionPolicyDecision = "allow" | "deny";

export interface ActionRequest<TAction = unknown> {
  id: string;
  userId: string;
  type: string;
  action: TAction;
  requestedAt: string;
}

export interface ActionAuditEvent {
  id: string;
  actionId: string;
  userId: string;
  type: string;
  status: "started" | "completed" | "denied" | "failed";
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
    return "allow";
  }
}

export class ActionExecutor<TAction = unknown, TResult = unknown> {
  constructor(
    private readonly policy: ActionPolicy<TAction>,
    private readonly ledger: ActionLedger,
    private readonly handlers: readonly ActionHandler<TAction, TResult>[],
  ) {}

  async execute(request: ActionRequest<TAction>): Promise<TResult> {
    const now = () => new Date().toISOString();
    const started = now();
    await this.ledger.append({
      id: `${request.id}:started`,
      actionId: request.id,
      userId: request.userId,
      type: request.type,
      status: "started",
      timestamp: started,
    });

    const decision = await this.policy.evaluate(request);
    if (decision !== "allow") {
      await this.ledger.append({
        id: `${request.id}:denied`,
        actionId: request.id,
        userId: request.userId,
        type: request.type,
        status: "denied",
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
        status: "failed",
        timestamp: now(),
        metadata: { reason: "handler_not_found" },
      });
      throw new Error(`No action handler registered for ${request.type}`);
    }

    try {
      const result = await handler.execute(request.action, request);
      await this.ledger.append({
        id: `${request.id}:completed`,
        actionId: request.id,
        userId: request.userId,
        type: request.type,
        status: "completed",
        timestamp: now(),
      });
      return result;
    } catch (error) {
      await this.ledger.append({
        id: `${request.id}:failed`,
        actionId: request.id,
        userId: request.userId,
        type: request.type,
        status: "failed",
        timestamp: now(),
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }
}
