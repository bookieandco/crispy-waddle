import { describe, expect, it } from 'vitest';
import { scoreSamOpportunity } from './sam-score';
import type { SamOpportunity } from './sam-types';

const profile = {
  capabilities: ['software', 'staffing', 'training'],
  preferredNaics: ['541511'],
};

const base: SamOpportunity = {
  noticeId: 'TEST-1',
  title: 'Software development services',
  noticeType: 'SOLICITATION',
  agency: 'Test Agency',
  responseDeadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  naics: '541511',
  setAside: 'Small Business Set-Aside',
  estimatedValue: 500_000,
  description: 'Software development and support services.',
};

describe('scoreSamOpportunity', () => {
  it('scores a strong direct-fit solicitation as PURSUE', () => {
    const result = scoreSamOpportunity(base, profile);
    expect(result.total).toBeGreaterThanOrEqual(75);
    expect(result.disposition).toBe('PURSUE');
  });

  it('routes a deadline-passed opportunity to PASS', () => {
    const result = scoreSamOpportunity({ ...base, responseDeadline: new Date(Date.now() - 86_400_000).toISOString() }, profile);
    expect(result.timing).toBe(0);
    expect(result.disposition).toBe('PASS');
  });

  it('supports PARTNER as a distinct path for weaker direct capability', () => {
    const result = scoreSamOpportunity(
      {
        ...base,
        title: 'Specialized facilities modernization',
        noticeType: 'PRESOLICITATION',
        naics: '236220',
        estimatedValue: 1_500_000,
        description: 'Facilities modernization requiring specialized construction partners.',
        setAside: 'Small Business',
      },
      profile,
    );
    expect(['PARTNER', 'MONITOR']).toContain(result.disposition);
    expect(result.partnerFit).toBeGreaterThanOrEqual(65);
  });
});
