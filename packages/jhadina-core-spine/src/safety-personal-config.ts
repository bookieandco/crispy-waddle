import type { EmergencyPreAuthorizationReceipt } from './emergency-governance.js';
import type { SafetyEscalationRule } from './safety-escalation-policy.js';

export interface PersonalSafetyConfiguration {
  readonly profileId: string;
  readonly ownerUserId: string;
  readonly trustedContactIds: readonly string[];
  readonly codeWordBindingIds: readonly string[];
  readonly defaultCheckInSeconds: number;
  readonly escalationRules: readonly SafetyEscalationRule[];
  readonly preAuthorizations: readonly EmergencyPreAuthorizationReceipt[];
  readonly gev: {
    readonly enabled: boolean;
    readonly allowSpatialContext: boolean;
    readonly allowPublicEnvironmentContext: boolean;
    readonly allowNamedPersonSearch: false;
    readonly allowFaceRecognition: false;
    readonly allowPlateIdentification: false;
  };
  readonly evidence: {
    readonly encryptedAtRest: true;
    readonly requireOffDeviceCopyBeforeRelease: boolean;
    readonly rollingBufferSeconds?: number;
  };
}

/**
 * SAFETY-PERSONAL.1 stores references and policy, not plaintext code words,
 * phone numbers, addresses, or other contact secrets in source control.
 */
export function validatePersonalSafetyConfiguration(config: PersonalSafetyConfiguration): void {
  if (config.defaultCheckInSeconds <= 0) throw new Error('Check-in interval must be positive');
  const receipts = new Set(config.preAuthorizations.map((item) => item.id));
  for (const rule of config.escalationRules) {
    if (!receipts.has(rule.preAuthorizationId)) throw new Error('Escalation references unknown pre-authorization');
  }
  if (config.gev.allowNamedPersonSearch || config.gev.allowFaceRecognition || config.gev.allowPlateIdentification) {
    throw new Error('Personal GEV privacy boundary violated');
  }
}
