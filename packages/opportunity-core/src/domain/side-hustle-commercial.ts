import type { FulfillmentPlan } from './fulfillment-plan.js'
import { calculateOpportunityOutcome, type OpportunityOutcome, type OpportunityOutcomeSourceOwner } from './outcome.js'
import type { Opportunity } from './opportunity.js'
import {
  isSideHustleProfile,
  type SideHustleFamily,
} from './side-hustles.js'

export type CommercialWorkOrderStatus =
  | 'draft'
  | 'scope_locked'
  | 'delivery_in_progress'
  | 'delivered'
  | 'revision_required'
  | 'accepted'
  | 'cancelled'

export type CommercialWorkOrderPriceCadence =
  | 'one_time'
  | 'project'
  | 'hourly'
  | 'per_unit'
  | 'monthly'

export type CommercialWorkOrderScopeItem = {
  id: string
  title: string
  description: string
  evidenceRefs: string[]
}

export type CommercialWorkOrderAcceptanceCriterion = {
  id: string
  description: string
  required: boolean
}

export type CommercialWorkOrder = {
  id: string
  opportunityId: string
  ventureId?: string
  family: SideHustleFamily
  customerRef: string
  title: string
  outcomePromise: string
  scopeItems: CommercialWorkOrderScopeItem[]
  acceptanceCriteria: CommercialWorkOrderAcceptanceCriterion[]
  price: {
    amount: number
    currency: string
    cadence: CommercialWorkOrderPriceCadence
  }
  executionOwners: string[]
  evidenceRefs: string[]
  status: CommercialWorkOrderStatus
  scopeLockedAt?: string
  startedAt?: string
  deliveredAt?: string
  acceptedAt?: string
  createdAt: string
  updatedAt: string
  authority: 'COMMERCIAL_SCOPE_ONLY'
  externalActionAuthorized: false
  paymentAuthorized: false
  signatureAuthorized: false
}

export type CommercialDeliveryStartReceipt = {
  id: string
  workOrderId: string
  opportunityId: string
  executionOwner: string
  executionRef: string
  evidenceRefs: string[]
  startedAt: string
  authority: 'OBSERVATION_ONLY'
  externalActionAuthorized: false
}

export type CommercialDeliveryReceipt = {
  id: string
  workOrderId: string
  opportunityId: string
  executionOwner: string
  executionRef: string
  deliveryRef: string
  deliverableRefs: string[]
  evidenceRefs: string[]
  deliveredAt: string
  authority: 'OBSERVATION_ONLY'
  externalActionAuthorized: false
}

export type CommercialAcceptanceDecision =
  | 'accepted'
  | 'revision_required'
  | 'rejected'

export type CommercialAcceptanceReceipt = {
  id: string
  workOrderId: string
  opportunityId: string
  deliveryReceiptId: string
  customerRef: string
  decision: CommercialAcceptanceDecision
  criteriaMet: string[]
  criteriaMissed: string[]
  evidenceRefs: string[]
  note?: string
  observedAt: string
  authority: 'CUSTOMER_EVIDENCE_ONLY'
  externalActionAuthorized: false
  paymentAuthorized: false
}

export type CommercialServiceOutcomeBridge = {
  workOrderId: string
  acceptanceReceiptId: string
  outcome: OpportunityOutcome
  authority: 'CANONICAL_OUTCOME_INPUT_ONLY'
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}

export type CommercialDeliveryRouteTargetType =
  | 'execution_owner'
  | 'fulfillment_provider'

export type CommercialDeliveryRouteAssignment = {
  id: string
  targetType: CommercialDeliveryRouteTargetType
  targetRef: string
  role: 'lead' | 'support' | 'provider'
  scopeItemIds: string[]
  evidenceRefs: string[]
  assignmentAuthorized: false
}

export type CommercialDeliveryRoutingPlan = {
  id: string
  workOrderId: string
  opportunityId: string
  family: SideHustleFamily
  assignments: CommercialDeliveryRouteAssignment[]
  unresolvedScopeItemIds: string[]
  blockers: string[]
  evidenceRefs: string[]
  createdAt: string
  authority: 'ROUTING_PLAN_ONLY'
  requiresApproval: true
  assignmentAuthorized: false
  externalActionAuthorized: false
}

export type SideHustleCommercialSoftwareEvidence = {
  workOrderBound: boolean
  deliveryAcceptanceBound: boolean
  canonicalOutcomeBridgeBound: boolean
  operatorRoutingBound: boolean
  canonicalOutcomeAuthorityPreserved: boolean
  actionAuthorityExternal: boolean
  moneyAuthorityExternal: boolean
  automaticMaturityPromotionDisabled: boolean
  duplicateAuthorityPaths: number
}

export type SideHustleCommercialLiveEvidence = {
  lockedWorkOrders: number
  observedDeliveries: number
  acceptedDeliveries: number
  realizedPaidOutcomes: number
  routingPlans: number
  unauthorizedExternalActions: number
  unauthorizedPayments: number
  automaticMaturityPromotions: number
}

export type SideHustleCommercialCertificationPhaseStatus =
  | 'pass'
  | 'blocked'
  | 'not_applicable'

export type SideHustleCommercialCertification = {
  family: SideHustleFamily
  softwareStatus: SideHustleCommercialCertificationPhaseStatus
  liveStatus: SideHustleCommercialCertificationPhaseStatus
  status: SideHustleCommercialCertificationPhaseStatus
  blockers: string[]
  externalActionAuthorized: false
  moneyMovementAuthorized: false
  automaticMaturityPromotionAuthorized: false
}

export function createCommercialWorkOrder(input: {
  opportunity: Opportunity
  id: string
  ventureId?: string
  customerRef: string
  title: string
  outcomePromise: string
  scopeItems: CommercialWorkOrderScopeItem[]
  acceptanceCriteria: CommercialWorkOrderAcceptanceCriterion[]
  price: {
    amount: number
    currency: string
    cadence: CommercialWorkOrderPriceCadence
  }
  evidenceRefs: string[]
  createdAt: string
}): CommercialWorkOrder {
  const profile = input.opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile)) throw new Error('Commercial work order requires a canonical sideHustleProfile')
  if (profile.role === 'capability' || profile.family === 'trading_investing_intelligence') {
    throw new Error('Capability-only Side Hustle families do not receive commercial work orders')
  }
  if (!['ready', 'approved', 'pursuing'].includes(input.opportunity.status)) {
    throw new Error(`Commercial work order requires a ready or active Opportunity, got ${input.opportunity.status}`)
  }

  requireText(input.id, 'workOrder.id')
  requireText(input.customerRef, 'workOrder.customerRef')
  requireText(input.title, 'workOrder.title')
  requireText(input.outcomePromise, 'workOrder.outcomePromise')
  requireDate(input.createdAt, 'workOrder.createdAt')
  requireEvidence(input.evidenceRefs, 'commercial work order')
  if (!Number.isFinite(input.price.amount) || input.price.amount < 0) {
    throw new Error('workOrder.price.amount must be a finite non-negative number')
  }
  requireText(input.price.currency, 'workOrder.price.currency')
  if (!['one_time', 'project', 'hourly', 'per_unit', 'monthly'].includes(input.price.cadence)) {
    throw new Error('workOrder.price.cadence is invalid')
  }

  const scopeItems = validateScopeItems(input.scopeItems)
  const acceptanceCriteria = validateAcceptanceCriteria(input.acceptanceCriteria)

  return {
    id: input.id.trim(),
    opportunityId: input.opportunity.id,
    ventureId: input.ventureId?.trim() || undefined,
    family: profile.family,
    customerRef: input.customerRef.trim(),
    title: input.title.trim(),
    outcomePromise: input.outcomePromise.trim(),
    scopeItems,
    acceptanceCriteria,
    price: {
      amount: roundMoney(input.price.amount),
      currency: input.price.currency.trim().toUpperCase(),
      cadence: input.price.cadence,
    },
    executionOwners: unique(profile.executionOwners),
    evidenceRefs: unique(input.evidenceRefs),
    status: 'draft',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    authority: 'COMMERCIAL_SCOPE_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
    signatureAuthorized: false,
  }
}

export function lockCommercialWorkOrderScope(input: {
  workOrder: CommercialWorkOrder
  evidenceRefs: string[]
  lockedAt: string
}): CommercialWorkOrder {
  if (input.workOrder.status !== 'draft') throw new Error('Only draft work orders may lock scope')
  requireEvidence(input.evidenceRefs, 'scope lock')
  requireDate(input.lockedAt, 'scopeLockedAt')

  return {
    ...cloneWorkOrder(input.workOrder),
    evidenceRefs: unique([...input.workOrder.evidenceRefs, ...input.evidenceRefs]),
    status: 'scope_locked',
    scopeLockedAt: input.lockedAt,
    updatedAt: input.lockedAt,
  }
}

export function recordCommercialDeliveryStart(input: {
  workOrder: CommercialWorkOrder
  receiptId: string
  executionOwner: string
  executionRef: string
  evidenceRefs: string[]
  startedAt: string
}): {
  workOrder: CommercialWorkOrder
  receipt: CommercialDeliveryStartReceipt
} {
  if (!['scope_locked', 'revision_required'].includes(input.workOrder.status)) {
    throw new Error('Commercial delivery can only start from scope_locked or revision_required')
  }
  requireText(input.receiptId, 'deliveryStart.receiptId')
  requireText(input.executionOwner, 'deliveryStart.executionOwner')
  requireText(input.executionRef, 'deliveryStart.executionRef')
  requireEvidence(input.evidenceRefs, 'delivery start')
  requireDate(input.startedAt, 'deliveryStart.startedAt')
  if (!input.workOrder.executionOwners.includes(input.executionOwner.trim())) {
    throw new Error('Commercial delivery execution owner is not registered on the Side Hustle profile')
  }

  const receipt: CommercialDeliveryStartReceipt = {
    id: input.receiptId.trim(),
    workOrderId: input.workOrder.id,
    opportunityId: input.workOrder.opportunityId,
    executionOwner: input.executionOwner.trim(),
    executionRef: input.executionRef.trim(),
    evidenceRefs: unique(input.evidenceRefs),
    startedAt: input.startedAt,
    authority: 'OBSERVATION_ONLY',
    externalActionAuthorized: false,
  }

  return {
    workOrder: {
      ...cloneWorkOrder(input.workOrder),
      status: 'delivery_in_progress',
      startedAt: input.startedAt,
      updatedAt: input.startedAt,
    },
    receipt,
  }
}

export function recordCommercialDelivery(input: {
  workOrder: CommercialWorkOrder
  startReceipt: CommercialDeliveryStartReceipt
  receiptId: string
  deliveryRef: string
  deliverableRefs: string[]
  evidenceRefs: string[]
  deliveredAt: string
}): {
  workOrder: CommercialWorkOrder
  receipt: CommercialDeliveryReceipt
} {
  if (input.workOrder.status !== 'delivery_in_progress') {
    throw new Error('Commercial delivery receipt requires delivery_in_progress')
  }
  if (
    input.startReceipt.workOrderId !== input.workOrder.id ||
    input.startReceipt.opportunityId !== input.workOrder.opportunityId
  ) {
    throw new Error('Commercial delivery start receipt does not match the work order')
  }
  requireText(input.receiptId, 'delivery.receiptId')
  requireText(input.deliveryRef, 'delivery.deliveryRef')
  requireEvidence(input.deliverableRefs, 'delivery deliverables')
  requireEvidence(input.evidenceRefs, 'delivery evidence')
  requireDate(input.deliveredAt, 'delivery.deliveredAt')
  if (Date.parse(input.deliveredAt) < Date.parse(input.startReceipt.startedAt)) {
    throw new Error('Commercial delivery cannot predate delivery start')
  }

  const receipt: CommercialDeliveryReceipt = {
    id: input.receiptId.trim(),
    workOrderId: input.workOrder.id,
    opportunityId: input.workOrder.opportunityId,
    executionOwner: input.startReceipt.executionOwner,
    executionRef: input.startReceipt.executionRef,
    deliveryRef: input.deliveryRef.trim(),
    deliverableRefs: unique(input.deliverableRefs),
    evidenceRefs: unique(input.evidenceRefs),
    deliveredAt: input.deliveredAt,
    authority: 'OBSERVATION_ONLY',
    externalActionAuthorized: false,
  }

  return {
    workOrder: {
      ...cloneWorkOrder(input.workOrder),
      status: 'delivered',
      deliveredAt: input.deliveredAt,
      updatedAt: input.deliveredAt,
    },
    receipt,
  }
}

export function recordCommercialAcceptance(input: {
  workOrder: CommercialWorkOrder
  deliveryReceipt: CommercialDeliveryReceipt
  receiptId: string
  customerRef: string
  decision: CommercialAcceptanceDecision
  criteriaMet: string[]
  criteriaMissed: string[]
  evidenceRefs: string[]
  note?: string
  observedAt: string
}): {
  workOrder: CommercialWorkOrder
  receipt: CommercialAcceptanceReceipt
} {
  if (input.workOrder.status !== 'delivered') {
    throw new Error('Commercial acceptance requires a delivered work order')
  }
  if (
    input.deliveryReceipt.workOrderId !== input.workOrder.id ||
    input.deliveryReceipt.opportunityId !== input.workOrder.opportunityId
  ) {
    throw new Error('Commercial acceptance delivery receipt does not match the work order')
  }
  requireText(input.receiptId, 'acceptance.receiptId')
  requireText(input.customerRef, 'acceptance.customerRef')
  requireEvidence(input.evidenceRefs, 'customer acceptance')
  requireDate(input.observedAt, 'acceptance.observedAt')
  if (input.customerRef.trim() !== input.workOrder.customerRef) {
    throw new Error('Commercial acceptance customer does not match the work order')
  }
  if (!['accepted', 'revision_required', 'rejected'].includes(input.decision)) {
    throw new Error('Commercial acceptance decision is invalid')
  }

  const criterionIds = new Set(input.workOrder.acceptanceCriteria.map((criterion) => criterion.id))
  const met = unique(input.criteriaMet)
  const missed = unique(input.criteriaMissed)
  for (const id of [...met, ...missed]) {
    if (!criterionIds.has(id)) throw new Error(`Unknown commercial acceptance criterion: ${id}`)
  }
  if (met.some((id) => missed.includes(id))) {
    throw new Error('Commercial acceptance criterion cannot be both met and missed')
  }
  const required = input.workOrder.acceptanceCriteria
    .filter((criterion) => criterion.required)
    .map((criterion) => criterion.id)
  if (input.decision === 'accepted') {
    const missingRequired = required.filter((id) => !met.includes(id))
    if (missingRequired.length > 0 || required.some((id) => missed.includes(id))) {
      throw new Error('Accepted commercial delivery must satisfy every required acceptance criterion')
    }
  }

  const nextStatus: CommercialWorkOrderStatus =
    input.decision === 'accepted'
      ? 'accepted'
      : input.decision === 'revision_required'
        ? 'revision_required'
        : 'cancelled'

  const receipt: CommercialAcceptanceReceipt = {
    id: input.receiptId.trim(),
    workOrderId: input.workOrder.id,
    opportunityId: input.workOrder.opportunityId,
    deliveryReceiptId: input.deliveryReceipt.id,
    customerRef: input.customerRef.trim(),
    decision: input.decision,
    criteriaMet: met,
    criteriaMissed: missed,
    evidenceRefs: unique(input.evidenceRefs),
    note: input.note?.trim() || undefined,
    observedAt: input.observedAt,
    authority: 'CUSTOMER_EVIDENCE_ONLY',
    externalActionAuthorized: false,
    paymentAuthorized: false,
  }

  return {
    workOrder: {
      ...cloneWorkOrder(input.workOrder),
      status: nextStatus,
      acceptedAt: input.decision === 'accepted' ? input.observedAt : undefined,
      updatedAt: input.observedAt,
    },
    receipt,
  }
}

export function linkCanonicalCommercialOutcome(input: {
  workOrder: CommercialWorkOrder
  acceptanceReceipt: CommercialAcceptanceReceipt
  outcome: OpportunityOutcome
}): CommercialServiceOutcomeBridge {
  if (input.outcome.opportunityId !== input.workOrder.opportunityId) {
    throw new Error('Canonical outcome does not belong to the commercial work order Opportunity')
  }
  if (input.acceptanceReceipt.workOrderId !== input.workOrder.id) {
    throw new Error('Commercial acceptance receipt does not belong to the work order')
  }
  if (input.outcome.result === 'won') {
    if (input.workOrder.status !== 'accepted' || input.acceptanceReceipt.decision !== 'accepted') {
      throw new Error('Won canonical commercial outcome requires accepted customer delivery evidence')
    }
    if (input.outcome.grossRevenue <= 0) {
      throw new Error('Won canonical commercial outcome requires positive realized revenue')
    }
  }
  if (input.outcome.result === 'lost' && input.acceptanceReceipt.decision === 'accepted') {
    throw new Error('Accepted delivery cannot link to a lost canonical commercial outcome')
  }

  return {
    workOrderId: input.workOrder.id,
    acceptanceReceiptId: input.acceptanceReceipt.id,
    outcome: { ...input.outcome, evidenceRefs: [...input.outcome.evidenceRefs], transactionRefs: [...(input.outcome.transactionRefs ?? [])] },
    authority: 'CANONICAL_OUTCOME_INPUT_ONLY',
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

export function buildCommercialServiceOutcome(input: {
  opportunity: Opportunity
  workOrder: CommercialWorkOrder
  acceptanceReceipt: CommercialAcceptanceReceipt
  id: string
  result: 'won' | 'lost'
  currency?: string
  grossRevenue: number
  refunds?: number
  directCosts: number
  fees?: number
  hours: number
  sourceOwner: OpportunityOutcomeSourceOwner
  evidenceRefs: string[]
  transactionRefs?: string[]
  actionRef?: string
  executionRef?: string
  observedAt: string
  notes?: string
}): CommercialServiceOutcomeBridge {
  if (input.workOrder.opportunityId !== input.opportunity.id) {
    throw new Error('Commercial work order does not belong to the Opportunity')
  }
  if (input.acceptanceReceipt.workOrderId !== input.workOrder.id) {
    throw new Error('Commercial acceptance receipt does not belong to the work order')
  }
  if (input.result === 'won') {
    if (input.workOrder.status !== 'accepted' || input.acceptanceReceipt.decision !== 'accepted') {
      throw new Error('Won commercial outcome requires accepted customer delivery evidence')
    }
    if (!Number.isFinite(input.grossRevenue) || input.grossRevenue <= 0) {
      throw new Error('Won commercial outcome requires positive realized revenue')
    }
  }
  if (input.result === 'lost' && input.acceptanceReceipt.decision === 'accepted') {
    throw new Error('Accepted delivery cannot be recorded as a lost commercial outcome')
  }

  const outcome = calculateOpportunityOutcome({
    id: input.id,
    opportunityId: input.opportunity.id,
    result: input.result,
    currency: input.currency?.trim() || input.workOrder.price.currency,
    grossRevenue: input.grossRevenue,
    refunds: input.refunds,
    directCosts: input.directCosts,
    fees: input.fees,
    hours: input.hours,
    sourceOwner: input.sourceOwner,
    evidenceRefs: unique([
      ...input.workOrder.evidenceRefs,
      ...input.acceptanceReceipt.evidenceRefs,
      ...input.evidenceRefs,
    ]),
    transactionRefs: unique(input.transactionRefs ?? []),
    actionRef: input.actionRef,
    executionRef: input.executionRef,
    observedAt: input.observedAt,
    notes: input.notes,
  })

  return linkCanonicalCommercialOutcome({
    workOrder: input.workOrder,
    acceptanceReceipt: input.acceptanceReceipt,
    outcome,
  })
}

export function buildCommercialDeliveryRouting(input: {
  workOrder: CommercialWorkOrder
  ownerAssignments?: Array<{
    executionOwner: string
    scopeItemIds: string[]
    evidenceRefs: string[]
    role?: 'lead' | 'support'
  }>
  fulfillmentPlan?: FulfillmentPlan
  providerScopeItemIds?: Record<string, string[]>
  evidenceRefs: string[]
  createdAt: string
}): CommercialDeliveryRoutingPlan {
  if (!['scope_locked', 'revision_required'].includes(input.workOrder.status)) {
    throw new Error('Commercial delivery routing requires a scope-locked or revision-required work order')
  }
  requireEvidence(input.evidenceRefs, 'commercial routing')
  requireDate(input.createdAt, 'commercial routing createdAt')

  const scopeIds = new Set(input.workOrder.scopeItems.map((item) => item.id))
  const assignments: CommercialDeliveryRouteAssignment[] = []
  const blockers: string[] = []

  for (const ownerAssignment of input.ownerAssignments ?? []) {
    const executionOwner = ownerAssignment.executionOwner.trim()
    if (!input.workOrder.executionOwners.includes(executionOwner)) {
      throw new Error(`Commercial routing execution owner is not registered: ${executionOwner}`)
    }
    const itemIds = validateScopeAssignmentIds(ownerAssignment.scopeItemIds, scopeIds)
    requireEvidence(ownerAssignment.evidenceRefs, `commercial routing owner ${executionOwner}`)
    assignments.push({
      id: `${input.workOrder.id}:owner:${executionOwner}`,
      targetType: 'execution_owner',
      targetRef: executionOwner,
      role: ownerAssignment.role ?? (assignments.length === 0 ? 'lead' : 'support'),
      scopeItemIds: itemIds,
      evidenceRefs: unique(ownerAssignment.evidenceRefs),
      assignmentAuthorized: false,
    })
  }

  if (input.fulfillmentPlan) {
    if (input.fulfillmentPlan.opportunityId !== input.workOrder.opportunityId) {
      throw new Error('Fulfillment plan does not belong to the commercial work order Opportunity')
    }
    blockers.push(...input.fulfillmentPlan.blockers)
    if (input.fulfillmentPlan.uncoveredRequirementIds.length > 0) {
      blockers.push('Referenced fulfillment plan has uncovered required requirements.')
    }
    for (const provider of input.fulfillmentPlan.assignments) {
      const itemIds = validateScopeAssignmentIds(
        input.providerScopeItemIds?.[provider.providerId] ?? [],
        scopeIds,
      )
      if (itemIds.length === 0) {
        blockers.push(`Provider ${provider.providerId} has no mapped commercial scope items.`)
        continue
      }
      assignments.push({
        id: `${input.workOrder.id}:provider:${provider.providerId}`,
        targetType: 'fulfillment_provider',
        targetRef: provider.providerId,
        role: 'provider',
        scopeItemIds: itemIds,
        evidenceRefs: unique(provider.evidenceRefs),
        assignmentAuthorized: false,
      })
    }
  }

  if (assignments.length === 0) blockers.push('Commercial delivery routing has no owner or provider assignments.')

  const covered = new Set(assignments.flatMap((assignment) => assignment.scopeItemIds))
  const unresolvedScopeItemIds = [...scopeIds].filter((id) => !covered.has(id))
  if (unresolvedScopeItemIds.length > 0) {
    blockers.push(`Unresolved commercial scope items: ${unresolvedScopeItemIds.join(', ')}`)
  }

  return {
    id: `${input.workOrder.id}:routing`,
    workOrderId: input.workOrder.id,
    opportunityId: input.workOrder.opportunityId,
    family: input.workOrder.family,
    assignments,
    unresolvedScopeItemIds,
    blockers: unique(blockers),
    evidenceRefs: unique([
      ...input.workOrder.evidenceRefs,
      ...input.evidenceRefs,
      ...assignments.flatMap((assignment) => assignment.evidenceRefs),
    ]),
    createdAt: input.createdAt,
    authority: 'ROUTING_PLAN_ONLY',
    requiresApproval: true,
    assignmentAuthorized: false,
    externalActionAuthorized: false,
  }
}

export function certifySideHustleCommercialFamily(input: {
  family: SideHustleFamily
  software: SideHustleCommercialSoftwareEvidence
  live: SideHustleCommercialLiveEvidence
}): SideHustleCommercialCertification {
  if (input.family === 'trading_investing_intelligence') {
    return {
      family: input.family,
      softwareStatus: 'not_applicable',
      liveStatus: 'not_applicable',
      status: 'not_applicable',
      blockers: ['Trading / Investing Intelligence is capability-only and has no standalone commercial Side Hustle certification.'],
      externalActionAuthorized: false,
      moneyMovementAuthorized: false,
      automaticMaturityPromotionAuthorized: false,
    }
  }

  const blockers: string[] = []
  const softwareStatus: SideHustleCommercialCertificationPhaseStatus =
    input.software.workOrderBound &&
    input.software.deliveryAcceptanceBound &&
    input.software.canonicalOutcomeBridgeBound &&
    input.software.operatorRoutingBound &&
    input.software.canonicalOutcomeAuthorityPreserved &&
    input.software.actionAuthorityExternal &&
    input.software.moneyAuthorityExternal &&
    input.software.automaticMaturityPromotionDisabled &&
    input.software.duplicateAuthorityPaths === 0
      ? 'pass'
      : 'blocked'

  if (softwareStatus === 'blocked') blockers.push('Commercial software boundaries are incomplete or duplicate authority exists.')

  if (input.live.lockedWorkOrders < 1) blockers.push('No scope-locked commercial work order evidence exists.')
  if (input.live.routingPlans < 1) blockers.push('No commercial delivery routing plan evidence exists.')
  if (input.live.observedDeliveries < 1) blockers.push('No observed commercial delivery evidence exists.')
  if (input.live.acceptedDeliveries < 1) blockers.push('No customer-accepted commercial delivery evidence exists.')
  if (input.live.realizedPaidOutcomes < 1) blockers.push('No realized paid commercial outcome evidence exists.')
  if (input.live.unauthorizedExternalActions > 0) blockers.push('Unauthorized external action evidence exists.')
  if (input.live.unauthorizedPayments > 0) blockers.push('Unauthorized payment evidence exists.')
  if (input.live.automaticMaturityPromotions > 0) blockers.push('Automatic maturity promotion evidence exists.')

  const liveStatus: SideHustleCommercialCertificationPhaseStatus =
    input.live.lockedWorkOrders >= 1 &&
    input.live.routingPlans >= 1 &&
    input.live.observedDeliveries >= 1 &&
    input.live.acceptedDeliveries >= 1 &&
    input.live.realizedPaidOutcomes >= 1 &&
    input.live.unauthorizedExternalActions === 0 &&
    input.live.unauthorizedPayments === 0 &&
    input.live.automaticMaturityPromotions === 0
      ? 'pass'
      : 'blocked'

  const status: SideHustleCommercialCertificationPhaseStatus =
    softwareStatus === 'pass' && liveStatus === 'pass' ? 'pass' : 'blocked'

  return {
    family: input.family,
    softwareStatus,
    liveStatus,
    status,
    blockers: unique(blockers),
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
    automaticMaturityPromotionAuthorized: false,
  }
}

function validateScopeItems(items: CommercialWorkOrderScopeItem[]): CommercialWorkOrderScopeItem[] {
  if (!items.length) throw new Error('Commercial work order requires at least one scope item')
  const ids = new Set<string>()
  return items.map((item) => {
    requireText(item.id, 'scopeItem.id')
    requireText(item.title, 'scopeItem.title')
    requireText(item.description, 'scopeItem.description')
    requireEvidence(item.evidenceRefs, `scope item ${item.id}`)
    const id = item.id.trim()
    if (ids.has(id)) throw new Error(`Duplicate commercial scope item id: ${id}`)
    ids.add(id)
    return {
      id,
      title: item.title.trim(),
      description: item.description.trim(),
      evidenceRefs: unique(item.evidenceRefs),
    }
  })
}

function validateAcceptanceCriteria(
  criteria: CommercialWorkOrderAcceptanceCriterion[],
): CommercialWorkOrderAcceptanceCriterion[] {
  if (!criteria.length) throw new Error('Commercial work order requires acceptance criteria')
  const ids = new Set<string>()
  return criteria.map((criterion) => {
    requireText(criterion.id, 'acceptanceCriterion.id')
    requireText(criterion.description, 'acceptanceCriterion.description')
    const id = criterion.id.trim()
    if (ids.has(id)) throw new Error(`Duplicate commercial acceptance criterion id: ${id}`)
    ids.add(id)
    return {
      id,
      description: criterion.description.trim(),
      required: Boolean(criterion.required),
    }
  })
}

function validateScopeAssignmentIds(values: string[], scopeIds: Set<string>): string[] {
  const ids = unique(values)
  for (const id of ids) {
    if (!scopeIds.has(id)) throw new Error(`Unknown commercial scope item assignment: ${id}`)
  }
  return ids
}

function cloneWorkOrder(workOrder: CommercialWorkOrder): CommercialWorkOrder {
  return {
    ...workOrder,
    scopeItems: workOrder.scopeItems.map((item) => ({ ...item, evidenceRefs: [...item.evidenceRefs] })),
    acceptanceCriteria: workOrder.acceptanceCriteria.map((criterion) => ({ ...criterion })),
    price: { ...workOrder.price },
    executionOwners: [...workOrder.executionOwners],
    evidenceRefs: [...workOrder.evidenceRefs],
  }
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be a valid date`)
}

function requireEvidence(values: readonly string[], field: string): void {
  if (!values.length || values.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(`${field} requires evidence references`)
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
