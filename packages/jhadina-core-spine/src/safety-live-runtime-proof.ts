import type { SafetyLiveRuntimeProof, SafetyLiveRuntimeProofKind } from './safety-prod-gate-5.js';

export interface SafetyRuntimeProofRecorder {
  record(proof: SafetyLiveRuntimeProof): Promise<void>;
  list(admissionId: string): Promise<readonly SafetyLiveRuntimeProof[]>;
}

export function createSafetyRuntimeProof(
  kind: SafetyLiveRuntimeProofKind,
  evidenceRef: string,
  observedAt: string,
  options: { passed: boolean; deviceRef?: string },
): SafetyLiveRuntimeProof {
  if (!evidenceRef) throw new Error('Safety runtime proof requires evidenceRef');
  return {
    kind,
    evidenceRef,
    observedAt,
    passed: options.passed,
    ...(options.deviceRef ? { deviceRef: options.deviceRef } : {}),
  };
}
