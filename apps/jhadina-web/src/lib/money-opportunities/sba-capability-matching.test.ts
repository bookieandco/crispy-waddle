import { describe, expect, it } from 'vitest';
import { matchSamOpportunityToCapabilities, isSbaCapabilityMatch } from './sba-capability-matching';
import type { SamOpportunity } from './sam-types';

describe('SBA capability matching', () => {
  const opportunity: SamOpportunity = {
    noticeId: 'sam-1',
    title: 'AI workflow automation services',
    noticeType: 'SOLICITATION',
    agency: 'Example Agency',
    responseDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    naics: '541511',
    setAside: '8(a)',
    placeOfPerformance: 'California',
    estimatedValue: 100000,
    description: 'Build AI automation and software workflows for agency operations.',
  };

  it('matches configured capabilities, location, and set-aside without an LLM', () => {
    const match = matchSamOpportunityToCapabilities(opportunity, {
      capabilities: ['AI automation', 'software'],
      locations: ['California'],
      preferredSetAsides: ['8(a)'],
      minEstimatedValue: 50000,
    });

    expect(match.eligible).toBe(true);
    expect(match.blockers).toEqual([]);
    expect(match.capabilityFit).toBe(100);
    expect(match.locationFit).toBe(100);
  });

  it('blocks an opportunity with insufficient capability evidence', () => {
    const match = matchSamOpportunityToCapabilities(opportunity, {
      capabilities: ['medical device manufacturing', 'laboratory testing'],
    });

    expect(match.eligible).toBe(false);
    expect(match.blockers).toContain('Insufficient capability evidence for the configured profile.');
    expect(isSbaCapabilityMatch(opportunity, { capabilities: ['medical device manufacturing'] })).toBe(false);
  });

  it('blocks expired solicitations deterministically', () => {
    const expired = { ...opportunity, responseDeadline: new Date(Date.now() - 86400000).toISOString() };
    const match = matchSamOpportunityToCapabilities(expired, { capabilities: ['AI automation'] });

    expect(match.eligible).toBe(false);
    expect(match.deadlineFit).toBe(0);
    expect(match.blockers).toContain('Response deadline has passed.');
  });
});
