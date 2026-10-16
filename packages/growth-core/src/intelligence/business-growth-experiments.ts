/** BIZ-GROWTH.07-.08: Commerce-derived outcomes and 30-day review experiments. */
export type GrowthContributionReceipt = {
  receiptId: string
  businessId: string
  missionId: string
  experimentId: string
  sourceAssetId: string
  campaignId: string
  orderId: string
  provider: string
  providerSettlementRef: string
  currency: 'USD'
  settledAt: string
  grossRevenueCents: number
  refundsCents: number
  fulfillmentCents: number
  platformFeesCents: number
  attributionCostCents: number
  evidenceRefs: string[]
  source: 'CANONICAL_COMMERCE_RECONCILIATION'
}
export type GrowthContributionResult = {
  status: 'VERIFIED_SETTLED_CONTRIBUTION' | 'INCOMPLETE'
  realizedCents: number | null
  earnedXp: number
  evidenceRefs: string[]
  requiredMissing: string[]
  nonFinancialObservationsNotCounted: true
  externalActionAuthorized: false
}
const validMoney = (n: number): boolean => Number.isSafeInteger(n) && n >= 0
const required = (s: string) => typeof s === 'string' && !!s.trim()
const validTime = (s: string) => Number.isFinite(Date.parse(s))

/**
 * Input MUST be assembled by a trusted server-side Commerce reconciler.
 * A string-valued source marker alone proves nothing: do NOT expose this as
 * a public verification endpoint accepting user-supplied JSON.
 */
export function reconcileGrowthContribution(
  receipt: Partial<GrowthContributionReceipt> | null,
  accepted: { businessId: string; missionId: string; experimentId: string; orderIdsAlreadyScored: readonly string[] },
): GrowthContributionResult {
  const incomplete = (reason: string): GrowthContributionResult => ({
    status: 'INCOMPLETE', realizedCents:null, earnedXp:0,
    evidenceRefs: [], requiredMissing:[reason],
    nonFinancialObservationsNotCounted:true, externalActionAuthorized:false,
  })
  if (!receipt) return incomplete('Canonical Commerce settlement receipt unavailable')
  if (receipt.businessId !== accepted.businessId || receipt.missionId !== accepted.missionId
    || receipt.experimentId !== accepted.experimentId) return incomplete('Cross-business or experiment reference mismatch')
  if (!required(receipt.receiptId ?? '') || !required(receipt.providerSettlementRef ?? '')
    || !required(receipt.provider ?? '') || !required(receipt.orderId ?? '')
    || !required(receipt.sourceAssetId ?? '') || !required(receipt.campaignId ?? '')
    || receipt.source !== 'CANONICAL_COMMERCE_RECONCILIATION'
    || !validTime(receipt.settledAt ?? '')
    || !receipt.evidenceRefs?.length || !receipt.evidenceRefs.every(required)) {
    return incomplete('Provider settlement, campaign, order, asset, and provenance required')
  }
  if (accepted.orderIdsAlreadyScored.includes(receipt.orderId!)) return incomplete('Order already attributed')
  if (receipt.currency !== 'USD') return incomplete('Currency must be reconciled before USD XP')
  const amounts = [
    receipt.grossRevenueCents, receipt.refundsCents,
    receipt.fulfillmentCents, receipt.platformFeesCents, receipt.attributionCostCents,
  ]
  if (amounts.some(x => x === undefined || !validMoney(x))) return incomplete('All settled revenue/cost fields required')
  const [gross,refunds,fulfillment,fees,acquisition] = amounts as number[]
  const realized = gross-refunds-fulfillment-fees-acquisition
  if (!Number.isSafeInteger(realized)) return incomplete('Contribution exceeds safe integer range')
  // Count only positive *net* contribution, with a small daily game reward cap.
  return {
    status:'VERIFIED_SETTLED_CONTRIBUTION',realizedCents:realized,
    earnedXp:realized>0?Math.min(100,20+Math.floor(realized/100)):0,
    evidenceRefs:[...new Set(receipt.evidenceRefs)],
    requiredMissing:[],nonFinancialObservationsNotCounted:true,externalActionAuthorized:false,
  }
}

export type GrowthExperimentPhase = 'BASELINE' | 'SITE_REPAIR' | 'CONTENT_REVIEW' | 'GOVERNED_DISTRIBUTION' | 'RESULTS'
export type GrowthExperimentCheckpoint = {
  day: number
  date: string
  phase: GrowthExperimentPhase
  deliverable: string
  automaticProviderAction: false
  evidenceRequired: true
}
export type BusinessGrowthExperiment = {
  id: string
  businessId: string
  ventureId: string
  startDate: string
  endDate: string
  objective: 'REALIZED_CONTRIBUTION'
  hypothesis: string
  ownerApprovedSpendUsd: 0
  externalExecutionAuthorized: false
  automaticPublicationAuthorized: false
  checkpoints: GrowthExperimentCheckpoint[]
  killCriteria: readonly string[]
  readyForLiveExperiment: false
  status: 'PLANNING'
}
const phases: readonly [number,GrowthExperimentPhase,string][] = [
  [1,'BASELINE','Verify site ownership, buyer-intent evidence and existing page inventory'],
  [4,'SITE_REPAIR','Review indexing/canonical/schema findings and proposed repairs'],
  [8,'SITE_REPAIR','Recheck repaired URLs only after authorized deployment receipt'],
  [12,'CONTENT_REVIEW','Review original high-intent briefs, sources, claims and media rights'],
  [16,'CONTENT_REVIEW','Approve or reject drafts in canonical Growth/Director review'],
  [20,'GOVERNED_DISTRIBUTION','Check Social/CMS approvals and record provider delivery or blockers'],
  [24,'RESULTS','Review first-party search and observed funnel progression'],
  [27,'RESULTS','Reconcile orders, reversals, costs and source-to-sale attribution'],
  [30,'RESULTS','Write final measured/incomplete outcome and next experiment recommendation'],
]
function startDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('BIZ_GROWTH_EXPERIMENT_DATE_INVALID')
  const d = new Date(value+'T00:00:00Z')
  if (!validTime(d.toISOString()) || d.toISOString().slice(0,10)!==value) throw new Error('BIZ_GROWTH_EXPERIMENT_DATE_INVALID')
  return d
}
function plusDays(date: Date,days: number) {
  return new Date(date.getTime()+86400000*days).toISOString().slice(0,10)
}
export function createBusinessGrowthExperiment(input: {
  id: string
  businessId: string
  ventureId: string
  startDate: string
  hypothesis: string
}): BusinessGrowthExperiment {
  if (![input.id,input.businessId,input.ventureId,input.hypothesis].every(required)) {
    throw new Error('BIZ_GROWTH_EXPERIMENT_FIELDS_REQUIRED')
  }
  const first = startDate(input.startDate)
  return {
    id:input.id, businessId:input.businessId, ventureId:input.ventureId,
    startDate:input.startDate,endDate:plusDays(first,29),
    objective:'REALIZED_CONTRIBUTION',hypothesis:input.hypothesis,
    ownerApprovedSpendUsd:0,externalExecutionAuthorized:false,automaticPublicationAuthorized:false,
    checkpoints:phases.map(([day,phase,deliverable])=>({
      day,date:plusDays(first,day-1),phase,deliverable,
      automaticProviderAction:false,evidenceRequired:true,
    })),
    killCriteria:[
      'Non-compliant or unapproved publication/claims',
      'Unauthorized spend, outreach, or backlink exchange',
      'Unreconciled commercial evidence or negative realized contribution',
      'Owner revokes property, account, content or experiment approval',
    ],
    readyForLiveExperiment:false,status:'PLANNING',
  }
}
export type ExperimentCheckpointReceipt = {
  experimentId: string
  day: number
  recordedAt: string
  evidenceRefs: string[]
  status: 'COMPLETED'|'BLOCKED'
  kind: 'PROVIDER_OR_OWNER_REVIEW'
}
export type GrowthExperimentAssessment = {
  experimentId: string
  outcome: 'INCOMPLETE'|'LOSS_OBSERVED'|'POSITIVE_CONTRIBUTION_OBSERVED'
  completedCheckpoints: number
  missingDays: number[]
  realizedContributionCents: number|null
  earnedXp: number
  finalAttributionVerified: boolean
  automaticScalingAuthorized: false
  reason: string
}
export function assessBusinessGrowthExperiment(input: {
  experiment: BusinessGrowthExperiment
  checkpointReceipts: ExperimentCheckpointReceipt[]
  outcome: GrowthContributionResult | null
  assessedAt: string
}): GrowthExperimentAssessment {
  const e=input.experiment
  if (!validTime(input.assessedAt)) throw new Error('BIZ_GROWTH_ASSESSMENT_TIME_INVALID')
  const finished = new Set<number>()
  for (const row of input.checkpointReceipts) {
    const checkpoint=e.checkpoints.find(cp=>cp.day===row.day)
    if (row.experimentId!==e.id || !checkpoint
      || !validTime(row.recordedAt) || !row.evidenceRefs?.length
      || row.kind !== 'PROVIDER_OR_OWNER_REVIEW'
      || row.recordedAt.slice(0,10)<checkpoint.date
      || Date.parse(row.recordedAt)>Date.parse(input.assessedAt)) {
      throw new Error('BIZ_GROWTH_CHECKPOINT_RECEIPT_INVALID')
    }
    if (row.status==='COMPLETED') finished.add(row.day)
  }
  const missingDays = e.checkpoints.filter(cp=>!finished.has(cp.day)).map(cp=>cp.day)
  if (input.assessedAt.slice(0,10) < e.endDate || missingDays.length
    || input.outcome?.status!=='VERIFIED_SETTLED_CONTRIBUTION') {
    return { experimentId:e.id,outcome:'INCOMPLETE',completedCheckpoints:finished.size,
      missingDays,realizedContributionCents:null,earnedXp:0,finalAttributionVerified:false,
      automaticScalingAuthorized:false,reason:'Duration, checkpoint or verified settlement evidence incomplete' }
  }
  const amount=input.outcome.realizedCents!
  return { experimentId:e.id, outcome:amount>0?'POSITIVE_CONTRIBUTION_OBSERVED':'LOSS_OBSERVED',
    completedCheckpoints:finished.size,missingDays:[],
    realizedContributionCents:amount,earnedXp:input.outcome.earnedXp,
    finalAttributionVerified:true,automaticScalingAuthorized:false,
    reason:'Settled contribution observed; this does not establish SEO causality or approve scaling' }
}
