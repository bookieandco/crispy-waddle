import { describe, expect, it } from 'vitest';
import { evaluateSafetyProdGate5 } from './safety-prod-gate-5.js';

const gate4 = {
  admissionId: 'a1',
  gateVersion: 'SAFETY-PROD-GATE.4' as const,
  admitted: true,
  evaluatedAt: '2026-09-20T18:00:00Z',
  deviceRef: 'owner-iphone',
  evidenceRefs: ['gate4:evidence'],
  blockers: [],
};

describe('SAFETY-PROD-GATE.5', () => {
  it('fails closed without live runtime proof', () => {
    const result = evaluateSafetyProdGate5(gate4, [], {
      maximumProofAgeMs: 86_400_000,
      requiredDeviceRef: 'owner-iphone',
    }, '2026-09-20T18:05:00Z');
    expect(result.admitted).toBe(false);
    expect(result.blockers).toContain('vault-roundtrip');
    expect(result.blockers).toContain('physical-device-suite:device-bound');
  });

  it('rejects device-bound proof from another phone', () => {
    const result = evaluateSafetyProdGate5(gate4, [{
      kind: 'physical-device-suite',
      passed: true,
      observedAt: '2026-09-20T18:04:00Z',
      evidenceRef: 'device:receipt',
      deviceRef: 'other-phone',
    }], {
      maximumProofAgeMs: 86_400_000,
      requiredDeviceRef: 'owner-iphone',
    }, '2026-09-20T18:05:00Z');
    expect(result.blockers).toContain('physical-device-suite:device-bound');
  });
});
