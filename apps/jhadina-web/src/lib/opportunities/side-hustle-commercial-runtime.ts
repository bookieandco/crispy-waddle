import {
  buildCommercialDeliveryRouting,
  buildSideHustleServiceWorkOrderDraft,
  certifySideHustleCommercialFamily,
  createCommercialWorkOrder,
  linkCanonicalCommercialOutcome,
  lockCommercialWorkOrderScope,
  recordCommercialAcceptance,
  recordCommercialDelivery,
  recordCommercialDeliveryStart,
  type CommercialAcceptanceReceipt,
  type CommercialDeliveryReceipt,
  type CommercialDeliveryRoutingPlan,
  type CommercialDeliveryStartReceipt,
  type CommercialServiceOutcomeBridge,
  type CommercialWorkOrder,
  type CommercialWorkOrderAcceptanceCriterion,
  type CommercialWorkOrderPriceCadence,
  type CommercialWorkOrderScopeItem,
  type FulfillmentPlan,
  type OpportunityOutcome,
  type SideHustleCommercialCertification,
  type SideHustleCommercialLiveEvidence,
  type SideHustleCommercialSoftwareEvidence,
  type SideHustleFamily,
} from '@jhadina/opportunity-core'
import type { StoredCanonicalOpportunity } from './canonical'
import type {
  SideHustleCommercialReceiptKind,
  SideHustleCommercialReceiptPayload,
  StoredSideHustleCommercialReceipt,
} from './supabase-opportunity-repository'

export type SideHustleCommercialPersistence = {
  get(id: string): Promise<StoredCanonicalOpportunity | undefined>
  getOutcome(id: string): Promise<OpportunityOutcome | undefined>
  getSideHustleCommercialWorkOrder(id: string): Promise<CommercialWorkOrder | undefined>
  listSideHustleCommercialWorkOrders(opportunityId?: string): Promise<CommercialWorkOrder[]>
  saveSideHustleCommercialWorkOrder(workOrder: CommercialWorkOrder): Promise<CommercialWorkOrder>
  transitionSideHustleCommercialWorkOrder(input: {
    workOrder: CommercialWorkOrder
    receipt: StoredSideHustleCommercialReceipt
  }): Promise<{
    workOrder: CommercialWorkOrder
    receipt: SideHustleCommercialReceiptPayload
  }>
  listSideHustleCommercialReceipts(input?: {
    opportunityId?: string
    workOrderId?: string
    family?: SideHustleFamily
    kind?: SideHustleCommercialReceiptKind
  }): Promise<StoredSideHustleCommercialReceipt[]>
  recordSideHustleCommercialReceipt(
    record: StoredSideHustleCommercialReceipt,
  ): Promise<SideHustleCommercialReceiptPayload>
}

export const SIDE_HUSTLE_COMMERCIAL_SOFTWARE_EVIDENCE: SideHustleCommercialSoftwareEvidence = Object.freeze({
  workOrderBound: true,
  deliveryAcceptanceBound: true,
  canonicalOutcomeBridgeBound: true,
  operatorRoutingBound: true,
  canonicalOutcomeAuthorityPreserved: true,
  actionAuthorityExternal: true,
  moneyAuthorityExternal: true,
  automaticMaturityPromotionDisabled: true,
  duplicateAuthorityPaths: 0,
})

export async function createSideHustleCommercialWorkOrderFromTemplateRuntime(input: {
  opportunityId: string
  id: string
  ventureId?: string
  customerRef: string
  price: {
    amount: number
    currency: string
    cadence: CommercialWorkOrderPriceCadence
  }
  evidenceRefs: string[]
  createdAt?: string
  title?: string
  outcomePromise?: string
}, repository: SideHustleCommercialPersistence): Promise<CommercialWorkOrder> {
  const opportunityId = requireText(input.opportunityId, 'opportunityId')
  const stored = await repository.get(opportunityId)
  if (!stored) throw new Error('SIDE_HUSTLE_COMMERCIAL_OPPORTUNITY_NOT_FOUND')

  const draft = buildSideHustleServiceWorkOrderDraft({
    opportunity: stored.opportunity,
    id: input.id,
    ventureId: input.ventureId,
    customerRef: input.customerRef,
    price: input.price,
    evidenceRefs: input.evidenceRefs,
    createdAt: input.createdAt,
    title: input.title,
    outcomePromise: input.outcomePromise,
  })

  return createSideHustleCommercialWorkOrderRuntime(draft, repository)
}

export async function createSideHustleCommercialWorkOrderRuntime(input: {
  opportunityId: string
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
  createdAt?: string
}, repository: SideHustleCommercialPersistence): Promise<CommercialWorkOrder> {
  const opportunityId = requireText(input.opportunityId, 'opportunityId')
  const stored = await repository.get(opportunityId)
  if (!stored) throw new Error('SIDE_HUSTLE_COMMERCIAL_OPPORTUNITY_NOT_FOUND')

  const workOrder = createCommercialWorkOrder({
    opportunity: stored.opportunity,
    id: input.id,
    ventureId: input.ventureId,
    customerRef: input.customerRef,
    title: input.title,
    outcomePromise: input.outcomePromise,
    scopeItems: input.scopeItems,
    acceptanceCriteria: input.acceptanceCriteria,
    price: input.price,
    evidenceRefs: input.evidenceRefs,
    createdAt: input.createdAt ?? new Date().toISOString(),
  })
  return repository.saveSideHustleCommercialWorkOrder(workOrder)
}

export async function lockSideHustleCommercialScopeRuntime(input: {
  workOrderId: string
  evidenceRefs: string[]
  lockedAt?: string
}, repository: SideHustleCommercialPersistence): Promise<CommercialWorkOrder> {
  const workOrder = await requireWorkOrder(input.workOrderId, repository)
  const next = lockCommercialWorkOrderScope({
    workOrder,
    evidenceRefs: input.evidenceRefs,
    lockedAt: input.lockedAt ?? new Date().toISOString(),
  })
  return repository.saveSideHustleCommercialWorkOrder(next)
}

export async function recordSideHustleCommercialDeliveryStartRuntime(input: {
  workOrderId: string
  receiptId: string
  executionOwner: string
  executionRef: string
  evidenceRefs: string[]
  startedAt?: string
}, repository: SideHustleCommercialPersistence) {
  const workOrder = await requireWorkOrder(input.workOrderId, repository)
  const result = recordCommercialDeliveryStart({
    workOrder,
    receiptId: input.receiptId,
    executionOwner: input.executionOwner,
    executionRef: input.executionRef,
    evidenceRefs: input.evidenceRefs,
    startedAt: input.startedAt ?? new Date().toISOString(),
  })
  const transitioned = await persistTransition(repository, {
    workOrder: result.workOrder,
    receipt: {
      id: result.receipt.id,
      workOrderId: result.workOrder.id,
      opportunityId: result.workOrder.opportunityId,
      family: result.workOrder.family,
      kind: 'delivery_start',
      evidenceRefs: result.receipt.evidenceRefs,
      payload: result.receipt,
      recordedAt: result.receipt.startedAt,
    },
  })
  return { workOrder: transitioned.workOrder, receipt: result.receipt }
}

export async function recordSideHustleCommercialDeliveryRuntime(input: {
  workOrderId: string
  startReceiptId: string
  receiptId: string
  deliveryRef: string
  deliverableRefs: string[]
  evidenceRefs: string[]
  deliveredAt?: string
}, repository: SideHustleCommercialPersistence) {
  const workOrder = await requireWorkOrder(input.workOrderId, repository)
  const startReceipt = await requireReceiptPayload<CommercialDeliveryStartReceipt>({
    repository,
    workOrderId: workOrder.id,
    receiptId: input.startReceiptId,
    kind: 'delivery_start',
  })
  const result = recordCommercialDelivery({
    workOrder,
    startReceipt,
    receiptId: input.receiptId,
    deliveryRef: input.deliveryRef,
    deliverableRefs: input.deliverableRefs,
    evidenceRefs: input.evidenceRefs,
    deliveredAt: input.deliveredAt ?? new Date().toISOString(),
  })
  const transitioned = await persistTransition(repository, {
    workOrder: result.workOrder,
    receipt: {
      id: result.receipt.id,
      workOrderId: result.workOrder.id,
      opportunityId: result.workOrder.opportunityId,
      family: result.workOrder.family,
      kind: 'delivery',
      evidenceRefs: result.receipt.evidenceRefs,
      payload: result.receipt,
      recordedAt: result.receipt.deliveredAt,
    },
  })
  return { workOrder: transitioned.workOrder, receipt: result.receipt }
}

export async function recordSideHustleCommercialAcceptanceRuntime(input: {
  workOrderId: string
  deliveryReceiptId: string
  receiptId: string
  customerRef: string
  decision: 'accepted' | 'revision_required' | 'rejected'
  criteriaMet: string[]
  criteriaMissed: string[]
  evidenceRefs: string[]
  note?: string
  observedAt?: string
}, repository: SideHustleCommercialPersistence) {
  const workOrder = await requireWorkOrder(input.workOrderId, repository)
  const deliveryReceipt = await requireReceiptPayload<CommercialDeliveryReceipt>({
    repository,
    workOrderId: workOrder.id,
    receiptId: input.deliveryReceiptId,
    kind: 'delivery',
  })
  const result = recordCommercialAcceptance({
    workOrder,
    deliveryReceipt,
    receiptId: input.receiptId,
    customerRef: input.customerRef,
    decision: input.decision,
    criteriaMet: input.criteriaMet,
    criteriaMissed: input.criteriaMissed,
    evidenceRefs: input.evidenceRefs,
    note: input.note,
    observedAt: input.observedAt ?? new Date().toISOString(),
  })
  const transitioned = await persistTransition(repository, {
    workOrder: result.workOrder,
    receipt: {
      id: result.receipt.id,
      workOrderId: result.workOrder.id,
      opportunityId: result.workOrder.opportunityId,
      family: result.workOrder.family,
      kind: 'acceptance',
      evidenceRefs: result.receipt.evidenceRefs,
      payload: result.receipt,
      recordedAt: result.receipt.observedAt,
    },
  })
  return { workOrder: transitioned.workOrder, receipt: result.receipt }
}

export async function buildSideHustleCommercialRoutingRuntime(input: {
  workOrderId: string
  ownerAssignments?: Array<{
    executionOwner: string
    scopeItemIds: string[]
    evidenceRefs: string[]
    role?: 'lead' | 'support'
  }>
  fulfillmentPlan?: FulfillmentPlan
  providerScopeItemIds?: Record<string, string[]>
  evidenceRefs: string[]
  createdAt?: string
}, repository: SideHustleCommercialPersistence): Promise<CommercialDeliveryRoutingPlan> {
  const workOrder = await requireWorkOrder(input.workOrderId, repository)
  const routing = buildCommercialDeliveryRouting({
    workOrder,
    ownerAssignments: input.ownerAssignments,
    fulfillmentPlan: input.fulfillmentPlan,
    providerScopeItemIds: input.providerScopeItemIds,
    evidenceRefs: input.evidenceRefs,
    createdAt: input.createdAt ?? new Date().toISOString(),
  })
  await persistReceipt(repository, {
    id: routing.id,
    workOrder,
    kind: 'routing',
    payload: routing,
    evidenceRefs: routing.evidenceRefs,
    recordedAt: routing.createdAt,
  })
  return routing
}

export async function linkSideHustleCommercialOutcomeRuntime(input: {
  workOrderId: string
  acceptanceReceiptId: string
  outcomeId: string
  receiptId?: string
  recordedAt?: string
}, repository: SideHustleCommercialPersistence): Promise<CommercialServiceOutcomeBridge> {
  const workOrder = await requireWorkOrder(input.workOrderId, repository)
  const acceptanceReceipt = await requireReceiptPayload<CommercialAcceptanceReceipt>({
    repository,
    workOrderId: workOrder.id,
    receiptId: input.acceptanceReceiptId,
    kind: 'acceptance',
  })
  const outcome = await repository.getOutcome(requireText(input.outcomeId, 'outcomeId'))
  if (!outcome) throw new Error('SIDE_HUSTLE_COMMERCIAL_OUTCOME_NOT_FOUND')

  const bridge = linkCanonicalCommercialOutcome({
    workOrder,
    acceptanceReceipt,
    outcome,
  })
  const evidenceRefs = unique([
    ...acceptanceReceipt.evidenceRefs,
    ...outcome.evidenceRefs,
    ...(outcome.transactionRefs ?? []),
    ...(outcome.actionRef ? [outcome.actionRef] : []),
    ...(outcome.executionRef ? [outcome.executionRef] : []),
  ])
  await persistReceipt(repository, {
    id: input.receiptId?.trim() || `${workOrder.id}:outcome-bridge:${outcome.id}`,
    workOrder,
    kind: 'outcome_bridge',
    payload: bridge,
    evidenceRefs,
    recordedAt: input.recordedAt ?? outcome.observedAt,
  })
  return bridge
}

export async function certifySideHustleCommercialFamilyRuntime(input: {
  family: SideHustleFamily
  certifiedAt?: string
}, repository: SideHustleCommercialPersistence): Promise<{
  report: SideHustleCommercialCertification
  live: SideHustleCommercialLiveEvidence
}> {
  const workOrders = (await repository.listSideHustleCommercialWorkOrders())
    .filter((workOrder) => workOrder.family === input.family)
  const receipts = await repository.listSideHustleCommercialReceipts({ family: input.family })

  const live: SideHustleCommercialLiveEvidence = {
    lockedWorkOrders: workOrders.filter((workOrder) => workOrder.status !== 'draft').length,
    observedDeliveries: receipts.filter((receipt) => receipt.kind === 'delivery').length,
    acceptedDeliveries: receipts.filter((receipt) =>
      receipt.kind === 'acceptance' &&
      isAcceptanceReceipt(receipt.payload) &&
      receipt.payload.decision === 'accepted',
    ).length,
    realizedPaidOutcomes: receipts.filter((receipt) =>
      receipt.kind === 'outcome_bridge' &&
      isOutcomeBridge(receipt.payload) &&
      receipt.payload.outcome.result === 'won' &&
      receipt.payload.outcome.grossRevenue > 0,
    ).length,
    routingPlans: receipts.filter((receipt) =>
      receipt.kind === 'routing' &&
      isRoutingPlan(receipt.payload) &&
      receipt.payload.blockers.length === 0,
    ).length,
    unauthorizedExternalActions: receipts.filter((receipt) =>
      containsTrueAuthority(receipt.payload, ['externalActionAuthorized']),
    ).length,
    unauthorizedPayments: receipts.filter((receipt) =>
      containsTrueAuthority(receipt.payload, ['paymentAuthorized', 'moneyMovementAuthorized', 'assignmentAuthorized']),
    ).length,
    automaticMaturityPromotions: receipts.filter((receipt) =>
      containsTrueAuthority(receipt.payload, ['automaticMaturityPromotionAuthorized']),
    ).length,
  }

  const report = certifySideHustleCommercialFamily({
    family: input.family,
    software: SIDE_HUSTLE_COMMERCIAL_SOFTWARE_EVIDENCE,
    live,
  })
  const certifiedAt = input.certifiedAt ?? new Date().toISOString()
  const evidenceRefs = unique([
    'software:side-hustle-commercial-runtime',
    ...workOrders.flatMap((workOrder) => workOrder.evidenceRefs),
    ...receipts.flatMap((receipt) => receipt.evidenceRefs),
  ])

  await repository.recordSideHustleCommercialReceipt({
    id: `side-hustle-commercial:certification:${input.family}:${certifiedAt}`,
    family: input.family,
    kind: 'certification',
    evidenceRefs,
    payload: report,
    recordedAt: certifiedAt,
  })

  return { report, live }
}

async function requireWorkOrder(
  id: string,
  repository: SideHustleCommercialPersistence,
): Promise<CommercialWorkOrder> {
  const workOrder = await repository.getSideHustleCommercialWorkOrder(requireText(id, 'workOrderId'))
  if (!workOrder) throw new Error('SIDE_HUSTLE_COMMERCIAL_WORK_ORDER_NOT_FOUND')
  return workOrder
}

async function requireReceiptPayload<T extends SideHustleCommercialReceiptPayload>(input: {
  repository: SideHustleCommercialPersistence
  workOrderId: string
  receiptId: string
  kind: SideHustleCommercialReceiptKind
}): Promise<T> {
  const receiptId = requireText(input.receiptId, 'receiptId')
  const receipts = await input.repository.listSideHustleCommercialReceipts({
    workOrderId: input.workOrderId,
    kind: input.kind,
  })
  const receipt = receipts.find((candidate) => candidate.id === receiptId)
  if (!receipt) throw new Error('SIDE_HUSTLE_COMMERCIAL_RECEIPT_NOT_FOUND')
  return receipt.payload as T
}

async function persistTransition(
  repository: SideHustleCommercialPersistence,
  input: {
    workOrder: CommercialWorkOrder
    receipt: StoredSideHustleCommercialReceipt
  },
): Promise<{
  workOrder: CommercialWorkOrder
  receipt: SideHustleCommercialReceiptPayload
}> {
  return repository.transitionSideHustleCommercialWorkOrder(input)
}

async function persistReceipt(inputRepository: SideHustleCommercialPersistence, input: {
  id: string
  workOrder: CommercialWorkOrder
  kind: SideHustleCommercialReceiptKind
  payload: SideHustleCommercialReceiptPayload
  evidenceRefs: string[]
  recordedAt: string
}): Promise<void> {
  await inputRepository.recordSideHustleCommercialReceipt({
    id: input.id,
    workOrderId: input.workOrder.id,
    opportunityId: input.workOrder.opportunityId,
    family: input.workOrder.family,
    kind: input.kind,
    evidenceRefs: unique(input.evidenceRefs),
    payload: input.payload,
    recordedAt: input.recordedAt,
  })
}

function isAcceptanceReceipt(payload: SideHustleCommercialReceiptPayload): payload is CommercialAcceptanceReceipt {
  return 'decision' in payload && 'criteriaMet' in payload && 'deliveryReceiptId' in payload
}

function isOutcomeBridge(payload: SideHustleCommercialReceiptPayload): payload is CommercialServiceOutcomeBridge {
  return 'outcome' in payload && 'acceptanceReceiptId' in payload
}

function isRoutingPlan(payload: SideHustleCommercialReceiptPayload): payload is CommercialDeliveryRoutingPlan {
  return 'assignments' in payload && 'unresolvedScopeItemIds' in payload && 'blockers' in payload
}

function containsTrueAuthority(value: unknown, keys: string[]): boolean {
  if (Array.isArray(value)) return value.some((item) => containsTrueAuthority(item, keys))
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (keys.some((key) => record[key] === true)) return true
  return Object.values(record).some((item) => containsTrueAuthority(item, keys))
}

function requireText(value: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
