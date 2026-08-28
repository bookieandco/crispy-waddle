import type { Opportunity, OpportunityMatch } from './types.js';

export interface OpportunityMatchProfile {
  capabilities: string[];
  eligibilityRules?: Array<(opportunity: Opportunity) => boolean>;
}

export function matchOpportunity(opportunity: Opportunity, profile: OpportunityMatchProfile): OpportunityMatch {
  const haystack = `${opportunity.title} ${opportunity.summary} ${opportunity.problem ?? ''} ${opportunity.market ?? ''}`.toLowerCase();
  const capabilityMatches = profile.capabilities.filter((capability) => haystack.includes(capability.toLowerCase()));
  const capabilityGaps = profile.capabilities.filter((capability) => !capabilityMatches.includes(capability));
  const eligibilityGaps = (profile.eligibilityRules ?? [])
    .map((rule, index) => rule(opportunity) ? null : `Eligibility rule ${index + 1} not satisfied`)
    .filter((reason): reason is string => reason !== null);
  const eligible = eligibilityGaps.length === 0;
  const fitScore = profile.capabilities.length === 0 ? 50 : Math.round((capabilityMatches.length / profile.capabilities.length) * 100);

  return {
    eligible,
    fitScore,
    capabilityMatches,
    capabilityGaps,
    eligibilityGaps,
    reasons: [
      capabilityMatches.length ? `Matched capabilities: ${capabilityMatches.join(', ')}` : 'No declared capability match found.',
      eligible ? 'Eligibility rules passed.' : `Eligibility gaps: ${eligibilityGaps.join('; ')}`,
    ],
  };
}

export interface SbaEligibilityProfile {
  businessTypes?: string[];
  certifications?: string[];
  naicsCodes?: string[];
  states?: string[];
  sizeEligible?: boolean;
}

export interface SbaOpportunityEligibilityInput {
  programName?: string;
  requiredBusinessTypes?: string[];
  requiredCertifications?: string[];
  eligibleNaicsCodes?: string[];
  eligibleStates?: string[];
  requiresSmallBusinessStatus?: boolean;
}

export function matchSbaEligibility(
  input: SbaOpportunityEligibilityInput,
  profile: SbaEligibilityProfile,
): OpportunityMatch {
  const businessTypeMatch = !input.requiredBusinessTypes?.length ||
    input.requiredBusinessTypes.some((value) => profile.businessTypes?.includes(value));
  const certificationMatch = !input.requiredCertifications?.length ||
    input.requiredCertifications.every((value) => profile.certifications?.includes(value));
  const naicsMatch = !input.eligibleNaicsCodes?.length ||
    input.eligibleNaicsCodes.some((value) => profile.naicsCodes?.includes(value));
  const stateMatch = !input.eligibleStates?.length ||
    input.eligibleStates.some((value) => profile.states?.includes(value));
  const sizeMatch = !input.requiresSmallBusinessStatus || profile.sizeEligible === true;

  const gaps = [
    businessTypeMatch ? null : 'Business type does not match required program types.',
    certificationMatch ? null : 'Required certification is not present.',
    naicsMatch ? null : 'No eligible NAICS code match.',
    stateMatch ? null : 'No eligible state match.',
    sizeMatch ? null : 'Small-business eligibility has not been established.',
  ].filter((value): value is string => value !== null);

  const passed = 5 - gaps.length;
  return {
    eligible: gaps.length === 0,
    fitScore: passed * 20,
    capabilityMatches: [],
    capabilityGaps: [],
    eligibilityGaps: gaps,
    reasons: [
      input.programName ? `SBA program: ${input.programName}` : 'SBA program eligibility match',
      gaps.length === 0 ? 'All supplied eligibility rules passed.' : `Eligibility gaps: ${gaps.join('; ')}`,
    ],
  };
}
