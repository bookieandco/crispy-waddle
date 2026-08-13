import type { SkillCapabilityToken } from "./SkillCapabilityToken";
import { SkillExecutorGuard } from "./SkillExecutorGuard";

export interface SkillExecutionAuditEvent {
  type: "SKILL_EXECUTION_ALLOWED" | "SKILL_EXECUTION_REJECTED";
  skillId: string;
  capabilityId: string;
  tokenId: string;
  reason: string;
  occurredAt: string;
}

export interface SkillExecutionAuditSink {
  append(event: SkillExecutionAuditEvent): void;
}

export interface SkillActionHandler<TInput = unknown, TResult = unknown> {
  execute(input: TInput): Promise<TResult>;
}

/**
 * Final governed execution boundary. A handler is unreachable unless the
 * capability token passes the guard. Every attempt emits an audit event.
 */
export class GuardedSkillExecutor {
  constructor(
    private readonly guard: SkillExecutorGuard,
    private readonly audit: SkillExecutionAuditSink,
  ) {}

  async execute<TInput, TResult>(request: {
    skillId: string;
    capabilityId: string;
    token: SkillCapabilityToken;
    input: TInput;
    handler: SkillActionHandler<TInput, TResult>;
  }): Promise<TResult> {
    const result = this.guard.authorize({
      skillId: request.skillId,
      capabilityId: request.capabilityId,
      token: request.token,
    });

    const eventBase = {
      skillId: request.skillId,
      capabilityId: request.capabilityId,
      tokenId: request.token.tokenId,
      occurredAt: new Date().toISOString(),
    };

    if (!result.allowed) {
      this.audit.append({
        type: "SKILL_EXECUTION_REJECTED",
        ...eventBase,
        reason: result.reason,
      });
      throw new Error(`Skill execution rejected: ${result.reason}`);
    }

    this.audit.append({
      type: "SKILL_EXECUTION_ALLOWED",
      ...eventBase,
      reason: result.reason,
    });

    return request.handler.execute(request.input);
  }
}
