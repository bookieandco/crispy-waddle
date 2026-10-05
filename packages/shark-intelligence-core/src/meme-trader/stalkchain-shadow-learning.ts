export type StalkChainShadowHorizon = '15M' | '1H' | '6H' | '24H' | '7D'

export type StalkChainShadowGrade = Readonly<{
  gradeId: string
  subjectType: 'TRADER' | 'THESIS' | 'TOKEN_COHORT'
  subjectId: string
  tokenAddress: string
  horizon: StalkChainShadowHorizon
  decidedAt: string
  evaluatedAt: string
  executableReturnBps: number
  maxFavorableExcursionBps?: number
  maxAdverseExcursionBps?: number
  rug?: boolean
  evidenceIds: readonly string[]
  authority: 'SHADOW_LEARNING_ONLY'
  canExecute: false
  canAuthorizeLive: false
}>

export type StalkChainShadowSummary = Readonly<{
  subjectType: StalkChainShadowGrade['subjectType']
  subjectId: string
  sampleSize: number
  distinctTokenCount: number
  positiveRate: number
  medianExecutableReturnBps: number
  meanExecutableReturnBps: number
  rugRate?: number
  horizonCoverage: Readonly<Record<StalkChainShadowHorizon, number>>
  evidenceIds: readonly string[]
  authority: 'LEARNING_ONLY'
  canExecute: false
  canAuthorizeLive: false
}>

export type StalkChainResearchCadence = 'EVERY_6_HOURS' | 'DAILY' | 'WEEKLY'

export type StalkChainResearchPlan = Readonly<{
  planId: string
  cadence: StalkChainResearchCadence
  leaderboardWindows: readonly ('24h' | '7d' | '30d')[]
  emergingTraderLimit: number
  tokenLimit: number
  includePositionChanges: boolean
  includeTheses: boolean
  includeKolExitPressure: boolean
  includeIndependentVerification: boolean
  output: 'RESEARCH_BRIEF'
  authority: 'RESEARCH_ONLY'
  canExecute: false
  canAuthorizeTrade: false
}>

const HORIZONS: readonly StalkChainShadowHorizon[] = Object.freeze(['15M', '1H', '6H', '24H', '7D'])
const iso = (value: string, code: string): void => {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(code)
}
const finite = (value: number | undefined, code: string): void => {
  if (value !== undefined && !Number.isFinite(value)) throw new Error(code)
}
const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[index]! : (sorted[index - 1]! + sorted[index]!) / 2
}

export function createStalkChainShadowGrade(
  input: Omit<StalkChainShadowGrade, 'authority' | 'canExecute' | 'canAuthorizeLive'>,
): StalkChainShadowGrade {
  if (!input.gradeId.trim() || !input.subjectId.trim() || !input.tokenAddress.trim() || !input.evidenceIds.length) {
    throw new Error('stalkchain_shadow_grade_identity_required')
  }
  iso(input.decidedAt, 'stalkchain_shadow_grade_decided_at_invalid')
  iso(input.evaluatedAt, 'stalkchain_shadow_grade_evaluated_at_invalid')
  if (Date.parse(input.evaluatedAt) < Date.parse(input.decidedAt)) throw new Error('stalkchain_shadow_grade_clock_invalid')
  finite(input.executableReturnBps, 'stalkchain_shadow_grade_return_invalid')
  finite(input.maxFavorableExcursionBps, 'stalkchain_shadow_grade_excursion_invalid')
  finite(input.maxAdverseExcursionBps, 'stalkchain_shadow_grade_excursion_invalid')
  return Object.freeze({
    ...input,
    evidenceIds: Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority: 'SHADOW_LEARNING_ONLY',
    canExecute: false,
    canAuthorizeLive: false,
  })
}

export function summarizeStalkChainShadowGrades(grades: readonly StalkChainShadowGrade[]): StalkChainShadowSummary {
  if (!grades.length) throw new Error('stalkchain_shadow_grades_required')
  const first = grades[0]!
  if (grades.some(grade => grade.subjectType !== first.subjectType || grade.subjectId !== first.subjectId)) {
    throw new Error('stalkchain_shadow_mixed_subject')
  }
  const returns = grades.map(grade => grade.executableReturnBps)
  const rugs = grades.filter(grade => grade.rug !== undefined)
  const horizonCoverage = Object.freeze(Object.fromEntries(HORIZONS.map(horizon => [
    horizon,
    grades.filter(grade => grade.horizon === horizon).length,
  ])) as Record<StalkChainShadowHorizon, number>)

  return Object.freeze({
    subjectType: first.subjectType,
    subjectId: first.subjectId,
    sampleSize: grades.length,
    distinctTokenCount: new Set(grades.map(grade => grade.tokenAddress)).size,
    positiveRate: returns.filter(value => value > 0).length / returns.length,
    medianExecutableReturnBps: median(returns),
    meanExecutableReturnBps: returns.reduce((sum, value) => sum + value, 0) / returns.length,
    rugRate: rugs.length ? rugs.filter(grade => grade.rug === true).length / rugs.length : undefined,
    horizonCoverage,
    evidenceIds: Object.freeze([...new Set(grades.flatMap(grade => grade.evidenceIds))].sort()),
    authority: 'LEARNING_ONLY',
    canExecute: false,
    canAuthorizeLive: false,
  })
}

/**
 * Declarative plan consumed by the production scheduler/worker layer. Keeping
 * this contract in SHARK makes the research workload reproducible without
 * granting the data provider or the schedule any financial authority.
 */
export function createStalkChainResearchPlan(input: Readonly<{
  planId: string
  cadence?: StalkChainResearchCadence
  leaderboardWindows?: readonly ('24h' | '7d' | '30d')[]
  emergingTraderLimit?: number
  tokenLimit?: number
}>): StalkChainResearchPlan {
  const planId = input.planId.trim()
  if (!planId) throw new Error('stalkchain_research_plan_id_required')
  const emergingTraderLimit = input.emergingTraderLimit ?? 25
  const tokenLimit = input.tokenLimit ?? 20
  if (!Number.isInteger(emergingTraderLimit) || emergingTraderLimit < 1 || emergingTraderLimit > 150) {
    throw new Error('stalkchain_research_plan_trader_limit_invalid')
  }
  if (!Number.isInteger(tokenLimit) || tokenLimit < 1 || tokenLimit > 50) {
    throw new Error('stalkchain_research_plan_token_limit_invalid')
  }
  const windows = [...new Set(input.leaderboardWindows ?? ['24h', '7d', '30d'])]
  if (!windows.length) throw new Error('stalkchain_research_plan_windows_required')

  return Object.freeze({
    planId,
    cadence: input.cadence ?? 'DAILY',
    leaderboardWindows: Object.freeze(windows),
    emergingTraderLimit,
    tokenLimit,
    includePositionChanges: true,
    includeTheses: true,
    includeKolExitPressure: true,
    includeIndependentVerification: true,
    output: 'RESEARCH_BRIEF',
    authority: 'RESEARCH_ONLY',
    canExecute: false,
    canAuthorizeTrade: false,
  })
}
