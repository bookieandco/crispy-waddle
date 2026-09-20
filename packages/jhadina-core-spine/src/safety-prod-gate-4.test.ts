import { describe, expect, it } from 'vitest';
import { evaluateSafetyProdGate4 } from './safety-live-admission.js';
import { transitionSafetyMode } from './safety-live-mode.js';

describe('SAFETY-PROD-GATE.4', () => {
  it('fails closed with no physical receipts', () => {
    const admission = evaluateSafetyProdGate4(
      { receipts: [], deviceReceipts: [] },
      { gateVersion: 'SAFETY-PROD-GATE.4', maximumReceiptAgeMs: 86_400_000, requiredDeviceRef: 'iphone-owner' },
      '2026-09-20T18:00:00Z',
      'admission-1',
    );
    expect(admission.admitted).toBe(false);
    expect(() => transitionSafetyMode('drill', 'live', admission)).toThrow(/LIVE locked/);
  });

  it('will not accept receipts from a different physical device', () => {
    const admission = evaluateSafetyProdGate4(
      {
        receipts: [],
        deviceReceipts: [{
          deviceRef: 'other-device',
          platform: 'ios',
          case: 'permissions',
          capabilities: {
            platform: 'ios',
            foregroundAudio: true,
            foregroundVideo: true,
            backgroundAudio: true,
            backgroundVideo: false,
            backgroundLocation: true,
            notifications: true,
            localEncryptedStorage: true,
          },
          passed: true,
          observedAt: '2026-09-20T17:59:00Z',
          evidenceRef: 'device:other',
        }],
      },
      { gateVersion: 'SAFETY-PROD-GATE.4', maximumReceiptAgeMs: 86_400_000, requiredDeviceRef: 'iphone-owner' },
      '2026-09-20T18:00:00Z',
      'admission-2',
    );
    expect(admission.blockers).toContain('physical-device-identity');
  });
});
