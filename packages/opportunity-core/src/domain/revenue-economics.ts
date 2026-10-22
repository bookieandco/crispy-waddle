/** JH-REVENUE.04 — conservative, nonexecuting earned-income selection.
 * Not the speculative-money Opportunity Bus and never a balance or ledger.
 * Estimates are hypotheses, not a representation of provider payability.
 */
export type RevenuePayoutKind =
  | 'individual_cash' | 'prize_pool' | 'api_credits' | 'restricted_grant' | 'investment' | 'unknown'
export type RevenueScoreInput = {
  id: string
  now: string
  sourceObservedAt: string
  deadline: string | null
  sourceStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN'
  aiWorkAllowed: boolean | null
  operatorEligible: boolean | null
  payerEvidenceRefs: readonly string[]
  termsEvidenceRefs: readonly string[]
  paymentAssurance: 'verified_escrow' | 'verified_contract' | 'direct_payer_unverified' | 'unknown'
  payoutKind: RevenuePayoutKind
  /** USD valuation, not a pool. Requires a current independent valuation citation. */
  individualRewardUsd: number | null
  rewardEvidenceRef: string | null
  rewardValuationAt: string | null
  probabilityFinish: number | null
  probabilityAcceptedGivenFinished: number | null
  probabilityPaidGivenAccepted: number | null
  estimatedWorkHours: number | null
  reviewHours: number | null
  laborOpportunityCostUsdPerHour: number | null
  computeCostUsd: number | null
  platformFeesUsd: number | null
  fulfillmentCostUsd: number | null
  reworkReserveUsd: number | null
  maxComputeBudgetUsd: number
  minimumExpectedNetUsdPerHour: number
  activeCompetitors: number | null
  saturationThreshold: number
}
export type RevenueScoreResult = {
  id: string
  decision: 'blocked' | 'insufficient_evidence' | 'reject_unprofitable' | 'research_candidate'
  reasons: string[]
  expectedGrossUsd: number | null
  expectedNetUsd: number | null
  expectedNetUsdPerHour: number | null
  predictedSuccessProbability: number | null
  estimationOnly: true
  submissionAuthorized: false
  spendingAuthorized: false
  earningsRecognizedUsd: 0
}
const validDate = (value: string | null): number =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN
const money = (x: number | null): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1_000_000_000
const chance = (x: number | null): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1
const documented = (refs: readonly string[]): boolean =>
  Array.isArray(refs) && refs.length > 0 && refs.length <= 20 &&
  refs.every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 500)
export function scoreEarnedRevenueOpportunity(x: RevenueScoreInput): RevenueScoreResult {
  const blocks: string[] = []
  const gaps: string[] = []
  const time = validDate(x.now)
  if (!Number.isFinite(time)) throw new Error('REVENUE_SCORE_NOW_INVALID')
  const observed = validDate(x.sourceObservedAt)
  if (!Number.isFinite(observed) || observed > time || time-observed > 24*3600_000)
    gaps.push('SOURCE_STALE_OR_MISSING')
  if (x.sourceStatus !== 'OPEN') blocks.push('SOURCE_NOT_OPEN')
  if (x.deadline !== null && (!Number.isFinite(validDate(x.deadline)) || validDate(x.deadline) <= time))
    blocks.push('DEADLINE_EXPIRED_OR_UNKNOWN')
  if (x.aiWorkAllowed === false) blocks.push('AI_WORK_FORBIDDEN')
  if (x.aiWorkAllowed === null) gaps.push('AI_POLICY_UNVERIFIED')
  if (x.operatorEligible === false) blocks.push('OPERATOR_INELIGIBLE')
  if (x.operatorEligible === null) gaps.push('OPERATOR_ELIGIBILITY_UNVERIFIED')
  if (!documented(x.payerEvidenceRefs)) gaps.push('PAYER_NOT_EVIDENCED')
  if (!documented(x.termsEvidenceRefs)) gaps.push('TERMS_NOT_EVIDENCED')
  if (!['verified_escrow','verified_contract'].includes(x.paymentAssurance))
    gaps.push('PAYMENT_ASSURANCE_NOT_VERIFIED')
  if (x.payoutKind !== 'individual_cash')
    blocks.push('NOT_AN_INDIVIDUAL_CASH_REWARD')
  if (!money(x.individualRewardUsd) || x.individualRewardUsd <= 0 ||
      !x.rewardEvidenceRef?.trim()) gaps.push('INDIVIDUAL_USD_REWARD_UNVERIFIED')
  const valued = validDate(x.rewardValuationAt)
  if (!Number.isFinite(valued) || valued > time || time-valued > 24*3600_000)
    gaps.push('REWARD_VALUATION_STALE')
  if (![x.probabilityFinish,x.probabilityAcceptedGivenFinished,x.probabilityPaidGivenAccepted].every(chance))
    gaps.push('SUCCESS_PROBABILITY_UNSUPPORTED')
  if (!money(x.estimatedWorkHours) || x.estimatedWorkHours <= 0 ||
      !money(x.reviewHours) || !money(x.laborOpportunityCostUsdPerHour) ||
      !money(x.computeCostUsd) || !money(x.platformFeesUsd) ||
      !money(x.fulfillmentCostUsd) || !money(x.reworkReserveUsd)) gaps.push('COSTS_OR_EFFORT_UNKNOWN')
  if (!money(x.maxComputeBudgetUsd) || !money(x.minimumExpectedNetUsdPerHour) ||
      !Number.isSafeInteger(x.saturationThreshold) || x.saturationThreshold < 1)
    throw new Error('REVENUE_SCORE_POLICY_INVALID')
  if (money(x.computeCostUsd) && x.computeCostUsd > x.maxComputeBudgetUsd) blocks.push('COMPUTE_BUDGET_EXCEEDED')
  if (typeof x.activeCompetitors !== 'number' || !Number.isSafeInteger(x.activeCompetitors) || x.activeCompetitors < 0)
    gaps.push('COMPETITOR_COUNT_UNKNOWN')
  else if (x.activeCompetitors >= x.saturationThreshold) gaps.push('SATURATED_COMPETITION')
  const reasons = [...new Set([...blocks,...gaps])]
  const readyForMath = reasons.every(r=>r !== 'SUCCESS_PROBABILITY_UNSUPPORTED' &&
    r !== 'COSTS_OR_EFFORT_UNKNOWN' && r !== 'INDIVIDUAL_USD_REWARD_UNVERIFIED' &&
    r !== 'REWARD_VALUATION_STALE')
  let expectedGrossUsd: number | null = null
  let expectedNetUsd: number | null = null
  let expectedNetUsdPerHour: number | null = null
  let predictedSuccessProbability: number | null = null
  if (readyForMath) {
    const hours = x.estimatedWorkHours as number
    const success = (x.probabilityFinish as number) *
      (x.probabilityAcceptedGivenFinished as number) * (x.probabilityPaidGivenAccepted as number)
    const gross = (x.individualRewardUsd as number) * success
    // Conservatively charge full preparation and review costs even on failure.
    const costs = (x.computeCostUsd as number) + (x.platformFeesUsd as number) +
      (x.fulfillmentCostUsd as number) + (x.reworkReserveUsd as number) +
      (hours + (x.reviewHours as number)) * (x.laborOpportunityCostUsdPerHour as number)
    predictedSuccessProbability = success
    expectedGrossUsd = gross
    expectedNetUsd = gross - costs
    expectedNetUsdPerHour = expectedNetUsd / (hours + (x.reviewHours as number))
  }
  const decision: RevenueScoreResult['decision'] = blocks.length ? 'blocked' :
    gaps.length ? 'insufficient_evidence' :
    expectedNetUsdPerHour === null ? 'insufficient_evidence' :
    expectedNetUsdPerHour < x.minimumExpectedNetUsdPerHour ? 'reject_unprofitable' :
    'research_candidate'
  if (decision === 'reject_unprofitable') reasons.push('NET_HOURLY_BELOW_FLOOR')
  return {
    id:x.id,decision,reasons,expectedGrossUsd,expectedNetUsd,
    expectedNetUsdPerHour,predictedSuccessProbability,
    estimationOnly:true,submissionAuthorized:false,spendingAuthorized:false,earningsRecognizedUsd:0,
  }
}
