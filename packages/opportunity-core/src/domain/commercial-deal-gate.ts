import type { FulfillmentPlan, FulfillmentPlanStructure } from './fulfillment-plan.js'

export type CommercialDealStructure =
  | 'direct_fulfillment'
  | 'subcontract_margin'
  | 'teaming'
  | 'joint_venture'
  | 'referral'
  | 'success_fee'
  | 'percentage'
  | 'unresolved'

export type CommercialAssumptions = {
  contractValue: number
  providerCosts?: Record<string, number>
  directCost?: number
  overhead?: number
  contingency?: number
  acquisitionCost?: number
  feePercent?: number
  minimumMarginPercent?: number
}

export type CommercialEconomics = {
  grossRevenue: number
  providerCost: number
  directCost: number
  overhead: number
  contingency: number
  acquisitionCost: number
  estimatedGrossProfit: number
  estimatedMarginPercent: number
}

export type CommercialDealGate = {
  opportunityId: string
  structure: CommercialDealStructure
  economics: CommercialEconomics
  status: 'blocked' | 'review_required' | 'commercially_viable'
  blockers: string[]
  warnings: string[]
  assumptions: string[]
  complianceReviewRequired: true
  humanApprovalRequired: true
  engagementAuthorized: false
}

const money = (value: number | undefined) => Math.max(0, Number.isFinite(value) ? value! : 0)
const pct = (value: number | undefined) => Math.max(0, Math.min(100, Number.isFinite(value) ? value! : 0))
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))]

function inferStructure(plan: FulfillmentPlan): CommercialDealStructure {
  const map: Record<FulfillmentPlanStructure, CommercialDealStructure> = {
    direct_fulfillment: 'direct_fulfillment',
    prime_with_subcontractor: 'subcontract_margin',
    teaming: 'teaming',
    specialist_vendor: 'subcontract_margin',
    unresolved: 'unresolved',
  }
  return map[plan.structure]
}

export function evaluateCommercialDeal(
  plan: FulfillmentPlan,
  input: CommercialAssumptions,
  structure: CommercialDealStructure = inferStructure(plan),
): CommercialDealGate {
  const blockers = [...plan.blockers]
  const warnings: string[] = []
  const assumptions: string[] = []
  const contractValue = money(input.contractValue)
  const providerCosts = input.providerCosts ?? {}
  const providerCost = plan.assignments.reduce((sum, assignment) => sum + money(providerCosts[assignment.providerId]), 0)
  const directCost = money(input.directCost)
  const overhead = money(input.overhead)
  const contingency = money(input.contingency)
  const acquisitionCost = money(input.acquisitionCost)
  const feePercent = pct(input.feePercent)
  const minimumMargin = pct(input.minimumMarginPercent ?? 10)

  if (contractValue <= 0) blockers.push('A reliable positive contract value is required for commercial evaluation.')
  if (plan.uncoveredRequirementIds.length > 0) blockers.push('Fulfillment plan has uncovered required requirements.')
  if (plan.structure === 'unresolved') blockers.push('Fulfillment structure is unresolved.')

  for (const assignment of plan.assignments) {
    if (providerCosts[assignment.providerId] === undefined) {
      warnings.push(`Provider cost is unknown for ${assignment.providerId}.`)
      assumptions.push(`Provider cost for ${assignment.providerId} modeled as $0 until supplied.`)
    }
  }

  if (['referral', 'success_fee', 'percentage'].includes(structure)) {
    blockers.push('Fee-based structure requires procurement/legal compliance review before it can be treated as permissible.')
    if (feePercent <= 0) warnings.push('Fee percentage is not supplied.')
  }

  const grossRevenue = ['referral', 'success_fee', 'percentage'].includes(structure)
    ? contractValue * feePercent / 100
    : contractValue
  const estimatedGrossProfit = grossRevenue - providerCost - directCost - overhead - contingency - acquisitionCost
  const estimatedMarginPercent = grossRevenue > 0 ? estimatedGrossProfit / grossRevenue * 100 : 0

  if (estimatedGrossProfit <= 0) blockers.push('Modeled gross profit is not positive.')
  if (grossRevenue > 0 && estimatedMarginPercent < minimumMargin) blockers.push(`Modeled margin is below the ${minimumMargin}% planning threshold.`)
  if (providerCost >= grossRevenue && grossRevenue > 0) blockers.push('Provider cost consumes all modeled gross revenue.')

  if (structure === 'joint_venture' || structure === 'teaming' || structure === 'subcontract_margin') {
    warnings.push('Structure requires solicitation-specific subcontracting, teaming, size-status, and performance-of-work review.')
  }

  const economics: CommercialEconomics = {
    grossRevenue,
    providerCost,
    directCost,
    overhead,
    contingency,
    acquisitionCost,
    estimatedGrossProfit,
    estimatedMarginPercent: Math.round(estimatedMarginPercent * 100) / 100,
  }

  let status: CommercialDealGate['status'] = 'review_required'
  if (blockers.length > 0) status = 'blocked'
  else if (contractValue > 0 && estimatedGrossProfit > 0 && estimatedMarginPercent >= minimumMargin) status = 'commercially_viable'

  return {
    opportunityId: plan.opportunityId,
    structure,
    economics,
    status,
    blockers: uniq(blockers),
    warnings: uniq(warnings),
    assumptions: uniq(assumptions),
    complianceReviewRequired: true,
    humanApprovalRequired: true,
    engagementAuthorized: false,
  }
}

export function canAdvanceToCommercialReview(gate: CommercialDealGate): boolean {
  return gate.status === 'commercially_viable' && gate.blockers.length === 0
}
