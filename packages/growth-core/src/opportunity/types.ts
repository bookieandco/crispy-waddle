export type OpportunityClass =
  | 'earn'
  | 'freelance'
  | 'product'
  | 'arbitrage'
  | 'ai_business'
  | 'partnership'
  | 'asset'
  | 'experiment';

export type OpportunityStage =
  | 'service'
  | 'productized_service'
  | 'digital_product'
  | 'software'
  | 'media'
  | 'audience';

export type OpportunityStatus =
  | 'discovered'
  | 'validated'
  | 'test_ready'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'archived';

export type OpportunitySourceType =
  | 'affiliate'
  | 'ecommerce'
  | 'digital_product'
  | 'service'
  | 'government'
  | 'subcontracting'
  | 'sba'
  | 'real_estate'
  | 'overage'
  | 'content'
  | 'software'
  | 'local_business'
  | 'market_intelligence';

export interface OpportunityEvidence {
  sourceId: string;
  sourceType: string;
  sourceUrl?: string;
  claim: string;
  confidence: number;
  observedAt: string;
  verified: boolean;
}

export interface OpportunityEconomics {
  estimatedRevenue?: number;
  estimatedCost?: number;
  estimatedHours?: number;
  currency?: string;
  recurringRevenue?: boolean;
  timeToFirstDollarDays?: number;
}

export interface OpportunityScoreDimensions {
  demand: number;
  buyerValue: number;
  distributionPotential: number;
  aiLeverage: number;
  recurringRevenue: number;
  competition: number;
  startupCost: number;
  operationalComplexity: number;
  regulatoryRisk: number;
  evidenceConfidence: number;
  personalFit: number;
}

export interface OpportunityScore {
  total: number;
  dimensions: OpportunityScoreDimensions;
  recommendation: 'pursue' | 'test' | 'monitor' | 'reject';
  rationale: string[];
  scoredAt: string;
}

export interface OpportunityMatch {
  eligible: boolean;
  fitScore: number;
  capabilityMatches: string[];
  capabilityGaps: string[];
  eligibilityGaps: string[];
  reasons: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  summary: string;
  problem?: string;
  buyer?: string;
  market?: string;
  class: OpportunityClass;
  stage: OpportunityStage;
  sourceType: OpportunitySourceType;
  sourceId: string;
  sourceUrl?: string;
  evidence: OpportunityEvidence[];
  economics: OpportunityEconomics;
  score?: OpportunityScore;
  match?: OpportunityMatch;
  status: OpportunityStatus;
  parentOpportunityId?: string;
  createdAt: string;
  updatedAt: string;
}
