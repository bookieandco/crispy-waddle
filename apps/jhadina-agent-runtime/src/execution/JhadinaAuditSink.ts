import type { ActionAuditEvent, ActionLedger } from "../../../../packages/jhadina-action-core/src/action-executor";
import type { SkillExecutionAuditEvent, SkillExecutionAuditSink } from "./GuardedSkillExecutor";

/**
 * Converts skill-runtime audit attempts into the canonical Jhadina ActionLedger
 * contract. The ledger remains the durable boundary; this adapter owns no storage.
 */
export class JhadinaAuditSink implements SkillExecutionAuditSink {
  constructor(private readonly ledger: ActionLedger) {}

  append(event: SkillExecutionAuditEvent): void {
    const auditEvent: ActionAuditEvent = {
      id: `${event.tokenId}:${event.type}:${event.occurredAt}`,
      actionId: event.tokenId,
      userId: "agent-runtime",
      type: `skill:${event.skillId}:${event.capabilityId}`,
      status: event.type === "SKILL_EXECUTION_ALLOWED" ? "completed" : "denied",
      timestamp: event.occurredAt,
      metadata: {
        source: "agent-runtime",
        skillId: event.skillId,
        capabilityId: event.capabilityId,
        tokenId: event.tokenId,
        reason: event.reason,
      },
    };

    void this.ledger.append(auditEvent);
  }
}
