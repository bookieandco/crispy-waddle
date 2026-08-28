export type GovernmentContractLifecycleStage =
  | 'FORECAST'
  | 'MARKET_RESEARCH'
  | 'PRE_SOLICITATION'
  | 'SOLICITATION'
  | 'EVALUATION'
  | 'AWARD'
  | 'ACTIVE'
  | 'OPTION_WINDOW'
  | 'EXTENSION'
  | 'EXPIRING'
  | 'RECOMPETE'
  | 'CLOSED'

export interface GovernmentContractLifecycle {
  opportunityId: string
  stage: GovernmentContractLifecycleStage
  baseStartDate?: string
  baseEndDate?: string
  optionPeriods: Array<{
    number: number
    startDate: string
    endDate: string
    exercised?: boolean
  }>
  orderingEndDate?: string
  lastKnownAwardDate?: string
  incumbentName?: string
  incumbentAwardId?: string
  recompeteExpected?: boolean
  recompeteExpectedDate?: string
  evidenceUrls: string[]
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface LifecycleSignal {
  stage: GovernmentContractLifecycleStage
  signal: string
  effectiveDate?: string
  sourceUrl?: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
}

const toTime = (value?: string): number | undefined => {
  if (!value) return undefined
  const time = Date.parse(value)
  return Number.isNaN(time) ? undefined : time
}

/**
 * Projects a lifecycle record into the next actionable government-demand state.
 * This is deterministic and deliberately does not infer award eligibility.
 */
export function deriveNextLifecycleSignal(
  lifecycle: GovernmentContractLifecycle,
  now = new Date(),
): LifecycleSignal {
  const nowTime = now.getTime()

  if (lifecycle.stage === 'CLOSED') {
    return { stage: 'CLOSED', signal: 'Contract is closed', confidence: 'HIGH' }
  }

  const nextOption = lifecycle.optionPeriods
    .filter((period) => !period.exercised)
    .map((period) => ({ period, start: toTime(period.startDate), end: toTime(period.endDate) }))
    .filter(({ start, end }) => start !== undefined && end !== undefined && end >= nowTime)
    .sort((a, b) => (a.start! - b.start!))[0]

  if (nextOption) {
    if (nextOption.start! <= nowTime) {
      return {
        stage: 'OPTION_WINDOW',
        signal: `Option period ${nextOption.period.number} is currently actionable`,
        effectiveDate: nextOption.period.startDate,
        confidence: 'HIGH',
      }
    }

    return {
      stage: 'OPTION_WINDOW',
      signal: `Option period ${nextOption.period.number} begins ${nextOption.period.startDate}`,
      effectiveDate: nextOption.period.startDate,
      confidence: 'HIGH',
    }
  }

  const orderingEnd = toTime(lifecycle.orderingEndDate)
  if (orderingEnd !== undefined && orderingEnd >= nowTime) {
    return {
      stage: 'ACTIVE',
      signal: `Ordering period remains open through ${lifecycle.orderingEndDate}`,
      effectiveDate: lifecycle.orderingEndDate,
      confidence: 'HIGH',
    }
  }

  const recompeteDate = toTime(lifecycle.recompeteExpectedDate)
  if (lifecycle.recompeteExpected && recompeteDate !== undefined) {
    return {
      stage: 'RECOMPETE',
      signal: `Recompete expected around ${lifecycle.recompeteExpectedDate}`,
      effectiveDate: lifecycle.recompeteExpectedDate,
      confidence: lifecycle.confidence,
    }
  }

  const baseEnd = toTime(lifecycle.baseEndDate)
  if (baseEnd !== undefined && baseEnd >= nowTime) {
    return {
      stage: 'ACTIVE',
      signal: `Base period remains active through ${lifecycle.baseEndDate}`,
      effectiveDate: lifecycle.baseEndDate,
      confidence: 'HIGH',
    }
  }

  return {
    stage: lifecycle.stage,
    signal: lifecycle.incumbentName
      ? `Historical contract identified; incumbent is ${lifecycle.incumbentName}`
      : 'Historical contract identified; future procurement timing is not yet known',
    confidence: lifecycle.confidence,
  }
}

export function scoreLifecycleActionability(
  lifecycle: GovernmentContractLifecycle,
  now = new Date(),
): number {
  const signal = deriveNextLifecycleSignal(lifecycle, now)

  switch (signal.stage) {
    case 'RECOMPETE':
      return 100
    case 'EXPIRING':
      return 95
    case 'PRE_SOLICITATION':
      return 90
    case 'MARKET_RESEARCH':
      return 85
    case 'SOLICITATION':
      return 80
    case 'FORECAST':
      return 70
    case 'OPTION_WINDOW':
      return 55
    case 'ACTIVE':
      return 40
    case 'AWARD':
      return 35
    case 'EVALUATION':
      return 30
    case 'EXTENSION':
      return 25
    case 'CLOSED':
      return 0
    default:
      return 10
  }
}
