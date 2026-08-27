import type { SamOpportunity } from './sam-types';

export type PartnerRole = 'SUBCONTRACTOR' | 'TEAMS' | 'SPECIALIST' | 'SUPPLIER' | 'PRIME';

export interface CapabilityGap {
  capability: string;
  evidence: string;
  required: boolean;
  naics?: string;
}

export interface PartnerSearchProfile {
  opportunityId: string;
  roles: PartnerRole[];
  capabilities: CapabilityGap[];
  searchTerms: string[];
  qualificationSignals: string[];
  disqualifiers: string[];
  humanReviewRequired: true;
}

const clean = (value?: string) => (value ?? '').trim();

/** Produces a discovery profile. It does not select or contact a partner. */
export function buildPartnerSearchProfile(opportunity: SamOpportunity, knownCapabilities: string[] = []): PartnerSearchProfile {
  const text = [opportunity.title, opportunity.description, opportunity.naics, opportunity.setAside].filter(Boolean).join(' ').toLowerCase();
  const capabilities = knownCapabilities.map(clean).filter(Boolean).filter((capability) => !text.includes(capability.toLowerCase())).map((capability) => ({
    capability,
    evidence: 'Not represented in the supplied internal capability list.',
    required: true,
    naics: opportunity.naics,
  }));
  const searchTerms = [clean(opportunity.naics), ...opportunity.title.split(/[^a-z0-9]+/i).filter((word) => word.length > 3).slice(0, 6), ...capabilities.map((gap) => gap.capability)].filter(Boolean);
  return {
    opportunityId: opportunity.noticeId,
    roles: capabilities.length ? ['SUBCONTRACTOR', 'TEAMS', 'SPECIALIST'] : ['TEAMS', 'SUBCONTRACTOR'],
    capabilities,
    searchTerms: [...new Set(searchTerms)],
    qualificationSignals: [
      opportunity.naics ? `Relevant NAICS experience: ${opportunity.naics}` : 'Relevant NAICS experience',
      opportunity.setAside ? `Ability to satisfy set-aside requirement: ${opportunity.setAside}` : 'Small-business eligibility where applicable',
      'Relevant past performance',
      'Capacity for the stated period of performance',
    ],
    disqualifiers: ['Cannot satisfy applicable solicitation eligibility requirements', 'No credible relevant past performance', 'Conflict of interest or procurement restriction'],
    humanReviewRequired: true,
  };
}
