import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import {
  allocateVenturePortfolio,
  assessVentureOriginality,
  buildVentureMakeSenseVote,
  buildVentureOpportunity,
  certifyVentureFactoryFinal,
  createVentureExperimentProposal,
  createVentureWorkflow,
  projectVentureHq,
  recordVentureMemory,
  scoreVenture,
  superviseVentureWork,
  transitionVentureLifecycle,
  type VentureAgent,
  type VentureMarketSignal,
  type VentureWorkItem,
} from './venture-factory.js'

const now = '2026-10-01T15:00:00.000Z'

const opportunity: Opportunity = {
  id: 'opportunity:venture:pod-1',
  title: 'Original personalized retro hometown gifts',
  family: 'business',
  type: 'commercial',
  sourceUrl: 'https://example.test/market',
  sourceName: 'Market scout fixture',
  claims: [],
  evidence: [],
  verificationStatus: 'unverified',
  sourceConfidence: 0.8,
  riskFlags: [],
  status: 'discovered',
  createdAt: now,
  updatedAt: now,
}

const signals: VentureMarketSignal[] = [
  { id: 'signal:sales', kind: 'sales', sourceRef: 'market:sales:1', observedAt: now, value: 1400, unit: 'sales', note: 'Newer shops show paid demand in the category.', confidence: 0.8 },
  { id: 'signal:search', kind: 'search', sourceRef: 'market:search:1', observedAt: now, value: 72, unit: 'index', note: 'Search demand is persistent.', confidence: 0.75 },
  { id: 'signal:reviews', kind: 'reviews', sourceRef: 'market:reviews:1', observedAt: now, value: 430, unit: 'reviews', note: 'Review velocity supports real purchases.', confidence: 0.78 },
]

const scoreFactors = {
  demandProof: 85,
  grossMarginPotential: 80,
  automationPotential: 92,
  competitionHeadroom: 65,
  differentiation: 82,
  startupEfficiency: 90,
  timeToEvidence: 88,
  repeatability: 86,
  legalPlatformSafety: 90,
  crossJhadinaLeverage: 95,
}

const makeSenseInput = {
  coherence: 90,
  causalLogic: 88,
  chronology: 85,
  incentives: 92,
  baseRates: 80,
  contradictionHandling: 82,
  alternativesConsidered: 86,
  evidenceQuality: 84,
  notes: ['Demand evidence is consistent with the paid-problem thesis.'],
  evidenceRefs: ['evidence:make-sense'],
}

function ventureFixture() {
  return buildVentureOpportunity({
    opportunity,
    family: 'pod_personalized_commerce',
    demandThesis: {
      buyer: 'Gift buyer',
      jobToBeDone: 'Buy a personalized hometown gift quickly.',
      paidProblem: 'Generic gifts feel impersonal.',
      marketMechanic: 'Personalization plus familiar retro visual language.',
      unmetAngles: ['Neighborhood-specific personalization', 'Family milestone bundles'],
      disconfirmingEvidence: ['Some search demand may be seasonal.'],
      evidenceRefs: ['evidence:demand'],
    },
    signals,
    unitEconomics: {
      currency: 'USD',
      expectedPrice: 34,
      expectedVariableCost: 15,
      expectedGrossMargin: 19,
      expectedAcquisitionCost: 5,
      expectedRefundRate: 0.04,
    },
    scoreFactors,
    makeSense: makeSenseInput,
    originalityInput: {
      marketMechanics: ['personalization', 'retro hometown nostalgia'],
      competitorArtifactRefs: ['competitor:listing:1'],
      proposedCreative: 'Original neighborhood sign system with custom typography and original illustration.',
      evidenceRefs: ['evidence:originality'],
    },
    evidenceRefs: ['evidence:venture'],
    createdAt: now,
  })
}

{
  const originality = assessVentureOriginality({
    marketMechanics: ['buyer wants hometown nostalgia'],
    competitorArtifactRefs: ['competitor:1'],
    proposedCreative: 'Original visual system',
    evidenceRefs: ['evidence:1'],
  })
  assert.equal(originality.decision, 'pass')
  assert.equal(originality.directReplicationAuthorized, false)
}

{
  const originality = assessVentureOriginality({
    marketMechanics: [],
    competitorArtifactRefs: ['competitor:1'],
    proposedCreative: 'Copy the source design',
    copiedPhrases: ['same phrase'],
    intentionalStyleClone: true,
    evidenceRefs: ['evidence:1'],
  })
  assert.equal(originality.decision, 'block')
}

{
  const vote = buildVentureMakeSenseVote(makeSenseInput)
  assert.equal(vote.decision, 'makes_sense')
  assert.ok(vote.overall >= 75)

  const score = scoreVenture(scoreFactors, ['evidence:score'])
  assert.equal(score.recommendation, 'validate')
  assert.ok(score.total >= 75)
}

{
  const venture = ventureFixture()
  assert.equal(venture.lifecycle, 'discovered')
  assert.equal(venture.originality.decision, 'pass')
  assert.equal(venture.externalExecutionAuthorized, false)
  assert.ok(venture.evidenceRefs.includes('market:sales:1'))

  const proposal = createVentureExperimentProposal({
    venture,
    hypothesis: 'Gift buyers will purchase an original neighborhood-specific personalized product.',
    targetCustomer: 'Gift buyer',
    offer: '$34 personalized product',
    channel: 'Owned storefront validation page',
    maxSpend: 50,
    maxHours: 6,
    maxDurationDays: 10,
    minimumObservations: 3,
    successMetrics: ['checkout_intent', 'gross_margin'],
    killMetrics: ['refund_rate'],
    evidenceRefs: ['experiment:evidence'],
  })
  assert.equal(proposal.requiresApproval, true)
  assert.equal(proposal.authorizationEffect, 'NONE')
}

{
  let venture = ventureFixture()
  venture = transitionVentureLifecycle(venture, 'researched', ['receipt:research'], '2026-10-01T16:00:00.000Z')
  venture = transitionVentureLifecycle(venture, 'validated', ['receipt:validation'], '2026-10-01T17:00:00.000Z')
  venture = transitionVentureLifecycle(venture, 'prototyped', ['receipt:prototype'], '2026-10-01T18:00:00.000Z')
  venture = transitionVentureLifecycle(venture, 'shadow', ['receipt:shadow'], '2026-10-01T19:00:00.000Z')
  assert.equal(venture.lifecycle, 'shadow')
  assert.throws(
    () => transitionVentureLifecycle(venture, 'scaling', ['receipt:skip'], '2026-10-01T20:00:00.000Z'),
    /exactly one active stage/,
  )
}

{
  const high = ventureFixture()
  const blocked = {
    ...ventureFixture(),
    id: 'venture:blocked',
    opportunityId: 'opportunity:blocked',
    originality: {
      ...ventureFixture().originality,
      decision: 'block' as const,
      reasons: ['Protected creative collision.'],
    },
  }
  const allocations = allocateVenturePortfolio([high, blocked], {
    [high.id]: ['portfolio:high'],
    [blocked.id]: ['portfolio:blocked'],
  })
  assert.equal(allocations.find((item) => item.ventureId === blocked.id)?.priority, 'blocked')
  assert.equal(allocations.find((item) => item.ventureId === blocked.id)?.resourceShareBps, 0)
  assert.equal(allocations.find((item) => item.ventureId === high.id)?.moneyMovementAuthorized, false)
}

{
  const venture = ventureFixture()
  const workItems: VentureWorkItem[] = [
    {
      id: 'work:stale',
      ventureId: venture.id,
      agentId: 'agent:research',
      step: 'research',
      status: 'running',
      createdAt: '2026-09-30T10:00:00.000Z',
      updatedAt: '2026-09-30T10:00:00.000Z',
      evidenceRefs: ['work:evidence'],
      outputRefs: [],
      spendUsd: 1.25,
      authorizationEffect: 'NONE',
    },
    ...Array.from({ length: 10 }, (_, index) => ({
      id: 'work:q:' + index,
      ventureId: venture.id,
      agentId: 'agent:research',
      step: 'research',
      status: 'queued' as const,
      createdAt: now,
      updatedAt: now,
      evidenceRefs: ['work:q'],
      outputRefs: [],
      spendUsd: 0,
      authorizationEffect: 'NONE' as const,
    })),
  ]
  const issues = superviseVentureWork({
    venture,
    workItems,
    now,
    evidenceRefs: ['supervisor:receipt'],
  })
  assert.ok(issues.some((item) => item.kind === 'stalled'))
  assert.ok(issues.some((item) => item.kind === 'queue_pressure'))
  assert.ok(issues.every((item) => item.automaticExternalActionAuthorized === false))
}

{
  const workflow = createVentureWorkflow({
    id: 'workflow:pod',
    name: 'Research to original product proposal',
    nodes: [
      { id: 'scout', agentClass: 'market_scout', capability: 'market_research' },
      { id: 'design', agentClass: 'designer', capability: 'original_concept_generation' },
      { id: 'review', agentClass: 'supervisor', capability: 'policy_and_evidence_gate' },
    ],
    edges: [
      { from: 'scout', to: 'design' },
      { from: 'design', to: 'review' },
    ],
    limits: {
      maxHops: 6,
      maxUsdPerWorkItem: 2,
      maxUsdPerDay: 50,
    },
  })
  assert.equal(workflow.nodes.length, 3)

  assert.throws(
    () => createVentureWorkflow({
      id: 'workflow:cycle',
      name: 'Bad cycle',
      nodes: [
        { id: 'a', agentClass: 'researcher', capability: 'a' },
        { id: 'b', agentClass: 'analyst', capability: 'b' },
      ],
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
      limits: { maxHops: 6, maxUsdPerWorkItem: 2 },
    }),
    /unbounded cycle/,
  )
}

{
  const agents: VentureAgent[] = [
    {
      id: 'agent:research',
      name: 'Drift',
      class: 'market_scout',
      capabilities: ['market_research'],
      executionOwners: ['opportunity'],
      maxConcurrentWork: 2,
      active: true,
    },
    {
      id: 'agent:supervisor',
      name: 'Governor',
      class: 'supervisor',
      capabilities: ['monitoring', 'repair_planning'],
      executionOwners: ['opportunity'],
      maxConcurrentWork: 4,
      active: true,
    },
  ]
  const workflow = createVentureWorkflow({
    id: 'workflow:hq',
    name: 'HQ research line',
    nodes: [
      { id: 'research', agentClass: 'market_scout', capability: 'market_research' },
      { id: 'review', agentClass: 'supervisor', capability: 'review' },
    ],
    edges: [{ from: 'research', to: 'review' }],
    limits: { maxHops: 6, maxUsdPerWorkItem: 2 },
  })
  const workItems: VentureWorkItem[] = [{
    id: 'work:1',
    ventureId: ventureFixture().id,
    agentId: 'agent:research',
    step: 'research',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    evidenceRefs: ['receipt:work'],
    outputRefs: ['outbox:research'],
    spendUsd: 0.75,
    authorizationEffect: 'NONE',
  }]
  const projection = projectVentureHq({
    rooms: [{
      id: 'room:research',
      name: 'Research Lab',
      capabilityScope: ['market_research'],
      agentIds: ['agent:research', 'agent:supervisor'],
      workflowIds: ['workflow:hq'],
    }],
    agents,
    workItems,
    workflows: [workflow],
    generatedAt: now,
  })
  assert.equal(projection.law, 'PROJECT_PROVABLE_RUNTIME_STATE_ONLY')
  assert.equal(projection.ledger.completedWork, 1)
  assert.equal(projection.ledger.observedAgentSpendUsd, 0.75)
}

{
  const memory = recordVentureMemory({
    id: 'memory:1',
    ventureId: ventureFixture().id,
    family: 'pod_personalized_commerce',
    lesson: 'Personalization evidence was stronger than generic category demand.',
    scope: 'family',
    confidence: 84,
    evidenceRefs: ['outcome:1'],
    observedAt: now,
  })
  assert.equal(memory.scope, 'family')
}

const software = {
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

{
  const report = certifyVentureFactoryFinal({
    software,
    live: {
      discoveredSignals: 3,
      boundedExperiments: 1,
      realizedCommercialOutcomes: 0,
      supervisorRepairReceipts: 0,
      spatialRuntimeReceipts: 0,
      unauthorizedExternalActions: 0,
      copiedCreativeAssets: 0,
    },
  })
  assert.equal(report.softwareStatus, 'pass')
  assert.equal(report.liveStatus, 'blocked')
  assert.equal(report.status, 'blocked')
}

{
  const report = certifyVentureFactoryFinal({
    software,
    live: {
      discoveredSignals: 3,
      boundedExperiments: 1,
      realizedCommercialOutcomes: 1,
      supervisorRepairReceipts: 1,
      spatialRuntimeReceipts: 1,
      unauthorizedExternalActions: 0,
      copiedCreativeAssets: 0,
    },
  })
  assert.equal(report.status, 'pass')
  assert.equal(report.externalExecutionAuthorized, false)
  assert.equal(report.directCreativeReplicationAuthorized, false)
  assert.equal(report.moneyMovementAuthorized, false)
}

console.log('venture factory tests passed')
