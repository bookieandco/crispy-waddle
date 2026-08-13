import { describe, expect, it, vi } from "vitest";
import { ActionCoreSkillExecutor } from "./ActionCoreSkillExecutor";
import { SkillExecutorGuard } from "./SkillExecutorGuard";
import type { SkillCapabilityToken } from "./SkillCapabilityToken";

const token = (overrides: Partial<SkillCapabilityToken> = {}): SkillCapabilityToken => ({
  tokenId: "token-1",
  skillId: "skill.demo",
  capabilityId: "calendar.read",
  decision: "allow",
  issuedAt: new Date(0).toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  ...overrides,
});

describe("ActionCoreSkillExecutor", () => {
  it("rejects an expired capability before Action Core is called", async () => {
    const actionExecutor = { execute: vi.fn() };
    const executor = new ActionCoreSkillExecutor(new SkillExecutorGuard(), actionExecutor);

    await expect(executor.execute({
      skillId: "skill.demo",
      capabilityId: "calendar.read",
      token: token({ expiresAt: new Date(0).toISOString() }),
      userId: "user-1",
      action: { date: "2026-08-10" },
      actionType: "calendar.read",
    })).rejects.toThrow("Capability token expired");

    expect(actionExecutor.execute).not.toHaveBeenCalled();
  });

  it("rejects a mismatched capability before Action Core is called", async () => {
    const actionExecutor = { execute: vi.fn() };
    const executor = new ActionCoreSkillExecutor(new SkillExecutorGuard(), actionExecutor);

    await expect(executor.execute({
      skillId: "skill.demo",
      capabilityId: "calendar.write",
      token: token(),
      userId: "user-1",
      action: {},
      actionType: "calendar.write",
    })).rejects.toThrow("Capability token scope mismatch");

    expect(actionExecutor.execute).not.toHaveBeenCalled();
  });

  it("passes a valid scoped token to the canonical Action Core executor", async () => {
    const actionExecutor = { execute: vi.fn().mockResolvedValue({ ok: true }) };
    const executor = new ActionCoreSkillExecutor(new SkillExecutorGuard(), actionExecutor);

    await expect(executor.execute({
      skillId: "skill.demo",
      capabilityId: "calendar.read",
      token: token(),
      userId: "user-1",
      action: { date: "2026-08-10" },
      actionType: "calendar.read",
    })).resolves.toEqual({ ok: true });

    expect(actionExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      id: "token-1",
      userId: "user-1",
      type: "calendar.read",
      action: { date: "2026-08-10" },
    }));
  });
});
