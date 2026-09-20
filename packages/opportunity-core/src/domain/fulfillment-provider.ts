export type FulfillmentProviderVerificationStatus =
  | 'unverified'
  | 'partially_verified'
  | 'verified'
  | 'rejected'

export type FulfillmentProviderStage =
  | 'discovered'
  | 'evidence_collected'
  | 'identity_verified'
  | 'capability_verified'
  | 'verified'
  | 'rejected'

export type FulfillmentProviderStructure =
  | 'prime'
  | 'subcontractor'
  | 'teaming_partner'
  | 'specialist_vendor'
  | 'supplier'
  | 'prime_support'

export type FulfillmentProviderIdentifierType =
  | 'uei'
  | 'cage'
  | 'sam_entity_id'
  | 'state_registration'
  | 'license_number'
  | 'other'

export type FulfillmentProviderIdentifier = {
  type: FulfillmentProviderIdentifierType
  value: string
  issuer?: string
  jurisdiction?: string
  verified: boolean
  evidenceRefs: string[]
}

export type FulfillmentProviderCapability = {
  id: string
  name: string
  description?: string
  naicsCodes: string[]
  pscCodes: string[]
  keywords: string[]
  confidence: number
  verified: boolean
  evidenceRefs: string[]
}

export type FulfillmentProviderCredentialKind =
  | 'license'
  | 'certification'
  | 'bond'
  | 'insurance'
  | 'socioeconomic'
  | 'registration'
  | 'clearance'
  | 'other'

export type FulfillmentProviderCredential = {
  id: string
  kind: FulfillmentProviderCredentialKind
  name: string
  issuer?: string
  jurisdiction?: string
  expiresAt?: string
  verified: boolean
  evidenceRefs: string[]
}

export type FulfillmentProviderServiceArea = {
  country?: string
  state?: string
  county?: string
  locality?: string
  serviceRadiusMiles?: number
  evidenceRefs: string[]
}

export type FulfillmentProviderPastPerformance = {
  id: string
  role: 'prime' | 'subcontractor' | 'supplier' | 'teaming_partner'
  customer: string
  agency?: string
  awardId?: string
  amount?: number
  currency?: string
  startedAt?: string
  endedAt?: string
  capabilityIds: string[]
  verified: boolean
  evidenceRefs: string[]
}

export type FulfillmentProviderCapacity = {
  status: 'unknown' | 'available' | 'limited' | 'unavailable'
  workforceSize?: number
  maxConcurrentProjects?: number
  notes?: string
  evidenceRefs: string[]
}

export type FulfillmentProviderEvidenceKind =
  | 'entity_record'
  | 'sam_registration'
  | 'award_record'
  | 'license_record'
  | 'insurance_record'
  | 'bond_record'
  | 'certification_record'
  | 'capability_record'
  | 'capacity_record'
  | 'official_source'
  | 'secondary_source'
  | 'user_supplied'
  | 'other'

export type FulfillmentProviderEvidenceRelationship =
  | 'supports_identity'
  | 'supports_capability'
  | 'supports_credential'
  | 'supports_past_performance'
  | 'supports_capacity'
  | 'supports_geography'
  | 'supports_eligibility'
  | 'other'

export type FulfillmentProviderEvidence = {
  id: string
  kind: FulfillmentProviderEvidenceKind
  relationship: FulfillmentProviderEvidenceRelationship
  sourceId: string
  sourceUrl?: string
  capturedAt: string
  confidence: number
}

export type FulfillmentProvider = {
  id: string
  legalName: string
  dbaName?: string
  website?: string
  identifiers: FulfillmentProviderIdentifier[]
  serviceAreas: FulfillmentProviderServiceArea[]
  capabilities: FulfillmentProviderCapability[]
  credentials: FulfillmentProviderCredential[]
  pastPerformance: FulfillmentProviderPastPerformance[]
  capacity: FulfillmentProviderCapacity
  evidence: FulfillmentProviderEvidence[]
  sourceIds: string[]
  verificationStatus: FulfillmentProviderVerificationStatus
  stage: FulfillmentProviderStage
  riskFlags: string[]
  createdAt: string
  updatedAt: string
}

export type FulfillmentProviderEngagementStatus =
  | 'candidate'
  | 'eligibility_checked'
  | 'commercial_review'
  | 'human_approved'
  | 'engagement_authorized'
  | 'rejected'

export type FulfillmentProviderEngagement = {
  id: string
  opportunityId: string
  providerId: string
  structure: FulfillmentProviderStructure
  status: FulfillmentProviderEngagementStatus
  eligibilityEvidenceRefs: string[]
  commercialEvidenceRefs: string[]
  approvalRef?: string
  reasons: string[]
  blockers: string[]
  createdAt: string
  updatedAt: string
  authorizedAt?: string
}

const PROVIDER_STAGE_TRANSITIONS: Record<FulfillmentProviderStage, FulfillmentProviderStage[]> = {
  discovered: ['evidence_collected', 'rejected'],
  evidence_collected: ['identity_verified', 'rejected'],
  identity_verified: ['capability_verified', 'rejected'],
  capability_verified: ['verified', 'rejected'],
  verified: ['rejected'],
  rejected: [],
}

const ENGAGEMENT_TRANSITIONS: Record<FulfillmentProviderEngagementStatus, FulfillmentProviderEngagementStatus[]> = {
  candidate: ['eligibility_checked', 'rejected'],
  eligibility_checked: ['commercial_review', 'rejected'],
  commercial_review: ['human_approved', 'rejected'],
  human_approved: ['engagement_authorized', 'rejected'],
  engagement_authorized: ['rejected'],
  rejected: [],
}

function clean(value: string): string {
  return value.trim()
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))]
}

function hasEvidence(provider: FulfillmentProvider, ref: string): boolean {
  return provider.evidence.some((item) => item.id === ref)
}

function evidenceSupports(
  provider: FulfillmentProvider,
  ref: string,
  relationship: FulfillmentProviderEvidenceRelationship,
): boolean {
  return provider.evidence.some((item) => item.id === ref && item.relationship === relationship)
}

function assertEvidenceRefsExist(provider: FulfillmentProvider, refs: string[], context: string): void {
  for (const ref of refs) {
    if (!hasEvidence(provider, ref)) throw new Error(`${context} references unknown evidence: ${ref}`)
  }
}

function identityIsVerified(provider: FulfillmentProvider): boolean {
  return provider.identifiers.some((identifier) =>
    identifier.verified &&
    identifier.value.trim().length > 0 &&
    identifier.evidenceRefs.length > 0 &&
    identifier.evidenceRefs.every((ref) => evidenceSupports(provider, ref, 'supports_identity')),
  )
}

function capabilityIsVerified(provider: FulfillmentProvider): boolean {
  return provider.capabilities.some((capability) =>
    capability.verified &&
    capability.evidenceRefs.length > 0 &&
    capability.evidenceRefs.every((ref) => evidenceSupports(provider, ref, 'supports_capability')),
  )
}

export function createFulfillmentProvider(
  input: Omit<FulfillmentProvider, 'verificationStatus' | 'stage' | 'createdAt' | 'updatedAt'>,
  now = new Date().toISOString(),
): FulfillmentProvider {
  if (!input.id.trim()) throw new Error('Fulfillment provider id is required')
  if (!input.legalName.trim()) throw new Error('Fulfillment provider legalName is required')

  const provider: FulfillmentProvider = {
    ...input,
    id: clean(input.id),
    legalName: clean(input.legalName),
    dbaName: input.dbaName ? clean(input.dbaName) : undefined,
    sourceIds: unique(input.sourceIds),
    riskFlags: unique(input.riskFlags),
    verificationStatus: 'unverified',
    stage: 'discovered',
    createdAt: now,
    updatedAt: now,
  }

  assertFulfillmentProviderIntegrity(provider)
  return provider
}

export function assertFulfillmentProviderIntegrity(provider: FulfillmentProvider): void {
  if (!provider.id.trim()) throw new Error('Fulfillment provider id is required')
  if (!provider.legalName.trim()) throw new Error('Fulfillment provider legalName is required')

  const evidenceIds = new Set<string>()
  for (const evidence of provider.evidence) {
    if (!evidence.id.trim()) throw new Error('Fulfillment provider evidence id is required')
    if (evidenceIds.has(evidence.id)) throw new Error(`Duplicate fulfillment provider evidence id: ${evidence.id}`)
    evidenceIds.add(evidence.id)
    if (evidence.confidence < 0 || evidence.confidence > 1) {
      throw new Error(`Evidence confidence must be between 0 and 1: ${evidence.id}`)
    }
  }

  for (const identifier of provider.identifiers) {
    if (!identifier.value.trim()) throw new Error(`Identifier value is required: ${identifier.type}`)
    assertEvidenceRefsExist(provider, identifier.evidenceRefs, `Identifier ${identifier.type}`)
    if (identifier.verified && !identifier.evidenceRefs.every((ref) => evidenceSupports(provider, ref, 'supports_identity'))) {
      throw new Error(`Verified identifier requires identity evidence: ${identifier.type}`)
    }
    if (identifier.verified && identifier.evidenceRefs.length === 0) {
      throw new Error(`Verified identifier requires evidence: ${identifier.type}`)
    }
  }

  const capabilityIds = new Set<string>()
  for (const capability of provider.capabilities) {
    if (!capability.id.trim()) throw new Error('Capability id is required')
    if (capabilityIds.has(capability.id)) throw new Error(`Duplicate fulfillment provider capability id: ${capability.id}`)
    capabilityIds.add(capability.id)
    if (capability.confidence < 0 || capability.confidence > 1) {
      throw new Error(`Capability confidence must be between 0 and 1: ${capability.id}`)
    }
    assertEvidenceRefsExist(provider, capability.evidenceRefs, `Capability ${capability.id}`)
    if (capability.verified && !capability.evidenceRefs.every((ref) => evidenceSupports(provider, ref, 'supports_capability'))) {
      throw new Error(`Verified capability requires capability evidence: ${capability.id}`)
    }
    if (capability.verified && capability.evidenceRefs.length === 0) {
      throw new Error(`Verified capability requires evidence: ${capability.id}`)
    }
  }

  for (const credential of provider.credentials) {
    assertEvidenceRefsExist(provider, credential.evidenceRefs, `Credential ${credential.id}`)
    if (credential.verified && !credential.evidenceRefs.every((ref) => evidenceSupports(provider, ref, 'supports_credential'))) {
      throw new Error(`Verified credential requires credential evidence: ${credential.id}`)
    }
    if (credential.verified && credential.evidenceRefs.length === 0) {
      throw new Error(`Verified credential requires evidence: ${credential.id}`)
    }
  }

  for (const performance of provider.pastPerformance) {
    assertEvidenceRefsExist(provider, performance.evidenceRefs, `Past performance ${performance.id}`)
    if (performance.verified && !performance.evidenceRefs.every((ref) => evidenceSupports(provider, ref, 'supports_past_performance'))) {
      throw new Error(`Verified past performance requires past-performance evidence: ${performance.id}`)
    }
    if (performance.verified && performance.evidenceRefs.length === 0) {
      throw new Error(`Verified past performance requires evidence: ${performance.id}`)
    }
  }

  for (const area of provider.serviceAreas) {
    assertEvidenceRefsExist(provider, area.evidenceRefs, 'Service area')
    if (!area.evidenceRefs.every((ref) => evidenceSupports(provider, ref, 'supports_geography'))) {
      throw new Error('Service area requires geography evidence')
    }
  }
  assertEvidenceRefsExist(provider, provider.capacity.evidenceRefs, 'Capacity')
  if (provider.capacity.evidenceRefs.length > 0 &&
      !provider.capacity.evidenceRefs.every((ref) => evidenceSupports(provider, ref, 'supports_capacity'))) {
    throw new Error('Capacity requires capacity evidence')
  }

  if (provider.stage === 'verified' && provider.verificationStatus !== 'verified') {
    throw new Error('Verified provider stage requires verified verificationStatus')
  }
  if (provider.verificationStatus === 'verified' && (!identityIsVerified(provider) || !capabilityIsVerified(provider))) {
    throw new Error('Verified provider requires evidence-backed identity and capability verification')
  }
  if (provider.stage === 'rejected' && provider.verificationStatus !== 'rejected') {
    throw new Error('Rejected provider stage requires rejected verificationStatus')
  }
}

export function advanceFulfillmentProviderStage(
  provider: FulfillmentProvider,
  nextStage: FulfillmentProviderStage,
  now = new Date().toISOString(),
): FulfillmentProvider {
  if (nextStage === provider.stage) return provider
  if (!PROVIDER_STAGE_TRANSITIONS[provider.stage].includes(nextStage)) {
    throw new Error(`Invalid fulfillment provider transition: ${provider.stage} -> ${nextStage}`)
  }

  if (nextStage === 'evidence_collected' && provider.evidence.length === 0) {
    throw new Error('Provider evidence is required before evidence_collected')
  }
  if (nextStage === 'identity_verified' && !identityIsVerified(provider)) {
    throw new Error('Evidence-backed verified provider identity is required before identity_verified')
  }
  if (nextStage === 'capability_verified' && !capabilityIsVerified(provider)) {
    throw new Error('Evidence-backed verified capability is required before capability_verified')
  }

  const verificationStatus: FulfillmentProviderVerificationStatus =
    nextStage === 'verified' ? 'verified' :
    nextStage === 'rejected' ? 'rejected' :
    nextStage === 'discovered' ? 'unverified' :
    'partially_verified'

  const advanced: FulfillmentProvider = {
    ...provider,
    stage: nextStage,
    verificationStatus,
    updatedAt: now,
  }

  assertFulfillmentProviderIntegrity(advanced)
  return advanced
}

export function isFulfillmentProviderVerified(provider: FulfillmentProvider): boolean {
  return provider.stage === 'verified' &&
    provider.verificationStatus === 'verified' &&
    identityIsVerified(provider) &&
    capabilityIsVerified(provider)
}

export function createFulfillmentProviderEngagement(
  input: Omit<FulfillmentProviderEngagement, 'status' | 'createdAt' | 'updatedAt' | 'authorizedAt'>,
  now = new Date().toISOString(),
): FulfillmentProviderEngagement {
  if (!input.id.trim() || !input.opportunityId.trim() || !input.providerId.trim()) {
    throw new Error('Engagement id, opportunityId, and providerId are required')
  }
  return {
    ...input,
    eligibilityEvidenceRefs: unique(input.eligibilityEvidenceRefs),
    commercialEvidenceRefs: unique(input.commercialEvidenceRefs),
    reasons: unique(input.reasons),
    blockers: unique(input.blockers),
    status: 'candidate',
    createdAt: now,
    updatedAt: now,
  }
}

export function advanceFulfillmentProviderEngagement(
  engagement: FulfillmentProviderEngagement,
  provider: FulfillmentProvider,
  nextStatus: FulfillmentProviderEngagementStatus,
  update: {
    eligibilityEvidenceRefs?: string[]
    commercialEvidenceRefs?: string[]
    approvalRef?: string
    reasons?: string[]
    blockers?: string[]
  } = {},
  now = new Date().toISOString(),
): FulfillmentProviderEngagement {
  if (provider.id !== engagement.providerId) throw new Error('Engagement provider does not match supplied provider')
  if (nextStatus === engagement.status) return engagement
  if (!ENGAGEMENT_TRANSITIONS[engagement.status].includes(nextStatus)) {
    throw new Error(`Invalid fulfillment provider engagement transition: ${engagement.status} -> ${nextStatus}`)
  }

  const next: FulfillmentProviderEngagement = {
    ...engagement,
    eligibilityEvidenceRefs: unique(update.eligibilityEvidenceRefs ?? engagement.eligibilityEvidenceRefs),
    commercialEvidenceRefs: unique(update.commercialEvidenceRefs ?? engagement.commercialEvidenceRefs),
    approvalRef: update.approvalRef?.trim() || engagement.approvalRef,
    reasons: unique([...(engagement.reasons ?? []), ...(update.reasons ?? [])]),
    blockers: unique([...(engagement.blockers ?? []), ...(update.blockers ?? [])]),
    status: nextStatus,
    updatedAt: now,
    authorizedAt: nextStatus === 'engagement_authorized' ? now : engagement.authorizedAt,
  }

  if (nextStatus === 'eligibility_checked' && next.eligibilityEvidenceRefs.length === 0) {
    throw new Error('Eligibility evidence is required before eligibility_checked')
  }
  if (nextStatus === 'commercial_review' && next.commercialEvidenceRefs.length === 0) {
    throw new Error('Commercial review evidence is required before commercial_review')
  }
  if (nextStatus === 'human_approved' && !next.approvalRef) {
    throw new Error('Human approval reference is required before human_approved')
  }
  if (nextStatus === 'engagement_authorized') {
    if (!isFulfillmentProviderVerified(provider)) {
      throw new Error('Provider must be verified before engagement authorization')
    }
    if (!next.approvalRef) throw new Error('Human approval reference is required before engagement authorization')
    if (next.blockers.length > 0) throw new Error('Engagement blockers must be resolved before authorization')
  }

  return next
}

export function isFulfillmentProviderEngagementAuthorized(
  engagement: FulfillmentProviderEngagement,
  provider: FulfillmentProvider,
): boolean {
  return engagement.providerId === provider.id &&
    engagement.status === 'engagement_authorized' &&
    Boolean(engagement.approvalRef) &&
    engagement.blockers.length === 0 &&
    isFulfillmentProviderVerified(provider)
}
