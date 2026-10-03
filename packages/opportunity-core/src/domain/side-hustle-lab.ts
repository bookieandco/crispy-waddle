import type { Opportunity } from './opportunity.js'
import type { OpportunityOutcome } from './outcome.js'
import {
  isPursuitReady,
  type OpportunityPursuitCase,
  type PursuitTaskKind,
} from './pursuit.js'
import {
  assessSideHustleMaturityPromotion,
  nextSideHustleAutomationMaturity,
  type SideHustleMaturityEvidence,
  type SideHustleMaturityPromotionAssessment,
} from './side-hustle-maturity.js'
import {
  proposeSideHustleExperiment,
  type SideHustleExperimentProposal,
} from './side-hustle-experiment-proposal.js'
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
} from './side-hustle-experiment.js'
import {
  isSideHustleDiscoveryProvenance,
  isSideHustleProfile,
  type SideHustleFamily,
} from './side-hustles.js'
import {
  allocateVenturePortfolio,
  buildVentureOpportunity,
  recordVentureMemory,
  transitionVentureLifecycle,
  type VentureDemandThesis,
  type VentureMakeSenseVote,
  type VentureMarketSignal,
  type VentureMemoryRecord,
  type VentureOpportunity,
  type VentureOriginalityInput,
  type VenturePortfolioAllocation,
  type VentureScoreFactors,
  type VentureSupervisorIssue,
  type VentureUnitEconomics,
  type VentureWorkItem,
} from './venture-factory.js'

const LAB_GATE_KINDS = [
  'assess_demand_thesis',
  'assess_make_it_make_sense',
  'assess_originality_ip',
] as const satisfies readonly PursuitTaskKind[]

export type SideHustleLabResearchSynthesis = {
  signals: VentureMarketSignal[]
  demandThesis: VentureDemandThesis
  unitEconomics?: Partial<VentureUnitEconomics>
  scoreFactors: VentureScoreFactors
  makeSense: Omit<VentureMakeSenseVote, 'overall' | 'decision'>
  originalityInput: VentureOriginalityInput
  evidenceRefs: string[]
  synthesizedAt: string
}

export type SideHustleLabResearchCompletion = {
  opportunityId: string
  researchCaseId: string
  ventureId: string
  family: SideHustleFamily
  decision: 'eligible_for_validation' | 'hold' | 'reject'
  gateEvidence: Record<(typeof LAB_GATE_KINDS)[number], string[]>
  evidenceRefs: string[]
  completedAt: string
  authority: 'RESEARCH_ONLY'
  externalActionAuthorized: false
  automaticExperimentAuthorized: false
  moneyMovementAuthorized: false
}

export type SideHustleLabValidationAdmission = {
  opportunityId: string
  ventureId: string
  decision: 'eligible' | 'blocked'
  blockers: string[]
  proposal?: SideHustleExperimentProposal
  evidenceRefs: string[]
  requiresApproval: true
  authorizationEffect: 'NONE'
  admittedAt: string
}

export type SideHustleLabValidationResult = {
  venture: VentureOpportunity
  experimentId: string
  decision: SideHustleExperimentEvaluation['decision']
  lifecycleEffect: 'validated' | 'killed' | 'remain_researched'
  evidenceRefs: string[]
  recordedAt: string
  authorizationEffect: 'NONE'
}

export type SideHustleLabOutcomeLearning = {
  opportunityId: string
  ventureId: string
  memories: VentureMemoryRecord[]
  maturityAssessment?: SideHustleMaturityPromotionAssessment
  evidenceRefs: string[]
  observedAt: string
  automaticMaturityPromotionAuthorized: false
  authorizationEffect: 'NONE'
}

export type SideHustleLabPersonaProjection = {
  generatedAt: string
  janet: {
    office: 'memory_context'
    authority: 'MEMORY_CONTEXT_ONLY'
    memories: VentureMemoryRecord[]
    evidenceRefs: string[]
  }
  delia: {
    office: 'strategy_intelligence'
    authority: 'STRATEGY_ONLY'
    ventures: Array<{
      ventureId: string
      family: SideHustleFamily
      lifecycle: VentureOpportunity['lifecycle']
      score: number
      scoreRecommendation: VentureOpportunity['score']['recommendation']
      makeSenseDecision: VentureOpportunity['makeSenseVote']['decision']
      originalityDecision: VentureOpportunity['originality']['decision']
    }>
    allocations: VenturePortfolioAllocation[]
    evidenceRefs: string[]
    moneyMovementAuthorized: false
  }
  marisa: {
    office: 'operations_execution'
    authority: 'OPERATIONS_COORDINATION_ONLY'
    workItems: VentureWorkItem[]
    supervisorIssues: VentureSupervisorIssue[]
    maturityAssessments: SideHustleMaturityPromotionAssessment[]
    executionOwners: string[]
    evidenceRefs: string[]
    automaticExternalActionAuthorized: false
  }
  jhadina: {
    office: 'executive_command'
    authority: 'GOVERNANCE_ONLY'
    ventureCount: number
    blockedVentureCount: number
    evidenceRefs: string[]
    externalActionAuthorized: false
  }
  law: 'PROJECT_PROVABLE_RUNTIME_STATE_ONLY'
}

export type SideHustleLabSoftwareEvidence = {
  researchToVentureBound: boolean
  validationAdmissionBound: boolean
  canonicalExperimentBound: boolean
  outcomeToMemoryBound: boolean
  outcomeToMaturityBound: boolean
  personaProjectionBound: boolean
  canonicalOpportunityAuthorityPreserved: boolean
  moneyAuthorityExternal: boolean
  automaticMaturityPromotionDisabled: boolean
  duplicateAuthorityPaths: number
}

export type SideHustleLabLiveEvidence = {
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

export type SideHustleLiveFinalReport = {
  status: 'pass' | 'blocked' | 'fail'
  softwareStatus: 'pass' | 'fail'
  liveStatus: 'pass' | 'blocked' | 'fail'
  softwareBlockers: string[]
  liveBlockers: string[]
  externalActionAuthorized: false
  moneyMovementAuthorized: false
  automaticMaturityPromotionAuthorized: false
}

export function completeSideHustleLabResearch(input: {
  opportunity: Opportunity
  pursuitCase: OpportunityPursuitCase
  synthesis: SideHustleLabResearchSynthesis
}): {
  venture: VentureOpportunity
  completion: SideHustleLabResearchCompletion
} {
  const { opportunity, pursuitCase, synthesis } = input
  if (pursuitCase.opportunityId !== opportunity.id) throw new Error('SIDE_HUSTLE_LAB_RESEARCH_CASE_MISMATCH')
  if (!isPursuitReady(pursuitCase)) throw new Error('SIDE_HUSTLE_LAB_RESEARCH_NOT_EVIDENCE_COMPLETE')
  if (!['research_pending', 'ready'].includes(opportunity.status)) {
    throw new Error('SIDE_HUSTLE_LAB_RESEARCH_REQUIRES_CANONICAL_RESEARCH_STATE')
  }
  requireDate(synthesis.synthesizedAt, 'synthesizedAt')
  requireEvidence(synthesis.evidenceRefs, 'Side Hustle Lab synthesis')

  const profile = opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile)) throw new Error('SIDE_HUSTLE_LAB_PROFILE_REQUIRED')
  const discovery = opportunity.metadata?.sideHustleDiscovery
  if (!isSideHustleDiscoveryProvenance(discovery) || discovery.origin !== 'venture_factory') {
    throw new Error('SIDE_HUSTLE_LAB_VENTURE_DISCOVERY_PROVENANCE_REQUIRED')
  }
  if (discovery.recommendation !== 'research') {
    throw new Error('SIDE_HUSTLE_LAB_CANDIDATE_NOT_RESEARCH_READY')
  }

  const intake = opportunity.metadata?.ventureLabResearchIntake as Record<string, unknown> | undefined
  if (
    !intake ||
    intake.origin !== 'venture_factory' ||
    intake.authority !== 'RESEARCH_ONLY' ||
    intake.researchCaseId !== pursuitCase.id
  ) {
    throw new Error('SIDE_HUSTLE_LAB_RESEARCH_INTAKE_MISMATCH')
  }

  const gateEvidence = {
    assess_demand_thesis: completedTaskEvidence(pursuitCase, 'assess_demand_thesis'),
    assess_make_it_make_sense: completedTaskEvidence(pursuitCase, 'assess_make_it_make_sense'),
    assess_originality_ip: completedTaskEvidence(pursuitCase, 'assess_originality_ip'),
  }
  requireOverlap(synthesis.demandThesis.evidenceRefs, gateEvidence.assess_demand_thesis, 'demand thesis')
  requireOverlap(synthesis.makeSense.evidenceRefs, gateEvidence.assess_make_it_make_sense, 'MAKE IT MAKE SENSE')
  requireOverlap(synthesis.originalityInput.evidenceRefs, gateEvidence.assess_originality_ip, 'originality/IP')

  const allowedSignals = new Set(discovery.signalIds)
  if (!synthesis.signals.length || synthesis.signals.some((signal) => !allowedSignals.has(signal.id))) {
    throw new Error('SIDE_HUSTLE_LAB_SIGNALS_MUST_COME_FROM_DISCOVERY_PROVENANCE')
  }

  let venture = buildVentureOpportunity({
    opportunity,
    family: profile.family,
    demandThesis: synthesis.demandThesis,
    signals: synthesis.signals,
    unitEconomics: synthesis.unitEconomics,
    scoreFactors: synthesis.scoreFactors,
    makeSense: synthesis.makeSense,
    originalityInput: synthesis.originalityInput,
    automationMaturity: profile.automationMaturity,
    evidenceRefs: unique([
      ...synthesis.evidenceRefs,
      ...Object.values(gateEvidence).flat(),
    ]),
    createdAt: synthesis.synthesizedAt,
  })

  if (venture.originality.decision === 'pass') {
    venture = transitionVentureLifecycle(
      venture,
      'researched',
      unique([...synthesis.evidenceRefs, ...Object.values(gateEvidence).flat()]),
      synthesis.synthesizedAt,
    )
  } else {
    venture = transitionVentureLifecycle(
      venture,
      'paused',
      gateEvidence.assess_originality_ip,
      synthesis.synthesizedAt,
    )
  }

  const decision: SideHustleLabResearchCompletion['decision'] =
    venture.originality.decision !== 'pass' ||
    venture.makeSenseVote.decision === 'does_not_make_sense' ||
    venture.score.recommendation === 'reject'
      ? 'reject'
      : venture.makeSenseVote.decision !== 'makes_sense' ||
          venture.score.recommendation !== 'validate'
        ? 'hold'
        : 'eligible_for_validation'

  const evidenceRefs = unique([
    ...venture.evidenceRefs,
    ...Object.values(gateEvidence).flat(),
  ])

  return {
    venture,
    completion: {
      opportunityId: opportunity.id,
      researchCaseId: pursuitCase.id,
      ventureId: venture.id,
      family: profile.family,
      decision,
      gateEvidence,
      evidenceRefs,
      completedAt: synthesis.synthesizedAt,
      authority: 'RESEARCH_ONLY',
      externalActionAuthorized: false,
      automaticExperimentAuthorized: false,
      moneyMovementAuthorized: false,
    },
  }
}

export function assessSideHustleLabValidationAdmission(input: {
  opportunity: Opportunity
  pursuitCase: OpportunityPursuitCase
  venture: VentureOpportunity
  completion: SideHustleLabResearchCompletion
  admittedAt: string
}): SideHustleLabValidationAdmission {
  const { opportunity, pursuitCase, venture, completion } = input
  requireDate(input.admittedAt, 'admittedAt')
  const blockers: string[] = []

  if (venture.opportunityId !== opportunity.id || completion.opportunityId !== opportunity.id) {
    blockers.push('Venture/research completion does not belong to the canonical opportunity.')
  }
  if (completion.researchCaseId !== pursuitCase.id || !isPursuitReady(pursuitCase)) {
    blockers.push('Canonical research case is not evidence-complete.')
  }
  if (opportunity.status !== 'ready') blockers.push('Canonical Opportunity must be ready before validation admission.')
  if (completion.decision !== 'eligible_for_validation') blockers.push('Research synthesis did not recommend validation.')
  if (venture.lifecycle !== 'researched') blockers.push('Venture lifecycle must be researched before validation admission.')
  if (venture.originality.decision !== 'pass') blockers.push('Originality/IP gate did not pass.')
  if (venture.makeSenseVote.decision !== 'makes_sense') blockers.push('MAKE IT MAKE SENSE did not pass.')
  if (venture.score.recommendation !== 'validate') blockers.push('Venture score does not recommend validation.')

  const evidenceRefs = unique([...completion.evidenceRefs, ...venture.evidenceRefs])
  let proposal: SideHustleExperimentProposal | undefined
  if (blockers.length === 0) {
    proposal = proposeSideHustleExperiment({
      opportunity,
      evidenceRefs,
      targetCustomer: venture.demandThesis.buyer,
      offer: opportunity.description ?? opportunity.title,
      currency: venture.unitEconomics.currency,
      generatedAt: input.admittedAt,
    })
  }

  return {
    opportunityId: opportunity.id,
    ventureId: venture.id,
    decision: blockers.length === 0 ? 'eligible' : 'blocked',
    blockers,
    proposal,
    evidenceRefs,
    requiresApproval: true,
    authorizationEffect: 'NONE',
    admittedAt: input.admittedAt,
  }
}

export function applySideHustleLabValidationEvaluation(input: {
  venture: VentureOpportunity
  admission: SideHustleLabValidationAdmission
  experiment: SideHustleExperiment
  evaluation: SideHustleExperimentEvaluation
  recordedAt: string
}): SideHustleLabValidationResult {
  requireDate(input.recordedAt, 'recordedAt')
  if (input.admission.decision !== 'eligible') throw new Error('SIDE_HUSTLE_LAB_VALIDATION_NOT_ADMITTED')
  if (input.venture.id !== input.admission.ventureId) throw new Error('SIDE_HUSTLE_LAB_VALIDATION_VENTURE_MISMATCH')
  if (input.experiment.opportunityId !== input.venture.opportunityId) throw new Error('SIDE_HUSTLE_LAB_EXPERIMENT_MISMATCH')
  if (input.experiment.status !== 'completed' || !input.experiment.completedAt) {
    throw new Error('SIDE_HUSTLE_LAB_VALIDATION_REQUIRES_COMPLETED_EXPERIMENT')
  }
  if (
    input.evaluation.experimentId !== input.experiment.id ||
    input.evaluation.opportunityId !== input.venture.opportunityId
  ) {
    throw new Error('SIDE_HUSTLE_LAB_VALIDATION_EVALUATION_MISMATCH')
  }

  let venture = input.venture
  let lifecycleEffect: SideHustleLabValidationResult['lifecycleEffect'] = 'remain_researched'
  if (input.evaluation.decision === 'promote') {
    venture = transitionVentureLifecycle(
      venture,
      'validated',
      unique([...input.experiment.evidenceRefs, ...input.evaluation.evidenceRefs]),
      input.recordedAt,
    )
    lifecycleEffect = 'validated'
  } else if (input.evaluation.decision === 'kill') {
    venture = transitionVentureLifecycle(
      venture,
      'killed',
      unique([...input.experiment.evidenceRefs, ...input.evaluation.evidenceRefs]),
      input.recordedAt,
    )
    lifecycleEffect = 'killed'
  }

  return {
    venture,
    experimentId: input.experiment.id,
    decision: input.evaluation.decision,
    lifecycleEffect,
    evidenceRefs: unique([...input.experiment.evidenceRefs, ...input.evaluation.evidenceRefs]),
    recordedAt: input.recordedAt,
    authorizationEffect: 'NONE',
  }
}

export function buildSideHustleLabOutcomeLearning(input: {
  opportunity: Opportunity
  venture: VentureOpportunity
  experiment: SideHustleExperiment
  evaluation: SideHustleExperimentEvaluation
  outcome: OpportunityOutcome
  assessedAt: string
  controls?: Omit<SideHustleMaturityEvidence, 'validationRecords' | 'outcomes'>
}): SideHustleLabOutcomeLearning {
  requireDate(input.assessedAt, 'assessedAt')
  if (input.venture.opportunityId !== input.opportunity.id || input.outcome.opportunityId !== input.opportunity.id) {
    throw new Error('SIDE_HUSTLE_LAB_OUTCOME_OPPORTUNITY_MISMATCH')
  }
  if (input.venture.lifecycle !== 'validated' && !['prototyped','shadow','launched','optimizing','scaling'].includes(input.venture.lifecycle)) {
    throw new Error('SIDE_HUSTLE_LAB_OUTCOME_REQUIRES_VALIDATED_VENTURE')
  }
  if (input.experiment.opportunityId !== input.opportunity.id || input.evaluation.experimentId !== input.experiment.id) {
    throw new Error('SIDE_HUSTLE_LAB_OUTCOME_VALIDATION_MISMATCH')
  }
  if (input.evaluation.decision !== 'promote') {
    throw new Error('SIDE_HUSTLE_LAB_OUTCOME_REQUIRES_PROMOTED_VALIDATION')
  }

  const evidenceRefs = unique([
    ...input.outcome.evidenceRefs,
    ...(input.outcome.transactionRefs ?? []),
    ...(input.outcome.actionRef ? [input.outcome.actionRef] : []),
    ...(input.outcome.executionRef ? [input.outcome.executionRef] : []),
    ...input.experiment.evidenceRefs,
    ...input.evaluation.evidenceRefs,
  ])
  const confidence = input.outcome.sourceOwner === 'user' ? 80 : 92
  const outcomeSummary = input.outcome.result === 'won'
    ? `Realized outcome: ${input.outcome.currency} ${round2(input.outcome.profit)} profit, ${formatMargin(input.outcome.margin)} margin, after promoted bounded validation.`
    : `Realized loss after promoted bounded validation; preserve the failed assumptions and economics before another test.`

  const memories = [
    recordVentureMemory({
      id: `venture-memory:${input.venture.id}:${input.outcome.id}`,
      ventureId: input.venture.id,
      family: input.venture.family,
      scope: 'venture',
      lesson: outcomeSummary,
      confidence,
      evidenceRefs,
      observedAt: input.outcome.observedAt,
    }),
    recordVentureMemory({
      id: `family-memory:${input.venture.family}:${input.outcome.id}`,
      ventureId: input.venture.id,
      family: input.venture.family,
      scope: 'family',
      lesson: `${input.venture.family} now has realized delivery evidence from ${input.outcome.id}; reuse the measured economics and failure/success conditions, not the creative artifact.`,
      confidence,
      evidenceRefs,
      observedAt: input.outcome.observedAt,
    }),
    recordVentureMemory({
      id: `portfolio-memory:${input.outcome.id}`,
      ventureId: input.venture.id,
      family: input.venture.family,
      scope: 'portfolio',
      lesson: `Portfolio learning receipt for ${input.venture.family}: compare future hypotheses against this realized outcome and its evidence before allocating more attention.`,
      confidence,
      evidenceRefs,
      observedAt: input.outcome.observedAt,
    }),
  ]

  const profile = input.opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile)) throw new Error('SIDE_HUSTLE_LAB_OUTCOME_PROFILE_REQUIRED')
  const target = nextSideHustleAutomationMaturity(profile.automationMaturity)
  const maturityAssessment = target
    ? assessSideHustleMaturityPromotion({
        opportunity: input.opportunity,
        target,
        evidence: {
          validationRecords: [{ experiment: input.experiment, evaluation: input.evaluation }],
          outcomes: [input.outcome],
          ...(input.controls ?? {}),
        },
        assessedAt: input.assessedAt,
      })
    : undefined

  return {
    opportunityId: input.opportunity.id,
    ventureId: input.venture.id,
    memories,
    maturityAssessment,
    evidenceRefs,
    observedAt: input.outcome.observedAt,
    automaticMaturityPromotionAuthorized: false,
    authorizationEffect: 'NONE',
  }
}

export function projectSideHustleLabPortfolioLearning(input: {
  ventures: VentureOpportunity[]
  memories: VentureMemoryRecord[]
  workItems: VentureWorkItem[]
  supervisorIssues: VentureSupervisorIssue[]
  maturityAssessments: SideHustleMaturityPromotionAssessment[]
  generatedAt: string
}): SideHustleLabPersonaProjection {
  requireDate(input.generatedAt, 'generatedAt')
  const allocations = allocateVenturePortfolio(
    input.ventures,
    Object.fromEntries(input.ventures.map((venture) => [venture.id, venture.evidenceRefs])),
  )
  const evidenceRefs = unique([
    ...input.ventures.flatMap((venture) => venture.evidenceRefs),
    ...input.memories.flatMap((memory) => memory.evidenceRefs),
    ...input.workItems.flatMap((item) => item.evidenceRefs),
    ...input.supervisorIssues.flatMap((issue) => issue.evidenceRefs),
    ...input.maturityAssessments.flatMap((assessment) => assessment.evidenceRefs),
  ])
  requireEvidence(evidenceRefs, 'Side Hustle Lab persona projection')

  return {
    generatedAt: input.generatedAt,
    janet: {
      office: 'memory_context',
      authority: 'MEMORY_CONTEXT_ONLY',
      memories: input.memories.map((memory) => ({ ...memory, evidenceRefs: [...memory.evidenceRefs] })),
      evidenceRefs: unique(input.memories.flatMap((memory) => memory.evidenceRefs)),
    },
    delia: {
      office: 'strategy_intelligence',
      authority: 'STRATEGY_ONLY',
      ventures: input.ventures.map((venture) => ({
        ventureId: venture.id,
        family: venture.family,
        lifecycle: venture.lifecycle,
        score: venture.score.total,
        scoreRecommendation: venture.score.recommendation,
        makeSenseDecision: venture.makeSenseVote.decision,
        originalityDecision: venture.originality.decision,
      })),
      allocations,
      evidenceRefs: unique(input.ventures.flatMap((venture) => venture.evidenceRefs)),
      moneyMovementAuthorized: false,
    },
    marisa: {
      office: 'operations_execution',
      authority: 'OPERATIONS_COORDINATION_ONLY',
      workItems: input.workItems.map((item) => ({
        ...item,
        evidenceRefs: [...item.evidenceRefs],
        outputRefs: [...item.outputRefs],
      })),
      supervisorIssues: input.supervisorIssues.map((issue) => ({
        ...issue,
        evidenceRefs: [...issue.evidenceRefs],
      })),
      maturityAssessments: input.maturityAssessments.map((assessment) => ({
        ...assessment,
        evidenceRefs: [...assessment.evidenceRefs],
        blockers: [...assessment.blockers],
        reasons: [...assessment.reasons],
      })),
      executionOwners: unique(input.ventures.flatMap((venture) => venture.executionOwners)),
      evidenceRefs: unique([
        ...input.workItems.flatMap((item) => item.evidenceRefs),
        ...input.supervisorIssues.flatMap((issue) => issue.evidenceRefs),
        ...input.maturityAssessments.flatMap((assessment) => assessment.evidenceRefs),
      ]),
      automaticExternalActionAuthorized: false,
    },
    jhadina: {
      office: 'executive_command',
      authority: 'GOVERNANCE_ONLY',
      ventureCount: input.ventures.length,
      blockedVentureCount: input.ventures.filter((venture) =>
        venture.lifecycle === 'paused' ||
        venture.lifecycle === 'killed' ||
        venture.originality.decision !== 'pass' ||
        venture.makeSenseVote.decision !== 'makes_sense'
      ).length,
      evidenceRefs,
      externalActionAuthorized: false,
    },
    law: 'PROJECT_PROVABLE_RUNTIME_STATE_ONLY',
  }
}

export function certifySideHustleLiveFinal(input: {
  software: SideHustleLabSoftwareEvidence
  live: SideHustleLabLiveEvidence
}): SideHustleLiveFinalReport {
  const softwareBlockers: string[] = []
  if (!input.software.researchToVentureBound) softwareBlockers.push('Research completion is not bound to Venture synthesis.')
  if (!input.software.validationAdmissionBound) softwareBlockers.push('Validation admission is not bound.')
  if (!input.software.canonicalExperimentBound) softwareBlockers.push('Canonical Side Hustle experiment engine is not bound.')
  if (!input.software.outcomeToMemoryBound) softwareBlockers.push('Realized outcomes are not bound to Venture memory.')
  if (!input.software.outcomeToMaturityBound) softwareBlockers.push('Realized outcomes are not bound to Side Hustle maturity assessment.')
  if (!input.software.personaProjectionBound) softwareBlockers.push('Janet/Delia/Marisa projection is not bound.')
  if (!input.software.canonicalOpportunityAuthorityPreserved) softwareBlockers.push('Canonical Opportunity authority is not preserved.')
  if (!input.software.moneyAuthorityExternal) softwareBlockers.push('Money authority is not external.')
  if (!input.software.automaticMaturityPromotionDisabled) softwareBlockers.push('Automatic maturity promotion must remain disabled.')
  if (input.software.duplicateAuthorityPaths !== 0) softwareBlockers.push('Duplicate authority paths remain.')

  const liveBlockers: string[] = []
  if (input.live.unauthorizedExternalActions > 0) liveBlockers.push('Unauthorized external action evidence exists.')
  if (input.live.automaticMaturityPromotions > 0) liveBlockers.push('Automatic maturity promotion evidence exists.')
  if (input.live.researchCompletions < 1) liveBlockers.push('No real research-completion receipt.')
  if (input.live.eligibleValidationAdmissions < 1) liveBlockers.push('No real eligible validation-admission receipt.')
  if (input.live.promotedValidationExperiments < 1) liveBlockers.push('No promoted bounded validation experiment.')
  if (input.live.realizedOutcomes < 1) liveBlockers.push('No realized commercial outcome.')
  if (input.live.memoryCommits < 1) liveBlockers.push('No outcome-backed Venture memory commit.')
  if (input.live.maturityAssessments < 1) liveBlockers.push('No outcome-backed maturity assessment.')
  if (input.live.personaProjections < 1) liveBlockers.push('No evidence-backed persona-office projection.')

  const softwareStatus = softwareBlockers.length === 0 ? 'pass' : 'fail'
  const hardLiveFailure = input.live.unauthorizedExternalActions > 0 || input.live.automaticMaturityPromotions > 0
  const liveStatus: SideHustleLiveFinalReport['liveStatus'] =
    hardLiveFailure ? 'fail' : liveBlockers.length === 0 ? 'pass' : 'blocked'

  return {
    status: softwareStatus === 'fail' || liveStatus === 'fail'
      ? 'fail'
      : liveStatus === 'pass'
        ? 'pass'
        : 'blocked',
    softwareStatus,
    liveStatus,
    softwareBlockers,
    liveBlockers,
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
    automaticMaturityPromotionAuthorized: false,
  }
}

function completedTaskEvidence(
  pursuitCase: OpportunityPursuitCase,
  kind: (typeof LAB_GATE_KINDS)[number],
): string[] {
  const task = pursuitCase.tasks.find((candidate) => candidate.kind === kind)
  if (!task || task.status !== 'completed') throw new Error(`SIDE_HUSTLE_LAB_GATE_INCOMPLETE:${kind}`)
  requireEvidence(task.evidenceRefs, `Side Hustle Lab gate ${kind}`)
  return unique(task.evidenceRefs)
}

function requireOverlap(values: string[], gateValues: string[], label: string): void {
  requireEvidence(values, label)
  const gate = new Set(gateValues)
  if (!values.some((value) => gate.has(value))) {
    throw new Error(`SIDE_HUSTLE_LAB_SYNTHESIS_NOT_BOUND_TO_GATE:${label}`)
  }
}

function requireEvidence(values: string[], label: string): void {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(`${label} requires evidence references`)
  }
}

function requireDate(value: string, field: string): void {
  if (!value?.trim() || !Number.isFinite(Date.parse(value))) throw new Error(`${field} must be a valid date`)
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function formatMargin(value: number | null): string {
  return value === null ? 'n/a' : `${round2(value * 100)}%`
}
