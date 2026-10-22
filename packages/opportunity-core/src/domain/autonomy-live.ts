import type { Opportunity } from './opportunity.js'
import type { CommercialAcceptanceReceipt, CommercialDeliveryReceipt, CommercialWorkOrder } from './side-hustle-commercial.js'
import type { OpportunityOutcome } from './outcome.js'
import { prepareInternalServicePilot, type ServicePilotInput } from './autonomy-pilot.js'

/** OCE-AUTONOMY.LIVE.07–.10: strictly internal research/delivery admission.
 * This module neither creates income nor confers outbound/application authority.
 */
export type OpportunityPilotSourceCheck = {
  id: string
  opportunityId: string
  sourceUrl: string
  evidenceId: string
  excerpt: string
  observedAt: string
  reviewedByOwner: boolean
}

export function verifyPilotEvidenceAgainstOpportunity(
  opportunity: Opportunity,
  observations: OpportunityPilotSourceCheck[],
): { admitted: OpportunityPilotSourceCheck[]; blockers: string[] } {
  const blockers: string[] = []
  const admitted: OpportunityPilotSourceCheck[] = []
  const seen = new Set<string>()
  if (!Array.isArray(observations) || observations.length > 50) throw new Error('pilot observations exceed bound')
  for (const row of observations) {
    const source = opportunity.evidence.find(e => e.id === row.evidenceId && e.sourceUrl === row.sourceUrl)
    const correct = row.opportunityId === opportunity.id && source && source.excerpt &&
      source.excerpt.trim() === row.excerpt.trim() && row.reviewedByOwner === true &&
      Number.isFinite(Date.parse(row.observedAt)) && Date.parse(row.observedAt) <= Date.now() &&
      Number.isFinite(Date.parse(source.capturedAt)) &&
      Date.parse(row.observedAt) >= Date.parse(source.capturedAt)
    if (!correct) {
      blockers.push('Observation lacks owner-reviewed canonical source/excerpt: ' + (row.id || 'unknown'))
      continue
    }
    if (seen.has(row.evidenceId)) { blockers.push('Repeated evidence ID: ' + row.evidenceId); continue }
    seen.add(row.evidenceId)
    admitted.push({ ...row })
  }
  return { admitted, blockers }
}

export function buildSourceBoundInternalPilot(input: {
  opportunity: Opportunity
  pilot: ServicePilotInput
  observations: OpportunityPilotSourceCheck[]
}) {
  const check = verifyPilotEvidenceAgainstOpportunity(input.opportunity, input.observations)
  const match = new Map(check.admitted.map(e => [e.sourceUrl, e]))
  const mismatch = input.pilot.evidence.some(e => {
    const row = match.get(e.sourceUrl)
    return !row || row.excerpt.trim() !== e.finding.trim() || e.observedAt !== row.observedAt
  })
  if (mismatch || check.blockers.length || input.pilot.evidence.length !== check.admitted.length) {
    return { admitted: false as const, blockers: [...check.blockers, ...(mismatch ? ['Report contains unsupported or altered observations'] : [])], draft: null, externalActionAuthorized: false as const }
  }
  const draft = prepareInternalServicePilot(input.pilot)
  return { admitted: draft.state === 'ready_for_owner_review', blockers: draft.checks.filter(c => !c.passed).map(c => c.name), draft, externalActionAuthorized: false as const }
}

export type InternalPilotQueueStage =
  | 'queued' | 'running' | 'owner_review' | 'blocked' | 'internal_complete' | 'cancelled'
export type InternalPilotQueueState = {
  id: string
  ownerId: string
  opportunityId: string
  stage: InternalPilotQueueStage
  attempt: number
  maxAttempts: number
  leaseToken?: string
  leaseUntil?: string
  lastError?: string
  receiptRefs: string[]
  version: number
}
export function decideInternalPilotTransition(input: {
  current: InternalPilotQueueState
  ownerId: string
  expectedVersion: number
  command: 'claim' | 'draft_ready' | 'review_accepted' | 'retry' | 'cancel' | 'fail'
  now: string
  leaseToken?: string
  receiptRef?: string
}): InternalPilotQueueState {
  const { current, command } = input
  if (current.ownerId !== input.ownerId || current.version !== input.expectedVersion) throw new Error('Owner/version mismatch')
  const at = Date.parse(input.now)
  if (!Number.isFinite(at)) throw new Error('Invalid transition time')
  if (['internal_complete','cancelled'].includes(current.stage)) throw new Error('Terminal pilot is immutable')
  const next = { ...current, receiptRefs: [...current.receiptRefs], version: current.version + 1 }
  if (command === 'cancel') { next.stage = 'cancelled'; delete next.leaseToken; delete next.leaseUntil; return next }
  if (command === 'claim') {
    if (!['queued','running'].includes(current.stage) || (current.stage === 'running' && Date.parse(current.leaseUntil ?? '') > at)) throw new Error('Pilot not claimable')
    if (current.attempt >= current.maxAttempts) throw new Error('Attempt cap reached')
    if (!input.leaseToken?.trim()) throw new Error('Lease token required')
    next.stage = 'running'
    next.attempt++
    next.leaseToken = input.leaseToken
    next.leaseUntil = new Date(at + 5 * 60_000).toISOString()
    return next
  }
  if (command === 'retry') {
    if (current.stage !== 'blocked' || current.attempt >= current.maxAttempts) throw new Error('Retry forbidden')
    next.stage = 'queued'
    return next
  }
  if (current.stage !== (command === 'review_accepted' ? 'owner_review' : 'running')) throw new Error('Invalid pilot transition')
  if (command !== 'review_accepted' && (!input.leaseToken || input.leaseToken !== current.leaseToken || Date.parse(current.leaseUntil ?? '') <= at)) throw new Error('Missing/expired lease')
  if (command === 'draft_ready' || command === 'review_accepted') {
    if (!input.receiptRef?.trim()) throw new Error('Independent evidence receipt is required')
    next.receiptRefs.push(input.receiptRef)
    next.stage = command === 'draft_ready' ? 'owner_review' : 'internal_complete'
  } else if (command === 'fail') { next.stage = 'blocked'; next.lastError = 'INTERNAL_PILOT_EXECUTION_FAILED' }
  delete next.leaseToken
  delete next.leaseUntil
  return next
}

export type PaidPilotEvidenceAssessment = {
  status: 'ready_for_independent_verification' | 'blocked'
  blockers: string[]
  recognizedRevenue: 0
  paymentRecorded: false
  authority: 'EVIDENCE_REVIEW_ONLY'
}
/** Never trusts arbitrary receipts as settled money. A distinct authenticated Money Core read is mandatory. */
export function reviewPaidPilotEvidence(input: {
  workOrder: CommercialWorkOrder
  delivery?: CommercialDeliveryReceipt
  acceptance?: CommercialAcceptanceReceipt
  outcome?: OpportunityOutcome
  moneyVerifiedByIndependentRead: boolean
}): PaidPilotEvidenceAssessment {
  const { workOrder, delivery, acceptance, outcome } = input
  const blockers: string[] = []
  if (!delivery || delivery.workOrderId !== workOrder.id || delivery.opportunityId !== workOrder.opportunityId) blockers.push('Delivery lineage absent or mismatched')
  if (!acceptance || acceptance.workOrderId !== workOrder.id || acceptance.customerRef !== workOrder.customerRef ||
    acceptance.decision !== 'accepted') blockers.push('Actual customer acceptance missing or mismatched')
  if (!outcome || outcome.opportunityId !== workOrder.opportunityId || outcome.sourceOwner !== 'money_core' ||
    outcome.result !== 'won' || outcome.grossRevenue <= 0 || !outcome.transactionRefs?.length) blockers.push('Money Core transaction-grounded outcome missing')
  if (outcome && outcome.currency !== workOrder.price.currency) blockers.push('Currency mismatch')
  if (!input.moneyVerifiedByIndependentRead) blockers.push('Independent Money Core verification not available')
  return {
    status: blockers.length ? 'blocked' : 'ready_for_independent_verification',
    blockers,
    recognizedRevenue: 0,
    paymentRecorded: false,
    authority: 'EVIDENCE_REVIEW_ONLY',
  }
}
