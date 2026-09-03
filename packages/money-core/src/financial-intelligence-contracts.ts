/**
 * Governed financial-intelligence contracts.
 *
 * Intelligence may recommend and explain; Money Core decides whether a
 * financial side effect is permitted. These contracts deliberately contain
 * no provider credentials and no execution primitives.
 */

export type AssetClass =
  | 'STOCK'
  | 'FOREX'
  | 'CRYPTO'
  | 'MEME'
  | 'PREDICTION'
  | 'XAU'
  | 'XAG'
  | 'XPT'
  | 'XPD'
  | 'OTHER';

export type EvidenceQuality = 'VERIFIED' | 'SUPPORTED' | 'STALE' | 'CONFLICTING' | 'UNKNOWN';

export interface EvidenceRef {
  evidenceId: string;
  sourceId: string;
  observedAt: string;
  receivedAt: string;
  quality: EvidenceQuality;
  inputHash: string;
}

export interface FinancialHypothesis {
  hypothesisId: string;
  assetClass: AssetClass;
  instrumentId: string;
  thesis: string;
  supportingEvidence: EvidenceRef[];
  contradictingEvidence: EvidenceRef[];
  createdAt: string;
  expiresAt: string;
}

export interface PredictionDistribution {
  scenarios: Array<{
    name: string;
    probability: number;
    expectedReturn?: number;
    expectedLoss?: number;
  }>;
  calibrationScore?: number;
  modelVersion: string;
  inputHash: string;
}

export interface OpportunityCandidate {
  opportunityId: string;
  hypothesisId: string;
  assetClass: AssetClass;
  instrumentId: string;
  expectedValue: number;
  downside: number;
  confidence: number;
  prediction: PredictionDistribution;
  evidence: EvidenceRef[];
  createdAt: string;
  expiresAt: string;
}

export type AllocationDecision = 'APPROVE' | 'DENY' | 'REQUIRE_APPROVAL' | 'DEGRADE' | 'HALT';

export interface CapitalAllocationRequest {
  allocationRequestId: string;
  opportunityId: string;
  userId: string;
  requestedAmount: number;
  currency: string;
  domain: AssetClass;
  protectedReserveFloor: number;
  deployableCapitalSnapshotId: string;
  riskDecisionId: string;
  policyVersion: string;
  actionFingerprint: string;
}

export interface CapitalAllocationDecision {
  allocationDecisionId: string;
  request: CapitalAllocationRequest;
  decision: AllocationDecision;
  approvedAmount: number;
  reasonCodes: string[];
  expiresAt: string;
  policyHash: string;
  resultHash: string;
}

export interface CanonicalFinancialAction {
  actionId: string;
  userId: string;
  capability: string;
  opportunityId?: string;
  allocationDecisionId?: string;
  amount?: number;
  currency?: string;
  instrumentId?: string;
  actionFingerprint: string;
  policyVersion: string;
  createdAt: string;
}

/** Runtime invariant: intelligence never executes a financial side effect. */
export function assertIntelligenceOnly(capability: string): void {
  if (capability.startsWith('money.payment.') || capability.startsWith('money.transfer.')) {
    throw new Error('Financial intelligence cannot directly execute money movement');
  }
}

export function assertProbability(probability: number): void {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('Probability must be finite and between 0 and 1');
  }
}

export function assertPositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be finite and greater than zero');
  }
}
