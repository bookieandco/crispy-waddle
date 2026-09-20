import type { EngagementLedger, EngagementLedgerEvent } from './engagement-ledger.js'
import type { ProviderOutreachPacket } from './provider-outreach.js'

export type ProviderNegotiationStatus =
  | 'awaiting_response'
  | 'response_received'
  | 'diligence'
  | 'negotiating'
  | 'provisional_terms'
  | 'declined'
  | 'closed'

export type ProviderClaimKind =
  | 'availability'
  | 'capacity'
  | 'capability'
  | 'credential'
  | 'eligibility'
  | 'pricing'
  | 'scope'
  | 'schedule'
  | 'commercial_term'
  | 'other'

export type ProviderClaimStatus = 'provider_asserted' | 'verified' | 'rejected' | 'superseded'

export type ProviderNegotiationClaim = {
  id: string
  kind: ProviderClaimKind
  value: string | number | boolean | string[]
  status: ProviderClaimStatus
  sourceMessageRef: string
  assertedAt: string
  evidenceRefs: string[]
  reviewRef?: string
  reviewedByRef?: string
  reviewedAt?: string
}

export type ProviderCounteroffer = {
  id: string
  sourceMessageRef: string
  capturedAt: string
  proposedProviderCost?: number
  proposedRequirementIds?: string[]
  scheduleNotes?: string
  commercialTerms: string[]
}

export type ProvisionalNegotiatedTerms = {
  counterofferId: string
  providerCost?: number
  requirementIds: string[]
  commercialTerms: string[]
  approvalRef: string
  approvedByRef: string
  approvedAt: string
  contractAuthority: false
  signatureAuthority: false
}

export type ProviderNegotiationState = {
  id: string
  opportunityId: string
  providerId: string
  packetId: string
  status: ProviderNegotiationStatus
  baseline: {
    role: ProviderOutreachPacket['role']
    requirementIds: string[]
    modeledProviderCost?: number
    commercialStructure: ProviderOutreachPacket['commercialSummary']['structure']
    modeledMarginPercent: number
    draftApprovalRef: string
  }
  claims: ProviderNegotiationClaim[]
  counteroffers: ProviderCounteroffer[]
  blockers: string[]
  openQuestions: string[]
  provisionalTerms?: ProvisionalNegotiatedTerms
  contractExecutionAuthorized: false
  signatureAuthorized: false
  createdAt: string
  updatedAt: string
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function responseEventFor(
  ledger: EngagementLedger,
  packet: ProviderOutreachPacket,
  messageRef: string,
): EngagementLedgerEvent {
  if (ledger.opportunityId !== packet.opportunityId || ledger.providerId !== packet.providerId) {
    throw new Error('Engagement ledger scope does not match outreach packet')
  }
  const event = ledger.events.find((item) =>
    item.type === 'provider_response_recorded' &&
    item.packetId === packet.id &&
    item.externalMessageRef === messageRef,
  )
  if (!event) throw new Error('Provider response must be recorded in the engagement ledger first')
  return event
}

export function createProviderNegotiationState(
  packet: ProviderOutreachPacket,
  now = new Date().toISOString(),
): ProviderNegotiationState {
  return {
    id: `${packet.id}:negotiation`,
    opportunityId: packet.opportunityId,
    providerId: packet.providerId,
    packetId: packet.id,
    status: 'awaiting_response',
    baseline: {
      role: packet.role,
      requirementIds: [...packet.requirementIds],
      modeledProviderCost: packet.commercialSummary.modeledProviderCost,
      commercialStructure: packet.commercialSummary.structure,
      modeledMarginPercent: packet.commercialSummary.modeledMarginPercent,
      draftApprovalRef: packet.approvalRef,
    },
    claims: [],
    counteroffers: [],
    blockers: [],
    openQuestions: [...packet.diligenceQuestions],
    contractExecutionAuthorized: false,
    signatureAuthorized: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function ingestProviderResponse(
  state: ProviderNegotiationState,
  packet: ProviderOutreachPacket,
  ledger: EngagementLedger,
  input: {
    messageRef: string
    claims?: Array<{ id: string; kind: ProviderClaimKind; value: ProviderNegotiationClaim['value']; evidenceRefs?: string[] }>
    counteroffer?: Omit<ProviderCounteroffer, 'sourceMessageRef' | 'capturedAt'>
    blockers?: string[]
    openQuestions?: string[]
  },
  now = new Date().toISOString(),
): ProviderNegotiationState {
  if (state.packetId !== packet.id || state.providerId !== packet.providerId || state.opportunityId !== packet.opportunityId) {
    throw new Error('Negotiation state does not match outreach packet')
  }
  responseEventFor(ledger, packet, input.messageRef)

  const knownClaimIds = new Set(state.claims.map((claim) => claim.id))
  const claims = [...state.claims]
  for (const raw of input.claims ?? []) {
    if (!raw.id.trim()) throw new Error('Provider claim id is required')
    if (knownClaimIds.has(raw.id)) throw new Error(`Duplicate provider claim id: ${raw.id}`)
    knownClaimIds.add(raw.id)
    claims.push({
      id: raw.id.trim(),
      kind: raw.kind,
      value: raw.value,
      status: 'provider_asserted',
      sourceMessageRef: input.messageRef,
      assertedAt: now,
      evidenceRefs: uniq(raw.evidenceRefs ?? []),
    })
  }

  const counteroffers = [...state.counteroffers]
  if (input.counteroffer) {
    if (counteroffers.some((offer) => offer.id === input.counteroffer!.id)) {
      throw new Error(`Duplicate provider counteroffer id: ${input.counteroffer.id}`)
    }
    const proposedCost = input.counteroffer.proposedProviderCost
    if (proposedCost !== undefined && (!Number.isFinite(proposedCost) || proposedCost < 0)) {
      throw new Error('Proposed provider cost must be a non-negative finite number')
    }
    counteroffers.push({
      ...input.counteroffer,
      proposedRequirementIds: input.counteroffer.proposedRequirementIds ? uniq(input.counteroffer.proposedRequirementIds) : undefined,
      commercialTerms: uniq(input.counteroffer.commercialTerms),
      sourceMessageRef: input.messageRef,
      capturedAt: now,
    })
  }

  return {
    ...state,
    status: counteroffers.length > state.counteroffers.length ? 'negotiating' : 'response_received',
    claims,
    counteroffers,
    blockers: uniq([...state.blockers, ...(input.blockers ?? [])]),
    openQuestions: uniq([...state.openQuestions, ...(input.openQuestions ?? [])]),
    updatedAt: now,
  }
}

export function reviewProviderClaim(
  state: ProviderNegotiationState,
  claimId: string,
  input: {
    decision: 'verified' | 'rejected'
    reviewRef: string
    reviewedByRef: string
    evidenceRefs?: string[]
  },
  now = new Date().toISOString(),
): ProviderNegotiationState {
  const reviewRef = input.reviewRef.trim()
  const reviewedByRef = input.reviewedByRef.trim()
  if (!reviewRef || !reviewedByRef) throw new Error('Claim review and reviewer references are required')

  let found = false
  const claims = state.claims.map((claim) => {
    if (claim.id !== claimId) return claim
    found = true
    if (claim.status !== 'provider_asserted') throw new Error('Only provider-asserted claims can be reviewed')
    const evidenceRefs = uniq([...(claim.evidenceRefs ?? []), ...(input.evidenceRefs ?? [])])
    if (input.decision === 'verified' && evidenceRefs.length === 0) {
      throw new Error('Evidence is required to verify a provider assertion')
    }
    return {
      ...claim,
      status: input.decision,
      evidenceRefs,
      reviewRef,
      reviewedByRef,
      reviewedAt: now,
    }
  })
  if (!found) throw new Error(`Unknown provider claim: ${claimId}`)

  return {
    ...state,
    status: state.status === 'response_received' ? 'diligence' : state.status,
    claims,
    updatedAt: now,
  }
}

export function supersedeProviderClaim(
  state: ProviderNegotiationState,
  claimId: string,
  now = new Date().toISOString(),
): ProviderNegotiationState {
  let found = false
  const claims = state.claims.map((claim) => {
    if (claim.id !== claimId) return claim
    found = true
    if (claim.status === 'superseded') return claim
    return { ...claim, status: 'superseded' as const, reviewedAt: now }
  })
  if (!found) throw new Error(`Unknown provider claim: ${claimId}`)
  return { ...state, claims, updatedAt: now }
}

export function acceptProvisionalTerms(
  state: ProviderNegotiationState,
  counterofferId: string,
  input: { approvalRef: string; approvedByRef: string },
  now = new Date().toISOString(),
): ProviderNegotiationState {
  if (state.blockers.length > 0) throw new Error('Negotiation blockers must be resolved before provisional terms')
  const unresolvedClaims = state.claims.filter((claim) => claim.status === 'provider_asserted')
  if (unresolvedClaims.length > 0) throw new Error('Provider assertions must be reviewed before provisional terms')
  const offer = state.counteroffers.find((item) => item.id === counterofferId)
  if (!offer) throw new Error(`Unknown provider counteroffer: ${counterofferId}`)
  const approvalRef = input.approvalRef.trim()
  const approvedByRef = input.approvedByRef.trim()
  if (!approvalRef || !approvedByRef) throw new Error('Provisional-term approval and approver references are required')

  return {
    ...state,
    status: 'provisional_terms',
    provisionalTerms: {
      counterofferId,
      providerCost: offer.proposedProviderCost,
      requirementIds: offer.proposedRequirementIds ?? [...state.baseline.requirementIds],
      commercialTerms: [...offer.commercialTerms],
      approvalRef,
      approvedByRef,
      approvedAt: now,
      contractAuthority: false,
      signatureAuthority: false,
    },
    updatedAt: now,
  }
}

export function resolveNegotiationBlocker(
  state: ProviderNegotiationState,
  blocker: string,
  now = new Date().toISOString(),
): ProviderNegotiationState {
  const target = blocker.trim()
  if (!target) throw new Error('Blocker is required')
  return { ...state, blockers: state.blockers.filter((item) => item !== target), updatedAt: now }
}

export function declineProviderNegotiation(
  state: ProviderNegotiationState,
  reason: string,
  now = new Date().toISOString(),
): ProviderNegotiationState {
  return {
    ...state,
    status: 'declined',
    blockers: uniq([...state.blockers, reason]),
    contractExecutionAuthorized: false,
    signatureAuthorized: false,
    updatedAt: now,
  }
}
