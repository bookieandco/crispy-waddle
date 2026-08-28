import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { DiscoveredOffer } from './offer-discovery.js';

export type OfferVerificationStatus = 'verified' | 'needs_review' | 'rejected';

export interface OfferVerification {
  offerId: GrowthId;
  status: OfferVerificationStatus;
  verifiedAt: ISODateTime;
  evidenceQuality: number;
  complianceRisk: number;
  checks: readonly {
    name: string;
    passed: boolean;
    evidence?: string;
  }[];
  reasons: readonly string[];
}

/** Provider-neutral contract; adapters must verify rather than infer commercial claims. */
export interface OfferVerificationAdapter {
  readonly provider: string;
  verify(offer: DiscoveredOffer): Promise<OfferVerification>;
}

export function isExperimentEligible(verification: OfferVerification): boolean {
  return verification.status === 'verified' && verification.evidenceQuality >= 60 && verification.complianceRisk < 80;
}
