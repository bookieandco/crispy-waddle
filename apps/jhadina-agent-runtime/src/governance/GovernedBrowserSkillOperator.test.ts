import { describe, expect, it, vi } from "vitest";
import { SkillRegistry } from "../skills/SkillRegistry";
import { SkillExecutorGuard } from "../execution/SkillExecutorGuard";
import { GovernedSkillCommandDispatcher } from "./GovernedSkillCommandDispatcher";
import { GovernedBrowserSkillOperator } from "./GovernedBrowserSkillOperator";
import { OutboundSentinel } from "./OutboundSentinel";
import type { SkillCapabilityToken } from "../execution/SkillCapabilityToken";

const capability = { id: "browser.read", description: "Read permitted public pages", risk: "low" as const, requiresApproval: false };
function token(override: Partial<SkillCapabilityToken> = {}): SkillCapabilityToken {
  return {
    tokenId: "test-token", skillId: "browser.builtin", capabilityId: "browser.read",
    decision: "allow", issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(), ...override,
  };
}
function setup(status: "candidate" | "approved" = "approved") {
  const registry = new SkillRegistry();
  registry.register({
    id: "browser.builtin", name: "Public reader", version: "1.0.0",
    description: "Read public docs", capabilities: [capability], status,
  });
  const actionExecutor = { execute: vi.fn().mockResolvedValue({ receipt: "action-core-stub" }) };
  const dispatcher = new GovernedSkillCommandDispatcher(new SkillExecutorGuard(), actionExecutor);
  const operator = new GovernedBrowserSkillOperator(registry, new OutboundSentinel(["https://example.org"]), dispatcher);
  return { operator, actionExecutor };
}

describe("JH-MUSE.PARITY.04 governed browser handoff", () => {
  it("routes a public GET with no cookies or redirect permission through canonical Action Core", async () => {
    const { operator, actionExecutor } = setup();
    const r = await operator.proposeRead({ skillId: "browser.builtin", userId: "owner", url: "https://example.org/docs", token: token() });
    expect(r.accepted).toBe(true);
    expect(actionExecutor.execute).toHaveBeenCalledOnce();
    expect(actionExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      type: "browser.fetch_read_only",
      action: { url: "https://example.org/docs", method: "GET", redirectPolicy: "error", cookies: "omit", credentials: "omit" },
    }));
  });

  it("blocks candidate skills, sandbox tokens, expired scopes and unlisted destinations", async () => {
    const candidate = setup("candidate");
    const target = { skillId: "browser.builtin", userId: "owner", url: "https://example.org/docs", token: token() };
    expect((await candidate.operator.proposeRead(target)).accepted).toBe(false);
    expect(candidate.actionExecutor.execute).not.toHaveBeenCalled();

    const { operator, actionExecutor } = setup();
    for (const input of [
      { ...target, token: token({ decision: "sandbox" }) },
      { ...target, token: token({ expiresAt: new Date(0).toISOString() }) },
      { ...target, token: token({ capabilityId: "browser.write" }) },
      { ...target, url: "https://evil.test/" },
      { ...target, url: "https://example.org/?private=data" },
    ]) expect((await operator.proposeRead(input)).accepted).toBe(false);
    expect(actionExecutor.execute).not.toHaveBeenCalled();
  });
});
