/** JH-ZERO-RIG.03 — purely hypothetical USD-denominated decision-support model. */
export type ZeroRigEconomicsInput = {
  id: string
  rewardUsd: number | null
  rewardValuationObservedAt: string | null
  rewardValuationEvidenceRef: string | null
  expectedWinProbability: number | null
  estimatedHours: number | null
  computeCostUsd: number | null
  claimAndPlatformFeesUsd: number | null
  laborOpportunityCostUsdPerHour: number | null
  minimumExpectedUsdPerHour: number
  now: string
  /** Strict TTL for changing reward/token value. Default 24 hours. */
  maximumValuationAgeHours?: number
}
export type ZeroRigEconomicsAssessment = {
  id: string
  decision: 'research_candidate' | 'reject' | 'insufficient_data'
  expectedGrossUsd: number | null
  expectedNetUsd: number | null
  expectedNetUsdPerHour: number | null
  reasons: string[]
  estimationOnly: true
  expenditureAuthorized: false
  executionAuthorized: false
}
const nonNegative = (v: number | null): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0
const time = (v: string | null): number =>
  v && Number.isFinite(Date.parse(v)) ? Date.parse(v) : NaN

export function assessZeroRigEconomics(input: ZeroRigEconomicsInput): ZeroRigEconomicsAssessment {
  const reasons: string[] = []
  const threshold = input.minimumExpectedUsdPerHour
  const ttl = input.maximumValuationAgeHours ?? 24
  if (!nonNegative(threshold) || !Number.isFinite(ttl) || ttl <= 0 || ttl > 720) {
    throw new Error('ZERO_RIG_INVALID_POLICY')
  }
  const now = time(input.now), observedAt = time(input.rewardValuationObservedAt)
  if (!Number.isFinite(now) || !Number.isFinite(observedAt) ||
      observedAt > now || now - observedAt > ttl * 3_600_000) reasons.push('STALE_OR_MISSING_VALUATION')
  if (!input.rewardValuationEvidenceRef?.trim()) reasons.push('MISSING_VALUATION_PROVENANCE')
  if (!nonNegative(input.rewardUsd)) reasons.push('MISSING_REWARD_USD')
  if (!nonNegative(input.computeCostUsd) || !nonNegative(input.claimAndPlatformFeesUsd) ||
    !nonNegative(input.laborOpportunityCostUsdPerHour)) reasons.push('MISSING_COSTS')
  if (typeof input.expectedWinProbability !== 'number' ||
    !Number.isFinite(input.expectedWinProbability) ||
    input.expectedWinProbability < 0 || input.expectedWinProbability > 1) reasons.push('MISSING_VALID_PROBABILITY')
  if (typeof input.estimatedHours !== 'number' ||
    !Number.isFinite(input.estimatedHours) || input.estimatedHours <= 0) reasons.push('MISSING_EFFORT')
  if (reasons.length > 0) {
    return { id: input.id, decision: 'insufficient_data', expectedGrossUsd: null,
      expectedNetUsd: null, expectedNetUsdPerHour: null, reasons, estimationOnly: true,
      expenditureAuthorized: false, executionAuthorized: false }
  }
  // All inputs validated above. Narrow to numbers without assertions about real earnings.
  const hours = input.estimatedHours as number
  const expectedGrossUsd = (input.rewardUsd as number) * (input.expectedWinProbability as number)
  const expectedNetUsd = expectedGrossUsd - (input.computeCostUsd as number) -
    (input.claimAndPlatformFeesUsd as number) - hours * (input.laborOpportunityCostUsdPerHour as number)
  const expectedNetUsdPerHour = expectedNetUsd / hours
  return {
    id: input.id, decision: expectedNetUsdPerHour > threshold ? 'research_candidate' : 'reject',
    expectedGrossUsd, expectedNetUsd, expectedNetUsdPerHour,
    reasons: expectedNetUsdPerHour > threshold
      ? ['HYPOTHETICAL_RETURN_ABOVE_POLICY_THRESHOLD'] : ['HYPOTHETICAL_RETURN_BELOW_POLICY_THRESHOLD'],
    estimationOnly: true, expenditureAuthorized: false, executionAuthorized: false,
  }
}
