import type { SkillRegistry } from "../skills/SkillRegistry";
import type { SkillCapabilityToken } from "../execution/SkillCapabilityToken";
import type { GovernedCommandDispatcher, GovernedCommandResult } from "./GovernedSkillCommand";
import { createGovernedSkillCommand } from "./GovernedSkillCommand";
import { OutboundSentinel } from "./OutboundSentinel";

export type ReadOnlyBrowserPayload = {
  url: string;
  method: "GET";
  redirectPolicy: "error";
  cookies: "omit";
  credentials: "omit";
};

/**
 * JH-MUSE.PARITY.04: no fetch, browser driver, DOM access or credential
 * loading lives here. This prepares a single canonical Action Core command.
 * Provider binding and real-world approval are separate operator gates.
 */
export class GovernedBrowserSkillOperator {
  constructor(
    private readonly registry: SkillRegistry,
    private readonly sentinel: OutboundSentinel,
    private readonly dispatcher: GovernedCommandDispatcher,
  ) {}

  async proposeRead(input: {
    skillId: string;
    userId: string;
    token: SkillCapabilityToken;
    url: string;
  }): Promise<GovernedCommandResult> {
    const skill = this.registry.get(input.skillId);
    if (!skill || skill.status !== "approved" ||
        !skill.capabilities.some(c => c.id === "browser.read")) {
      return { accepted: false, commandId: "", reason: "SKILL_NOT_ADMITTED_FOR_BROWSER_READ" };
    }
    if (!input.userId || input.token.decision !== "allow") {
      return { accepted: false, commandId: "", reason: "IDENTITY_OR_TOKEN_NOT_ADMITTED" };
    }
    const review = this.sentinel.reviewReadOnly(input.url);
    if (!review.allowed) return { accepted: false, commandId: "", reason: review.reason };
    return this.dispatcher.dispatch<ReadOnlyBrowserPayload, unknown>(
      createGovernedSkillCommand({
        skillId: input.skillId,
        capabilityId: "browser.read",
        token: input.token,
        userId: input.userId,
        domain: "browser",
        actionType: "fetch_read_only",
        payload: {
          url: review.url, method: "GET", redirectPolicy: "error",
          cookies: "omit", credentials: "omit",
        },
      }),
    );
  }
}
