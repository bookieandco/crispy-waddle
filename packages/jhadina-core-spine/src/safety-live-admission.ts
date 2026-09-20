import type { SafetyProdGate3Input } from './safety-prod-gate-3.js';
import { evaluateSafetyProdGate3 } from './safety-prod-gate-3.js';

export interface SafetyLiveAdmissionPolicy {
  readonly gateVersion: 'SAFETY-PROD-GATE.4';
  readonly maximumReceiptAgeMs: number;
  readonly requiredDeviceRef: string;
}

export interface SafetyLiveAdmissionReceipt {
  readonly admissionId: string;
  readonly gateVersion: 'SAFETY-PROD-GATE.4';
  readonly admitted: boolean;
  readonly evaluatedAt: string;
  readonly deviceRef: string;
  readonly evidenceRefs: readonly string[];
  readonly blockers: readonly string[];
}

export function evaluateSafetyProdGate4(
  input: SafetyProdGate3Input,
  policy: SafetyLiveAdmissionPolicy,
  evaluatedAt: string,
  admissionId: string,
): SafetyLiveAdmissionReceipt {
  const gate3 = evaluateSafetyProdGate3(input);
  const blockers = [...gate3.blockers];
  const now = Date.parse(evaluatedAt);

  if (!Number.isFinite(now)) blockers.push('invalid-evaluation-time');

  for (const receipt of input.receipts) {
    const observed = Date.parse(receipt.observedAt);
    if (!Number.isFinite(observed) || now - observed > policy.maximumReceiptAgeMs || observed > now) {
      blockers.push(`${receipt.kind}:stale-or-invalid`);
    }
  }

  const deviceReceipts = input.deviceReceipts.filter((receipt) => receipt.deviceRef === policy.requiredDeviceRef);
  if (deviceReceipts.length !== input.deviceReceipts.length || deviceReceipts.length === 0) {
    blockers.push('physical-device-identity');
  }
  for (const receipt of deviceReceipts) {
    const observed = Date.parse(receipt.observedAt);
    if (!Number.isFinite(observed) || now - observed > policy.maximumReceiptAgeMs || observed > now) {
      blockers.push(`device:${receipt.case}:stale-or-invalid`);
    }
    if (!receipt.evidenceRef) blockers.push(`device:${receipt.case}:missing-evidence`);
  }

  const uniqueBlockers = [...new Set(blockers)];
  return {
    admissionId,
    gateVersion: 'SAFETY-PROD-GATE.4',
    admitted: gate3.readyForLive && uniqueBlockers.length === 0,
    evaluatedAt,
    deviceRef: policy.requiredDeviceRef,
    evidenceRefs: [...gate3.evidenceRefs, ...deviceReceipts.map((receipt) => receipt.evidenceRef)],
    blockers: uniqueBlockers,
  };
}

export function assertSafetyLiveAdmission(receipt: SafetyLiveAdmissionReceipt): void {
  if (!receipt.admitted) throw new Error(`Safety LIVE locked: ${receipt.blockers.join(', ')}`);
}
