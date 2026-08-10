import type { ActionAuditEvent, ActionHandler, ActionLedger, ActionPolicy, ActionRequest } from './action-executor.js';
import { ActionExecutor } from './action-executor.js';

export interface VerifiedIdentity {
  userId: string;
  sessionId: string;
}

export interface ActionIdentityVerifier {
  verify(request: ActionRequest): Promise<VerifiedIdentity>;
}

/**
 * Governs every action through server-verified identity before the normal
 * Policy -> Handler -> Audit execution path is allowed to run.
 */
export class VerifiedActionExecutor<TAction = unknown, TResult = unknown> {
  private readonly executor: ActionExecutor<TAction, TResult>;

  constructor(
    private readonly identityVerifier: ActionIdentityVerifier,
    policy: ActionPolicy<TAction>,
    ledger: ActionLedger,
    handlers: readonly ActionHandler<TAction, TResult>[],
  ) {
    this.executor = new ActionExecutor(policy, ledger, handlers);
  }

  async execute(request: ActionRequest<TAction>): Promise<TResult> {
    const identity = await this.identityVerifier.verify(request);
    if (identity.userId !== request.userId) {
      throw new Error('Action identity mismatch');
    }
    if (!identity.sessionId) {
      throw new Error('Action session missing');
    }
    return this.executor.execute(request);
  }
}

export class StaticIdentityVerifier implements ActionIdentityVerifier {
  constructor(private readonly identity: VerifiedIdentity) {}

  async verify(_request: ActionRequest): Promise<VerifiedIdentity> {
    return this.identity;
  }
}
