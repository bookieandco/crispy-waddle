import {
  applySideHustleLabValidationEvaluation,
  assessSideHustleLabValidationAdmission,
  buildSideHustleLabOutcomeLearning,
  certifySideHustleLiveFinal,
  completeSideHustleLabResearch,
  isSideHustleProfile,
  projectSideHustleLabPortfolioLearning,
  type OpportunityOutcome,
  type OpportunityPursuitCase,
  type SideHustleLabResearchCompletion,
  type SideHustleLabResearchSynthesis,
  type SideHustleLabValidationAdmission,
  type SideHustleLiveFinalReport,
  type SideHustleMaturityEvidence,
  type SideHustleMaturityPromotionAssessment,
  type VentureMemoryRecord,
  type VentureOpportunity,
  type VentureSupervisorIssue,
  type VentureWorkItem,
} from '@jhadina/opportunity-core'
import type { StoredCanonicalOpportunity } from './canonical'
import type { StoredSideHustleExperiment } from './supabase-opportunity-repository'
import type {
  VentureRuntimeReceipt,
  VentureRuntimeReceiptKind,
  VentureScoutInboxRecord,
} from './venture-runtime-repository'

export type SideHustleLabOpportunityPersistence = {
  get(id: string): Promise<StoredCanonicalOpportunity | undefined>
  getResearchCase(id: string): Promise<OpportunityPursuitCase | undefined>
  getOutcome(id: string): Promise<OpportunityOutcome | undefined>
  listOutcomes(opportunityId: string): Promise<OpportunityOutcome[]>
  listSideHustleExperiments(opportunityId: string): Promise<StoredSideHustleExperiment[]>
}

export type SideHustleLabVenturePersistence = {
  getScoutSignals(ids: string[]): Promise<VentureScoutInboxRecord[]>
  saveVenture(ownerUserId: string, venture: VentureOpportunity): Promise<VentureOpportunity>
  getVenture(ownerUserId: string, ventureId: string): Promise<VentureOpportunity | null>
  getVentureByOpportunity(ownerUserId: string, opportunityId: string): Promise<VentureOpportunity | null>
  listVentures(ownerUserId: string): Promise<VentureOpportunity[]>
  listWorkItems(ownerUserId: string, ventureId?: string): Promise<VentureWorkItem[]>
  listSupervisorIssues(ownerUserId: string, ventureId?: string): Promise<VentureSupervisorIssue[]>
  upsertMemory(ownerUserId: string, records: VentureMemoryRecord[]): Promise<number>
  listMemory(ownerUserId: string, ventureId?: string): Promise<VentureMemoryRecord[]>
  recordReceipt(receipt: VentureRuntimeReceipt): Promise<VentureRuntimeReceipt>
  listReceipts(ownerUserId: string, kind?: VentureRuntimeReceiptKind): Promise<VentureRuntimeReceipt[]>
}

export type SideHustleLabRuntimeDependencies = {
  opportunities: SideHustleLabOpportunityPersistence
  ventures: SideHustleLabVenturePersistence
}

export type SideHustleLabRuntimeControls = Omit<
  SideHustleMaturityEvidence,
  'validationRecords' | 'outcomes'
>

export const SIDE_HUSTLE_LAB_SOFTWARE_EVIDENCE = {
  researchToVentureBound: true,
  validationAdmissionBound: true,
  canonicalExperimentBound: true,
  outcomeToMemoryBound: true,
  outcomeToMaturityBound: true,
  personaProjectionBound: true,
  canonicalOpportunityAuthorityPreserved: true,
  moneyAuthorityExternal: true,
  automaticMaturityPromotionDisabled: true,
  duplicateAuthorityPaths: 0,
} as const

function requireOwner(ownerUserId: string): string {
  const owner = ownerUserId.trim()
  if (!owner) throw new Error('SIDE_HUSTLE_LAB_OWNER_REQUIRED')
  return owner
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isValidationAdmission(value: unknown): value is SideHustleLabValidationAdmission {
  if (!isRecord(value)) return false
  return typeof value.opportunityId === 'string'
    && typeof value.ventureId === 'string'
    && (value.decision === 'eligible' || value.decision === 'blocked')
    && Array.isArray(value.blockers)
    && Array.isArray(value.evidenceRefs)
    && value.requiresApproval === true
    && value.authorizationEffect === 'NONE'
    && typeof value.admittedAt === 'string'
}

function isMaturityAssessment(value: unknown): value is SideHustleMaturityPromotionAssessment {
  if (!isRecord(value)) return false
  return typeof value.opportunityId === 'string'
    && typeof value.from === 'string'
    && typeof value.to === 'string'
    && (value.decision === 'eligible' || value.decision === 'blocked')
    && Array.isArray(value.evidenceRefs)
    && Array.isArray(value.blockers)
    && Array.isArray(value.reasons)
    && value.requiresHumanApproval === true
    && value.authorizationEffect === 'NONE'
}

function payloadContainsTrueKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => payloadContainsTrueKey(item, key))
  if (!isRecord(value)) return false
  if (value[key] === true) return true
  return Object.values(value).some((item) => payloadContainsTrueKey(item, key))
}

function getResearchCaseId(stored: StoredCanonicalOpportunity): string {
  if (stored.researchCaseId?.trim()) return stored.researchCaseId.trim()
  const intake = stored.opportunity.metadata?.ventureLabResearchIntake
  if (isRecord(intake)) {
    const researchCaseId = readString(intake, 'researchCaseId')
    if (researchCaseId) return researchCaseId
  }
  throw new Error('SIDE_HUSTLE_LAB_RESEARCH_CASE_REQUIRED')
}

function receiptPayload<T>(receipt: VentureRuntimeReceipt, key: string): T | undefined {
  const value = receipt.payload[key]
  return value as T | undefined
}

export async function completeSideHustleLabResearchRuntime(input: {
  ownerUserId: string
  opportunityId: string
  synthesis: SideHustleLabResearchSynthesis
  admittedAt?: string
}, dependencies: SideHustleLabRuntimeDependencies) {
  const ownerUserId = requireOwner(input.ownerUserId)
  const opportunityId = input.opportunityId.trim()
  if (!opportunityId) throw new Error('SIDE_HUSTLE_LAB_OPPORTUNITY_REQUIRED')

  const stored = await dependencies.opportunities.get(opportunityId)
  if (!stored) throw new Error('SIDE_HUSTLE_LAB_OPPORTUNITY_NOT_FOUND')
  if (stored.userId && stored.userId !== ownerUserId) {
    throw new Error('SIDE_HUSTLE_LAB_OWNER_MISMATCH')
  }

  const researchCaseId = getResearchCaseId(stored)
  const pursuitCase = await dependencies.opportunities.getResearchCase(researchCaseId)
  if (!pursuitCase) throw new Error('SIDE_HUSTLE_LAB_RESEARCH_CASE_NOT_FOUND')

  const profile = stored.opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile)) throw new Error('SIDE_HUSTLE_LAB_PROFILE_REQUIRED')

  const requestedSignalIds = unique(input.synthesis.signals.map((signal) => signal.id))
  if (!requestedSignalIds.length) throw new Error('SIDE_HUSTLE_LAB_SIGNALS_REQUIRED')
  const persistedSignals = await dependencies.ventures.getScoutSignals(requestedSignalIds)
  if (persistedSignals.length !== requestedSignalIds.length) {
    throw new Error('SIDE_HUSTLE_LAB_SIGNAL_NOT_PERSISTED')
  }
  if (persistedSignals.some((record) => record.family !== profile.family)) {
    throw new Error('SIDE_HUSTLE_LAB_SIGNAL_FAMILY_MISMATCH')
  }
  const byId = new Map(persistedSignals.map((record) => [record.signal.id, record.signal]))
  const canonicalSignals = requestedSignalIds.map((id) => {
    const signal = byId.get(id)
    if (!signal) throw new Error('SIDE_HUSTLE_LAB_SIGNAL_NOT_PERSISTED')
    return signal
  })

  const { venture, completion } = completeSideHustleLabResearch({
    opportunity: stored.opportunity,
    pursuitCase,
    synthesis: {
      ...input.synthesis,
      signals: canonicalSignals,
    },
  })

  await dependencies.ventures.saveVenture(ownerUserId, venture)
  await dependencies.ventures.recordReceipt({
    id: `side-hustle-lab:research-completion:${venture.id}:${pursuitCase.id}`,
    ownerUserId,
    ventureId: venture.id,
    kind: 'research_completion',
    evidenceRefs: completion.evidenceRefs,
    payload: {
      completion,
      canonicalOpportunityId: stored.opportunity.id,
      canonicalOpportunityStatus: stored.opportunity.status,
      authority: 'RESEARCH_ONLY',
      externalActionAuthorized: false,
      automaticExperimentAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: completion.completedAt,
  })

  const admission = assessSideHustleLabValidationAdmission({
    opportunity: stored.opportunity,
    pursuitCase,
    venture,
    completion,
    admittedAt: input.admittedAt ?? completion.completedAt,
  })

  await dependencies.ventures.recordReceipt({
    id: `side-hustle-lab:validation-admission:${venture.id}:${pursuitCase.id}`,
    ownerUserId,
    ventureId: venture.id,
    kind: 'validation_admission',
    evidenceRefs: admission.evidenceRefs,
    payload: {
      admission,
      canonicalOpportunityId: stored.opportunity.id,
      canonicalOpportunityStatus: stored.opportunity.status,
      externalActionAuthorized: false,
      moneyMovementAuthorized: false,
      authorizationEffect: 'NONE',
    },
    recordedAt: admission.admittedAt,
  })

  return {
    venture,
    completion,
    admission,
    canonicalOpportunityMutated: false as const,
    externalActionAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  }
}

export async function loadPersistedSideHustleLabValidationAdmission(input: {
  ownerUserId: string
  ventureId: string
}, ventures: SideHustleLabVenturePersistence): Promise<{
  receipt: VentureRuntimeReceipt
  admission: SideHustleLabValidationAdmission
}> {
  const ownerUserId = requireOwner(input.ownerUserId)
  const ventureId = input.ventureId.trim()
  if (!ventureId) throw new Error('SIDE_HUSTLE_LAB_VENTURE_REQUIRED')

  const receipts = await ventures.listReceipts(ownerUserId, 'validation_admission')
  const receipt = receipts.find((candidate) => candidate.ventureId === ventureId)
  if (!receipt) throw new Error('SIDE_HUSTLE_LAB_VALIDATION_ADMISSION_REQUIRED')
  const admission = receiptPayload<SideHustleLabValidationAdmission>(receipt, 'admission')
  if (!isValidationAdmission(admission)) throw new Error('SIDE_HUSTLE_LAB_VALIDATION_ADMISSION_INVALID')
  if (admission.ventureId !== ventureId) throw new Error('SIDE_HUSTLE_LAB_VALIDATION_ADMISSION_VENTURE_MISMATCH')
  return { receipt, admission }
}

export async function requireEligibleSideHustleLabValidationAdmission(input: {
  ownerUserId: string
  ventureId: string
  opportunityId: string
}, ventures: SideHustleLabVenturePersistence) {
  const persisted = await loadPersistedSideHustleLabValidationAdmission(input, ventures)
  if (persisted.admission.opportunityId !== input.opportunityId) {
    throw new Error('SIDE_HUSTLE_LAB_VALIDATION_ADMISSION_OPPORTUNITY_MISMATCH')
  }
  if (persisted.admission.decision !== 'eligible' || !persisted.admission.proposal) {
    throw new Error('SIDE_HUSTLE_LAB_VALIDATION_NOT_ADMITTED')
  }
  return persisted
}

function selectPromotedExperiment(
  experiments: StoredSideHustleExperiment[],
  bridgedExperimentIds: Set<string>,
): StoredSideHustleExperiment {
  const promoted = experiments
    .filter((record) =>
      bridgedExperimentIds.has(record.experiment.id)
      && record.experiment.status === 'completed'
      && record.evaluation?.decision === 'promote',
    )
    .sort((a, b) =>
      Date.parse(b.experiment.completedAt ?? b.experiment.createdAt)
      - Date.parse(a.experiment.completedAt ?? a.experiment.createdAt),
    )
  const selected = promoted[0]
  if (!selected?.evaluation) throw new Error('SIDE_HUSTLE_LAB_PROMOTED_VALIDATION_REQUIRED')
  return selected
}

export async function projectSideHustleLabPortfolioRuntime(input: {
  ownerUserId: string
  generatedAt?: string
}, ventures: SideHustleLabVenturePersistence) {
  const ownerUserId = requireOwner(input.ownerUserId)
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  const durableVentures = await ventures.listVentures(ownerUserId)
  if (!durableVentures.length) throw new Error('SIDE_HUSTLE_LAB_PORTFOLIO_EMPTY')
  const memories = await ventures.listMemory(ownerUserId)
  const workItems = await ventures.listWorkItems(ownerUserId)
  const supervisorIssues = await ventures.listSupervisorIssues(ownerUserId)
  const maturityReceipts = await ventures.listReceipts(ownerUserId, 'maturity_assessment')
  const maturityAssessments = maturityReceipts
    .map((receipt) => receiptPayload<SideHustleMaturityPromotionAssessment>(receipt, 'assessment'))
    .filter(isMaturityAssessment)

  const projection = projectSideHustleLabPortfolioLearning({
    ventures: durableVentures,
    memories,
    workItems,
    supervisorIssues,
    maturityAssessments,
    generatedAt,
  })

  await ventures.recordReceipt({
    id: `side-hustle-lab:persona-projection:${generatedAt}`,
    ownerUserId,
    kind: 'persona_projection',
    evidenceRefs: projection.jhadina.evidenceRefs,
    payload: {
      projection,
      externalActionAuthorized: false,
      moneyMovementAuthorized: false,
      automaticMaturityPromotionAuthorized: false,
      law: projection.law,
    },
    recordedAt: generatedAt,
  })

  return projection
}

export async function runSideHustleLabOutcomeLearningRuntime(input: {
  ownerUserId: string
  outcomeId: string
  ventureId?: string
  assessedAt?: string
  controls?: SideHustleLabRuntimeControls
}, dependencies: SideHustleLabRuntimeDependencies) {
  const ownerUserId = requireOwner(input.ownerUserId)
  const outcomeId = input.outcomeId.trim()
  if (!outcomeId) throw new Error('SIDE_HUSTLE_LAB_OUTCOME_REQUIRED')

  const outcome = await dependencies.opportunities.getOutcome(outcomeId)
  if (!outcome) throw new Error('SIDE_HUSTLE_LAB_OUTCOME_NOT_FOUND')
  const stored = await dependencies.opportunities.get(outcome.opportunityId)
  if (!stored) throw new Error('SIDE_HUSTLE_LAB_OPPORTUNITY_NOT_FOUND')
  if (stored.userId && stored.userId !== ownerUserId) throw new Error('SIDE_HUSTLE_LAB_OWNER_MISMATCH')

  let venture = input.ventureId
    ? await dependencies.ventures.getVenture(ownerUserId, input.ventureId)
    : await dependencies.ventures.getVentureByOpportunity(ownerUserId, outcome.opportunityId)
  if (!venture) throw new Error('SIDE_HUSTLE_LAB_VENTURE_NOT_FOUND')
  if (venture.opportunityId !== outcome.opportunityId) {
    throw new Error('SIDE_HUSTLE_LAB_OUTCOME_VENTURE_MISMATCH')
  }

  const { admission } = await requireEligibleSideHustleLabValidationAdmission({
    ownerUserId,
    ventureId: venture.id,
    opportunityId: outcome.opportunityId,
  }, dependencies.ventures)

  const experimentReceipts = await dependencies.ventures.listReceipts(ownerUserId, 'experiment_bridge')
  const bridgedExperimentIds = new Set(
    experimentReceipts
      .filter((receipt) => receipt.ventureId === venture!.id)
      .map((receipt) => readString(receipt.payload, 'experimentId'))
      .filter((value): value is string => Boolean(value)),
  )
  const experiments = await dependencies.opportunities.listSideHustleExperiments(outcome.opportunityId)
  const selected = selectPromotedExperiment(experiments, bridgedExperimentIds)
  const evaluation = selected.evaluation!
  const assessedAt = input.assessedAt ?? new Date().toISOString()

  if (venture.lifecycle === 'researched') {
    const validation = applySideHustleLabValidationEvaluation({
      venture,
      admission,
      experiment: selected.experiment,
      evaluation,
      recordedAt: assessedAt,
    })
    venture = await dependencies.ventures.saveVenture(ownerUserId, validation.venture)
    await dependencies.ventures.recordReceipt({
      id: `side-hustle-lab:validation-result:${venture.id}:${selected.experiment.id}`,
      ownerUserId,
      ventureId: venture.id,
      kind: 'validation_result',
      evidenceRefs: validation.evidenceRefs,
      payload: {
        result: validation,
        evaluation,
        externalActionAuthorized: false,
        authorizationEffect: 'NONE',
      },
      recordedAt: validation.recordedAt,
    })
  }

  if (!['validated', 'prototyped', 'shadow', 'launched', 'optimizing', 'scaling'].includes(venture.lifecycle)) {
    throw new Error('SIDE_HUSTLE_LAB_OUTCOME_REQUIRES_VALIDATED_VENTURE')
  }

  const learning = buildSideHustleLabOutcomeLearning({
    opportunity: stored.opportunity,
    venture,
    experiment: selected.experiment,
    evaluation,
    outcome,
    assessedAt,
    controls: input.controls,
  })

  await dependencies.ventures.recordReceipt({
    id: `side-hustle-lab:outcome-bridge:${venture.id}:${outcome.id}`,
    ownerUserId,
    ventureId: venture.id,
    kind: 'outcome_bridge',
    evidenceRefs: learning.evidenceRefs,
    payload: {
      outcomeId: outcome.id,
      experimentId: selected.experiment.id,
      outcomeResult: outcome.result,
      authorizationEffect: 'NONE',
      externalActionAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: outcome.observedAt,
  })

  await dependencies.ventures.upsertMemory(ownerUserId, learning.memories)
  await dependencies.ventures.recordReceipt({
    id: `side-hustle-lab:memory-commit:${venture.id}:${outcome.id}`,
    ownerUserId,
    ventureId: venture.id,
    kind: 'memory_commit',
    evidenceRefs: learning.evidenceRefs,
    payload: {
      outcomeId: outcome.id,
      memoryIds: learning.memories.map((memory) => memory.id),
      memoryCount: learning.memories.length,
      authorizationEffect: 'NONE',
    },
    recordedAt: learning.observedAt,
  })

  if (learning.maturityAssessment) {
    await dependencies.ventures.recordReceipt({
      id: `side-hustle-lab:maturity-assessment:${venture.id}:${outcome.id}`,
      ownerUserId,
      ventureId: venture.id,
      kind: 'maturity_assessment',
      evidenceRefs: learning.maturityAssessment.evidenceRefs,
      payload: {
        assessment: learning.maturityAssessment,
        automaticMaturityPromotionAuthorized: false,
        authorizationEffect: 'NONE',
      },
      recordedAt: learning.maturityAssessment.assessedAt,
    })
  }

  const projection = await projectSideHustleLabPortfolioRuntime({
    ownerUserId,
    generatedAt: assessedAt,
  }, dependencies.ventures)

  return {
    venture,
    outcome,
    experiment: selected.experiment,
    evaluation,
    learning,
    projection,
    automaticMaturityPromotionAuthorized: false as const,
    externalActionAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  }
}

export async function certifySideHustleLiveFinalRuntime(input: {
  ownerUserId: string
  certifiedAt?: string
}, dependencies: SideHustleLabRuntimeDependencies): Promise<{
  report: SideHustleLiveFinalReport
  liveEvidence: {
    researchCompletions: number
    eligibleValidationAdmissions: number
    promotedValidationExperiments: number
    realizedOutcomes: number
    memoryCommits: number
    maturityAssessments: number
    personaProjections: number
    unauthorizedExternalActions: number
    automaticMaturityPromotions: number
  }
}> {
  const ownerUserId = requireOwner(input.ownerUserId)
  const certifiedAt = input.certifiedAt ?? new Date().toISOString()
  const receipts = await dependencies.ventures.listReceipts(ownerUserId)

  const researchReceipts = receipts.filter((receipt) => receipt.kind === 'research_completion')
  const admissionReceipts = receipts.filter((receipt) => receipt.kind === 'validation_admission')
  const experimentBridgeReceipts = receipts.filter((receipt) => receipt.kind === 'experiment_bridge')
  const bridgedExperimentIds = new Set(
    experimentBridgeReceipts
      .map((receipt) => readString(receipt.payload, 'experimentId'))
      .filter((value): value is string => Boolean(value)),
  )

  const eligibleValidationAdmissions = admissionReceipts.filter((receipt) => {
    const admission = receiptPayload<SideHustleLabValidationAdmission>(receipt, 'admission')
    return isValidationAdmission(admission) && admission.decision === 'eligible'
  }).length

  const durableVentures = await dependencies.ventures.listVentures(ownerUserId)
  const promotedExperimentIds = new Set<string>()
  const realizedOutcomeIds = new Set<string>()
  const canonicalEvidenceRefs: string[] = []

  for (const venture of durableVentures) {
    const experiments = await dependencies.opportunities.listSideHustleExperiments(venture.opportunityId)
    for (const record of experiments) {
      if (
        bridgedExperimentIds.has(record.experiment.id)
        && record.experiment.status === 'completed'
        && record.evaluation?.decision === 'promote'
      ) {
        promotedExperimentIds.add(record.experiment.id)
        canonicalEvidenceRefs.push(...record.experiment.evidenceRefs, ...record.evaluation.evidenceRefs)
      }
    }

    const outcomes = await dependencies.opportunities.listOutcomes(venture.opportunityId)
    for (const outcome of outcomes) {
      realizedOutcomeIds.add(outcome.id)
      canonicalEvidenceRefs.push(
        ...outcome.evidenceRefs,
        ...(outcome.transactionRefs ?? []),
        ...(outcome.actionRef ? [outcome.actionRef] : []),
        ...(outcome.executionRef ? [outcome.executionRef] : []),
      )
    }
  }

  const liveEvidence = {
    researchCompletions: researchReceipts.length,
    eligibleValidationAdmissions,
    promotedValidationExperiments: promotedExperimentIds.size,
    realizedOutcomes: realizedOutcomeIds.size,
    memoryCommits: receipts.filter((receipt) => receipt.kind === 'memory_commit').length,
    maturityAssessments: receipts.filter((receipt) => receipt.kind === 'maturity_assessment').length,
    personaProjections: receipts.filter((receipt) => receipt.kind === 'persona_projection').length,
    unauthorizedExternalActions: receipts.filter((receipt) =>
      payloadContainsTrueKey(receipt.payload, 'externalActionAuthorized'),
    ).length,
    automaticMaturityPromotions: receipts.filter((receipt) =>
      payloadContainsTrueKey(receipt.payload, 'automaticMaturityPromotionAuthorized'),
    ).length,
  }

  const report = certifySideHustleLiveFinal({
    software: SIDE_HUSTLE_LAB_SOFTWARE_EVIDENCE,
    live: liveEvidence,
  })

  const evidenceRefs = unique([
    'software:side-hustle-lab-runtime',
    ...receipts.flatMap((receipt) => receipt.evidenceRefs),
    ...canonicalEvidenceRefs,
  ])

  await dependencies.ventures.recordReceipt({
    id: `side-hustle-lab:live-final:${certifiedAt}`,
    ownerUserId,
    kind: 'live_final',
    evidenceRefs,
    payload: {
      report,
      liveEvidence,
      softwareEvidence: SIDE_HUSTLE_LAB_SOFTWARE_EVIDENCE,
      externalActionAuthorized: false,
      moneyMovementAuthorized: false,
      automaticMaturityPromotionAuthorized: false,
    },
    recordedAt: certifiedAt,
  })

  return { report, liveEvidence }
}
