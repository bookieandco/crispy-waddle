import {
  appendVentureRuntimeReceipts,
  buildVentureOpportunity,
  createSideHustleExperiment,
  createVentureRuntimeReceipt,
  initializeVentureRuntimeState,
  mergeVentureSignals,
  normalizeVentureScoutBatch,
  proposeSideHustleExperiment,
  recordSpatialRuntimeProjection,
  recordSupervisorRepair,
  runVentureSupervisorRuntime,
  type Opportunity,
  type SideHustleExperiment,
  type VentureAgent,
  type VentureFactorySoftwareEvidence,
  type VentureHqRoom,
  type VentureRuntimeState,
  type VentureScoutBatch,
  type VentureWorkflow,
} from '@jhadina/opportunity-core'
import type { StoredCanonicalOpportunity } from './canonical'
import { createSupabaseOpportunityRepository } from './supabase-opportunity-repository'

export type VentureRuntimeRepository = {
  get(id: string): Promise<StoredCanonicalOpportunity | undefined>
  upsert(userId: string, opportunity: Opportunity): Promise<StoredCanonicalOpportunity>
  createSideHustleExperiment(experiment: SideHustleExperiment): Promise<SideHustleExperiment>
}

export type VentureMarketScout = {
  id: string
  scan(input: {
    opportunity: Opportunity
    state?: VentureRuntimeState
    capturedAt: string
  }): Promise<VentureScoutBatch>
}

export type PersistedVentureRuntime = {
  stored: StoredCanonicalOpportunity
  state: VentureRuntimeState
}

const METADATA_KEY = 'ventureFactoryRuntime'

export async function createAndPersistVentureRuntime(
  userId: string,
  input: Parameters<typeof buildVentureOpportunity>[0],
  repository: VentureRuntimeRepository = createSupabaseOpportunityRepository(),
): Promise<PersistedVentureRuntime> {
  requireUserId(userId)
  const venture = buildVentureOpportunity(input)
  const state = initializeVentureRuntimeState({
    venture,
    receipts: [
      createVentureRuntimeReceipt({
        ventureId: venture.id,
        kind: 'venture_snapshot',
        occurredAt: venture.createdAt,
        evidenceRefs: venture.evidenceRefs,
        details: {
          family: venture.family,
          lifecycle: venture.lifecycle,
          score: venture.score.total,
          originalityDecision: venture.originality.decision,
          makeSenseDecision: venture.makeSenseVote.decision,
        },
      }),
    ],
  })
  return persistVentureRuntimeState(userId, state, repository)
}

export async function loadVentureRuntimeState(
  opportunityId: string,
  repository: Pick<VentureRuntimeRepository, 'get'> = createSupabaseOpportunityRepository(),
): Promise<VentureRuntimeState | undefined> {
  const stored = await repository.get(opportunityId)
  if (!stored) return undefined
  return readRuntimeMetadata(stored.opportunity)
}

export async function persistVentureRuntimeState(
  userId: string,
  state: VentureRuntimeState,
  repository: Pick<VentureRuntimeRepository, 'get' | 'upsert'> = createSupabaseOpportunityRepository(),
): Promise<PersistedVentureRuntime> {
  requireUserId(userId)
  const stored = await repository.get(state.venture.opportunityId)
  if (!stored) throw new Error('Canonical opportunity not found for venture runtime')
  const updated: Opportunity = {
    ...stored.opportunity,
    metadata: {
      ...stored.opportunity.metadata,
      [METADATA_KEY]: cloneSerializableState(state),
    },
    updatedAt: state.updatedAt,
  }
  const persisted = await repository.upsert(userId, updated)
  return {
    stored: persisted,
    state: readRuntimeMetadata(persisted.opportunity) ?? state,
  }
}

export async function runAndPersistVentureScoutCycle(input: {
  userId: string
  opportunityId: string
  scouts: VentureMarketScout[]
  capturedAt: string
  repository?: VentureRuntimeRepository
}): Promise<PersistedVentureRuntime> {
  requireUserId(input.userId)
  if (!input.scouts.length) throw new Error('At least one venture market scout is required')
  const repository = input.repository ?? createSupabaseOpportunityRepository()
  const stored = await repository.get(input.opportunityId)
  if (!stored) throw new Error('Opportunity not found')
  const state = readRuntimeMetadata(stored.opportunity)
  if (!state) throw new Error('Venture runtime is not initialized')
  if (state.venture.originality.decision !== 'pass') {
    throw new Error('Blocked originality/IP gate prevents venture scouting progression')
  }

  const batches = await Promise.all(
    input.scouts.map(async (scout) => {
      if (!scout.id.trim()) throw new Error('Venture scout id is required')
      return normalizeVentureScoutBatch(await scout.scan({
        opportunity: stored.opportunity,
        state,
        capturedAt: input.capturedAt,
      }))
    }),
  )
  const signals = mergeVentureSignals(state.venture.signals, batches)
  const receipts = batches.map((batch) => createVentureRuntimeReceipt({
    ventureId: state.venture.id,
    kind: 'market_scan',
    occurredAt: batch.capturedAt,
    evidenceRefs: [
      ...batch.evidenceRefs,
      ...batch.signals.map((signal) => signal.sourceRef),
    ],
    details: {
      scoutId: batch.scoutId,
      source: batch.source,
      signalCount: batch.signals.length,
      externalMutationPerformed: false,
    },
  }))

  const next: VentureRuntimeState = {
    ...state,
    venture: {
      ...state.venture,
      signals,
      evidenceRefs: unique([
        ...state.venture.evidenceRefs,
        ...batches.flatMap((batch) => batch.evidenceRefs),
        ...signals.map((signal) => signal.sourceRef),
      ]),
      updatedAt: input.capturedAt,
    },
    receipts: appendVentureRuntimeReceipts(state.receipts, receipts),
    updatedAt: input.capturedAt,
  }
  return persistVentureRuntimeState(input.userId, next, repository)
}

export async function createAndPersistVentureValidationExperiment(input: {
  userId: string
  opportunityId: string
  generatedAt: string
  targetCustomer?: string
  offer?: string
  currency?: string
  maxSpend?: number
  maxHours?: number
  maxDurationDays?: number
  evidenceRefs?: string[]
  repository?: VentureRuntimeRepository
}): Promise<PersistedVentureRuntime & { experiment: SideHustleExperiment }> {
  requireUserId(input.userId)
  const repository = input.repository ?? createSupabaseOpportunityRepository()
  const stored = await repository.get(input.opportunityId)
  if (!stored) throw new Error('Opportunity not found')
  const state = readRuntimeMetadata(stored.opportunity)
  if (!state) throw new Error('Venture runtime is not initialized')
  if (state.venture.originality.decision !== 'pass') {
    throw new Error('Originality/IP gate must pass before validation')
  }
  if (state.venture.makeSenseVote.decision === 'does_not_make_sense') {
    throw new Error('Make It Make Sense blocks validation')
  }

  const proposal = proposeSideHustleExperiment({
    opportunity: stored.opportunity,
    targetCustomer: input.targetCustomer,
    offer: input.offer,
    currency: input.currency,
    maxSpend: input.maxSpend,
    maxHours: input.maxHours,
    maxDurationDays: input.maxDurationDays,
    evidenceRefs: input.evidenceRefs?.length ? input.evidenceRefs : state.venture.evidenceRefs,
    generatedAt: input.generatedAt,
  })

  const experiment = createSideHustleExperiment({
    opportunity: stored.opportunity,
    hypothesis: proposal.hypothesis,
    targetCustomer: proposal.targetCustomer,
    channel: proposal.channel,
    offer: proposal.offer,
    maxSpend: proposal.maxSpend,
    currency: proposal.currency,
    maxHours: proposal.maxHours,
    maxDurationDays: proposal.maxDurationDays,
    minimumObservations: proposal.minimumObservations,
    successCriteria: proposal.successCriteria,
    killCriteria: proposal.killCriteria,
    evidenceRefs: proposal.evidenceRefs,
    createdAt: proposal.generatedAt,
  })
  const persistedExperiment = await repository.createSideHustleExperiment(experiment)
  const receipt = createVentureRuntimeReceipt({
    ventureId: state.venture.id,
    kind: 'experiment_proposal',
    occurredAt: input.generatedAt,
    evidenceRefs: persistedExperiment.evidenceRefs,
    details: {
      experimentId: persistedExperiment.id,
      family: proposal.family,
      archetype: proposal.archetype,
      maxSpend: proposal.maxSpend,
      currency: proposal.currency,
      maxHours: proposal.maxHours,
      maxDurationDays: proposal.maxDurationDays,
      requiresReview: proposal.requiresReview,
    },
  })
  const next: VentureRuntimeState = {
    ...state,
    receipts: appendVentureRuntimeReceipts(state.receipts, [receipt]),
    updatedAt: input.generatedAt,
  }
  const persisted = await persistVentureRuntimeState(input.userId, next, repository)
  return { ...persisted, experiment: persistedExperiment }
}

export async function runAndPersistVentureSupervisor(input: {
  userId: string
  opportunityId: string
  now: string
  evidenceRefs: string[]
  staleAfterHours?: number
  queuePressureThreshold?: number
  marginFloor?: number
  refundRate?: number
  repository?: VentureRuntimeRepository
}): Promise<PersistedVentureRuntime> {
  const repository = input.repository ?? createSupabaseOpportunityRepository()
  const state = await requireRuntime(input.opportunityId, repository)
  const next = runVentureSupervisorRuntime({
    state,
    now: input.now,
    evidenceRefs: input.evidenceRefs,
    staleAfterHours: input.staleAfterHours,
    queuePressureThreshold: input.queuePressureThreshold,
    marginFloor: input.marginFloor,
    refundRate: input.refundRate,
  })
  return persistVentureRuntimeState(input.userId, next, repository)
}

export async function repairAndPersistVentureSupervisorIssue(input: {
  userId: string
  opportunityId: string
  issueId: string
  repairSummary: string
  evidenceRefs: string[]
  repairedAt: string
  repository?: VentureRuntimeRepository
}): Promise<PersistedVentureRuntime> {
  const repository = input.repository ?? createSupabaseOpportunityRepository()
  const state = await requireRuntime(input.opportunityId, repository)
  const next = recordSupervisorRepair({
    state,
    issueId: input.issueId,
    repairSummary: input.repairSummary,
    evidenceRefs: input.evidenceRefs,
    repairedAt: input.repairedAt,
  })
  return persistVentureRuntimeState(input.userId, next, repository)
}

export async function recordAndPersistVentureSpatialRuntime(input: {
  userId: string
  opportunityId: string
  rooms: VentureHqRoom[]
  agents: VentureAgent[]
  workflows: VentureWorkflow[]
  generatedAt: string
  evidenceRefs: string[]
  repository?: VentureRuntimeRepository
}): Promise<PersistedVentureRuntime> {
  const repository = input.repository ?? createSupabaseOpportunityRepository()
  const state = await requireRuntime(input.opportunityId, repository)
  const next = recordSpatialRuntimeProjection({
    state,
    rooms: input.rooms,
    agents: input.agents,
    workflows: input.workflows,
    generatedAt: input.generatedAt,
    evidenceRefs: input.evidenceRefs,
  })
  return persistVentureRuntimeState(input.userId, next, repository)
}

export async function recordAndPersistVentureCommercialOutcome(input: {
  userId: string
  opportunityId: string
  outcomeRef: string
  occurredAt: string
  amount?: number
  currency?: string
  repository?: VentureRuntimeRepository
}): Promise<PersistedVentureRuntime> {
  const repository = input.repository ?? createSupabaseOpportunityRepository()
  const state = await requireRuntime(input.opportunityId, repository)
  if (!input.outcomeRef.trim()) throw new Error('outcomeRef is required')
  if (input.amount !== undefined && (!Number.isFinite(input.amount) || input.amount < 0)) {
    throw new Error('amount must be a finite non-negative number')
  }
  const receipt = createVentureRuntimeReceipt({
    ventureId: state.venture.id,
    kind: 'commercial_outcome',
    occurredAt: input.occurredAt,
    evidenceRefs: [input.outcomeRef],
    details: {
      outcomeRef: input.outcomeRef,
      amount: input.amount,
      currency: input.currency?.trim().toUpperCase(),
    },
  })
  const next = {
    ...state,
    receipts: appendVentureRuntimeReceipts(state.receipts, [receipt]),
    updatedAt: input.occurredAt,
  }
  return persistVentureRuntimeState(input.userId, next, repository)
}

export function ventureRuntimeSoftwareEvidence(): VentureFactorySoftwareEvidence {
  return {
    opportunitySchemaBound: true,
    marketSignalsBound: true,
    originalityGateBound: true,
    makeSenseVoteBound: true,
    experimentBridgeBound: true,
    lifecycleBound: true,
    supervisorBound: true,
    memoryBound: true,
    portfolioAllocatorBound: true,
    spatialProjectionBound: true,
    actionGovernanceBound: true,
    moneyAuthorityIsExternal: true,
    duplicateAuthorityPaths: 0,
  }
}

async function requireRuntime(
  opportunityId: string,
  repository: Pick<VentureRuntimeRepository, 'get'>,
): Promise<VentureRuntimeState> {
  const stored = await repository.get(opportunityId)
  if (!stored) throw new Error('Opportunity not found')
  const state = readRuntimeMetadata(stored.opportunity)
  if (!state) throw new Error('Venture runtime is not initialized')
  return state
}

function readRuntimeMetadata(opportunity: Opportunity): VentureRuntimeState | undefined {
  const value = opportunity.metadata?.[METADATA_KEY]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const state = value as VentureRuntimeState
  if (!state.venture || state.venture.opportunityId !== opportunity.id) return undefined
  return cloneSerializableState(state)
}

function cloneSerializableState(state: VentureRuntimeState): VentureRuntimeState {
  return JSON.parse(JSON.stringify(state)) as VentureRuntimeState
}

function requireUserId(userId: string): void {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('userId is required')
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
