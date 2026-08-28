import type { OpportunityLifecycleEvent } from './procurement-opportunity-lifecycle'

export interface ProcurementAward {
  opportunityId: string
  awardId?: string
  recipientName: string
  recipientExternalId?: string
  awardAmount?: number
  currency: string
  awardedAt?: string
  contractStartAt?: string
  contractEndAt?: string
  sourceId: string
  evidenceId?: string
}

export interface IncumbentProfile {
  opportunityId: string
  recipientName: string
  awardAmount?: number
  currency: string
  awardedAt?: string
  contractStartAt?: string
  contractEndAt?: string
  evidenceIds: string[]
}

/** Extracts award facts from lifecycle events without inventing recipient or contract data. */
export function extractProcurementAwards(events: OpportunityLifecycleEvent[]): ProcurementAward[] {
  return events
    .filter((event) => event.type === 'AWARDED' && event.newValue && typeof event.newValue === 'object')
    .map((event) => {
      const value = event.newValue as Record<string, unknown>
      const recipientName = typeof value.recipientName === 'string' ? value.recipientName.trim() : ''
      if (!recipientName) return null
      return {
        opportunityId: event.opportunityId,
        awardId: typeof value.awardId === 'string' ? value.awardId : undefined,
        recipientName,
        recipientExternalId: typeof value.recipientExternalId === 'string' ? value.recipientExternalId : undefined,
        awardAmount: typeof value.awardAmount === 'number' ? value.awardAmount : undefined,
        currency: typeof value.currency === 'string' ? value.currency.toUpperCase() : 'USD',
        awardedAt: typeof value.awardedAt === 'string' ? value.awardedAt : event.effectiveAt,
        contractStartAt: typeof value.contractStartAt === 'string' ? value.contractStartAt : undefined,
        contractEndAt: typeof value.contractEndAt === 'string' ? value.contractEndAt : undefined,
        sourceId: event.sourceId,
        evidenceId: event.evidenceId,
      }
    })
    .filter((award): award is ProcurementAward => award !== null)
}

/** Produces an incumbent profile only when an award record supplies a named recipient. */
export function buildIncumbentProfile(award: ProcurementAward): IncumbentProfile {
  return {
    opportunityId: award.opportunityId,
    recipientName: award.recipientName,
    awardAmount: award.awardAmount,
    currency: award.currency,
    awardedAt: award.awardedAt,
    contractStartAt: award.contractStartAt,
    contractEndAt: award.contractEndAt,
    evidenceIds: award.evidenceId ? [award.evidenceId] : [],
  }
}
