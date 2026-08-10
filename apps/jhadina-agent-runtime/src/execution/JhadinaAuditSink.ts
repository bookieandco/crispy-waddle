import type { SkillExecutionAuditEvent, SkillExecutionAuditSink } from "./GuardedSkillExecutor";

export interface JhadinaAuditEvent {
  type: string;
  occurredAt: string;
  source: "agent-runtime";
  subject: {
    kind: "skill-capability";
    skillId: string;
    capabilityId: string;
    tokenId: string;
  };
  outcome: "allowed" | "rejected";
  reason: string;
}

export interface JhadinaAuditWriter {
  append(event: JhadinaAuditEvent): void | Promise<void>;
}

/** Adapts agent-runtime execution events to Jhadina's canonical audit contract. */
export class JhadinaAuditSink implements SkillExecutionAuditSink {
  constructor(private readonly writer: JhadinaAuditWriter) {}

  append(event: SkillExecutionAuditEvent): void {
    void this.writer.append({
      type: event.type,
      occurredAt: event.occurredAt,
      source: "agent-runtime",
      subject: {
        kind: "skill-capability",
        skillId: event.skillId,
        capabilityId: event.capabilityId,
        tokenId: event.tokenId,
      },
      outcome: event.type === "SKILL_EXECUTION_ALLOWED" ? "allowed" : "rejected",
      reason: event.reason,
    });
  }
}
