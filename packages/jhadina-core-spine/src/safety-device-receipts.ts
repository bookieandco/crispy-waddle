import type { SafetyPlatformCapabilities } from './safety-platform-capabilities.js';

export type SafetyDeviceDrillCase =
  | 'permissions'
  | 'foreground-capture'
  | 'background-transition'
  | 'network-loss'
  | 'app-relaunch'
  | 'reboot'
  | 'storage-pressure';

export interface SafetyDeviceDrillReceipt {
  readonly deviceRef: string;
  readonly platform: 'ios' | 'android';
  readonly case: SafetyDeviceDrillCase;
  readonly capabilities: SafetyPlatformCapabilities;
  readonly passed: boolean;
  readonly observedAt: string;
  readonly evidenceRef: string;
}

export function deviceDrillComplete(receipts: readonly SafetyDeviceDrillReceipt[]): boolean {
  const required: readonly SafetyDeviceDrillCase[] = ['permissions','foreground-capture','background-transition','network-loss','app-relaunch','reboot','storage-pressure'];
  return required.every((testCase) => receipts.some((receipt) => receipt.case === testCase && receipt.passed));
}
