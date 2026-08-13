import type { SkillCapabilityToken } from "./SkillCapabilityToken";
import { isCapabilityTokenActive } from "./SkillCapabilityToken";

export interface GuardedExecutionRequest {
  skillId: string;
  capabilityId: string;
  token: SkillCapabilityToken;
}

export interface ExecutorGuardResult {
  allowed: boolean;
  reason: string;
}

/** Final pre-execution gate. It validates scope and expiry; it never runs code. */
export class SkillExecutorGuard {
  authorize(request: GuardedExecutionRequest, now = Date.now()): ExecutorGuardResult {
    const { token } = request;

    if (token.skillId !== request.skillId) {
      return { allowed: false, reason: "Capability token skill mismatch" };
    }

    if (token.capabilityId !== request.capabilityId) {
      return { allowed: false, reason: "Capability token scope mismatch" };
    }

    if (token.decision !== "allow" && token.decision !== "sandbox") {
      return { allowed: false, reason: "Capability token is not executable" };
    }

    if (!isCapabilityTokenActive(token, now)) {
      return { allowed: false, reason: "Capability token expired" };
    }

    return { allowed: true, reason: "Capability token authorized" };
  }
}
