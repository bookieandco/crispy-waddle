import { describe, expect, it } from 'vitest';
import { evaluateSafetyProdGate2 } from './safety-live-readiness.js';

describe('SAFETY-PROD-GATE.2', () => {
  it('refuses live mode when physical-device receipts do not exist', () => {
    const result = evaluateSafetyProdGate2({
      safetyCiGreen: true,
      migrationApplied: true,
      device: [],
      communicationsDrillPassed: false,
      vaultDrillPassed: true,
      deadManServiceDrillPassed: true,
      chaosDrillPassed: true,
      personalProfileConfigured: false,
      controlledPersonalDrillPassed: false,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('nativeDeviceDrillPassed');
    expect(result.blockers).toContain('communicationsDrillPassed');
  });
});
