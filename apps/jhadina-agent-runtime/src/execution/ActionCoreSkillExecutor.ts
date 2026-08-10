import type {
  ActionExecutor,
  ActionRequest,
} from "../../../../packages/jhadina-action-core/src/action-executor";
import type { SkillCapabilityToken } from "./SkillCapabilityToken";
import { SkillExecutorGuard } from "./SkillExecutorGuard";
import type { SkillExecutionAuditEvent, SkillExecutionAuditSink } from "./GuardedSkillExecutor";

export interface SkillActionRequest<TAction = unknown> {
  skillId: string;
  capabilityId: string;
  token: SkillCapabilityToken;
  userId: string;
  action: TAction;
  actionType: string;
}

/**
 * Governed bridge into the canonical Action Core executor. Skill execution
 * attempts are audited here, while Action Core remains responsible for its
 * own policy, handler selection, completion/failure ledger entries, and execution.
 */
export class ActionCoreSkillExecutor {
  constructor(
    private readonly guard: SkillExecutorGuard,
    private readonly actionExecutor: ActionExecutor,
    private readonly audit?: SkillExecutionAuditSink,
  ) {}

  async execute<TAction>(request: SkillActionRequest<TAction>): Promise<unknown> {
    const authorization = this.guard.authorize({
      skillId: request.skillId,
      capabilityId: request.capabilityId,
      token: request.token,
    });

    const auditBase = {
      skillId: request.skillId,
      capabilityId: request.capabilityId,
      tokenId: request.token.tokenId,
      occurredAt: new Date().toISOString(),
    };

    if (!authorization.allowed) {
      this.audit?.append({
        type: "SKILL_EXECUTION_REJECTED",
        ...auditBase,
        reason: authorization.reason,
      });
      throw new Error(`Skill execution rejected: ${authorization.reason}`);
    }

    this.audit?.append({
      type: "SKILL_EXECUTION_ALLOWED",
      ...auditBase,
      reason: authorization.reason,
    });

    const actionRequest: ActionRequest<TAction> = {
      id: request.token.tokenId,
      userId: request.userId,
      type: request.actionType,
      action: request.action,
      requestedAt: new Date().toISOString(),
    };

    return this.actionExecutor.execute(actionRequest);
  }
}
