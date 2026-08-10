import { describe, expect, it, vi } from "vitest";
import { SkillAdmission } from "./SkillAdmission";
import { SkillRegistry } from "./SkillRegistry";
import { SkillScanner } from "./SkillScanner";
import { SkillPolicyAdapter } from "../governance/SkillPolicyAdapter";
import { CapabilityTokenIssuer } from "../execution/SkillCapabilityToken";
import { SkillExecutorGuard } from "../execution/SkillExecutorGuard";
import { ActionCoreSkillExecutor } from "../execution/ActionCoreSkillExecutor";
import { JhadinaAuditSink } from "../execution/JhadinaAuditSink";
import type { ActionAuditEvent, ActionLedger } from "../../../../packages/jhadina-action-core/src/action-executor";

describe("governed skill execution flow", () => {
  it("executes through Action Core and writes the production skill audit through ActionLedger", async () => {
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

    const ledgerEvents: ActionAuditEvent[] = [];
    const ledger: ActionLedger = {
      append: vi.fn(async (event) => ledgerEvents.push(event)),
    };
    const audit = new JhadinaAuditSink(ledger);
    const actionExecutor = { execute: vi.fn().mockResolvedValue({ ok: true }) };
    const executor = new ActionCoreSkillExecutor(new SkillExecutorGuard(), actionExecutor, audit);

    await expect(executor.execute({
      skillId: registered.id,
      capabilityId: capability.id,
      token,
      userId: "user-1",
      action: { date: "2026-08-10" },
      actionType: "calendar.read",
    })).resolves.toEqual({ ok: true });

    expect(actionExecutor.execute).toHaveBeenCalledTimes(1);
    expect(ledger.append).toHaveBeenCalledTimes(1);
    expect(ledgerEvents[0]).toEqual(expect.objectContaining({
      actionId: token.tokenId,
      type: "skill:calendar.read:calendar.read",
      status: "started",
      metadata: expect.objectContaining({
        source: "agent-runtime",
        skillId: "calendar.read",
        capabilityId: "calendar.read",
        tokenId: token.tokenId,
      }),
    }));
  });

  it("records a rejected execution through the canonical ActionLedger before Action Core is reached", async () => {
    const ledgerEvents: ActionAuditEvent[] = [];
    const ledger: ActionLedger = {
      append: vi.fn(async (event) => ledgerEvents.push(event)),
    };
    const audit = new JhadinaAuditSink(ledger);
    const actionExecutor = { execute: vi.fn() };
    const executor = new ActionCoreSkillExecutor(new SkillExecutorGuard(), actionExecutor, audit);
    const token = new CapabilityTokenIssuer().issue({
      skillId: "calendar.read",
      capabilityId: "calendar.read",
      decision: "allow",
      ttlMs: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(executor.execute({
      skillId: "calendar.read",
      capabilityId: "calendar.read",
      token,
      userId: "user-1",
      action: {},
      actionType: "calendar.read",
    })).rejects.toThrow("Capability token expired");

    expect(actionExecutor.execute).not.toHaveBeenCalled();
    expect(ledgerEvents[0]).toEqual(expect.objectContaining({
      type: "skill:calendar.read:calendar.read",
      status: "denied",
      metadata: expect.objectContaining({
        reason: "Capability token expired",
      }),
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
