import type { SafetyLiveAdmissionReceipt } from './safety-live-admission.js';

export type SafetyLiveRuntimeProofKind =
  | 'admission-durable'
  | 'vault-roundtrip'
  | 'communications-delivery'
  | 'deadman-server-execution'
  | 'physical-device-suite'
  | 'personal-profile-decrypt'
  | 'controlled-personal-drill'
  | 'chaos-recovery';

export interface SafetyLiveRuntimeProof {
  readonly kind: SafetyLiveRuntimeProofKind;
  readonly passed: boolean;
  readonly observedAt: string;
  readonly evidenceRef: string;
  readonly deviceRef?: string;
}

export interface SafetyProdGate5Policy {
  readonly maximumProofAgeMs: number;
  readonly requiredDeviceRef: string;
}

export interface SafetyProdGate5Result {
  readonly admitted: boolean;
  readonly gateVersion: 'SAFETY-PROD-GATE.5';
  readonly blockers: readonly string[];
  readonly evidenceRefs: readonly string[];
}

const required: readonly SafetyLiveRuntimeProofKind[] = [
  'admission-durable',
  'vault-roundtrip',
  'communications-delivery',
  'deadman-server-execution',
  'physical-device-suite',
  'personal-profile-decrypt',
  'controlled-personal-drill',
  'chaos-recovery',
];

export function evaluateSafetyProdGate5(
  gate4: SafetyLiveAdmissionReceipt,
  proofs: readonly SafetyLiveRuntimeProof[],
  policy: SafetyProdGate5Policy,
  evaluatedAt: string,
): SafetyProdGate5Result {
  const blockers: string[] = [];
  const now = Date.parse(evaluatedAt);

  if (!gate4.admitted) blockers.push('prod-gate-4-admission');
  if (gate4.deviceRef !== policy.requiredDeviceRef) blockers.push('gate4-device-identity');
  if (!Number.isFinite(now)) blockers.push('invalid-evaluation-time');

  for (const kind of required) {
    const matches = proofs.filter((proof) => proof.kind === kind && proof.passed && proof.evidenceRef.length > 0);
    if (matches.length === 0) blockers.push(kind);
  }

  for (const proof of proofs) {
    const observed = Date.parse(proof.observedAt);
    if (!Number.isFinite(observed) || observed > now || now - observed > policy.maximumProofAgeMs) {
      blockers.push(`${proof.kind}:stale-or-invalid`);
    }
  }

  const deviceBound: readonly SafetyLiveRuntimeProofKind[] = [
    'physical-device-suite',
    'controlled-personal-drill',
    'chaos-recovery',
  ];
  for (const kind of deviceBound) {
    if (!proofs.some((proof) =>
      proof.kind === kind &&
      proof.passed &&
      proof.deviceRef === policy.requiredDeviceRef &&
      proof.evidenceRef.length > 0
    )) blockers.push(`${kind}:device-bound`);
  }

  const unique = [...new Set(blockers)];
  return {
    admitted: unique.length === 0,
    gateVersion: 'SAFETY-PROD-GATE.5',
    blockers: unique,
    evidenceRefs: [...gate4.evidenceRefs, ...proofs.filter((proof) => proof.passed).map((proof) => proof.evidenceRef)],
  };
}
