export interface SafetyProductionGateInput {
  readonly safetyCiGreen: boolean;
  readonly migrationApplied: boolean;
  readonly nativeDeviceDrillPassed: boolean;
  readonly communicationsDrillPassed: boolean;
  readonly vaultDrillPassed: boolean;
  readonly deadManServiceDrillPassed: boolean;
  readonly chaosDrillPassed: boolean;
  readonly personalProfileConfigured: boolean;
  readonly controlledPersonalDrillPassed: boolean;
}

export interface SafetyProductionGateResult {
  readonly ready: boolean;
  readonly blockers: readonly string[];
}

export function evaluateSafetyProductionGate(input: SafetyProductionGateInput): SafetyProductionGateResult {
  const blockers = Object.entries(input)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return { ready: blockers.length === 0, blockers };
}
