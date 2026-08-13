import type { ActionExecutor, ActionRequest } from "../../../../packages/jhadina-action-core/src/action-executor";
import { SkillExecutorGuard } from "../execution/SkillExecutorGuard";
import type {
  GovernedCommandDispatcher,
  GovernedCommandResult,
  GovernedSkillCommand,
} from "./GovernedSkillCommand";

/**
 * Converts an admitted skill command into the canonical Jhadina Action Core
 * request. Domain services remain behind Action Core; skills never receive a
 * direct domain-service reference.
 */
export class GovernedSkillCommandDispatcher implements GovernedCommandDispatcher {
  constructor(
    private readonly guard: SkillExecutorGuard,
    private readonly actionExecutor: ActionExecutor,
  ) {}

  async dispatch<TPayload, TResult>(
    command: GovernedSkillCommand<TPayload>,
  ): Promise<GovernedCommandResult<TResult>> {
    const authorization = this.guard.authorize({
      skillId: command.skillId,
      capabilityId: command.capabilityId,
      token: command.token,
    });

    if (!authorization.allowed) {
      return {
        accepted: false,
        commandId: command.commandId,
        reason: authorization.reason,
      };
    }

    const action: ActionRequest<TPayload> = {
      id: command.commandId,
      userId: command.userId,
      type: `${command.domain}.${command.actionType}`,
      action: command.payload,
      requestedAt: command.requestedAt,
    };

    const result = await this.actionExecutor.execute(action);

    return {
      accepted: true,
      commandId: command.commandId,
      result: result as TResult,
    };
  }
}
