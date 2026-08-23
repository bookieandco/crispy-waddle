export type EmergencyScenarioName =
  | 'codeword-activation'
  | 'threat-specific-notification'
  | 'no-ack-escalation'
  | 'evidence-preservation'
  | 'authorized-release'
  | 'cancellation'
  | 'device-network-failure'
  | 'unknown-threat'
  | 'contingency-path';

export interface EmergencyScenarioExpectation {
  readonly name: EmergencyScenarioName;
  readonly requiredStages: readonly string[];
  readonly forbiddenEffects: readonly string[];
}

/**
 * Contract-level scenario matrix. Concrete test runners should map these
 * expectations to fake adapters and assert that forbidden real-world effects
 * never occur during integration tests.
 */
export const emergencyScenarioMatrix: readonly EmergencyScenarioExpectation[] = [
  { name: 'codeword-activation', requiredStages: ['triggered', 'protocol-selected'], forbiddenEffects: ['real-notification', 'real-capture'] },
  { name: 'threat-specific-notification', requiredStages: ['notifications-sent'], forbiddenEffects: ['wrong-recipient', 'wrong-template'] },
  { name: 'no-ack-escalation', requiredStages: ['notifications-sent', 'escalated'], forbiddenEffects: ['duplicate-escalation'] },
  { name: 'evidence-preservation', requiredStages: ['evidence-capture-started', 'evidence-persisted'], forbiddenEffects: ['plaintext-persistence'] },
  { name: 'authorized-release', requiredStages: ['release-authorized', 'release-executed'], forbiddenEffects: ['unauthorized-release'] },
  { name: 'cancellation', requiredStages: ['triggered'], forbiddenEffects: ['post-cancel-release'] },
  { name: 'device-network-failure', requiredStages: ['evidence-capture-started'], forbiddenEffects: ['false-delivery-success'] },
  { name: 'unknown-threat', requiredStages: ['triggered', 'protocol-selected'], forbiddenEffects: ['llm-authorized-release'] },
  { name: 'contingency-path', requiredStages: ['triggered'], forbiddenEffects: ['unconfigured-action'] },
];
