import { describe, expect, it } from 'vitest';
import { evaluateSafetyProdGate3, type SafetyProdGate3Receipt } from './safety-prod-gate-3.js';

const softwareReceipts: SafetyProdGate3Receipt[] = [
  { kind: 'safety-ci', passed: true, observedAt: '2026-09-20T00:00:00Z', evidenceRef: 'ci:safety', environment: 'production' },
  { kind: 'migration', passed: true, observedAt: '2026-09-20T00:00:00Z', evidenceRef: 'db:migration', environment: 'production' },
  { kind: 'native-ci', passed: true, observedAt: '2026-09-20T00:00:00Z', evidenceRef: 'ci:native', environment: 'production' },
];

describe('SAFETY-PROD-GATE.3', () => {
  it('fails closed when only software receipts exist', () => {
    const result = evaluateSafetyProdGate3({ receipts: softwareReceipts, deviceReceipts: [] });
    expect(result.readyForLive).toBe(false);
    expect(result.blockers).toContain('physical-device-drill-suite');
    expect(result.blockers).toContain('controlled-personal-drill');
  });

  it('does not accept production/simulator evidence for a physical live drill', () => {
    const result = evaluateSafetyProdGate3({
      receipts: [...softwareReceipts, {
        kind: 'controlled-personal-drill',
        passed: true,
        observedAt: '2026-09-20T00:00:00Z',
        evidenceRef: 'simulator:not-physical',
        environment: 'production',
      }],
      deviceReceipts: [],
    });
    expect(result.blockers).toContain('controlled-personal-drill:physical-device');
  });
});
