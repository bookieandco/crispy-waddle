import type { Agent, AgentContext, AgentResult } from "./contracts";
import { janetClient } from "../janet/client";

export class JanetAgent implements Agent {
  readonly id = "janet" as const;
  readonly name = "JANET";
  readonly role = "Memory, identity, preferences, and context";

  async health() {
    try {
      await janetClient.getHealth();
      return "online" as const;
    } catch {
      return "degraded" as const;
    }
  }

  async handle(context: AgentContext): Promise<AgentResult> {
    const timestamp = new Date().toISOString();
    const candidate = await janetClient.createMemoryCandidate(context.goal);
    return {
      agent: this.id,
      requestId: context.requestId,
      status: "needs_approval",
      summary: "JANET classified the request as a memory candidate and is awaiting approval.",
      data: { candidate },
      audit: { action: "memory_candidate_created", timestamp },
    };
  }
}
