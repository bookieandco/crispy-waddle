export type PrivacyRequestKind = 'data-broker-opt-out' | 'data-deletion' | 'collector-contact' | 'credit-dispute';
export type PrivacyRequestStatus = 'draft' | 'pending_approval' | 'submitted' | 'verified' | 'rejected';

export type PrivacyDefenseRequest = {
  id: string;
  userId: string;
  kind: PrivacyRequestKind;
  organization: string;
  target: string;
  status: PrivacyRequestStatus;
  createdAt: string;
  submittedAt?: string;
  verifiedAt?: string;
  evidenceRefs: string[];
  notes?: string;
};

export function createPrivacyDefenseRequest(input: Omit<PrivacyDefenseRequest, 'id' | 'createdAt' | 'status'>): PrivacyDefenseRequest {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'draft' };
}

export function prepareForSubmission(request: PrivacyDefenseRequest): PrivacyDefenseRequest {
  if (request.status !== 'draft') throw new Error(`PRIVACY_REQUEST_NOT_DRAFT:${request.id}`);
  return { ...request, status: 'pending_approval' };
}

export function markSubmitted(request: PrivacyDefenseRequest): PrivacyDefenseRequest {
  if (request.status !== 'pending_approval') throw new Error(`PRIVACY_REQUEST_NOT_APPROVED:${request.id}`);
  return { ...request, status: 'submitted', submittedAt: new Date().toISOString() };
}

export function verifyRemoval(request: PrivacyDefenseRequest): PrivacyDefenseRequest {
  if (request.status !== 'submitted') throw new Error(`PRIVACY_REQUEST_NOT_SUBMITTED:${request.id}`);
  return { ...request, status: 'verified', verifiedAt: new Date().toISOString() };
}
