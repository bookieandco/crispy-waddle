import { describe, expect, it, vi } from "vitest";
import { SkillAdmission } from "./SkillAdmission";
import { SkillRegistry } from "./SkillRegistry";
import { SkillScanner } from "./SkillScanner";
import { SkillPolicyAdapter } from "../governance/SkillPolicyAdapter";
import { CapabilityTokenIssuer } from "../execution/SkillCapabilityToken";
import { SkillExecutorGuard } from "../execution/SkillExecutorGuard";
import { GuardedSkillExecutor } from "../execution/GuardedSkillExecutor";
import { ActionCoreSkillExecutor } from "../execution/ActionCoreSkillExecutor";

describe("governed skill execution flow", () => {
  it("admits a safe skill, executes it, and records the canonical audit event", async () => {
    const skill = {
      id: "calendar.read",
      name: "Calendar Reader",
      version: "1.0.0",
      description: "Read calendar events",
      capabilities: [{
        id: "calendar.read",
        description: "Read calendar events",
        risk: "low" as const,
        requiresApproval: false,
      }],
      status: "candidate" as const,
      source: "builtin://calendar",
    };

    const scan = new SkillScanner().scan(skill);
    expect(scan.approved).toBe(true);

    const admission = new SkillAdmission().evaluate(skill, scan, {
      source: "builtin://calendar",
      sourceType: "builtin",
      contentDigest: "sha256:test",
    });
    expect(admission.decision).toBe("approved");

    const registry = new SkillRegistry({ allow: () => true });
    registry.register({ ...skill, status: "approved" });
    const registered = registry.get(skill.id)!;
    const capability = registered.capabilities[0];

    const decision = new SkillPolicyAdapter().evaluate({
      skill: registered,
      capability,
      authenticated: true,
      userApproved: false,
      sandboxAvailable: true,
    });
    expect(decision).toBe("allow");

    const token = new CapabilityTokenIssuer().issue({
      skillId: registered.id,
      capabilityId: capability.id,
      decision,
    });

    const audit = { append: vi.fn() };
    const guarded = new GuardedSkillExecutor(new SkillExecutorGuard(), audit);
    const actionExecutor = { execute: vi.fn().mockResolvedValue({ ok: true }) };
    const executor = new ActionCoreSkillExecutor(new SkillExecutorGuard(), actionExecutor);

    const result = await executor.execute({
      skillId: registered.id,
      capabilityId: capability.id,
      token,
      userId: "user-1",
      action: { date: "2026-08-10" },
      actionType: "calendar.read",
    });

    await guarded.execute({
      skillId: registered.id,
      capabilityId: capability.id,
      token,
      input: { date: "2026-08-10" },
      handler: { execute: async () => result },
    });

    expect(result).toEqual({ ok: true });
    expect(actionExecutor.execute).toHaveBeenCalledTimes(1);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({
      type: "SKILL_EXECUTION_ALLOWED",
      skillId: "calendar.read",
      capabilityId: "calendar.read",
      tokenId: token.tokenId,
    }));
  });

  it("does not admit a high-risk capability without approval", () => {
    const skill = {
      id: "dangerous.example",
      name: "High Risk",
      version: "1.0.0",
      description: "High risk test capability",
      capabilities: [{
        id: "dangerous.execute",
        description: "High risk operation",
        risk: "high" as const,
        requiresApproval: false,
      }],
      status: "approved" as const,
    };

    const scan = new SkillScanner().scan(skill);
    expect(scan.approved).toBe(false);
    expect(scan.findings.some((f) => f.code === "HIGH_RISK_REQUIRES_APPROVAL")).toBe(true);
  });

  it("requires approval for an approval-gated capability", () => {
    const skill = {
      id: "calendar.write",
      name: "Calendar Writer",
      version: "1.0.0",
      description: "Modify calendar events",
      capabilities: [{
        id: "calendar.write",
        description: "Modify calendar events",
        risk: "medium" as const,
        requiresApproval: true,
      }],
      status: "approved" as const,
    };

    const decision = new SkillPolicyAdapter().evaluate({
      skill,
      capability: skill.capabilities[0],
      authenticated: true,
      userApproved: false,
      sandboxAvailable: true,
    });

    expect(decision).toBe("ask");
  });
});
