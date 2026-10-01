import {
  createSideHustleExperiment,
  createVentureExperimentProposal,
  type Opportunity,
  type SideHustleExperiment,
  type SideHustleExperimentCriterion,
  type VentureOpportunity,
} from '@jhadina/opportunity-core'

export type VentureExperimentPersistence = {
  createSideHustleExperiment(experiment: SideHustleExperiment): Promise<SideHustleExperiment>
}

export async function createVentureBoundedExperiment(input: {
  venture: VentureOpportunity
  opportunity: Opportunity
  hypothesis: string
  targetCustomer: string
  offer: string
  channel: string
  maxSpend: number
  currency: string
  maxHours: number
  maxDurationDays: number
  minimumObservations: number
  successCriteria: SideHustleExperimentCriterion[]
  killCriteria?: SideHustleExperimentCriterion[]
  evidenceRefs: string[]
  createdAt?: string
}, repository: VentureExperimentPersistence) {
  if (input.venture.opportunityId !== input.opportunity.id) {
    throw new Error('VENTURE_EXPERIMENT_OPPORTUNITY_MISMATCH')
  }

  const createdAt = input.createdAt ?? new Date().toISOString()
  const metricNames = input.successCriteria.map((criterion) => criterion.metric)
  const killMetricNames = (input.killCriteria ?? []).map((criterion) => criterion.metric)

  const proposal = createVentureExperimentProposal({
    venture: input.venture,
    hypothesis: input.hypothesis,
    targetCustomer: input.targetCustomer,
    offer: input.offer,
    channel: input.channel,
    maxSpend: input.maxSpend,
    maxHours: input.maxHours,
    maxDurationDays: input.maxDurationDays,
    minimumObservations: input.minimumObservations,
    successMetrics: metricNames,
    killMetrics: killMetricNames,
    evidenceRefs: input.evidenceRefs,
  })

  const experiment = createSideHustleExperiment({
    opportunity: input.opportunity,
    hypothesis: proposal.hypothesis,
    targetCustomer: proposal.targetCustomer,
    channel: proposal.channel,
    offer: proposal.offer,
    maxSpend: proposal.maxSpend,
    currency: input.currency,
    maxHours: proposal.maxHours,
    maxDurationDays: proposal.maxDurationDays,
    minimumObservations: proposal.minimumObservations,
    successCriteria: input.successCriteria,
    killCriteria: input.killCriteria ?? [],
    evidenceRefs: [...new Set([...proposal.evidenceRefs, ...input.venture.evidenceRefs])],
    createdAt,
  })

  const persisted = await repository.createSideHustleExperiment(experiment)
  return {
    proposal,
    experiment: persisted,
    started: false as const,
    authorizationEffect: 'NONE' as const,
  }
}
