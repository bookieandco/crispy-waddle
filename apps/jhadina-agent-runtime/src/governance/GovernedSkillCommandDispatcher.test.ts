import { describe, expect, it, vi } from "vitest";
import { GovernedSkillCommandDispatcher } from "./GovernedSkillCommandDispatcher";
import { createGovernedSkillCommand } from "./GovernedSkillCommand";
import { SkillExecutorGuard } from "../execution/SkillExecutorGuard";
import type { SkillCapabilityToken } from "../execution/SkillCapabilityToken";

const makeToken = (overrides: Partial<SkillCapabilityToken> = {}): SkillCapabilityToken => ({
  tokenId: "token-planning-1",
  skillId: "planning.calendar",
  capabilityId: "planning.timeline.write",
  decision: "allow",
  issuedAt: new Date(0).toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  ...overrides,
});

describe("GovernedSkillCommandDispatcher", () => {
  it("dispatches a valid Planning Core command through Action Core", async () => {
    const actionExecutor = { execute: vi.fn().mockResolvedValue({ eventId: "evt-1" }) };
    const dispatcher = new GovernedSkillCommandDispatcher(new SkillExecutorGuard(), actionExecutor);
    const command = createGovernedSkillCommand({
      skillId: "planning.calendar",
      capabilityId: "planning.timeline.write",
      token: makeToken(),
      userId: "user-1",
      domain: "planning",
      actionType: "timeline.event.create",
      payload: { date: "2026-08-10", title: "Today" },
    });

    const result = await dispatcher.dispatch(command);

    expect(result).toEqual({ accepted: true, commandId: command.commandId, result: { eventId: "evt-1" } });
    expect(actionExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      id: command.commandId,
      type: "planning.timeline.event.create",
      action: { date: "2026-08-10", title: "Today" },
    }));
  });

  it("rejects an expired capability before Action Core", async () => {
    const actionExecutor = { execute: vi.fn() };
    const dispatcher = new GovernedSkillCommandDispatcher(new SkillExecutorGuard(), actionExecutor);
    const command = createGovernedSkillCommand({
      skillId: "planning.calendar",
      capabilityId: "planning.timeline.write",
      token: makeToken({ expiresAt: new Date(0).toISOString() }),
      userId: "user-1",
      domain: "planning",
      actionType: "timeline.event.create",
      payload: {},
    });

    await expect(dispatcher.dispatch(command)).resolves.toEqual(expect.objectContaining({
      accepted: false,
      commandId: command.commandId,
      reason: "Capability token expired",
    }));
    expect(actionExecutor.execute).not.toHaveBeenCalled();
  });

  it("rejects a mismatched capability before Action Core", async () => {
    const actionExecutor = { execute: vi.fn() };
    const dispatcher = new GovernedSkillCommandDispatcher(new SkillExecutorGuard(), actionExecutor);
    const command = createGovernedSkillCommand({
      skillId: "planning.calendar",
      capabilityId: "planning.timeline.write",
      token: makeToken({ capabilityId: "planning.timeline.read" }),
      userId: "user-1",
      domain: "planning",
      actionType: "timeline.event.create",
      payload: {},
    });

    const result = await dispatcher.dispatch(command);

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("Capability token scope mismatch");
    expect(actionExecutor.execute).not.toHaveBeenCalled();
  });
});
