import { describe, expect, it } from 'vitest';
import { analyzeSamPartnerGap } from './sam-partner';
import type { SamOpportunity } from './sam-types';

const profile = {
  capabilities: ['software', 'staffing', 'training'],
  preferredNaics: ['541511'],
  maxDirectContractValue: 500_000,
};

const base: SamOpportunity = {
  noticeId: 'PARTNER-1',
  title: 'Specialized facilities modernization',
  noticeType: 'SOLICITATION',
  naics: '236220',
  estimatedValue: 1_500_000,
  responseDeadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  description: 'Facilities modernization requiring bonding and licensed construction experience.',
};

describe('analyzeSamPartnerGap', () => {
  it('identifies capability, NAICS, scale, and special-requirement gaps', () => {
    const result = analyzeSamPartnerGap(base, profile);
    expect(result.needed).toBe(true);
    expect(result.gaps.map((gap) => gap.kind)).toEqual(
      expect.arrayContaining(['CAPABILITY', 'NAICS', 'SCALE', 'SPECIAL_REQUIREMENT']),
    );
    expect(result.dealModel).toBe('PRIME_WITH_SUBCONTRACTOR');
  });

  it('uses teaming for early-stage notices', () => {
    const result = analyzeSamPartnerGap(
      { ...base, noticeType: 'SOURCES_SOUGHT' },
      profile,
    );
    expect(result.dealModel).toBe('TEAMING');
  });

  it('returns no partner need for a direct-fit opportunity', () => {
    const result = analyzeSamPartnerGap(
      {
        ...base,
        title: 'Software development services',
        naics: '541511',
        estimatedValue: 250_000,
        description: 'Software development and support services.',
      },
      profile,
    );
    expect(result.needed).toBe(false);
    expect(result.dealModel).toBe('NONE');
  });
});
