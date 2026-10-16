import type {
  CommercialAcceptanceReceipt,
  CommercialDeliveryReceipt,
  CommercialDeliveryRoutingPlan,
  CommercialDeliveryStartReceipt,
  CommercialServiceOutcomeBridge,
  CommercialWorkOrder,
  SideHustleCommercialLiveEvidence,
} from './side-hustle-commercial.js'
import type {SideHustleFamily} from './side-hustles.js'

/**
 * Read-only correlation of existing canonical commercial evidence. An outcome
 * observation or user-supplied receipt is NOT independent settlement proof.
 * This is an acceptance candidate only, never permission to spend or publish.
 */
export type PortfolioCommercialReceipt = {
  id: string
  family: SideHustleFamily
  kind: 'routing' | 'delivery_start' | 'delivery' | 'acceptance' | 'outcome_bridge' | 'certification'
  workOrderId?: string
  opportunityId?: string
  evidenceRefs: string[]
  payload: unknown
  recordedAt: string
}

export type SideHustlePortfolioEvidenceReview = {
  family: SideHustleFamily
  live: SideHustleCommercialLiveEvidence
  linkedPaidWorkOrderIds: string[]
  rejectedWorkOrderIds: string[]
  // This deliberately cannot represent independent provider verification.
  status: 'awaiting_evidence' | 'ready_for_independent_verification' | 'not_applicable'
  blockers: string[]
  externalActionAuthorized: false
  moneyMovementAuthorized: false
  automaticMaturityPromotionAuthorized: false
}

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
const refs = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(x => typeof x === 'string' && x.trim().length > 0)
const obj = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function unauthorized(value: unknown, keys: readonly string[]): boolean {
  if (Array.isArray(value)) return value.some(item => unauthorized(item, keys))
  if (!obj(value)) return false
  return keys.some(key => value[key] === true) ||
    Object.values(value).some(item => unauthorized(item, keys))
}

function matching<T>(rows: PortfolioCommercialReceipt[], kind: PortfolioCommercialReceipt['kind'],
  workOrder: CommercialWorkOrder, accept: (payload: T) => boolean): T[] {
  return rows.filter(row =>
    row.kind === kind &&
    row.workOrderId === workOrder.id &&
    row.opportunityId === workOrder.opportunityId &&
    row.family === workOrder.family &&
    refs(row.evidenceRefs) &&
    obj(row.payload) &&
    row.payload.workOrderId === workOrder.id &&
    row.payload.opportunityId === workOrder.opportunityId &&
    (() => { try { return accept(row.payload as unknown as T) } catch { return false } })()
  ).map(row => row.payload as unknown as T)
}

export function reviewSideHustlePortfolioCommercialEvidence(input: {
  family: SideHustleFamily
  workOrders: CommercialWorkOrder[]
  receipts: PortfolioCommercialReceipt[]
}): SideHustlePortfolioEvidenceReview {
  const live: SideHustleCommercialLiveEvidence = {
    lockedWorkOrders: 0, routingPlans: 0, observedDeliveries: 0,
    acceptedDeliveries: 0, realizedPaidOutcomes: 0,
    unauthorizedExternalActions: 0, unauthorizedPayments: 0,
    automaticMaturityPromotions: 0,
  }
  if(input.family === 'trading_investing_intelligence') {
    return {
      family:input.family,live,linkedPaidWorkOrderIds:[],rejectedWorkOrderIds:[],
      status:'not_applicable',blockers:['Capability-only Money intelligence is not a commercial executor.'],
      externalActionAuthorized:false,moneyMovementAuthorized:false,automaticMaturityPromotionAuthorized:false,
    }
  }
  const receipts = input.receipts.filter(row => row.family === input.family)
  live.unauthorizedExternalActions = receipts.filter(row =>
    unauthorized(row.payload, ['externalActionAuthorized'])).length
  live.unauthorizedPayments = receipts.filter(row =>
    unauthorized(row.payload, ['paymentAuthorized','moneyMovementAuthorized','assignmentAuthorized'])).length
  live.automaticMaturityPromotions = receipts.filter(row =>
    unauthorized(row.payload, ['automaticMaturityPromotionAuthorized'])).length

  const workOrders = input.workOrders.filter(order => order.family === input.family)
  const linkedPaidWorkOrderIds: string[] = []
  const rejectedWorkOrderIds: string[] = []

  for (const workOrder of workOrders) {
    if (!validDate(workOrder.scopeLockedAt) || workOrder.status === 'draft' ||
        workOrder.status === 'cancelled' || !refs(workOrder.evidenceRefs)) {
      rejectedWorkOrderIds.push(workOrder.id)
      continue
    }
    live.lockedWorkOrders++
    const scopeIds = new Set(workOrder.scopeItems.map(item => item.id))
    const routes = matching<CommercialDeliveryRoutingPlan>(receipts,'routing',workOrder,p =>
      p.family === workOrder.family && p.blockers.length === 0 &&
      p.unresolvedScopeItemIds.length === 0 && p.assignments.length > 0 &&
      p.assignments.every(a => a.scopeItemIds.length > 0 &&
        a.scopeItemIds.every(id => scopeIds.has(id)) && a.assignmentAuthorized === false) &&
      scopeIds.size > 0 && workOrder.scopeItems.every(scope =>
        p.assignments.some(a => a.scopeItemIds.includes(scope.id))) &&
      p.externalActionAuthorized === false && p.assignmentAuthorized === false)
    if (!routes.length) { rejectedWorkOrderIds.push(workOrder.id); continue }
    live.routingPlans++

    const starts = matching<CommercialDeliveryStartReceipt>(receipts,'delivery_start',workOrder,p =>
      validDate(p.startedAt) && Date.parse(p.startedAt) >= Date.parse(workOrder.scopeLockedAt!) &&
      workOrder.executionOwners.includes(p.executionOwner) && refs(p.evidenceRefs) &&
      p.externalActionAuthorized === false)
    const deliveries = matching<CommercialDeliveryReceipt>(receipts,'delivery',workOrder,p =>
      validDate(p.deliveredAt) && refs(p.deliverableRefs) && refs(p.evidenceRefs) &&
      starts.some(s => s.executionRef === p.executionRef && s.executionOwner === p.executionOwner &&
        Date.parse(s.startedAt) <= Date.parse(p.deliveredAt)) &&
      p.externalActionAuthorized === false)
    if (!deliveries.length) { rejectedWorkOrderIds.push(workOrder.id); continue }
    live.observedDeliveries++

    const acceptances = matching<CommercialAcceptanceReceipt>(receipts,'acceptance',workOrder,p =>
      p.decision === 'accepted' && p.customerRef === workOrder.customerRef &&
      validDate(p.observedAt) && refs(p.evidenceRefs) && p.paymentAuthorized === false &&
      deliveries.some(d => d.id === p.deliveryReceiptId &&
        Date.parse(d.deliveredAt) <= Date.parse(p.observedAt)) &&
      workOrder.acceptanceCriteria.filter(c => c.required).every(c => p.criteriaMet.includes(c.id)) &&
      p.criteriaMissed.length === 0)
    if (workOrder.status !== 'accepted' || !acceptances.length) {
      rejectedWorkOrderIds.push(workOrder.id); continue
    }
    live.acceptedDeliveries++

    const outcomes = matching<CommercialServiceOutcomeBridge>(receipts,'outcome_bridge',workOrder,p =>
      p.authority === 'CANONICAL_OUTCOME_INPUT_ONLY' && p.moneyMovementAuthorized === false &&
      acceptances.some(a => a.id === p.acceptanceReceiptId &&
        validDate(p.outcome.observedAt) && Date.parse(p.outcome.observedAt) >= Date.parse(a.observedAt)) &&
      p.outcome.opportunityId === workOrder.opportunityId &&
      p.outcome.result === 'won' && p.outcome.grossRevenue > 0 &&
      p.outcome.currency === workOrder.price.currency &&
      p.outcome.sourceOwner !== 'user' && refs(p.outcome.transactionRefs) &&
      refs(p.outcome.evidenceRefs) && Number.isFinite(p.outcome.profit) &&
      Number.isFinite(p.outcome.netRevenue) && p.outcome.refunds >= 0 &&
      p.outcome.directCosts >= 0 && p.outcome.fees >= 0)
    if (!outcomes.length) { rejectedWorkOrderIds.push(workOrder.id); continue }
    live.realizedPaidOutcomes++
    linkedPaidWorkOrderIds.push(workOrder.id)
  }

  const blockers: string[] = []
  if (!linkedPaidWorkOrderIds.length) blockers.push('No single work order has a complete linked scope → route → delivery → acceptance → domain-sourced paid outcome with transaction references.')
  if (live.unauthorizedExternalActions || live.unauthorizedPayments || live.automaticMaturityPromotions) blockers.push('Unauthorized authority flags were observed.')
  // Even a complete user-readable receipt chain is not a processor-signed settlement.
  blockers.push('Independent provider settlement/customer/permission verification is required before claiming commercial certification.')
  return {
    family:input.family,live,linkedPaidWorkOrderIds,rejectedWorkOrderIds,
    status:linkedPaidWorkOrderIds.length && blockers.length === 1
      ? 'ready_for_independent_verification' : 'awaiting_evidence',
    blockers,
    externalActionAuthorized:false,moneyMovementAuthorized:false,automaticMaturityPromotionAuthorized:false,
  }
}
