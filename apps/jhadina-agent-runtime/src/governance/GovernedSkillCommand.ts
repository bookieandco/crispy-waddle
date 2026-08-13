import type { SkillCapabilityToken } from "../execution/SkillCapabilityToken";

export interface GovernedSkillCommand<TPayload = unknown> {
  commandId: string;
  skillId: string;
  capabilityId: string;
  token: SkillCapabilityToken;
  userId: string;
  domain: string;
  actionType: string;
  payload: TPayload;
  requestedAt: string;
}

export interface GovernedCommandResult<TResult = unknown> {
  accepted: boolean;
  commandId: string;
  result?: TResult;
  reason?: string;
}

/**
 * Skills may describe a domain command, but they do not receive direct access
 * to domain services. The command is consumed by Jhadina's governed executor.
 */
export interface GovernedCommandDispatcher {
  dispatch<TPayload, TResult>(
    command: GovernedSkillCommand<TPayload>,
  ): Promise<GovernedCommandResult<TResult>>;
}

export function createGovernedSkillCommand<TPayload>(input: {
  skillId: string;
  capabilityId: string;
  token: SkillCapabilityToken;
  userId: string;
  domain: string;
  actionType: string;
  payload: TPayload;
}): GovernedSkillCommand<TPayload> {
  return {
    commandId: crypto.randomUUID(),
    ...input,
    requestedAt: new Date().toISOString(),
  };
}
