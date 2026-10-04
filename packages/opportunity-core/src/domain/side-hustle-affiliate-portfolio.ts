import type {
  SideHustleAffiliateEconomicState,
  SideHustleAffiliateEvent,
} from './side-hustle-commerce.js'

export type SideHustleAffiliateCurrencyTruth = {
  currency: string
  pendingCommissionAmount: number
  approvedCommissionAmount: number
  paidStateCommissionAmount: number
  rejectedCommissionAmount: number
  reversalAmount: number
  payoutAmount: number
  netApprovedAfterReversals: number
  approvedEpc?: number
  realizedPayoutEpc?: number
  reversalRateByApprovedAmount?: number
  realizedRevenueAmount: number
  realizedRevenueSource: 'PAYOUT_EVENT_ONLY'
}

export type SideHustleAffiliateProgramTruth = {
  providerRef: string
  programRef: string
  clickCount: number
  conversionCount: number
  pendingConversionCount: number
  approvedConversionCount: number
  paidStateConversionCount: number
  rejectedConversionCount: number
  unknownConversionCount: number
  reversalCount: number
  payoutCount: number
  conversionRate?: number
  approvalRate?: number
  rejectionRate?: number
  currencies: SideHustleAffiliateCurrencyTruth[]
  evidenceRefs: string[]
  firstObservedAt?: string
  lastObservedAt?: string
  hasRealizedPayoutEvidence: boolean
  authority: 'AFFILIATE_PORTFOLIO_ANALYTICS_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  paymentAuthorized: false
  moneyMovementAuthorized: false
}

export type SideHustleAffiliatePortfolioTruth = {
  opportunityId?: string
  rawEventCount: number
  canonicalEventCount: number
  programs: SideHustleAffiliateProgramTruth[]
  realizedRevenueSource: 'PAYOUT_EVENT_ONLY'
  warning: 'APPROVED_COMMISSION_IS_NOT_REALIZED_REVENUE'
  authority: 'AFFILIATE_PORTFOLIO_ANALYTICS_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  paymentAuthorized: false
  moneyMovementAuthorized: false
}

type MutableCurrencyTruth = {
  pendingCommissionAmount: number
  approvedCommissionAmount: number
  paidStateCommissionAmount: number
  rejectedCommissionAmount: number
  reversalAmount: number
  payoutAmount: number
}

type MutableProgramTruth = {
  providerRef: string
  programRef: string
  events: SideHustleAffiliateEvent[]
  evidenceRefs: Set<string>
  currencies: Map<string, MutableCurrencyTruth>
}

export function summarizeSideHustleAffiliatePortfolio(
  events: readonly SideHustleAffiliateEvent[],
): SideHustleAffiliatePortfolioTruth {
  const normalized = events.map(assertAffiliateEvent)
  const opportunityIds = unique(normalized.map((event) => event.opportunityId))
  if (opportunityIds.length > 1) {
    throw new Error('Affiliate portfolio cannot combine multiple opportunities')
  }

  const canonical = latestSideHustleAffiliateStates(normalized)
  const programs = new Map<string, MutableProgramTruth>()

  for (const event of canonical) {
    const key = programKey(event)
    let program = programs.get(key)
    if (!program) {
      program = {
        providerRef: event.providerRef,
        programRef: event.programRef,
        events: [],
        evidenceRefs: new Set<string>(),
        currencies: new Map<string, MutableCurrencyTruth>(),
      }
      programs.set(key, program)
    }
    program.events.push(event)
    for (const evidence of event.evidenceRefs) program.evidenceRefs.add(evidence)

    if (event.kind === 'click') continue
    const currency = requireMoneyCurrency(event)
    const amount = event.amount as number
    let bucket = program.currencies.get(currency)
    if (!bucket) {
      bucket = emptyCurrencyTruth()
      program.currencies.set(currency, bucket)
    }

    if (event.kind === 'conversion') {
      switch (event.economicState ?? 'unknown') {
        case 'pending':
          bucket.pendingCommissionAmount += amount
          break
        case 'approved':
          bucket.approvedCommissionAmount += amount
          break
        case 'paid':
          // A provider saying a commission is in a paid state is useful state
          // evidence, but realized revenue still requires a distinct payout event.
          bucket.paidStateCommissionAmount += amount
          break
        case 'rejected':
          bucket.rejectedCommissionAmount += amount
          break
        default:
          break
      }
    } else if (event.kind === 'reversal') {
      bucket.reversalAmount += amount
    } else if (event.kind === 'payout') {
      bucket.payoutAmount += amount
    }
  }

  const programTruth = [...programs.values()]
    .map(finalizeProgram)
    .sort((a, b) =>
      a.providerRef.localeCompare(b.providerRef) ||
      a.programRef.localeCompare(b.programRef),
    )

  return {
    opportunityId: opportunityIds[0],
    rawEventCount: normalized.length,
    canonicalEventCount: canonical.length,
    programs: programTruth,
    realizedRevenueSource: 'PAYOUT_EVENT_ONLY',
    warning: 'APPROVED_COMMISSION_IS_NOT_REALIZED_REVENUE',
    authority: 'AFFILIATE_PORTFOLIO_ANALYTICS_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    paymentAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

export function latestSideHustleAffiliateStates(
  events: readonly SideHustleAffiliateEvent[],
): SideHustleAffiliateEvent[] {
  const latest = new Map<string, SideHustleAffiliateEvent>()
  for (const raw of events) {
    const event = assertAffiliateEvent(raw)
    const key = eventKey(event)
    const existing = latest.get(key)
    if (!existing || isNewerAffiliateState(event, existing)) {
      latest.set(key, event)
    }
  }
  return [...latest.values()].sort((a, b) =>
    Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
    eventKey(a).localeCompare(eventKey(b)),
  )
}

function finalizeProgram(program: MutableProgramTruth): SideHustleAffiliateProgramTruth {
  const clicks = program.events.filter((event) => event.kind === 'click')
  const conversions = program.events.filter((event) => event.kind === 'conversion')
  const reversals = program.events.filter((event) => event.kind === 'reversal')
  const payouts = program.events.filter((event) => event.kind === 'payout')

  const pending = conversions.filter((event) => state(event) === 'pending').length
  const approved = conversions.filter((event) => state(event) === 'approved').length
  const paidState = conversions.filter((event) => state(event) === 'paid').length
  const rejected = conversions.filter((event) => state(event) === 'rejected').length
  const unknown = conversions.filter((event) => state(event) === 'unknown').length
  const approvedOrPaid = approved + paidState

  const currencies = [...program.currencies.entries()]
    .map(([currency, values]): SideHustleAffiliateCurrencyTruth => {
      const approvedGross =
        values.approvedCommissionAmount + values.paidStateCommissionAmount
      const netApprovedAfterReversals = money(
        approvedGross - values.reversalAmount,
      )
      return {
        currency,
        pendingCommissionAmount: money(values.pendingCommissionAmount),
        approvedCommissionAmount: money(values.approvedCommissionAmount),
        paidStateCommissionAmount: money(values.paidStateCommissionAmount),
        rejectedCommissionAmount: money(values.rejectedCommissionAmount),
        reversalAmount: money(values.reversalAmount),
        payoutAmount: money(values.payoutAmount),
        netApprovedAfterReversals,
        approvedEpc:
          clicks.length > 0 ? ratio(netApprovedAfterReversals, clicks.length) : undefined,
        realizedPayoutEpc:
          clicks.length > 0 ? ratio(values.payoutAmount, clicks.length) : undefined,
        reversalRateByApprovedAmount:
          approvedGross > 0 ? ratio(values.reversalAmount, approvedGross) : undefined,
        realizedRevenueAmount: money(values.payoutAmount),
        realizedRevenueSource: 'PAYOUT_EVENT_ONLY',
      }
    })
    .sort((a, b) => a.currency.localeCompare(b.currency))

  const times = program.events
    .map((event) => Date.parse(event.occurredAt))
    .filter(Number.isFinite)

  return {
    providerRef: program.providerRef,
    programRef: program.programRef,
    clickCount: clicks.length,
    conversionCount: conversions.length,
    pendingConversionCount: pending,
    approvedConversionCount: approved,
    paidStateConversionCount: paidState,
    rejectedConversionCount: rejected,
    unknownConversionCount: unknown,
    reversalCount: reversals.length,
    payoutCount: payouts.length,
    conversionRate:
      clicks.length > 0 ? ratio(conversions.length, clicks.length) : undefined,
    approvalRate:
      conversions.length > 0 ? ratio(approvedOrPaid, conversions.length) : undefined,
    rejectionRate:
      conversions.length > 0 ? ratio(rejected, conversions.length) : undefined,
    currencies,
    evidenceRefs: [...program.evidenceRefs].sort(),
    firstObservedAt:
      times.length > 0 ? new Date(Math.min(...times)).toISOString() : undefined,
    lastObservedAt:
      times.length > 0 ? new Date(Math.max(...times)).toISOString() : undefined,
    hasRealizedPayoutEvidence: payouts.length > 0,
    authority: 'AFFILIATE_PORTFOLIO_ANALYTICS_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    paymentAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

function isNewerAffiliateState(
  candidate: SideHustleAffiliateEvent,
  existing: SideHustleAffiliateEvent,
): boolean {
  const candidateTime = Date.parse(candidate.occurredAt)
  const existingTime = Date.parse(existing.occurredAt)
  if (candidateTime !== existingTime) return candidateTime > existingTime

  const candidateState = conservativeStateRank(candidate.economicState)
  const existingState = conservativeStateRank(existing.economicState)
  if (candidateState !== existingState) return candidateState > existingState

  return kindRank(candidate.kind) > kindRank(existing.kind)
}

function conservativeStateRank(state?: SideHustleAffiliateEconomicState): number {
  switch (state) {
    case 'paid':
      return 5
    case 'rejected':
      return 4
    case 'approved':
      return 3
    case 'pending':
      return 2
    default:
      return 1
  }
}

function kindRank(kind: SideHustleAffiliateEvent['kind']): number {
  switch (kind) {
    case 'payout':
      return 4
    case 'reversal':
      return 3
    case 'conversion':
      return 2
    case 'click':
      return 1
  }
}

function assertAffiliateEvent(
  event: SideHustleAffiliateEvent,
): SideHustleAffiliateEvent {
  if (event.family !== 'commerce_affiliate') {
    throw new Error('Affiliate portfolio requires commerce_affiliate events')
  }
  if (!event.providerRef.trim() || !event.programRef.trim() || !event.externalEventRef.trim()) {
    throw new Error('Affiliate portfolio event identity is incomplete')
  }
  if (!Number.isFinite(Date.parse(event.occurredAt))) {
    throw new Error('Affiliate portfolio event timestamp is invalid')
  }
  if (!event.evidenceRefs.length || event.evidenceRefs.some((ref) => !ref.trim())) {
    throw new Error('Affiliate portfolio event evidence is required')
  }
  if (event.kind !== 'click') requireMoneyCurrency(event)
  return event
}

function requireMoneyCurrency(event: SideHustleAffiliateEvent): string {
  if (event.amount === undefined || !Number.isFinite(event.amount) || event.amount < 0) {
    throw new Error(`Affiliate ${event.kind} requires a non-negative amount`)
  }
  const currency = event.currency?.trim().toUpperCase()
  if (!currency) throw new Error(`Affiliate ${event.kind} requires currency`)
  return currency
}

function state(event: SideHustleAffiliateEvent): SideHustleAffiliateEconomicState {
  return event.economicState ?? 'unknown'
}

function emptyCurrencyTruth(): MutableCurrencyTruth {
  return {
    pendingCommissionAmount: 0,
    approvedCommissionAmount: 0,
    paidStateCommissionAmount: 0,
    rejectedCommissionAmount: 0,
    reversalAmount: 0,
    payoutAmount: 0,
  }
}

function eventKey(event: SideHustleAffiliateEvent): string {
  return [
    event.opportunityId,
    event.providerRef,
    event.programRef,
    event.externalEventRef,
  ].join('|')
}

function programKey(event: SideHustleAffiliateEvent): string {
  return [event.providerRef, event.programRef].join('|')
}

function ratio(numerator: number, denominator: number): number {
  return Math.round((numerator / denominator) * 1_000_000) / 1_000_000
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}
