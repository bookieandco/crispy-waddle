import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchCommerceBusinessCycle,
  evaluateSideHustleExperiment,
  isSearchCommerceFamily,
  projectSearchCommerceToBusinessPipeline,
  routineIdFromWorkStep,
  type OpportunityOutcome,
  type SearchCommerceExperimentEvidence,
  type SearchCommerceRoutineId,
  type VentureWorkItem,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

type OutcomeRow = { payload: OpportunityOutcome }
type ExperimentRow = { payload: SearchCommerceExperimentEvidence['experiment'] }
type ObservationRow = { payload: SearchCommerceExperimentEvidence['observations'][number] }

export type SearchCommerceBusinessCycleVentureRepository = Pick<
  VentureRuntimeRepository,
  'listVenturesForSupervisor' | 'listWorkItems' | 'listScoutSignals' | 'upsertWorkItems'
>

export type SearchCommerceBusinessCycleEvidenceRepository = {
  listOutcomes(opportunityId: string): Promise<OpportunityOutcome[]>
  listExperiments(opportunityId: string): Promise<SearchCommerceExperimentEvidence[]>
}

export type SearchCommerceBusinessCycleDependencies = {
  ventures: SearchCommerceBusinessCycleVentureRepository
  evidence: SearchCommerceBusinessCycleEvidenceRepository
}

export type SearchCommerceWorkReconciliation = {
  upserts: VentureWorkItem[]
  superseded: VentureWorkItem[]
  carriedForwardRoutineIds: SearchCommerceRoutineId[]
  unchanged: number
}

class SupabaseSearchCommerceBusinessCycleEvidence
implements SearchCommerceBusinessCycleEvidenceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listOutcomes(opportunityId: string): Promise<OpportunityOutcome[]> {
    const { data, error } = await this.client
      .from('jhadina_opportunity_outcomes')
      .select('payload')
      .eq('opportunity_id', opportunityId)
      .order('observed_at', { ascending: true })
      .returns<OutcomeRow[]>()
    if (error) throw new Error('SEARCH_COMMERCE_OUTCOME_READ_FAILED:' + error.message)
    return (data ?? []).map((row) => row.payload)
  }

  async listExperiments(opportunityId: string): Promise<SearchCommerceExperimentEvidence[]> {
    const [{ data: experiments, error: experimentError }, { data: observations, error: observationError }] =
      await Promise.all([
        this.client
          .from('jhadina_side_hustle_experiments')
          .select('payload')
          .eq('opportunity_id', opportunityId)
          .order('created_at', { ascending: false })
          .returns<ExperimentRow[]>(),
        this.client
          .from('jhadina_side_hustle_experiment_observations')
          .select('payload')
          .eq('opportunity_id', opportunityId)
          .order('observed_at', { ascending: true })
          .returns<ObservationRow[]>(),
      ])
    if (experimentError) throw new Error('SEARCH_COMMERCE_EXPERIMENT_READ_FAILED:' + experimentError.message)
    if (observationError) throw new Error('SEARCH_COMMERCE_EXPERIMENT_OBSERVATION_READ_FAILED:' + observationError.message)

    const allObservations = (observations ?? []).map((row) => row.payload)
    return (experiments ?? []).map((row) => {
      const experiment = row.payload
      const scoped = allObservations.filter((observation) => observation.experimentId === experiment.id)
      const evaluation = ['running', 'completed'].includes(experiment.status)
        ? evaluateSideHustleExperiment({
            experiment,
            observations: scoped,
            evaluatedAt: new Date().toISOString(),
          })
        : undefined
      return { experiment, observations: scoped, evaluation }
    })
  }
}

export async function runVentureSearchCommerceBusinessCycle(
  client: SupabaseClient,
  input: {
    limit?: number
    now?: string
    businessDate?: string
    dependencies?: SearchCommerceBusinessCycleDependencies
  } = {},
) {
  const now = normalizeDate(input.now ?? new Date().toISOString())
  const businessDate = input.businessDate ?? now.slice(0, 10)
  const dependencies = input.dependencies ?? {
    ventures: new VentureRuntimeRepository(client),
    evidence: new SupabaseSearchCommerceBusinessCycleEvidence(client),
  }

  const allVentures = await dependencies.ventures.listVenturesForSupervisor(input.limit ?? 100)
  const ventures = allVentures.filter(({ venture }) => isSearchCommerceFamily(venture.family))
  const signalCache = new Map<string, Awaited<ReturnType<SearchCommerceBusinessCycleVentureRepository['listScoutSignals']>>>()
  const results: Array<{
    ownerUserId: string
    ventureId: string
    opportunityId: string
    family: string
    due: number
    blocked: number
    upserted: number
    superseded: number
    carriedForward: number
    evidenceKeys: number
  }> = []

  for (const { ownerUserId, venture } of ventures) {
    let signals = signalCache.get(venture.family)
    if (!signals) {
      signals = await dependencies.ventures.listScoutSignals({ family: venture.family, limit: 500 })
      signalCache.set(venture.family, signals)
    }

    const [workItems, outcomes, experiments] = await Promise.all([
      dependencies.ventures.listWorkItems(ownerUserId, venture.id),
      dependencies.evidence.listOutcomes(venture.opportunityId),
      dependencies.evidence.listExperiments(venture.opportunityId),
    ])

    const cycle = buildSearchCommerceBusinessCycle({
      venture,
      businessDate,
      observedAt: now,
      workItems,
      scoutSignals: signals.map((record) => record.signal),
      outcomes,
      experiments,
    })

    const runningOrWaiting = new Set(
      workItems
        .filter((item) => item.status === 'running' || item.status === 'waiting')
        .map((item) => routineIdFromWorkStep(item.step))
        .filter((value): value is SearchCommerceRoutineId => Boolean(value)),
    )
    const effectiveDueTasks = cycle.queue.dueTasks.filter((task) => !runningOrWaiting.has(task.routineId))
    const effectiveQueue = Object.freeze({
      ...cycle.queue,
      dueTasks: Object.freeze(effectiveDueTasks),
      blockedDueTasks: Object.freeze(
        effectiveDueTasks.filter((task) => task.missingInputs.length > 0),
      ),
    })

    const projection = projectSearchCommerceToBusinessPipeline({
      ventureId: venture.id,
      queue: effectiveQueue,
      observedAt: now,
      evidenceRefs: cycle.evidence.evidenceRefs,
    })

    const reconciliation = reconcileSearchCommerceProjectedWork({
      existing: workItems,
      planned: projection.items.map((item) => item.ventureWorkItem),
      queue: cycle.queue,
      observedAt: now,
    })
    const writes = [...reconciliation.superseded, ...reconciliation.upserts]
    if (writes.length) {
      await dependencies.ventures.upsertWorkItems(ownerUserId, writes)
    }

    results.push({
      ownerUserId,
      ventureId: venture.id,
      opportunityId: venture.opportunityId,
      family: venture.family,
      due: effectiveQueue.dueTasks.length,
      blocked: effectiveQueue.blockedDueTasks.length,
      upserted: reconciliation.upserts.length,
      superseded: reconciliation.superseded.length,
      carriedForward: reconciliation.carriedForwardRoutineIds.length,
      evidenceKeys: cycle.evidence.availableInputKeys.length,
    })
  }

  return Object.freeze({
    status: 'PASS' as const,
    businessDate,
    observedAt: now,
    scannedVentures: allVentures.length,
    searchCommerceVentures: ventures.length,
    dueTasks: results.reduce((sum, item) => sum + item.due, 0),
    blockedTasks: results.reduce((sum, item) => sum + item.blocked, 0),
    upsertedWorkItems: results.reduce((sum, item) => sum + item.upserted, 0),
    supersededWorkItems: results.reduce((sum, item) => sum + item.superseded, 0),
    carriedForwardRoutines: results.reduce((sum, item) => sum + item.carriedForward, 0),
    results: Object.freeze(results),
    externalActionAuthorized: false as const,
    publishingAuthorized: false as const,
    purchasingAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  })
}

export function reconcileSearchCommerceProjectedWork(input: {
  existing: readonly VentureWorkItem[]
  planned: readonly VentureWorkItem[]
  queue: {
    tasks: readonly { routineId: SearchCommerceRoutineId; periodKey: string }[]
  }
  observedAt: string
}): SearchCommerceWorkReconciliation {
  const observedAt = normalizeDate(input.observedAt)
  const currentIdByRoutine = new Map(
    input.queue.tasks.map((task) => [
      task.routineId,
      businessWorkId(input.planned[0]?.ventureId ?? firstVentureId(input.existing), task.routineId, task.periodKey),
    ]),
  )
  const existingById = new Map(input.existing.map((item) => [item.id, item]))
  const superseded: VentureWorkItem[] = []
  const carriedForward = new Set<SearchCommerceRoutineId>()

  for (const item of input.existing) {
    const routineId = routineIdFromWorkStep(item.step)
    if (!routineId) continue
    if (item.status === 'running' || item.status === 'waiting') {
      carriedForward.add(routineId)
      continue
    }
    if (item.status !== 'queued' && item.status !== 'blocked') continue
    const currentId = currentIdByRoutine.get(routineId)
    if (currentId && item.id !== currentId) {
      superseded.push(Object.freeze({
        ...item,
        status: 'superseded',
        updatedAt: observedAt,
      }))
    }
  }

  const upserts: VentureWorkItem[] = []
  let unchanged = 0
  for (const planned of input.planned) {
    const prior = existingById.get(planned.id)
    if (prior && ['running', 'waiting', 'completed', 'failed', 'superseded'].includes(prior.status)) {
      unchanged += 1
      continue
    }
    if (!prior) {
      upserts.push(planned)
      continue
    }

    const candidate: VentureWorkItem = Object.freeze({
      ...planned,
      createdAt: prior.createdAt,
      updatedAt: observedAt,
      evidenceRefs: Object.freeze(unique([...prior.evidenceRefs, ...planned.evidenceRefs])),
    })
    if (materiallySameWork(prior, candidate)) {
      unchanged += 1
      continue
    }
    upserts.push(candidate)
  }

  return Object.freeze({
    upserts,
    superseded,
    carriedForwardRoutineIds: [...carriedForward].sort(),
    unchanged,
  })
}

function materiallySameWork(a: VentureWorkItem, b: VentureWorkItem): boolean {
  return a.status === b.status
    && a.step === b.step
    && a.agentId === b.agentId
    && a.spendUsd === b.spendUsd
    && arraysEqual(unique(a.evidenceRefs).sort(), unique(b.evidenceRefs).sort())
    && arraysEqual(unique(a.outputRefs).sort(), unique(b.outputRefs).sort())
}

function businessWorkId(
  ventureId: string,
  routineId: SearchCommerceRoutineId,
  periodKey: string,
): string {
  return 'business-work:' + ventureId + ':' + routineId + ':' + periodKey
}

function firstVentureId(items: readonly VentureWorkItem[]): string {
  return items[0]?.ventureId ?? ''
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('SEARCH_COMMERCE_BUSINESS_CYCLE_TIMESTAMP_INVALID')
  return new Date(parsed).toISOString()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
