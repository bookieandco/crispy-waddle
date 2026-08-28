export type RecurringDemandInput = {
  opportunityId: string
  entityId: string
  contractValue?: number
  startAt?: string
  expirationAt?: string
  incumbentProviderId?: string
  awardEvidenceIds: string[]
  expirationEvidenceId?: string
  historicalAwardIds?: string[]
}

export type RecurringDemandAssessment = {
  opportunityId: string
  entityId: string
  annualizedValue?: number
  incumbentProviderId?: string
  recompeteAt?: string
  preparationWindowStartAt?: string
  historicalAwardCount: number
  evidenceIds: string[]
  signals: string[]
}

function positive(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? value : undefined
}

/**
 * Turns an observed award/contract into a future-demand signal. This is a
 * forecasting aid, not a claim that an agency must recompete or renew.
 */
export function assessRecurringDemand(input: RecurringDemandInput): RecurringDemandAssessment {
  const start = input.startAt ? new Date(input.startAt).getTime() : undefined
  const expiration = input.expirationAt ? new Date(input.expirationAt).getTime() : undefined
  const durationMonths = start !== undefined && expiration !== undefined && expiration > start
    ? Math.max(1, (expiration - start) / (30.44 * 86_400_000))
    : undefined
  const annualizedValue = input.contractValue !== undefined && durationMonths
    ? input.contractValue / (durationMonths / 12)
    : positive(input.contractValue)

  const historicalAwardCount = input.historicalAwardIds?.length ?? 0
  const signals: string[] = []
  if (annualizedValue !== undefined) signals.push('recurring spend observed')
  if (input.expirationAt) signals.push('known contract expiration')
  if (input.incumbentProviderId) signals.push('incumbent identified')
  if (historicalAwardCount > 0) signals.push('historical award activity')

  let recompeteAt: string | undefined
  let preparationWindowStartAt: string | undefined
  if (input.expirationAt) {
    const expiry = new Date(input.expirationAt)
    recompeteAt = expiry.toISOString()
    const prep = new Date(expiry)
    prep.setUTCDate(prep.getUTCDate() - 180)
    preparationWindowStartAt = prep.toISOString()
  }

  return {
    opportunityId: input.opportunityId,
    entityId: input.entityId,
    annualizedValue,
    incumbentProviderId: input.incumbentProviderId,
    recompeteAt,
    preparationWindowStartAt,
    historicalAwardCount,
    evidenceIds: [
      ...input.awardEvidenceIds,
      ...(input.expirationEvidenceId ? [input.expirationEvidenceId] : []),
    ],
    signals,
  }
}

export function rankRecurringDemand(items: RecurringDemandAssessment[]): RecurringDemandAssessment[] {
  return [...items].sort((a, b) => {
    const valueA = a.annualizedValue ?? 0
    const valueB = b.annualizedValue ?? 0
    if (valueB !== valueA) return valueB - valueA
    return b.historicalAwardCount - a.historicalAwardCount
  })
}
