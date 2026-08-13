import type { PolicyDecision } from "../governance/SkillPolicyAdapter";

export interface SkillCapabilityToken {
  readonly tokenId: string;
  readonly skillId: string;
  readonly capabilityId: string;
  readonly decision: "allow" | "sandbox";
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface CapabilityTokenIssuer {
  issue(input: {
    skillId: string;
    capabilityId: string;
    decision: PolicyDecision;
    ttlMs?: number;
  }): SkillCapabilityToken {
    if (input.decision !== "allow" && input.decision !== "sandbox") {
      throw new Error(`Cannot issue execution token for policy decision: ${input.decision}`);
    }

    const now = Date.now();
    const ttlMs = input.ttlMs ?? 60_000;
    if (ttlMs <= 0) throw new Error("Token TTL must be positive");

    return {
      tokenId: crypto.randomUUID(),
      skillId: input.skillId,
      capabilityId: input.capabilityId,
      decision: input.decision,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
  }
}

export function isCapabilityTokenActive(token: SkillCapabilityToken, now = Date.now()): boolean {
  return new Date(token.expiresAt).getTime() > now;
}
