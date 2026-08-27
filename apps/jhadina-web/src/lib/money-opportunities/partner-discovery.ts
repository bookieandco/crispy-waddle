import type { SamOpportunity, OpportunityScore } from './sam-types';

export type CapabilityGapSeverity = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

export interface CapabilityGap {
  capability: string;
  severity: CapabilityGapSeverity;
  evidence: string;
  suggestedPartnerProfile: string;
}

export interface PartnerDealModel {
  role: 'SUBCONTRACTOR' | 'TEAMING_PARTNER' | 'SPECIALIST_VENDOR' | 'PRIME_SUPPORT';
  rationale: string;
  targetSharePercent: number;
  diligenceRequired: string[];
}

export interface PartnerDiscoveryPlan {
  opportunityId: string;
  disposition: 'SELF_EXECUTE' | 'PARTNER_REQUIRED' | 'INSUFFICIENT_DATA';
  gaps: CapabilityGap[];
  partnerDeal: PartnerDealModel | null;
  nextActions: string[];
}

/**
 * Deterministic first-pass gap mapper. It does not select or contact vendors.
 * Human approval remains required before outreach, teaming, or bid submission.
 */
export function buildPartnerDiscoveryPlan(
  opportunity: SamOpportunity,
  score: OpportunityScore,
): PartnerDiscoveryPlan {
  const gaps: CapabilityGap[] = [];
  const text = `${opportunity.title} ${opportunity.description ?? ''} ${opportunity.naics ?? ''}`.toLowerCase();

  if (score.disposition !== 'PARTNER') {
    return {
      opportunityId: opportunity.noticeId,
      disposition: score.disposition === 'PURSUE' ? 'SELF_EXECUTE' : 'INSUFFICIENT_DATA',
      gaps,
      partnerDeal: null,
      nextActions: score.disposition === 'PURSUE'
        ? ['Complete internal capability confirmation.', 'Verify solicitation requirements and representations.', 'Route bid/no-bid decision through the human approval gate.']
        : ['Monitor for new information or solicitation changes.'],
    };
  }

  const addGap = (capability: string, severity: CapabilityGapSeverity, evidence: string, profile: string) =>
    gaps.push({ capability, severity, evidence, suggestedPartnerProfile: profile });

  if (/construction|renovation|facility|maintenance|installation/.test(text)) {
    addGap('Trade / field execution capacity', 'CRITICAL', 'Opportunity language indicates physical execution.', 'Licensed/local contractor with relevant past performance and bonding capacity.');
  }
  if (/software|cyber|cloud|data|it |information technology|application/.test(text)) {
    addGap('Technical delivery capability', 'IMPORTANT', 'Opportunity language indicates technology delivery.', 'Small technology firm with matching NAICS, certifications, security posture, and federal past performance.');
  }
  if (/training|instruction|curriculum|workshop/.test(text)) {
    addGap('Training delivery capacity', 'IMPORTANT', 'Opportunity language indicates training/instruction.', 'Training provider with qualified instructors and directly relevant past performance.');
  }
  if (/medical|health|clinical|laboratory/.test(text)) {
    addGap('Domain-qualified health capability', 'CRITICAL', 'Opportunity language indicates regulated health services.', 'Appropriately licensed/certified provider with federal compliance experience.');
  }
  if (/security|guard|protective/.test(text)) {
    addGap('Security operations capacity', 'CRITICAL', 'Opportunity language indicates security services.', 'Properly licensed security contractor with required clearances/certifications and past performance.');
  }

  if (gaps.length === 0) {
    addGap('Unresolved capability gap', 'IMPORTANT', 'Opportunity scored as PARTNER but no deterministic domain signal was found.', 'Federal small business with complementary capabilities and relevant past performance.');
  }

  const critical = gaps.some((gap) => gap.severity === 'CRITICAL');
  const targetSharePercent = critical ? 70 : 55;

  return {
    opportunityId: opportunity.noticeId,
    disposition: 'PARTNER_REQUIRED',
    gaps,
    partnerDeal: {
      role: critical ? 'TEAMING_PARTNER' : 'SUBCONTRACTOR',
      rationale: 'Use a complementary firm for the identified capability gap while retaining a commercially viable prime/lead role where permitted.',
      targetSharePercent,
      diligenceRequired: [
        'Verify legal business identity and SAM registration status.',
        'Verify relevant NAICS and socioeconomic status where material.',
        'Verify past performance and references.',
        'Verify licenses, certifications, insurance, bonding, and security requirements as applicable.',
        'Confirm conflicts, exclusivity restrictions, and solicitation teaming/subcontracting rules.',
        'Do not represent partner capabilities as our own until an agreement is executed.',
      ],
    },
    nextActions: [
      'Translate each gap into partner-search criteria.',
      'Build a shortlist from lawful public/business sources.',
      'Estimate prime revenue, partner cost, and gross margin before outreach.',
      'Prepare a draft teaming/subcontract structure for human review.',
      'Obtain human approval before contacting any prospective partner or submitting a bid.',
    ],
  };
}
