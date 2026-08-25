import type { FeedItem } from './core';

export type VerificationState = 'verified' | 'needs_review' | 'unverified';

export interface OverageOpportunity {
  opportunityId: string;
  jurisdiction: string;
  amount?: number;
  currency?: string;
  property?: string;
  claimantStatus?: string;
  deadline?: string;
  source: string;
  evidence: string[];
  verificationState: VerificationState;
  confidence?: number;
  claimability?: 'unknown' | 'potential' | 'eligible' | 'ineligible';
}

export interface OverageOSSurface {
  groupId: string;
  opportunity: OverageOpportunity;
  surfaces: Array<'overview' | 'evidence' | 'property' | 'claim' | 'research' | 'action'>;
}

export function overageOpportunityToFeedItem(opportunity: OverageOpportunity): FeedItem {
  const amount = opportunity.amount == null ? undefined : `${opportunity.currency ?? 'USD'} ${opportunity.amount.toLocaleString()}`;
  return {
    id: `overageos-${opportunity.opportunityId}`,
    kind: 'opportunity',
    label: 'OverageOS',
    title: `Opportunity detected · ${opportunity.jurisdiction}`,
    body: [
      amount && `Potential surplus: ${amount}`,
      opportunity.property && `Property: ${opportunity.property}`,
      `Verification: ${opportunity.verificationState}`,
      opportunity.claimability && `Claimability: ${opportunity.claimability}`,
    ].filter(Boolean).join(' · '),
    status: opportunity.verificationState,
    action: 'View opportunity',
    relevance: Math.round((opportunity.confidence ?? 0) * 100),
    relevanceReason: 'Discovered by OverageOS',
  };
}

export function createOverageSurface(opportunity: OverageOpportunity): OverageOSSurface {
  return {
    groupId: `overage-signal-${opportunity.opportunityId}`,
    opportunity,
    surfaces: ['overview', 'evidence', 'property', 'claim', 'research', 'action'],
  };
}
