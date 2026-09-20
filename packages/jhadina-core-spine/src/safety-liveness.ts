export type SafetyLivenessSignal =
  | 'explicit-safe-confirmation'
  | 'device-heartbeat'
  | 'communication-heartbeat'
  | 'evidence-vault-heartbeat'
  | 'trusted-contact-acknowledgment';

export interface SafetyLivenessObservation {
  readonly signal: SafetyLivenessSignal;
  readonly observedAt: string;
  readonly healthy: boolean;
  readonly sourceRef: string;
}

export interface SafetyLivenessAssessment {
  readonly observedSignals: number;
  readonly unhealthySignals: number;
  readonly explicitSafeConfirmation: boolean;
}

/** Descriptive only: this assessment never authorizes an emergency action. */
export function assessSafetyLiveness(observations: readonly SafetyLivenessObservation[]): SafetyLivenessAssessment {
  return {
    observedSignals: observations.length,
    unhealthySignals: observations.filter((item) => !item.healthy).length,
    explicitSafeConfirmation: observations.some((item) => item.signal === 'explicit-safe-confirmation' && item.healthy),
  };
}
