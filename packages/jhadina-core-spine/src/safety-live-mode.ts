import { assertSafetyLiveAdmission, type SafetyLiveAdmissionReceipt } from './safety-live-admission.js';

export type SafetyOperatingMode = 'drill' | 'live';

export interface SafetyModeTransition {
  readonly from: SafetyOperatingMode;
  readonly to: SafetyOperatingMode;
  readonly admissionId?: string;
}

export function transitionSafetyMode(
  current: SafetyOperatingMode,
  target: SafetyOperatingMode,
  admission?: SafetyLiveAdmissionReceipt,
): SafetyModeTransition {
  if (target === 'live') {
    if (!admission) throw new Error('Safety LIVE requires PROD-GATE.4 admission');
    assertSafetyLiveAdmission(admission);
    return { from: current, to: target, admissionId: admission.admissionId };
  }
  return { from: current, to: 'drill' };
}
