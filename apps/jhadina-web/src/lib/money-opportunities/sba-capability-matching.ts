import type { OpportunityMatch } from '@jhadina/growth-core/opportunity';
import type { SamOpportunity } from './sam-types';
import type { SamRankingProfile } from './sam-ranking';

export interface SbaCapabilityProfile extends SamRankingProfile {
  eligibleBusinessTypes?: string[];
  certifications?: string[];
  locations?: string[];
  maxStartupCost?: number;
  minPaymentLikelihood?: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const includesAny = (value: string | undefined, terms: string[] | undefined) =>
  Boolean(value && terms?.some((term) => value.toLowerCase().includes(term.toLowerCase())));

/**
 * Deterministic SBA/capability gate. It enriches the canonical OpportunityMatch
 * but never uses an LLM to decide eligibility or blockers.
 */
export function matchSamOpportunityToCapabilities(
  opportunity: SamOpportunity,
  profile: SbaCapabilityProfile = {},
): OpportunityMatch {
  const text = [opportunity.title, opportunity.description, opportunity.naics, opportunity.setAside]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const capabilityTerms = profile.capabilities ?? [];
  const matchedCapabilities = capabilityTerms.filter((capability) => text.includes(capability.toLowerCase()));
  const capabilityFit = capabilityTerms.length
    ? clamp((matchedCapabilities.length / capabilityTerms.length) * 100)
    : 50;

  const locationFit = profile.locations?.length
    ? (includesAny(opportunity.placeOfPerformance, profile.locations) ? 100 : 25)
    : 50;

  const setAsideFit = profile.preferredSetAsides?.length
    ? (includesAny(opportunity.setAside, profile.preferredSetAsides) ? 100 : 55)
    : 50;

  const valueFit = opportunity.estimatedValue == null || profile.minEstimatedValue == null
    ? 60
    : opportunity.estimatedValue >= profile.minEstimatedValue ? 100 : 25;

  const deadlineFit = opportunity.responseDeadline
    ? new Date(opportunity.responseDeadline).getTime() >= Date.now()
      ? 100
      : 0
    : 50;

  const paymentLikelihood = opportunity.estimatedValue != null ? 80 : 55;
  const startupCostFit = profile.maxStartupCost == null ? 60 : 60;
  const timeFit = profile.maxDaysToDeadline == null || !opportunity.responseDeadline
    ? 60
    : clamp(((new Date(opportunity.responseDeadline).getTime() - Date.now()) / 86400000) >= profile.maxDaysToDeadline ? 100 : 35);

  const blockers: string[] = [];
  if (deadlineFit === 0) blockers.push('Response deadline has passed.');
  if (capabilityTerms.length > 0 && capabilityFit < 50) blockers.push('Insufficient capability evidence for the configured profile.');
  if (profile.locations?.length && locationFit < 50) blockers.push('Place of performance does not match the configured locations.');

  const reasons = [
    matchedCapabilities.length
      ? `Matched capabilities: ${matchedCapabilities.join(', ')}.`
      : 'No configured capability terms matched the opportunity text.',
    `Capability fit: ${capabilityFit}/100.`,
    `Location fit: ${locationFit}/100.`,
    `Set-aside fit: ${setAsideFit}/100.`,
    `Deadline fit: ${deadlineFit}/100.`,
  ];

  return {
    eligible: blockers.length === 0,
    capabilityFit,
    locationFit,
    startupCostFit,
    timeFit,
    paymentLikelihood,
    deadlineFit,
    blockers,
    reasons,
  };
}

export function isSbaCapabilityMatch(
  opportunity: SamOpportunity,
  profile: SbaCapabilityProfile = {},
): boolean {
  return matchSamOpportunityToCapabilities(opportunity, profile).eligible;
}
