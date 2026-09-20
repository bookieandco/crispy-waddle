import type { SamOpportunity } from './sam-types';
import type { MoneyCapabilityProfile } from './capability-profile';

export type CapabilityDisposition = 'CAN_DO' | 'CAN_DO_WITH_PARTNER' | 'CANNOT_DO' | 'UNKNOWN';

export interface CapabilityAssessment {
  disposition: CapabilityDisposition;
  capabilityGap: boolean;
  matchedCapabilities: string[];
  missingSignals: string[];
  rationale: string[];
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function assessSamCapability(
  opportunity: SamOpportunity,
  profile: MoneyCapabilityProfile,
): CapabilityAssessment {
  const text = normalize([opportunity.title, opportunity.description, opportunity.naics].filter(Boolean).join(' '));
  const matchedCapabilities = profile.capabilities.filter((capability) => text.includes(normalize(capability)));
  const naicsMatch = !!opportunity.naics && profile.preferredNaics.includes(opportunity.naics);
  const hasServiceSignal = matchedCapabilities.length > 0 || naicsMatch;

  if (!text) {
    return {
      disposition: 'UNKNOWN',
      capabilityGap: true,
      matchedCapabilities: [],
      missingSignals: ['Opportunity contains insufficient description data.'],
      rationale: ['Do not assume capability when SAM data is incomplete; route to research/partner discovery.'],
    };
  }

  if (hasServiceSignal && (matchedCapabilities.length >= 2 || naicsMatch)) {
    return {
      disposition: 'CAN_DO',
      capabilityGap: false,
      matchedCapabilities: [...matchedCapabilities, ...(naicsMatch ? [`NAICS ${opportunity.naics}`] : [])],
      missingSignals: [],
      rationale: ['Opportunity contains direct signals matching Jhadina commercial capabilities.'],
    };
  }

  if (hasServiceSignal) {
    return {
      disposition: 'CAN_DO_WITH_PARTNER',
      capabilityGap: true,
      matchedCapabilities: [...matchedCapabilities, ...(naicsMatch ? [`NAICS ${opportunity.naics}`] : [])],
      missingSignals: ['Only partial capability evidence is present.'],
      rationale: ['Treat partial matches as partner candidates until requirements are validated.'],
    };
  }

  return {
    disposition: 'UNKNOWN',
    capabilityGap: true,
    matchedCapabilities: [],
    missingSignals: ['No direct capability or preferred-NAICS match found.'],
    rationale: ['Research the requirement before spending bid effort.'],
  };
}
