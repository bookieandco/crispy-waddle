import { deviceDrillComplete, type SafetyDeviceDrillReceipt } from './safety-device-receipts.js';

export type SafetyProdGate3ReceiptKind =
  | 'safety-ci'
  | 'migration'
  | 'native-ci'
  | 'communications-live-drill'
  | 'vault-live-drill'
  | 'deadman-live-drill'
  | 'chaos-live-drill'
  | 'personal-profile'
  | 'controlled-personal-drill';

export interface SafetyProdGate3Receipt {
  readonly kind: SafetyProdGate3ReceiptKind;
  readonly passed: boolean;
  readonly observedAt: string;
  readonly evidenceRef: string;
  readonly environment: 'production' | 'physical-device';
}

export interface SafetyProdGate3Input {
  readonly receipts: readonly SafetyProdGate3Receipt[];
  readonly deviceReceipts: readonly SafetyDeviceDrillReceipt[];
}

export interface SafetyProdGate3Result {
  readonly readyForLive: boolean;
  readonly blockers: readonly string[];
  readonly evidenceRefs: readonly string[];
}

const required: readonly SafetyProdGate3ReceiptKind[] = [
  'safety-ci',
  'migration',
  'native-ci',
  'communications-live-drill',
  'vault-live-drill',
  'deadman-live-drill',
  'chaos-live-drill',
  'personal-profile',
  'controlled-personal-drill',
];

export function evaluateSafetyProdGate3(input: SafetyProdGate3Input): SafetyProdGate3Result {
  const blockers: string[] = [];

  for (const kind of required) {
    const matches = input.receipts.filter((receipt) => receipt.kind === kind && receipt.passed && receipt.evidenceRef.length > 0);
    if (matches.length === 0) blockers.push(kind);
  }

  if (!deviceDrillComplete(input.deviceReceipts)) blockers.push('physical-device-drill-suite');

  const physicalKinds: readonly SafetyProdGate3ReceiptKind[] = [
    'communications-live-drill',
    'vault-live-drill',
    'deadman-live-drill',
    'chaos-live-drill',
    'personal-profile',
    'controlled-personal-drill',
  ];
  for (const kind of physicalKinds) {
    if (!input.receipts.some((receipt) => receipt.kind === kind && receipt.passed && receipt.environment === 'physical-device')) {
      blockers.push(`${kind}:physical-device`);
    }
  }

  return {
    readyForLive: blockers.length === 0,
    blockers: [...new Set(blockers)],
    evidenceRefs: input.receipts.filter((receipt) => receipt.passed).map((receipt) => receipt.evidenceRef),
  };
}
