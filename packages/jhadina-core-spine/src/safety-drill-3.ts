import { assertDrillIsNonEmergency, assertDrillRecipient, type SafetyDrillGuard } from './safety-drill-mode.js';
import type { SafetyDrillResult } from './safety-drill.js';

export interface ControlledPersonalDrillDependencies {
  readonly guard: SafetyDrillGuard;
  readonly run: () => Promise<SafetyDrillResult>;
  readonly simulateRestart: () => Promise<void>;
  readonly verifyRecovery: () => Promise<boolean>;
  readonly verifyEncryptedOffDeviceEvidence: () => Promise<boolean>;
  readonly verifyDeliveryReceipt: () => Promise<boolean>;
  readonly verifyNoUnauthorizedRelease: () => Promise<boolean>;
}

export interface ControlledPersonalDrillResult {
  readonly passed: boolean;
  readonly drill: SafetyDrillResult;
  readonly checks: Readonly<Record<string, boolean>>;
}

export async function runControlledPersonalSafetyDrill(
  recipientId: string,
  deps: ControlledPersonalDrillDependencies,
): Promise<ControlledPersonalDrillResult> {
  assertDrillIsNonEmergency(deps.guard);
  assertDrillRecipient(deps.guard, recipientId);

  const drill = await deps.run();
  await deps.simulateRestart();

  const checks = {
    drillCompleted: drill.passed,
    recoveredAfterRestart: await deps.verifyRecovery(),
    encryptedOffDeviceEvidence: await deps.verifyEncryptedOffDeviceEvidence(),
    deliveryReceipt: await deps.verifyDeliveryReceipt(),
    noUnauthorizedRelease: await deps.verifyNoUnauthorizedRelease(),
  };
  return { passed: Object.values(checks).every(Boolean), drill, checks };
}
