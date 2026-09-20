import { describe, expect, it } from 'vitest';
import { transitionDeadMan } from './safety-deadman.js';
import { assertBlackBoxChain } from './safety-blackbox-runtime.js';
import { validatePersonalSafetyConfiguration } from './safety-personal-config.js';

describe('Safety personal stack', () => {
  it('requires deterministic dead-man transitions', () => {
    expect(transitionDeadMan('armed', 'check-in-due')).toBe('check-in-due');
    expect(() => transitionDeadMan('armed', 'begin-escalation')).toThrow();
  });

  it('rejects a broken evidence chain', () => {
    expect(() => assertBlackBoxChain([
      { id: '1', incidentId: 'i', sequence: 1, ciphertextRef: 'a', contentHash: 'h1', persistedLocally: true, persistedOffDevice: true },
      { id: '2', incidentId: 'i', sequence: 2, ciphertextRef: 'b', contentHash: 'h2', previousChunkHash: 'wrong', persistedLocally: true, persistedOffDevice: false },
    ])).toThrow();
  });

  it('keeps invasive GEV identity capabilities disabled', () => {
    expect(() => validatePersonalSafetyConfiguration({
      profileId: 'p',
      ownerUserId: 'u',
      trustedContactIds: [],
      codeWordBindingIds: [],
      defaultCheckInSeconds: 900,
      escalationRules: [],
      preAuthorizations: [],
      gev: {
        enabled: true,
        allowSpatialContext: true,
        allowPublicEnvironmentContext: true,
        allowNamedPersonSearch: true as false,
        allowFaceRecognition: false,
        allowPlateIdentification: false,
      },
      evidence: { encryptedAtRest: true, requireOffDeviceCopyBeforeRelease: true },
    })).toThrow();
  });
});
