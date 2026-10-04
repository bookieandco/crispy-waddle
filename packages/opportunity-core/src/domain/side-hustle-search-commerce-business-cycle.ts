import type { OpportunityOutcome } from './outcome.js'
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
  SideHustleExperimentObservation,
} from './side-hustle-experiment.js'
import {
  SEARCH_COMMERCE_EVIDENCE_KEYS,
  SEARCH_COMMERCE_ROUTINE_IDS,
  type SearchCommerceEvidenceKey,
  type SearchCommerceRoutineId,
} from './side-hustle-search-commerce-operations.js'
import {
  buildSearchCommerceDueTaskQueue,
  type SearchCommerceDueTaskQueue,
} from './side-hustle-search-commerce-task-engine.js'
import type { SearchCommerceStorefrontDiagnostic } from './side-hustle-search-commerce-storefront.js'
import type {
  VentureMarketSignal,
  VentureOpportunity,
  VentureWorkItem,
} from './venture-factory.js'

export type SearchCommerceExperimentEvidence = {
  experiment: SideHustleExperiment
  observations: readonly SideHustleExperimentObservation[]
  evaluation?: SideHustleExperimentEvaluation
}

export type SearchCommerceAdditionalEvidence = {
  key: SearchCommerceEvidenceKey
  evidenceRefs: readonly string[]
}

export type SearchCommerceEvidenceEntry = {
  key: SearchCommerceEvidenceKey
  evidenceRefs: readonly string[]
}

export type SearchCommerceEvidenceSnapshot = {
  ventureId: string
  opportunityId: string
  family: VentureOpportunity['family']
  observedAt: string
  availableInputKeys: readonly SearchCommerceEvidenceKey[]
  entries: readonly SearchCommerceEvidenceEntry[]
  evidenceRefs: readonly string[]
  authority: 'SEARCH_COMMERCE_EVIDENCE_ONLY'
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceBusinessCycle = {
  ventureId: string
  opportunityId: string
  family: VentureOpportunity['family']
  businessDate: string
  evidence: SearchCommerceEvidenceSnapshot
  lastCompletedDateByRoutine: Partial<Record<SearchCommerceRoutineId, string>>
  queue: SearchCommerceDueTaskQueue
  authority: 'SIDE_HUSTLE_BUSINESS_FACTORY_PLANNING_ONLY'
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}

const ROUTINE_IDS = new Set<SearchCommerceRoutineId>(SEARCH_COMMERCE_ROUTINE_IDS)
const EVIDENCE_KEYS = new Set<SearchCommerceEvidenceKey>(SEARCH_COMMERCE_EVIDENCE_KEYS)

export function buildSearchCommerceBusinessCycle(input: {
  venture: VentureOpportunity
  businessDate: string
  observedAt: string
  workItems: readonly VentureWorkItem[]
  scoutSignals?: readonly VentureMarketSignal[]
  outcomes?: readonly OpportunityOutcome[]
  experiments?: readonly SearchCommerceExperimentEvidence[]
  additionalEvidence?: readonly SearchCommerceAdditionalEvidence[]
  diagnostic?: SearchCommerceStorefrontDiagnostic
}): SearchCommerceBusinessCycle {
  const evidence = buildSearchCommerceEvidenceSnapshot({
    venture: input.venture,
    observedAt: input.observedAt,
    scoutSignals: input.scoutSignals,
    outcomes: input.outcomes,
    experiments: input.experiments,
    additionalEvidence: input.additionalEvidence,
  })
  const lastCompletedDateByRoutine = deriveSearchCommerceLastCompletedDates(input.workItems)
  const queue = buildSearchCommerceDueTaskQueue({
    family: input.venture.family,
    businessDate: input.businessDate,
    lastCompletedDateByRoutine,
    availableInputKeys: evidence.availableInputKeys,
    diagnostic: input.diagnostic,
  })

  return Object.freeze({
    ventureId: input.venture.id,
    opportunityId: input.venture.opportunityId,
    family: input.venture.family,
    businessDate: queue.businessDate,
    evidence,
    lastCompletedDateByRoutine,
    queue,
    authority: 'SIDE_HUSTLE_BUSINESS_FACTORY_PLANNING_ONLY',
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function buildSearchCommerceEvidenceSnapshot(input: {
  venture: VentureOpportunity
  observedAt: string
  scoutSignals?: readonly VentureMarketSignal[]
  outcomes?: readonly OpportunityOutcome[]
  experiments?: readonly SearchCommerceExperimentEvidence[]
  additionalEvidence?: readonly SearchCommerceAdditionalEvidence[]
}): SearchCommerceEvidenceSnapshot {
  const observedAt = normalizeDate(input.observedAt)
  const evidence = new Map<SearchCommerceEvidenceKey, Set<string>>()

  const add = (key: SearchCommerceEvidenceKey, refs: readonly string[]) => {
    if (!EVIDENCE_KEYS.has(key)) throw new Error('Unknown Search Commerce evidence key')
    const normalized = unique(refs)
    if (!normalized.length) return
    const bucket = evidence.get(key) ?? new Set<string>()
    normalized.forEach((ref) => bucket.add(ref))
    evidence.set(key, bucket)
  }

  const signals = dedupeSignals([
    ...input.venture.signals,
    ...(input.scoutSignals ?? []),
  ])

  if (signals.length) {
    add('market observations', signals.map((signal) => signal.sourceRef))
  }
  const searchSignals = signals.filter((signal) => signal.kind === 'search')
  if (searchSignals.length) {
    const refs = searchSignals.map((signal) => signal.sourceRef)
    add('search observations', refs)
    add('search demand', refs)
  }
  const competitorSignals = signals.filter((signal) =>
    signal.kind === 'competition'
    || /etsy\.com/i.test(signal.sourceRef)
    || /scope:shop_level/i.test(signal.note),
  )
  if (competitorSignals.length) {
    add('competitor observations', competitorSignals.map((signal) => signal.sourceRef))
  }
  const trendSignals = signals.filter((signal) =>
    signal.kind === 'platform_velocity' || signal.kind === 'social',
  )
  if (trendSignals.length) {
    add('trend observations', trendSignals.map((signal) => signal.sourceRef))
  }
  const pricingSignals = signals.filter((signal) => signal.kind === 'pricing')
  if (pricingSignals.length) {
    add('pricing', pricingSignals.map((signal) => signal.sourceRef))
  }

  for (const record of input.experiments ?? []) {
    if (record.evaluation) {
      add('experiment results', record.evaluation.evidenceRefs)
    }
    for (const observation of record.observations) {
      for (const metric of Object.keys(observation.metrics)) {
        const key = evidenceKeyForMetric(metric)
        if (key) add(key, observation.evidenceRefs)
      }
    }
  }

  for (const outcome of input.outcomes ?? []) {
    const refs = unique([
      ...outcome.evidenceRefs,
      ...(outcome.transactionRefs ?? []),
      ...(outcome.actionRef ? [outcome.actionRef] : []),
      ...(outcome.executionRef ? [outcome.executionRef] : []),
    ])
    add('revenue', refs)
    add('refunds/reversals', refs)
    add('fees', refs)
    add('performance observations', refs)
  }

  for (const item of input.additionalEvidence ?? []) {
    add(item.key, item.evidenceRefs)
  }

  const entries = [...evidence.entries()]
    .map(([key, refs]) => Object.freeze({
      key,
      evidenceRefs: Object.freeze([...refs].sort()),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))

  const evidenceRefs = unique([
    ...input.venture.evidenceRefs,
    ...signals.map((signal) => signal.sourceRef),
    ...entries.flatMap((entry) => entry.evidenceRefs),
  ])

  return Object.freeze({
    ventureId: input.venture.id,
    opportunityId: input.venture.opportunityId,
    family: input.venture.family,
    observedAt,
    availableInputKeys: Object.freeze(entries.map((entry) => entry.key)),
    entries: Object.freeze(entries),
    evidenceRefs: Object.freeze(evidenceRefs),
    authority: 'SEARCH_COMMERCE_EVIDENCE_ONLY',
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function deriveSearchCommerceLastCompletedDates(
  workItems: readonly VentureWorkItem[],
): Partial<Record<SearchCommerceRoutineId, string>> {
  const result: Partial<Record<SearchCommerceRoutineId, string>> = {}
  for (const item of workItems) {
    if (item.status !== 'completed') continue
    const routineId = routineIdFromWorkStep(item.step)
    if (!routineId) continue
    const date = normalizeDate(item.updatedAt).slice(0, 10)
    const prior = result[routineId]
    if (!prior || date > prior) result[routineId] = date
  }
  return Object.freeze({ ...result })
}

export function routineIdFromWorkStep(step: string): SearchCommerceRoutineId | undefined {
  const prefix = 'search_commerce:'
  if (!step.startsWith(prefix)) return undefined
  const candidate = step.slice(prefix.length) as SearchCommerceRoutineId
  return ROUTINE_IDS.has(candidate) ? candidate : undefined
}

function evidenceKeyForMetric(metric: string): SearchCommerceEvidenceKey | undefined {
  const normalized = metric.trim().toLowerCase().replace(/[\s.-]+/g, '_')
  switch (normalized) {
    case 'impressions':
      return 'impressions'
    case 'clicks':
      return 'clicks'
    case 'visits':
    case 'sessions':
      return 'visits'
    case 'conversion':
    case 'conversion_rate':
    case 'conversionrate':
      return 'conversion'
    default:
      return undefined
  }
}

function dedupeSignals(signals: readonly VentureMarketSignal[]): VentureMarketSignal[] {
  const byId = new Map<string, VentureMarketSignal>()
  for (const signal of signals) {
    if (!byId.has(signal.id)) byId.set(signal.id, signal)
  }
  return [...byId.values()]
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('Search Commerce evidence timestamp must be valid')
  return new Date(parsed).toISOString()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
