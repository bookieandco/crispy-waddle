import { deviceDrillComplete, type SafetyDeviceDrillReceipt } from './safety-device-receipts.js';
import { evaluateSafetyProductionGate, type SafetyProductionGateResult } from './safety-production-gate.js';

export interface SafetyRuntimeReceipts {
  readonly safetyCiGreen: boolean;
  readonly migrationApplied: boolean;
  readonly device: readonly SafetyDeviceDrillReceipt[];
  readonly communicationsDrillPassed: boolean;
  readonly vaultDrillPassed: boolean;
  readonly deadManServiceDrillPassed: boolean;
  readonly chaosDrillPassed: boolean;
  readonly personalProfileConfigured: boolean;
  readonly controlledPersonalDrillPassed: boolean;
}

export function evaluateSafetyProdGate2(receipts: SafetyRuntimeReceipts): SafetyProductionGateResult {
  return evaluateSafetyProductionGate({
    safetyCiGreen: receipts.safetyCiGreen,
    migrationApplied: receipts.migrationApplied,
    nativeDeviceDrillPassed: deviceDrillComplete(receipts.device),
    communicationsDrillPassed: receipts.communicationsDrillPassed,
    vaultDrillPassed: receipts.vaultDrillPassed,
    deadManServiceDrillPassed: receipts.deadManServiceDrillPassed,
    chaosDrillPassed: receipts.chaosDrillPassed,
    personalProfileConfigured: receipts.personalProfileConfigured,
    controlledPersonalDrillPassed: receipts.controlledPersonalDrillPassed,
  });
}
