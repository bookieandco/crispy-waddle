import type { AppendAuditInput, AuditRepository } from "../repositories/AuditRepository.js";
import type { AuditEvent } from "../types.js";

/**
 * Thin wrapper so every audit write goes through one call site with a
 * consistent shape: what happened (eventName + payload), when (stamped by
 * the repository), what caused it (triggeredBy), and whether the driver
 * approved it (driverApproved, explicitly nullable for events where
 * approval doesn't apply).
 */
export class AuditService {
  constructor(private readonly auditRepo: AuditRepository) {}

  record(input: AppendAuditInput): Promise<AuditEvent> {
    return this.auditRepo.append(input);
  }

  listRecent(limit?: number): Promise<AuditEvent[]> {
    return this.auditRepo.listRecent(limit);
  }
}
