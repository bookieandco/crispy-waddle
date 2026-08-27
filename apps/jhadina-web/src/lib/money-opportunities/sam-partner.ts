import type { SamOpportunity } from './sam-types';

export interface SamPartnerProfile {
  capabilities: string[];
  preferredNaics?: string[];
  maxDirectContractValue?: number;
}

export type PartnerGapKind = 'CAPABILITY' | 'NAICS' | 'SCALE' | 'TIMING' | 'SPECIAL_REQUIREMENT';

export interface SamPartnerGap {
  kind: PartnerGapKind;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface SamPartnerPlan {
  needed: boolean;
  gaps: SamPartnerGap[];
  partnerProfile: string[];
  dealModel: 'TEAMING' | 'SUBCONTRACT' | 'PRIME_WITH_SUBCONTRACTOR' | 'NONE';
  nextActions: string[];
}

function includesAny(text: string, terms: string[]): boolean {
  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

/**
 * Deterministic partner-gap analysis. Advisory only: it never selects a
 * vendor, contacts a company, submits a bid, or promises a subcontract.
 */
export function analyzeSamPartnerGap(
  opportunity: SamOpportunity,
  profile: SamPartnerProfile,
): SamPartnerPlan {
  const text = `${opportunity.title} ${opportunity.description ?? ''}`;
  const gaps: SamPartnerGap[] = [];

  const directCapability = profile.capabilities.some((capability) =>
    includesAny(text, [capability]),
  );

  if (!directCapability) {
    gaps.push({
      kind: 'CAPABILITY',
      severity: 'HIGH',
      description: 'No configured direct capability matches the notice text.',
    });
  }

  if (
    opportunity.naics &&
    profile.preferredNaics?.length &&
    !profile.preferredNaics.includes(opportunity.naics)
  ) {
    gaps.push({
      kind: 'NAICS',
      severity: 'MEDIUM',
      description: `NAICS ${opportunity.naics} is outside the configured preferred NAICS list.`,
    });
  }

  if (
    opportunity.estimatedValue != null &&
    profile.maxDirectContractValue != null &&
    opportunity.estimatedValue > profile.maxDirectContractValue
  ) {
    gaps.push({
      kind: 'SCALE',
      severity: 'HIGH',
      description: 'Estimated value exceeds the configured direct-execution ceiling.',
    });
  }

  const specialSignals = [
    'classified',
    'security clearance',
    'facility clearance',
    'bonding',
    'licensed',
    'certified',
    'incumbent experience',
  ];
  if (includesAny(text, specialSignals)) {
    gaps.push({
      kind: 'SPECIAL_REQUIREMENT',
      severity: 'MEDIUM',
      description: 'Notice text contains a requirement that may require a qualified partner.',
    });
  }

  if (opportunity.responseDeadline) {
    const days =
      (new Date(opportunity.responseDeadline).getTime() - Date.now()) / 86_400_000;
    if (days >= 0 && days < 14) {
      gaps.push({
        kind: 'TIMING',
        severity: 'MEDIUM',
        description: 'Less than 14 days remain; partner identification must be treated as time-critical.',
      });
    }
  }

  const needed = gaps.length > 0;
  const highGap = gaps.some((gap) => gap.severity === 'HIGH');
  const earlyNotice =
    opportunity.noticeType === 'SOURCES_SOUGHT' ||
    opportunity.noticeType === 'PRESOLICITATION';

  let dealModel: SamPartnerPlan['dealModel'] = 'NONE';
  if (needed) {
    if (earlyNotice) dealModel = 'TEAMING';
    else if (highGap) dealModel = 'PRIME_WITH_SUBCONTRACTOR';
    else dealModel = 'SUBCONTRACT';
  }

  const partnerProfile = gaps
    .filter((gap) => gap.kind !== 'TIMING')
    .map((gap) => gap.description);

  const nextActions = needed
    ? [
        'Define the missing capability, certification, scale, or requirement in procurement-ready terms.',
        'Search authorized/public business sources for qualified potential partners; do not infer qualification from marketing copy alone.',
        'Compare partner capability against the notice requirements and set-aside constraints.',
        'Model prime/subcontract economics and confirm responsibilities before any outreach.',
        'Require human approval before contacting a prospective partner or submitting any response.',
      ]
    : ['Keep as a direct-execution opportunity; no partner is currently indicated by the configured profile.'];

  return { needed, gaps, partnerProfile, dealModel, nextActions };
}
