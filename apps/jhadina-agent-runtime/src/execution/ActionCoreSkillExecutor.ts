import type {
  ActionExecutor,
  ActionRequest,
} from "../../../../packages/jhadina-action-core/src/action-executor";
import type { SkillCapabilityToken } from "./SkillCapabilityToken";
import { SkillExecutorGuard } from "./SkillExecutorGuard";

export interface SkillActionRequest<TAction = unknown> {
  skillId: string;
  capabilityId: string;
  token: SkillCapabilityToken;
  userId: string;
  action: TAction;
  actionType: string;
}

/**
 * Narrow bridge into the canonical Action Core executor. Skills must pass the
 * local scope/expiry guard first; Action Core remains responsible for its own
 * policy, handler selection, completion/failure ledger entries, and execution.
 */
export class ActionCoreSkillExecutor {
  constructor(
    private readonly guard: SkillExecutorGuard,
    private readonly actionExecutor: ActionExecutor,
  ) {}

  async execute<TAction>(request: SkillActionRequest<TAction>): Promise<unknown> {
    const authorization = this.guard.authorize({
      skillId: request.skillId,
      capabilityId: request.capabilityId,
      token: request.token,
    });

    if (!authorization.allowed) {
      throw new Error(`Skill execution rejected: ${authorization.reason}`);
    }

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
