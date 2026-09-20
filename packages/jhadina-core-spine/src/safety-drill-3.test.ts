import { describe, expect, it } from 'vitest';
import { runControlledPersonalSafetyDrill } from './safety-drill-3.js';
import { evaluateSafetyProductionGate } from './safety-production-gate.js';

describe('SAFETY-DRILL.3', () => {
  it('passes a controlled personal drill only when all recovery/evidence/delivery checks pass', async () => {
    const result = await runControlledPersonalSafetyDrill('test-contact', {
      guard: {
        mode: 'drill',
        allowedRecipientIds: ['test-contact'],
        allowExternalEmergencyServices: false,
        allowEvidenceRelease: false,
      },
      run: async () => ({ incidentId: 'drill-3', stages: ['triggered', 'audit-complete'], passed: true }),
      simulateRestart: async () => undefined,
      verifyRecovery: async () => true,
      verifyEncryptedOffDeviceEvidence: async () => true,
      verifyDeliveryReceipt: async () => true,
      verifyNoUnauthorizedRelease: async () => true,
    });
    expect(result.passed).toBe(true);
  });

  it('keeps production disabled until live-device and controlled drill gates pass', () => {
    const gate = evaluateSafetyProductionGate({
      safetyCiGreen: true,
      migrationApplied: true,
      nativeDeviceDrillPassed: false,
      communicationsDrillPassed: false,
      vaultDrillPassed: false,
      deadManServiceDrillPassed: true,
      chaosDrillPassed: true,
      personalProfileConfigured: false,
      controlledPersonalDrillPassed: false,
    });
    expect(gate.ready).toBe(false);
    expect(gate.blockers).toContain('nativeDeviceDrillPassed');
  });
});
