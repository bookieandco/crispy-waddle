import type { Opportunity } from './opportunity.js'
import { isSideHustleProfile, type SideHustleProfile } from './side-hustles.js'

export type SideHustleExperimentStatus = 'planned' | 'running' | 'completed' | 'cancelled'
export type SideHustleExperimentDecision = 'insufficient_evidence' | 'promote' | 'iterate' | 'kill'
export type SideHustleMetricOperator = 'gte' | 'lte'
export type SideHustleMetricAggregation = 'sum' | 'average' | 'min' | 'max' | 'latest'

export type SideHustleExperimentCriterion = {
  id: string
  metric: string
  operator: SideHustleMetricOperator
  threshold: number
  aggregation: SideHustleMetricAggregation
  unit: string
}

export type SideHustleExperiment = {
  id: string
  opportunityId: string
  profile: SideHustleProfile
  hypothesis: string
  targetCustomer: string
  channel: string
  offer: string
  maxSpend: number
  currency: string
  maxHours: number
  maxDurationDays: number
  minimumObservations: number
  successCriteria: SideHustleExperimentCriterion[]
  killCriteria: SideHustleExperimentCriterion[]
  evidenceRefs: string[]
  requiresApproval: true
  status: SideHustleExperimentStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export type SideHustleExperimentObservation = {
  id: string
  experimentId: string
  observedAt: string
  metrics: Record<string, number>
  spend: number
  hours: number
  evidenceRefs: string[]
  notes?: string
}

export type SideHustleExperimentEvaluation = {
  experimentId: string
  opportunityId: string
  decision: SideHustleExperimentDecision
  observationCount: number
  totalSpend: number
  totalHours: number
  successCriteriaMet: string[]
  successCriteriaMissed: string[]
  killCriteriaMet: string[]
  evidenceRefs: string[]
  reasons: string[]
  evaluatedAt: string
}

/**
 * Creates a bounded market-validation plan only.
 *
 * Opportunity Core does not execute the experiment. Any outreach, spend,
 * publishing, procurement, trading, or other consequential action still
 * belongs to the governed execution owner and its approval boundary.
 */
export function createSideHustleExperiment(input: {
  opportunity: Opportunity
  hypothesis: string
  targetCustomer: string
  channel: string
  offer: string
  maxSpend: number
  currency: string
  maxHours: number
  maxDurationDays: number
  minimumObservations: number
  successCriteria: SideHustleExperimentCriterion[]
  killCriteria?: SideHustleExperimentCriterion[]
  evidenceRefs: string[]
  createdAt: string
}): SideHustleExperiment {
  const profile = readSideHustleProfile(input.opportunity)
  if (profile.role === 'capability') {
    throw new Error('Capability-only side hustle profiles cannot be promoted as standalone businesses')
  }
  requireText(input.hypothesis, 'hypothesis')
  requireText(input.targetCustomer, 'targetCustomer')
  requireText(input.channel, 'channel')
  requireText(input.offer, 'offer')
  requireText(input.currency, 'currency')
  requireNonNegative(input.maxSpend, 'maxSpend')
  requirePositive(input.maxHours, 'maxHours')
  requirePositiveInteger(input.maxDurationDays, 'maxDurationDays')
  requirePositiveInteger(input.minimumObservations, 'minimumObservations')
  requireEvidence(input.evidenceRefs, 'Experiment plan')
  if (!Array.isArray(input.successCriteria) || input.successCriteria.length === 0) {
    throw new Error('Experiment plan requires at least one success criterion')
  }
  validateCriteria(input.successCriteria, 'successCriteria')
  validateCriteria(input.killCriteria ?? [], 'killCriteria')
  requireIsoDate(input.createdAt, 'createdAt')

  return {
    id: `side-hustle-experiment:${input.opportunity.id}:${stableExperimentSuffix(input.createdAt)}`,
    opportunityId: input.opportunity.id,
    profile,
    hypothesis: input.hypothesis.trim(),
    targetCustomer: input.targetCustomer.trim(),
    channel: input.channel.trim(),
    offer: input.offer.trim(),
    maxSpend: input.maxSpend,
    currency: input.currency.trim().toUpperCase(),
    maxHours: input.maxHours,
    maxDurationDays: input.maxDurationDays,
    minimumObservations: input.minimumObservations,
    successCriteria: cloneCriteria(input.successCriteria),
    killCriteria: cloneCriteria(input.killCriteria ?? []),
    evidenceRefs: unique(input.evidenceRefs),
    requiresApproval: true,
    status: 'planned',
    createdAt: input.createdAt,
  }
}

export function startSideHustleExperiment(
  experiment: SideHustleExperiment,
  startedAt: string,
): SideHustleExperiment {
  if (experiment.status !== 'planned') throw new Error('Only planned experiments can start')
  requireIsoDate(startedAt, 'startedAt')
  if (Date.parse(startedAt) < Date.parse(experiment.createdAt)) {
    throw new Error('Experiment cannot start before it was created')
  }
  return { ...experiment, status: 'running', startedAt }
}

export function recordSideHustleExperimentObservation(input: {
  experiment: SideHustleExperiment
  observation: SideHustleExperimentObservation
}): SideHustleExperimentObservation {
  const { experiment, observation } = input
  if (experiment.status !== 'running') throw new Error('Experiment must be running before observations can be recorded')
  if (observation.experimentId !== experiment.id) throw new Error('Observation does not belong to experiment')
  requireText(observation.id, 'observation.id')
  requireIsoDate(observation.observedAt, 'observation.observedAt')
  requireNonNegative(observation.spend, 'observation.spend')
  requireNonNegative(observation.hours, 'observation.hours')
  requireEvidence(observation.evidenceRefs, 'Experiment observation')
  if (!observation.metrics || typeof observation.metrics !== 'object' || Array.isArray(observation.metrics)) {
    throw new Error('Experiment observation metrics are required')
  }
  for (const [metric, value] of Object.entries(observation.metrics)) {
    requireText(metric, 'metric')
    if (!Number.isFinite(value)) throw new Error(`Experiment metric ${metric} must be finite`)
  }
  if (experiment.startedAt && Date.parse(observation.observedAt) < Date.parse(experiment.startedAt)) {
    throw new Error('Observation cannot predate experiment start')
  }
  return {
    ...observation,
    metrics: { ...observation.metrics },
    evidenceRefs: unique(observation.evidenceRefs),
  }
}

export function evaluateSideHustleExperiment(input: {
  experiment: SideHustleExperiment
  observations: SideHustleExperimentObservation[]
  evaluatedAt: string
}): SideHustleExperimentEvaluation {
  const { experiment } = input
  requireIsoDate(input.evaluatedAt, 'evaluatedAt')
  if (!['running', 'completed'].includes(experiment.status)) {
    throw new Error('Experiment must be running or completed before evaluation')
  }
  if (experiment.startedAt && Date.parse(input.evaluatedAt) < Date.parse(experiment.startedAt)) {
    throw new Error('Experiment cannot be evaluated before it started')
  }
  if (experiment.status === 'completed') {
    if (!experiment.completedAt) throw new Error('Completed experiment requires completedAt')
    requireIsoDate(experiment.completedAt, 'completedAt')
    if (experiment.startedAt && Date.parse(experiment.completedAt) < Date.parse(experiment.startedAt)) {
      throw new Error('Completed experiment cannot end before it started')
    }
    if (Date.parse(experiment.completedAt) > Date.parse(input.evaluatedAt)) {
      throw new Error('Experiment cannot be evaluated before it completed')
    }
  }
  if (input.observations.some((observation) => Date.parse(observation.observedAt) > Date.parse(input.evaluatedAt))) {
    throw new Error('Experiment evaluation cannot include future observations')
  }
  if (
    experiment.status === 'completed' &&
    experiment.completedAt &&
    input.observations.some((observation) => Date.parse(observation.observedAt) > Date.parse(experiment.completedAt!))
  ) {
    throw new Error('Completed experiment cannot include observations after completion')
  }

  const observations = input.observations.map((observation) =>
    recordSideHustleExperimentObservation({
      experiment: experiment.status === 'completed' ? { ...experiment, status: 'running' } : experiment,
      observation,
    }),
  )
  const totalSpend = round(observations.reduce((sum, observation) => sum + observation.spend, 0))
  const totalHours = round(observations.reduce((sum, observation) => sum + observation.hours, 0))
  const evidenceRefs = unique([
    ...experiment.evidenceRefs,
    ...observations.flatMap((observation) => observation.evidenceRefs),
  ])

  const success = assessCriteria(experiment.successCriteria, observations)
  const kill = assessCriteria(experiment.killCriteria, observations)
  const boundsReasons: string[] = []
  if (totalSpend > experiment.maxSpend) boundsReasons.push(`spend cap exceeded: ${totalSpend} > ${experiment.maxSpend}`)
  if (totalHours > experiment.maxHours) boundsReasons.push(`hour cap exceeded: ${totalHours} > ${experiment.maxHours}`)
  if (experiment.startedAt) {
    const durationEnd = experiment.status === 'completed' && experiment.completedAt
      ? experiment.completedAt
      : input.evaluatedAt
    const elapsedDays = (Date.parse(durationEnd) - Date.parse(experiment.startedAt)) / 86_400_000
    if (elapsedDays > experiment.maxDurationDays) {
      boundsReasons.push(`duration cap exceeded: ${round(elapsedDays)} > ${experiment.maxDurationDays} days`)
    }
  }

  let decision: SideHustleExperimentDecision
  const reasons: string[] = []
  if (boundsReasons.length > 0) {
    decision = 'kill'
    reasons.push(...boundsReasons)
  } else if (kill.met.length > 0) {
    decision = 'kill'
    reasons.push(`kill criteria met: ${kill.met.join(', ')}`)
  } else if (observations.length < experiment.minimumObservations) {
    decision = 'insufficient_evidence'
    reasons.push(`observations ${observations.length}/${experiment.minimumObservations}`)
  } else if (success.missed.length === 0) {
    decision = 'promote'
    reasons.push('all success criteria met within experiment bounds')
  } else {
    decision = 'iterate'
    reasons.push(`success criteria missed: ${success.missed.join(', ')}`)
  }

  return {
    experimentId: experiment.id,
    opportunityId: experiment.opportunityId,
    decision,
    observationCount: observations.length,
    totalSpend,
    totalHours,
    successCriteriaMet: success.met,
    successCriteriaMissed: success.missed,
    killCriteriaMet: kill.met,
    evidenceRefs,
    reasons,
    evaluatedAt: input.evaluatedAt,
  }
}

/**
 * Records the validation recommendation on the opportunity without mutating
 * canonical lifecycle status. A "promote" recommendation is evidence for a
 * later governed readiness decision, not permission to execute.
 */
export function applySideHustleExperimentEvaluation(
  opportunity: Opportunity,
  evaluation: SideHustleExperimentEvaluation,
  now = new Date().toISOString(),
): Opportunity {
  if (evaluation.opportunityId !== opportunity.id) {
    throw new Error('Experiment evaluation does not belong to opportunity')
  }
  return {
    ...opportunity,
    metadata: {
      ...opportunity.metadata,
      sideHustleExperimentId: evaluation.experimentId,
      sideHustleValidationDecision: evaluation.decision,
      sideHustleValidationEvidenceRefs: [...evaluation.evidenceRefs],
      sideHustleValidationReasons: [...evaluation.reasons],
      sideHustleValidationEvaluatedAt: evaluation.evaluatedAt,
    },
    updatedAt: now,
  }
}

export function completeSideHustleExperiment(
  experiment: SideHustleExperiment,
  completedAt: string,
): SideHustleExperiment {
  if (experiment.status !== 'running') throw new Error('Only running experiments can complete')
  requireIsoDate(completedAt, 'completedAt')
  if (experiment.startedAt && Date.parse(completedAt) < Date.parse(experiment.startedAt)) {
    throw new Error('Experiment cannot complete before it started')
  }
  return { ...experiment, status: 'completed', completedAt }
}

function readSideHustleProfile(opportunity: Opportunity): SideHustleProfile {
  const profile = opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile)) {
    throw new Error('Side hustle experiment requires a canonical sideHustleProfile')
  }
  return profile
}

function assessCriteria(
  criteria: SideHustleExperimentCriterion[],
  observations: SideHustleExperimentObservation[],
): { met: string[]; missed: string[] } {
  const met: string[] = []
  const missed: string[] = []

  for (const criterion of criteria) {
    const values = observations
      .map((observation) => observation.metrics[criterion.metric])
      .filter((value): value is number => Number.isFinite(value))

    if (values.length === 0) {
      missed.push(criterion.id)
      continue
    }

    const value = aggregate(values, criterion.aggregation)
    const criterionMet = criterion.operator === 'gte'
      ? value >= criterion.threshold
      : value <= criterion.threshold

    ;(criterionMet ? met : missed).push(criterion.id)
  }

  return { met, missed }
}

function aggregate(values: number[], aggregation: SideHustleMetricAggregation): number {
  switch (aggregation) {
    case 'sum': return values.reduce((sum, value) => sum + value, 0)
    case 'average': return values.reduce((sum, value) => sum + value, 0) / values.length
    case 'min': return Math.min(...values)
    case 'max': return Math.max(...values)
    case 'latest': return values[values.length - 1]
  }
}

function validateCriteria(criteria: SideHustleExperimentCriterion[], field: string): void {
  const ids = new Set<string>()
  for (const criterion of criteria) {
    requireText(criterion.id, `${field}.id`)
    requireText(criterion.metric, `${field}.metric`)
    requireText(criterion.unit, `${field}.unit`)
    if (ids.has(criterion.id)) throw new Error(`${field} criterion ids must be unique`)
    ids.add(criterion.id)
    if (!['gte', 'lte'].includes(criterion.operator)) throw new Error(`${field} operator is invalid`)
    if (!['sum', 'average', 'min', 'max', 'latest'].includes(criterion.aggregation)) throw new Error(`${field} aggregation is invalid`)
    if (!Number.isFinite(criterion.threshold)) throw new Error(`${field} threshold must be finite`)
  }
}

function cloneCriteria(criteria: SideHustleExperimentCriterion[]): SideHustleExperimentCriterion[] {
  return criteria.map((criterion) => ({ ...criterion }))
}

function stableExperimentSuffix(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, '').slice(0, 20)
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
}

function requireEvidence(values: string[], label: string): void {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(`${label} requires non-empty evidence references`)
  }
}

function requireNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative number`)
}

function requirePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} must be a finite positive number`)
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`)
}

function requireIsoDate(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be a valid date`)
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
