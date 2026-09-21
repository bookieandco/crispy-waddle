import { describe, expect, it } from 'vitest';
import { validSampleEvidence } from '../lib/catalog-certification';

describe('physical sample certification evidence', () => {
  const passing = {
    providerOrderId: 'sample-order-1',
    receivedAt: '2026-09-20T12:00:00.000Z',
    approvedBy: 'operator',
    inspection: {
      printPlacementPass: true,
      colorPass: true,
      materialPass: true,
      damageFree: true,
    },
  };

  it('requires a received order plus every physical inspection gate', () => {
    expect(validSampleEvidence(passing)).toBe(true);
    expect(
      validSampleEvidence({
        ...passing,
        inspection: { ...passing.inspection, colorPass: false },
      })
    ).toBe(false);
  });

  it('rejects future receipt timestamps', () => {
    expect(validSampleEvidence({ ...passing, receivedAt: '2099-01-01T00:00:00.000Z' })).toBe(false);
  });
});
