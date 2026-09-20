export const VERIFICATION_STATUSES = [
  'unverified',
  'partially_verified',
  'verified',
  'rejected',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_CHECKS = [
  'source_record',
  'property_reference',
  'claimant_identity',
  'entitlement',
] as const;

export type VerificationCheckType = (typeof VERIFICATION_CHECKS)[number];

export type VerificationCheckResult = 'pending' | 'verified' | 'rejected';

export interface VerificationCheck {
  type: VerificationCheckType;
  result: VerificationCheckResult;
  evidenceRefs: string[];
}

export interface VerificationDecision {
  id: string;
  opportunityId: string;
  status: VerificationStatus;
  checks: VerificationCheck[];
  evidenceRefs: string[];
  reviewerRef: string;
  decidedAt: string;
  verifiedAt?: string;
  reason?: string;
}

export function isVerificationStatus(value: string): value is VerificationStatus {
  return (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export function isCompleteVerification(decision: VerificationDecision | undefined, opportunityId?: string): boolean {
  if (!decision) return false;
  if (opportunityId !== undefined && decision.opportunityId !== opportunityId) return false;
  if (decision.status !== 'verified') return false;
  if (!decision.reviewerRef || !decision.verifiedAt) return false;
  if (decision.evidenceRefs.length === 0 || decision.evidenceRefs.some((ref) => typeof ref !== 'string' || !ref.trim())) return false;

  return VERIFICATION_CHECKS.every((required) => {
    const check = decision.checks.find((candidate) => candidate.type === required);
    return Boolean(check && check.result === 'verified' && check.evidenceRefs.length > 0 && check.evidenceRefs.every((ref) => typeof ref === 'string' && ref.trim().length > 0));
  });
}

export function assertCompleteVerification(decision: VerificationDecision, opportunityId?: string): void {
  if (!isCompleteVerification(decision, opportunityId)) {
    throw new Error('Verification decision is not complete enough to mark an opportunity verified');
  }
}
