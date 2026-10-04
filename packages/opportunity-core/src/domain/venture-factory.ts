import type { Opportunity } from './opportunity.js'
import {
  buildSideHustleProfile,
  isSideHustleProfile,
  type SideHustleAutomationMaturity,
  type SideHustleFamily,
  type SideHustleMonetizationModel,
  type SideHustleProfile,
} from './side-hustles.js'

export type VentureLifecycleStage =
  | 'discovered'
  | 'researched'
  | 'validated'
  | 'prototyped'
  | 'shadow'
  | 'launched'
  | 'optimizing'
  | 'scaling'
  | 'paused'
  | 'killed'
  | 'archived'

export type VentureSignalKind =
  | 'sales'
  | 'reviews'
  | 'search'
  | 'social'
  | 'pricing'
  | 'competition'
  | 'buyer_pain'
  | 'repeat_purchase'
  | 'platform_velocity'
  | 'other'

export type VentureMarketSignal = {
  id: string
  kind: VentureSignalKind
  sourceRef: string
  observedAt: string
  value?: number
  unit?: string
  note: string
  confidence: number
}

export type VentureDemandThesis = {
  buyer: string
  jobToBeDone: string
  paidProblem: string
  marketMechanic: string
  unmetAngles: string[]
  disconfirmingEvidence: string[]
  evidenceRefs: string[]
}

export type VentureUnitEconomics = {
  currency: string
  expectedPrice?: number
  expectedVariableCost?: number
  expectedGrossMargin?: number
  expectedAcquisitionCost?: number
  expectedRefundRate?: number
}

export type VentureOriginalityInput = {
  marketMechanics: string[]
  competitorArtifactRefs: string[]
  proposedCreative: string
  protectedTerms?: string[]
  protectedCharacters?: string[]
  copiedPhrases?: string[]
  intentionalStyleClone?: boolean
  evidenceRefs: string[]
}

export type VentureOriginalityAssessment = {
  decision: 'pass' | 'block'
  reasons: string[]
  evidenceRefs: string[]
  directReplicationAuthorized: false
  competitorAssetReuseAuthorized: false
}

export type VentureMakeSenseVote = {
  coherence: number
  causalLogic: number
  chronology: number
  incentives: number
  baseRates: number
  contradictionHandling: number
  alternativesConsidered: number
  evidenceQuality: number
  overall: number
  decision: 'makes_sense' | 'weak' | 'does_not_make_sense'
  notes: string[]
  evidenceRefs: string[]
}

export type VentureScoreFactors = {
  demandProof: number
  grossMarginPotential: number
  automationPotential: number
  competitionHeadroom: number
  differentiation: number
  startupEfficiency: number
  timeToEvidence: number
  repeatability: number
  legalPlatformSafety: number
  crossJhadinaLeverage: number
}

export type VentureScore = {
  total: number
  factors: VentureScoreFactors
  evidenceRefs: string[]
  recommendation: 'validate' | 'hold' | 'reject'
}

export type VentureOpportunity = {
  id: string
  opportunityId: string
  title: string
  family: SideHustleFamily
  profile: SideHustleProfile
  lifecycle: VentureLifecycleStage
  demandThesis: VentureDemandThesis
  signals: VentureMarketSignal[]
  unitEconomics: VentureUnitEconomics
  score: VentureScore
  makeSenseVote: VentureMakeSenseVote
  originality: VentureOriginalityAssessment
  executionOwners: string[]
  monetizationModels: SideHustleMonetizationModel[]
  riskFlags: string[]
  evidenceRefs: string[]
  createdAt: string
  updatedAt: string
  externalExecutionAuthorized: false
  paymentAuthorized: false
  publishingAuthorized: false
  outreachAuthorized: false
}

export type VentureExperimentProposal = {
  ventureId: string
  hypothesis: string
  targetCustomer: string
  offer: string
  channel: string
  maxSpend: number
  maxHours: number
  maxDurationDays: number
  minimumObservations: number
  successMetrics: string[]
  killMetrics: string[]
  evidenceRefs: string[]
  requiresApproval: true
  authorizationEffect: 'NONE'
}

export type VentureSupervisorIssueKind =
  | 'stalled'
  | 'queue_pressure'
  | 'repeated_failure'
  | 'policy_block'
  | 'margin_failure'
  | 'refund_spike'
  | 'evidence_gap'
  | 'budget_pressure'
  | 'other'

export type VentureSupervisorIssue = {
  id: string
  ventureId: string
  kind: VentureSupervisorIssueKind
  severity: 'info' | 'warning' | 'critical'
  detectedAt: string
  summary: string
  evidenceRefs: string[]
  recommendedAction: 'observe' | 'repair' | 'pause' | 'kill' | 'escalate'
  automaticExternalActionAuthorized: false
}

export type VentureMemoryRecord = {
  id: string
  ventureId: string
  family: SideHustleFamily
  lesson: string
  scope: 'venture' | 'family' | 'portfolio'
  confidence: number
  evidenceRefs: string[]
  observedAt: string
}

export type VenturePortfolioAllocation = {
  ventureId: string
  priority: 'high' | 'medium' | 'low' | 'blocked'
  reason: string
  resourceShareBps: number
  evidenceRefs: string[]
  moneyMovementAuthorized: false
}

export type VentureAgentClass =
  | 'market_scout'
  | 'researcher'
  | 'designer'
  | 'builder'
  | 'marketer'
  | 'publisher'
  | 'operator'
  | 'supervisor'
  | 'analyst'

export type VentureAgent = {
  id: string
  name: string
  class: VentureAgentClass
  capabilities: string[]
  executionOwners: string[]
  maxConcurrentWork: number
  active: boolean
}

export type VentureWorkStatus = 'queued' | 'running' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'superseded'

export type VentureWorkItem = {
  id: string
  ventureId: string
  agentId: string
  step: string
  status: VentureWorkStatus
  createdAt: string
  updatedAt: string
  evidenceRefs: string[]
  outputRefs: string[]
  spendUsd: number
  authorizationEffect: 'NONE'
}

export type VentureWorkflowNode = {
  id: string
  agentClass: VentureAgentClass
  capability: string
}

export type VentureWorkflowEdge = {
  from: string
  to: string
  condition?: string
}

export type VentureWorkflow = {
  id: string
  name: string
  nodes: VentureWorkflowNode[]
  edges: VentureWorkflowEdge[]
  limits: {
    maxHops: number
    maxUsdPerWorkItem: number
    maxUsdPerDay?: number
  }
}

export type VentureHqRoom = {
  id: string
  name: string
  capabilityScope: string[]
  agentIds: string[]
  workflowIds: string[]
}

export type VentureHqProjection = {
  generatedAt: string
  rooms: VentureHqRoom[]
  agents: VentureAgent[]
  workItems: VentureWorkItem[]
  workflows: VentureWorkflow[]
  ledger: {
    runningWork: number
    blockedWork: number
    completedWork: number
    failedWork: number
    observedAgentSpendUsd: number
  }
  law: 'PROJECT_PROVABLE_RUNTIME_STATE_ONLY'
}

export type VentureFactorySoftwareEvidence = {
  opportunitySchemaBound: boolean
  marketSignalsBound: boolean
  originalityGateBound: boolean
  makeSenseVoteBound: boolean
  experimentBridgeBound: boolean
  lifecycleBound: boolean
  supervisorBound: boolean
  memoryBound: boolean
  portfolioAllocatorBound: boolean
  spatialProjectionBound: boolean
  actionGovernanceBound: boolean
  moneyAuthorityIsExternal: boolean
  duplicateAuthorityPaths: number
}

export type VentureFactoryLiveEvidence = {
  discoveredSignals: number
  boundedExperiments: number
  realizedCommercialOutcomes: number
  supervisorRepairReceipts: number
  spatialRuntimeReceipts: number
  unauthorizedExternalActions: number
  copiedCreativeAssets: number
}

export type VentureFactoryFinalReport = {
  status: 'pass' | 'blocked' | 'fail'
  softwareStatus: 'pass' | 'fail'
  liveStatus: 'pass' | 'blocked' | 'fail'
  softwareBlockers: string[]
  liveBlockers: string[]
  externalExecutionAuthorized: false
  directCreativeReplicationAuthorized: false
  moneyMovementAuthorized: false
}

const LIFECYCLE_ORDER: readonly VentureLifecycleStage[] = [
  'discovered',
  'researched',
  'validated',
  'prototyped',
  'shadow',
  'launched',
  'optimizing',
  'scaling',
]

export function buildVentureOpportunity(input: {
  opportunity: Opportunity
  family: SideHustleFamily
  demandThesis: VentureDemandThesis
  signals: VentureMarketSignal[]
  unitEconomics?: Partial<VentureUnitEconomics>
  scoreFactors: VentureScoreFactors
  makeSense: Omit<VentureMakeSenseVote, 'overall' | 'decision'>
  originalityInput: VentureOriginalityInput
  automationMaturity?: SideHustleAutomationMaturity
  evidenceRefs: string[]
  createdAt: string
}): VentureOpportunity {
  requireText(input.opportunity.id, 'opportunity.id')
  requireDate(input.createdAt, 'createdAt')
  if (!Array.isArray(input.signals) || input.signals.length === 0) {
    throw new Error('Venture opportunity requires at least one market signal')
  }
  input.signals.forEach(validateSignal)
  requireEvidence(input.demandThesis.evidenceRefs, 'Demand thesis')
  requireEvidence(input.evidenceRefs, 'Venture opportunity')

  const profile = isSideHustleProfile(input.opportunity.metadata?.sideHustleProfile)
    ? input.opportunity.metadata!.sideHustleProfile as SideHustleProfile
    : buildSideHustleProfile({
        family: input.family,
        automationMaturity: input.automationMaturity ?? 'unvalidated',
      })

  if (profile.family !== input.family) {
    throw new Error('Venture family must match canonical Side Hustle profile')
  }
  if (profile.role === 'capability') {
    throw new Error('Capability-only profiles cannot become Venture Factory businesses')
  }

  const originality = assessVentureOriginality(input.originalityInput)
  const makeSenseVote = buildVentureMakeSenseVote(input.makeSense)
  const score = scoreVenture(input.scoreFactors, input.evidenceRefs)

  const riskFlags = unique([
    ...input.opportunity.riskFlags,
    ...(originality.decision === 'block' ? ['originality_or_ip_block'] : []),
    ...(makeSenseVote.decision !== 'makes_sense' ? ['make_it_make_sense_not_passed'] : []),
    ...(score.recommendation === 'reject' ? ['venture_score_reject'] : []),
  ])

  return {
    id: 'venture:' + input.opportunity.id,
    opportunityId: input.opportunity.id,
    title: input.opportunity.title,
    family: input.family,
    profile,
    lifecycle: 'discovered',
    demandThesis: cloneDemandThesis(input.demandThesis),
    signals: input.signals.map((signal) => ({ ...signal })),
    unitEconomics: normalizeUnitEconomics(input.unitEconomics),
    score,
    makeSenseVote,
    originality,
    executionOwners: [...profile.executionOwners],
    monetizationModels: [...profile.monetizationModels],
    riskFlags,
    evidenceRefs: unique([
      ...input.evidenceRefs,
      ...input.demandThesis.evidenceRefs,
      ...input.signals.map((signal) => signal.sourceRef),
      ...originality.evidenceRefs,
      ...makeSenseVote.evidenceRefs,
    ]),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    externalExecutionAuthorized: false,
    paymentAuthorized: false,
    publishingAuthorized: false,
    outreachAuthorized: false,
  }
}

export function assessVentureOriginality(input: VentureOriginalityInput): VentureOriginalityAssessment {
  requireEvidence(input.evidenceRefs, 'Originality assessment')
  requireText(input.proposedCreative, 'proposedCreative')
  const reasons: string[] = []
  if (input.intentionalStyleClone) reasons.push('Intentional style cloning is not permitted.')
  if ((input.protectedTerms ?? []).length > 0) reasons.push('Protected terms require clearance or removal.')
  if ((input.protectedCharacters ?? []).length > 0) reasons.push('Protected characters require clearance or removal.')
  if ((input.copiedPhrases ?? []).length > 0) reasons.push('Copied marketplace phrases require original replacement.')
  if (input.competitorArtifactRefs.length > 0 && input.marketMechanics.length === 0) {
    reasons.push('Competitor artifacts were supplied without an extracted market-mechanics abstraction.')
  }

  if (reasons.length === 0) {
    reasons.push('Creative plan uses market mechanics as evidence and does not authorize competitor asset replication.')
  }

  return {
    decision: reasons.length === 1 && reasons[0].startsWith('Creative plan uses') ? 'pass' : 'block',
    reasons,
    evidenceRefs: unique(input.evidenceRefs),
    directReplicationAuthorized: false,
    competitorAssetReuseAuthorized: false,
  }
}

export function buildVentureMakeSenseVote(
  input: Omit<VentureMakeSenseVote, 'overall' | 'decision'>,
): VentureMakeSenseVote {
  const keys: Array<keyof Omit<VentureMakeSenseVote, 'overall' | 'decision' | 'notes' | 'evidenceRefs'>> = [
    'coherence',
    'causalLogic',
    'chronology',
    'incentives',
    'baseRates',
    'contradictionHandling',
    'alternativesConsidered',
    'evidenceQuality',
  ]
  for (const key of keys) requireScore(input[key], String(key))
  requireEvidence(input.evidenceRefs, 'Make It Make Sense vote')
  const overall = round(keys.reduce((sum, key) => sum + input[key], 0) / keys.length)
  const decision = overall >= 75 ? 'makes_sense' : overall >= 50 ? 'weak' : 'does_not_make_sense'
  return {
    ...input,
    notes: [...input.notes],
    evidenceRefs: unique(input.evidenceRefs),
    overall,
    decision,
  }
}

export function scoreVenture(factors: VentureScoreFactors, evidenceRefs: string[]): VentureScore {
  for (const [name, value] of Object.entries(factors)) requireScore(value, name)
  requireEvidence(evidenceRefs, 'Venture score')
  const total = round(Object.values(factors).reduce((sum, value) => sum + value, 0) / 10)
  return {
    total,
    factors: { ...factors },
    evidenceRefs: unique(evidenceRefs),
    recommendation: total >= 75 ? 'validate' : total >= 55 ? 'hold' : 'reject',
  }
}

export function createVentureExperimentProposal(input: {
  venture: VentureOpportunity
  hypothesis: string
  targetCustomer: string
  offer: string
  channel: string
  maxSpend: number
  maxHours: number
  maxDurationDays: number
  minimumObservations: number
  successMetrics: string[]
  killMetrics?: string[]
  evidenceRefs: string[]
}): VentureExperimentProposal {
  if (input.venture.originality.decision !== 'pass') {
    throw new Error('Originality/IP gate must pass before a venture experiment can be proposed')
  }
  if (input.venture.makeSenseVote.decision === 'does_not_make_sense') {
    throw new Error('Make It Make Sense vote blocks this venture hypothesis')
  }
  requireText(input.hypothesis, 'hypothesis')
  requireText(input.targetCustomer, 'targetCustomer')
  requireText(input.offer, 'offer')
  requireText(input.channel, 'channel')
  requireNonNegative(input.maxSpend, 'maxSpend')
  requirePositive(input.maxHours, 'maxHours')
  requirePositiveInteger(input.maxDurationDays, 'maxDurationDays')
  requirePositiveInteger(input.minimumObservations, 'minimumObservations')
  requireEvidence(input.evidenceRefs, 'Experiment proposal')

  return {
    ventureId: input.venture.id,
    hypothesis: input.hypothesis.trim(),
    targetCustomer: input.targetCustomer.trim(),
    offer: input.offer.trim(),
    channel: input.channel.trim(),
    maxSpend: input.maxSpend,
    maxHours: input.maxHours,
    maxDurationDays: input.maxDurationDays,
    minimumObservations: input.minimumObservations,
    successMetrics: unique(input.successMetrics),
    killMetrics: unique(input.killMetrics ?? []),
    evidenceRefs: unique(input.evidenceRefs),
    requiresApproval: true,
    authorizationEffect: 'NONE',
  }
}

export function transitionVentureLifecycle(
  venture: VentureOpportunity,
  target: VentureLifecycleStage,
  evidenceRefs: string[],
  now: string,
): VentureOpportunity {
  requireDate(now, 'now')
  requireEvidence(evidenceRefs, 'Lifecycle transition')

  if (['paused', 'killed', 'archived'].includes(target)) {
    return {
      ...venture,
      lifecycle: target,
      evidenceRefs: unique([...venture.evidenceRefs, ...evidenceRefs]),
      updatedAt: now,
    }
  }

  const fromIndex = LIFECYCLE_ORDER.indexOf(venture.lifecycle)
  const targetIndex = LIFECYCLE_ORDER.indexOf(target)
  if (fromIndex < 0 || targetIndex < 0 || targetIndex !== fromIndex + 1) {
    throw new Error('Venture lifecycle must advance exactly one active stage at a time')
  }
  if (venture.originality.decision !== 'pass') {
    throw new Error('Blocked originality gate prevents active lifecycle advancement')
  }
  if (targetIndex >= LIFECYCLE_ORDER.indexOf('validated') && venture.makeSenseVote.decision !== 'makes_sense') {
    throw new Error('Venture must pass Make It Make Sense before validated-or-later stages')
  }

  return {
    ...venture,
    lifecycle: target,
    evidenceRefs: unique([...venture.evidenceRefs, ...evidenceRefs]),
    updatedAt: now,
  }
}

export function allocateVenturePortfolio(
  ventures: VentureOpportunity[],
  evidenceRefs: Record<string, string[]>,
): VenturePortfolioAllocation[] {
  const eligible = ventures.filter((venture) =>
    venture.originality.decision === 'pass' &&
    venture.makeSenseVote.decision === 'makes_sense' &&
    venture.lifecycle !== 'killed' &&
    venture.lifecycle !== 'archived',
  )

  const weights = eligible.map((venture) => Math.max(1, venture.score.total))
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)

  return ventures.map((venture) => {
    const refs = evidenceRefs[venture.id] ?? venture.evidenceRefs
    requireEvidence(refs, 'Portfolio allocation')
    const index = eligible.findIndex((candidate) => candidate.id === venture.id)
    if (index < 0) {
      return {
        ventureId: venture.id,
        priority: 'blocked',
        reason: 'Venture is blocked by policy, coherence, or terminal lifecycle state.',
        resourceShareBps: 0,
        evidenceRefs: unique(refs),
        moneyMovementAuthorized: false,
      }
    }
    const share = totalWeight > 0 ? Math.floor((weights[index] / totalWeight) * 10000) : 0
    return {
      ventureId: venture.id,
      priority: venture.score.total >= 80 ? 'high' : venture.score.total >= 65 ? 'medium' : 'low',
      reason: 'Portfolio priority is evidence-weighted and does not move money.',
      resourceShareBps: share,
      evidenceRefs: unique(refs),
      moneyMovementAuthorized: false,
    }
  })
}

export function superviseVentureWork(input: {
  venture: VentureOpportunity
  workItems: VentureWorkItem[]
  now: string
  staleAfterHours?: number
  queuePressureThreshold?: number
  marginFloor?: number
  refundRate?: number
  evidenceRefs: string[]
}): VentureSupervisorIssue[] {
  requireDate(input.now, 'now')
  requireEvidence(input.evidenceRefs, 'Supervisor assessment')
  const issues: VentureSupervisorIssue[] = []
  const staleMs = (input.staleAfterHours ?? 18) * 3_600_000
  const queueThreshold = input.queuePressureThreshold ?? 10
  const relevant = input.workItems.filter((item) => item.ventureId === input.venture.id)

  for (const item of relevant) {
    requireDate(item.updatedAt, 'workItem.updatedAt')
    if (
      ['running', 'waiting'].includes(item.status) &&
      Date.parse(input.now) - Date.parse(item.updatedAt) > staleMs
    ) {
      issues.push(issue(input.venture.id, 'stalled', 'warning', input.now, 'Work item ' + item.id + ' is stale.', 'repair', [
        ...input.evidenceRefs,
        ...item.evidenceRefs,
      ]))
    }
  }

  const queued = relevant.filter((item) => item.status === 'queued').length
  if (queued >= queueThreshold) {
    issues.push(issue(input.venture.id, 'queue_pressure', 'warning', input.now, 'Queued work is ' + queued + ', above the configured threshold.', 'repair', input.evidenceRefs))
  }

  const failures = relevant.filter((item) => item.status === 'failed').length
  if (failures >= 3) {
    issues.push(issue(input.venture.id, 'repeated_failure', 'critical', input.now, 'Repeated work failures require diagnosis before scaling.', 'pause', input.evidenceRefs))
  }

  if (typeof input.marginFloor === 'number' && typeof input.venture.unitEconomics.expectedGrossMargin === 'number' &&
      input.venture.unitEconomics.expectedGrossMargin < input.marginFloor) {
    issues.push(issue(input.venture.id, 'margin_failure', 'critical', input.now, 'Expected gross margin is below the configured floor.', 'pause', input.evidenceRefs))
  }

  if (typeof input.refundRate === 'number' && input.refundRate > 0.2) {
    issues.push(issue(input.venture.id, 'refund_spike', 'critical', input.now, 'Observed refund rate is above 20%.', 'pause', input.evidenceRefs))
  }

  return issues
}

export function recordVentureMemory(input: VentureMemoryRecord): VentureMemoryRecord {
  requireText(input.id, 'memory.id')
  requireText(input.lesson, 'memory.lesson')
  requireScore(input.confidence, 'memory.confidence')
  requireDate(input.observedAt, 'memory.observedAt')
  requireEvidence(input.evidenceRefs, 'Venture memory')
  return {
    ...input,
    lesson: input.lesson.trim(),
    evidenceRefs: unique(input.evidenceRefs),
  }
}

export function createVentureWorkflow(input: VentureWorkflow): VentureWorkflow {
  requireText(input.id, 'workflow.id')
  requireText(input.name, 'workflow.name')
  if (!Number.isInteger(input.limits.maxHops) || input.limits.maxHops < 1 || input.limits.maxHops > 24) {
    throw new Error('Workflow maxHops must be an integer between 1 and 24')
  }
  if (!Number.isFinite(input.limits.maxUsdPerWorkItem) || input.limits.maxUsdPerWorkItem <= 0 || input.limits.maxUsdPerWorkItem > 50) {
    throw new Error('Workflow maxUsdPerWorkItem must be > 0 and <= 50')
  }
  if (
    input.limits.maxUsdPerDay !== undefined &&
    (!Number.isFinite(input.limits.maxUsdPerDay) || input.limits.maxUsdPerDay <= 0 || input.limits.maxUsdPerDay > 500)
  ) {
    throw new Error('Workflow maxUsdPerDay must be > 0 and <= 500')
  }

  const nodeIds = new Set(input.nodes.map((node) => node.id))
  if (nodeIds.size !== input.nodes.length || nodeIds.has('')) throw new Error('Workflow node ids must be unique and non-empty')
  for (const edge of input.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new Error('Workflow edge references an unknown node')
  }
  if (hasCycle(input.nodes, input.edges)) throw new Error('Workflow graph cannot contain an unbounded cycle')
  return {
    ...input,
    nodes: input.nodes.map((node) => ({ ...node })),
    edges: input.edges.map((edge) => ({ ...edge })),
    limits: { ...input.limits },
  }
}

export function projectVentureHq(input: {
  rooms: VentureHqRoom[]
  agents: VentureAgent[]
  workItems: VentureWorkItem[]
  workflows: VentureWorkflow[]
  generatedAt: string
}): VentureHqProjection {
  requireDate(input.generatedAt, 'generatedAt')
  const agentIds = new Set(input.agents.map((agent) => agent.id))
  const workflowIds = new Set(input.workflows.map((workflow) => workflow.id))
  for (const room of input.rooms) {
    for (const agentId of room.agentIds) if (!agentIds.has(agentId)) throw new Error('HQ room references unknown agent ' + agentId)
    for (const workflowId of room.workflowIds) if (!workflowIds.has(workflowId)) throw new Error('HQ room references unknown workflow ' + workflowId)
  }
  for (const work of input.workItems) {
    if (!agentIds.has(work.agentId)) throw new Error('HQ work item references unknown agent ' + work.agentId)
    requireNonNegative(work.spendUsd, 'workItem.spendUsd')
  }

  return {
    generatedAt: input.generatedAt,
    rooms: input.rooms.map((room) => ({
      ...room,
      capabilityScope: [...room.capabilityScope],
      agentIds: [...room.agentIds],
      workflowIds: [...room.workflowIds],
    })),
    agents: input.agents.map((agent) => ({
      ...agent,
      capabilities: [...agent.capabilities],
      executionOwners: [...agent.executionOwners],
    })),
    workItems: input.workItems.map((item) => ({
      ...item,
      evidenceRefs: [...item.evidenceRefs],
      outputRefs: [...item.outputRefs],
    })),
    workflows: input.workflows.map(createVentureWorkflow),
    ledger: {
      runningWork: input.workItems.filter((item) => item.status === 'running').length,
      blockedWork: input.workItems.filter((item) => item.status === 'blocked').length,
      completedWork: input.workItems.filter((item) => item.status === 'completed').length,
      failedWork: input.workItems.filter((item) => item.status === 'failed').length,
      observedAgentSpendUsd: round(input.workItems.reduce((sum, item) => sum + item.spendUsd, 0)),
    },
    law: 'PROJECT_PROVABLE_RUNTIME_STATE_ONLY',
  }
}

export function certifyVentureFactoryFinal(input: {
  software: VentureFactorySoftwareEvidence
  live: VentureFactoryLiveEvidence
}): VentureFactoryFinalReport {
  const softwareBlockers: string[] = []
  const liveBlockers: string[] = []

  for (const [key, value] of Object.entries(input.software)) {
    if (key === 'duplicateAuthorityPaths') continue
    if (value !== true) softwareBlockers.push('Software binding missing: ' + key + '.')
  }
  if (!Number.isInteger(input.software.duplicateAuthorityPaths) || input.software.duplicateAuthorityPaths !== 0) {
    softwareBlockers.push('Duplicate authority paths must equal 0.')
  }

  let liveStatus: VentureFactoryFinalReport['liveStatus'] = 'pass'
  if (input.live.unauthorizedExternalActions !== 0) {
    liveBlockers.push('Unauthorized external actions observed: ' + input.live.unauthorizedExternalActions + '.')
    liveStatus = 'fail'
  }
  if (input.live.copiedCreativeAssets !== 0) {
    liveBlockers.push('Copied creative assets observed: ' + input.live.copiedCreativeAssets + '.')
    liveStatus = 'fail'
  }

  const minimums: Array<[keyof VentureFactoryLiveEvidence, number, string]> = [
    ['discoveredSignals', 3, 'market signals'],
    ['boundedExperiments', 1, 'bounded experiments'],
    ['realizedCommercialOutcomes', 1, 'realized commercial outcomes'],
    ['supervisorRepairReceipts', 1, 'supervisor repair receipts'],
    ['spatialRuntimeReceipts', 1, 'spatial runtime receipts'],
  ]
  for (const [key, minimum, label] of minimums) {
    const value = input.live[key]
    if (!Number.isInteger(value) || value < 0) {
      liveBlockers.push(String(key) + ' must be a non-negative integer.')
      liveStatus = 'fail'
    } else if (value < minimum) {
      liveBlockers.push(label + ': ' + value + '/' + minimum + '.')
      if (liveStatus !== 'fail') liveStatus = 'blocked'
    }
  }

  const softwareStatus: VentureFactoryFinalReport['softwareStatus'] = softwareBlockers.length === 0 ? 'pass' : 'fail'
  const status: VentureFactoryFinalReport['status'] =
    softwareStatus === 'fail' || liveStatus === 'fail' ? 'fail' : liveStatus === 'blocked' ? 'blocked' : 'pass'

  return {
    status,
    softwareStatus,
    liveStatus,
    softwareBlockers,
    liveBlockers,
    externalExecutionAuthorized: false,
    directCreativeReplicationAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

function issue(
  ventureId: string,
  kind: VentureSupervisorIssueKind,
  severity: VentureSupervisorIssue['severity'],
  detectedAt: string,
  summary: string,
  recommendedAction: VentureSupervisorIssue['recommendedAction'],
  evidenceRefs: string[],
): VentureSupervisorIssue {
  return {
    id: 'venture-issue:' + ventureId + ':' + kind + ':' + stableSuffix(detectedAt),
    ventureId,
    kind,
    severity,
    detectedAt,
    summary,
    evidenceRefs: unique(evidenceRefs),
    recommendedAction,
    automaticExternalActionAuthorized: false,
  }
}

function cloneDemandThesis(value: VentureDemandThesis): VentureDemandThesis {
  return {
    ...value,
    unmetAngles: [...value.unmetAngles],
    disconfirmingEvidence: [...value.disconfirmingEvidence],
    evidenceRefs: unique(value.evidenceRefs),
  }
}

function normalizeUnitEconomics(value: Partial<VentureUnitEconomics> | undefined): VentureUnitEconomics {
  const normalized: VentureUnitEconomics = {
    currency: (value?.currency ?? 'USD').toUpperCase(),
    expectedPrice: value?.expectedPrice,
    expectedVariableCost: value?.expectedVariableCost,
    expectedGrossMargin: value?.expectedGrossMargin,
    expectedAcquisitionCost: value?.expectedAcquisitionCost,
    expectedRefundRate: value?.expectedRefundRate,
  }
  for (const [key, amount] of Object.entries(normalized)) {
    if (key === 'currency' || amount === undefined) continue
    requireNonNegative(amount as number, 'unitEconomics.' + key)
  }
  return normalized
}

function validateSignal(signal: VentureMarketSignal): void {
  requireText(signal.id, 'signal.id')
  requireText(signal.sourceRef, 'signal.sourceRef')
  requireText(signal.note, 'signal.note')
  requireDate(signal.observedAt, 'signal.observedAt')
  if (signal.value !== undefined && !Number.isFinite(signal.value)) throw new Error('signal.value must be finite')
  if (!Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) {
    throw new Error('signal.confidence must be between 0 and 1')
  }
}

function hasCycle(nodes: VentureWorkflowNode[], edges: VentureWorkflowEdge[]): boolean {
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]))
  for (const edge of edges) adjacency.get(edge.from)!.push(edge.to)
  const color = new Map<string, 0 | 1 | 2>()
  function visit(id: string): boolean {
    const state = color.get(id) ?? 0
    if (state === 1) return true
    if (state === 2) return false
    color.set(id, 1)
    for (const next of adjacency.get(id) ?? []) if (visit(next)) return true
    color.set(id, 2)
    return false
  }
  return nodes.some((node) => visit(node.id))
}

function stableSuffix(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, '').slice(0, 24)
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(field + ' is required')
}

function requireEvidence(values: string[], label: string): void {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(label + ' requires evidence references')
  }
}

function requireScore(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(field + ' must be between 0 and 100')
}

function requireDate(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(field + ' must be a valid date')
  }
}

function requireNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(field + ' must be a finite non-negative number')
}

function requirePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(field + ' must be a finite positive number')
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(field + ' must be a positive integer')
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
