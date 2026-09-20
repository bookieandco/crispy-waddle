import type { EmergencyGovernedCapability, EmergencyPreAuthorizationReceipt } from './emergency-governance.js';

export interface SafetyEscalationRule {
  readonly id: string;
  readonly fromState: 'missed' | 'escalating';
  readonly afterSeconds: number;
  readonly capability: EmergencyGovernedCapability;
  readonly recipientIds: readonly string[];
  readonly preAuthorizationId: string;
}

export function assertEscalationRuleAuthorized(
  rule: SafetyEscalationRule,
  receipt: EmergencyPreAuthorizationReceipt,
): void {
  if (rule.preAuthorizationId !== receipt.id) throw new Error('Escalation pre-authorization mismatch');
  if (!receipt.allowedCapabilities.includes(rule.capability)) throw new Error('Escalation capability not authorized');
  for (const id of rule.recipientIds) if (!receipt.recipientIds.includes(id)) throw new Error('Escalation recipient not authorized');
}
