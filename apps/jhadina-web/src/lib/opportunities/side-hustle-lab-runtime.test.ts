import { describe, expect, it } from 'vitest'
import {
  buildSideHustleDiscoveryProvenance,
  buildSideHustleProfile,
  calculateOpportunityOutcome,
  completeSideHustleExperiment,
  createSideHustleExperiment,
  startSideHustleExperiment,
  type Opportunity,
  type OpportunityPursuitCase,
  type PursuitTaskKind,
  type SideHustleExperimentEvaluation,
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
import {
  certifySideHustleLiveFinalRuntime,
  completeSideHustleLabResearchRuntime,
  requireEligibleSideHustleLabValidationAdmission,
  runSideHustleLabOutcomeLearningRuntime,
  type SideHustleLabOpportunityPersistence,
  type SideHustleLabVenturePersistence,
} from './side-hustle-lab-runtime'

const ownerUserId = 'owner:test'
const now = '2026-10-02T18:00:00.000Z'
const gateRefs = {
  demand: 'evidence:demand',
  mitms: 'evidence:mitms',
  originality: 'evidence:originality',
}

const discovery = buildSideHustleDiscoveryProvenance({
  candidateId: 'venture-candidate:runtime-test',
  recommendation: 'research',
  signalIds: ['signal:1', 'signal:2', 'signal:3'],
  sourceRefs: ['source:1', 'source:2', 'source:3'],
  evidenceScore: 88,
})

const opportunity: Opportunity = {
  id: 'opportunity:venture-candidate:runtime-test',
  title: 'Original neighborhood gift',
  family: 'business',
  type: 'commercial',
  description: 'An original personalized gift for a defined local buyer.',
  sourceUrl: 'https://example.test/venture',
  sourceName: 'Jhadina Venture Discovery',
  claims: [],
  evidence: [],
  verificationStatus: 'unverified',
  sourceConfidence: 0.88,
  fitScore: 88,
  riskFlags: ['requires_make_it_make_sense', 'requires_originality_gate', 'requires_bounded_validation'],
  metadata: {
    sideHustleProfile: buildSideHustleProfile({ family: 'pod_personalized_commerce' }),
    sideHustleDiscovery: { ...discovery, stage: 'researching' },
    ventureLabResearchIntake: {
      origin: 'venture_factory',
      candidateId: discovery.candidateId,
      researchCaseId: 'research:opportunity:venture-candidate:runtime-test',
      stage: 'researching',
      approvedAt: '2026-10-02T17:00:00.000Z',
      authority: 'RESEARCH_ONLY',
      requiredGates: ['demand_thesis', 'make_it_make_sense', 'originality_ip'],
      externalActionAuthorized: false,
      automaticExperimentAuthorized: false,
      moneyMovementAuthorized: false,
    },
  },
  status: 'ready',
  createdAt: '2026-10-02T16:00:00.000Z',
  updatedAt: now,
}

const taskKinds: PursuitTaskKind[] = [
  'verify_source', 'verify_economics', 'verify_requirements', 'verify_deadline',
  'verify_provider', 'assess_margin', 'assess_capability', 'assess_competition', 'assess_compliance',
  'assess_demand_thesis', 'assess_make_it_make_sense', 'assess_originality_ip',
]

const pursuitCase: OpportunityPursuitCase = {
  id: 'research:opportunity:venture-candidate:runtime-test',
  opportunityId: opportunity.id,
  title: 'Research: Original neighborhood gift',
  status: 'ready',
  tasks: taskKinds.map((kind, index) => ({
    id: `research:runtime:task:${index + 1}`,
    kind,
    title: kind,
    required: true,
    status: 'completed',
    createdAt: '2026-10-02T17:00:00.000Z',
    completedAt: '2026-10-02T17:30:00.000Z',
    evidenceRefs: [
      kind === 'assess_demand_thesis' ? gateRefs.demand
        : kind === 'assess_make_it_make_sense' ? gateRefs.mitms
          : kind === 'assess_originality_ip' ? gateRefs.originality
            : `evidence:${kind}`,
    ],
  })),
  createdAt: '2026-10-02T17:00:00.000Z',
  updatedAt: '2026-10-02T17:30:00.000Z',
}

const signals = [
  { id: 'signal:1', kind: 'sales' as const, sourceRef: 'source:1', observedAt: now, value: 100, unit: 'sales', note: 'Paid demand', confidence: 0.9 },
  { id: 'signal:2', kind: 'reviews' as const, sourceRef: 'source:2', observedAt: now, value: 75, unit: 'reviews', note: 'Review demand', confidence: 0.85 },
  { id: 'signal:3', kind: 'buyer_pain' as const, sourceRef: 'source:3', observedAt: now, note: 'Buyer wants more local personalization', confidence: 0.8 },
]

const synthesis = {
  signals,
  demandThesis: {
    buyer: 'Local gift buyers',
    jobToBeDone: 'Find a personal gift that feels specific to the recipient.',
    paidProblem: 'Generic gifts do not feel personal enough.',
    marketMechanic: 'Personalization plus local identity.',
    unmetAngles: ['Original neighborhood-specific options'],
    disconfirmingEvidence: ['Demand could be seasonal.'],
    evidenceRefs: [gateRefs.demand],
  },
  unitEconomics: {
    currency: 'USD',
    expectedPrice: 40,
    expectedVariableCost: 18,
    expectedGrossMargin: 0.55,
  },
  scoreFactors: {
    demandProof: 90,
    grossMarginPotential: 82,
    automationPotential: 88,
    competitionHeadroom: 78,
    differentiation: 90,
    startupEfficiency: 90,
    timeToEvidence: 88,
    repeatability: 86,
    legalPlatformSafety: 96,
    crossJhadinaLeverage: 94,
  },
  makeSense: {
    coherence: 90,
    causalLogic: 88,
    chronology: 85,
    incentives: 90,
    baseRates: 82,
    contradictionHandling: 84,
    alternativesConsidered: 86,
    evidenceQuality: 90,
    notes: ['Demand is supported by multiple observed signals.'],
    evidenceRefs: [gateRefs.mitms],
  },
  originalityInput: {
    marketMechanics: ['personalization', 'local identity'],
    competitorArtifactRefs: ['competitor:listing:1'],
    proposedCreative: 'Original typography, illustration, and neighborhood-specific copy.',
    evidenceRefs: [gateRefs.originality],
  },
  evidenceRefs: ['evidence:research-complete'],
  synthesizedAt: now,
}

function fixture() {
  let stored: StoredCanonicalOpportunity = {
    userId: ownerUserId,
    opportunity: { ...opportunity, metadata: { ...opportunity.metadata } },
    triageState: 'saved',
    approvedAt: '2026-10-02T17:00:00.000Z',
    researchCaseId: pursuitCase.id,
  }

  const outcomes = new Map<string, ReturnType<typeof calculateOpportunityOutcome>>()
  const experimentRecords: StoredSideHustleExperiment[] = []
  const venturesById = new Map<string, VentureOpportunity>()
  const receipts: VentureRuntimeReceipt[] = []
  const memories = new Map<string, VentureMemoryRecord>()
  const workItems: VentureWorkItem[] = []
  const supervisorIssues: VentureSupervisorIssue[] = []
  const scoutSignals: VentureScoutInboxRecord[] = signals.map((signal) => ({
    seedId: 'seed:runtime',
    family: 'pod_personalized_commerce',
    signal,
    sourceTitle: signal.note,
  }))

  const opportunities: SideHustleLabOpportunityPersistence = {
    async get(id) {
      return id === stored.opportunity.id ? stored : undefined
    },
    async getResearchCase(id) {
      return id === pursuitCase.id ? pursuitCase : undefined
    },
    async getOutcome(id) {
      return outcomes.get(id)
    },
    async listOutcomes(opportunityId) {
      return [...outcomes.values()].filter((outcome) => outcome.opportunityId === opportunityId)
    },
    async listSideHustleExperiments(opportunityId) {
      return experimentRecords.filter((record) => record.experiment.opportunityId === opportunityId)
    },
  }

  const venturePersistence: SideHustleLabVenturePersistence = {
    async getScoutSignals(ids) {
      const wanted = new Set(ids)
      return scoutSignals.filter((record) => wanted.has(record.signal.id))
    },
    async saveVenture(_owner, venture) {
      venturesById.set(venture.id, venture)
      return venture
    },
    async getVenture(_owner, ventureId) {
      return venturesById.get(ventureId) ?? null
    },
    async getVentureByOpportunity(_owner, opportunityId) {
      return [...venturesById.values()].find((venture) => venture.opportunityId === opportunityId) ?? null
    },
    async listVentures() {
      return [...venturesById.values()]
    },
    async listWorkItems() {
      return workItems
    },
    async listSupervisorIssues() {
      return supervisorIssues
    },
    async upsertMemory(_owner, records) {
      for (const record of records) memories.set(record.id, record)
      return records.length
    },
    async listMemory() {
      return [...memories.values()]
    },
    async recordReceipt(receipt) {
      const index = receipts.findIndex((candidate) => candidate.id === receipt.id)
      if (index >= 0) receipts[index] = receipt
      else receipts.push(receipt)
      return receipt
    },
    async listReceipts(_owner, kind?: VentureRuntimeReceiptKind) {
      return receipts
        .filter((receipt) => !kind || receipt.kind === kind)
        .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
    },
  }

  return {
    opportunities,
    venturePersistence,
    experimentRecords,
    outcomes,
    receipts,
    memories,
    get stored() {
      return stored
    },
    setStored(next: StoredCanonicalOpportunity) {
      stored = next
    },
  }
}

describe('Side Hustle Lab production runtime', () => {
  it('binds research, validation, canonical outcomes, learning, projection, and LIVE.FINAL without creating authority', async () => {
    const f = fixture()
    const research = await completeSideHustleLabResearchRuntime({
      ownerUserId,
      opportunityId: opportunity.id,
      synthesis,
      admittedAt: '2026-10-02T18:05:00.000Z',
    }, {
      opportunities: f.opportunities,
      ventures: f.venturePersistence,
    })

    expect(research.venture.lifecycle).toBe('researched')
    expect(research.completion.decision).toBe('eligible_for_validation')
    expect(research.admission.decision).toBe('eligible')
    expect(research.canonicalOpportunityMutated).toBe(false)
    expect(f.stored.opportunity.status).toBe('ready')

    const persistedAdmission = await requireEligibleSideHustleLabValidationAdmission({
      ownerUserId,
      ventureId: research.venture.id,
      opportunityId: opportunity.id,
    }, f.venturePersistence)
    const proposal = persistedAdmission.admission.proposal!
    expect(proposal.requiresReview).toBe(true)

    let experiment = createSideHustleExperiment({
      opportunity: f.stored.opportunity,
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
      createdAt: '2026-10-02T18:10:00.000Z',
    })
    experiment = startSideHustleExperiment(experiment, '2026-10-02T18:11:00.000Z')
    experiment = completeSideHustleExperiment(experiment, '2026-10-02T18:20:00.000Z')

    const evaluation: SideHustleExperimentEvaluation = {
      experimentId: experiment.id,
      opportunityId: opportunity.id,
      decision: 'promote',
      observationCount: proposal.minimumObservations,
      totalSpend: 25,
      totalHours: 2,
      successCriteriaMet: experiment.successCriteria.map((criterion) => criterion.id),
      successCriteriaMissed: [],
      killCriteriaMet: [],
      evidenceRefs: ['evidence:paid-order', 'transaction:order-1'],
      reasons: ['Observed paid order within bounded validation.'],
      evaluatedAt: '2026-10-02T18:21:00.000Z',
    }
    f.experimentRecords.push({ experiment, observations: [], evaluation })
    await f.venturePersistence.recordReceipt({
      id: `venture-experiment-bridge:${experiment.id}`,
      ownerUserId,
      ventureId: research.venture.id,
      kind: 'experiment_bridge',
      evidenceRefs: experiment.evidenceRefs,
      payload: {
        experimentId: experiment.id,
        validationAdmissionReceiptId: persistedAdmission.receipt.id,
        started: false,
        externalActionAuthorized: false,
        authorizationEffect: 'NONE',
      },
      recordedAt: experiment.createdAt,
    })

    const outcome = calculateOpportunityOutcome({
      id: 'outcome:runtime:1',
      opportunityId: opportunity.id,
      result: 'won',
      currency: 'USD',
      grossRevenue: 40,
      directCosts: 18,
      fees: 2,
      refunds: 0,
      hours: 1,
      sourceOwner: 'commerce',
      evidenceRefs: ['evidence:paid-order'],
      transactionRefs: ['transaction:order-1'],
      executionRef: 'execution:commerce:1',
      observedAt: '2026-10-02T18:25:00.000Z',
    })
    f.outcomes.set(outcome.id, outcome)
    f.setStored({
      ...f.stored,
      opportunity: {
        ...f.stored.opportunity,
        status: 'won',
        updatedAt: outcome.observedAt,
      },
    })

    const learned = await runSideHustleLabOutcomeLearningRuntime({
      ownerUserId,
      ventureId: research.venture.id,
      outcomeId: outcome.id,
      assessedAt: '2026-10-02T18:26:00.000Z',
    }, {
      opportunities: f.opportunities,
      ventures: f.venturePersistence,
    })

    expect(learned.venture.lifecycle).toBe('validated')
    expect(learned.learning.memories).toHaveLength(3)
    expect(learned.learning.maturityAssessment?.decision).toBe('eligible')
    expect(learned.learning.automaticMaturityPromotionAuthorized).toBe(false)
    expect(learned.projection.janet.authority).toBe('MEMORY_CONTEXT_ONLY')
    expect(learned.projection.delia.moneyMovementAuthorized).toBe(false)
    expect(learned.projection.marisa.automaticExternalActionAuthorized).toBe(false)
    expect(learned.projection.jhadina.authority).toBe('GOVERNANCE_ONLY')
    expect(f.stored.opportunity.metadata?.sideHustleProfile).toEqual(opportunity.metadata?.sideHustleProfile)

    const final = await certifySideHustleLiveFinalRuntime({
      ownerUserId,
      certifiedAt: '2026-10-02T18:30:00.000Z',
    }, {
      opportunities: f.opportunities,
      ventures: f.venturePersistence,
    })

    expect(final.report.softwareStatus).toBe('pass')
    expect(final.report.liveStatus).toBe('pass')
    expect(final.report.status).toBe('pass')
    expect(final.report.externalActionAuthorized).toBe(false)
    expect(final.report.moneyMovementAuthorized).toBe(false)
    expect(final.report.automaticMaturityPromotionAuthorized).toBe(false)
    expect(final.liveEvidence.promotedValidationExperiments).toBe(1)
    expect(final.liveEvidence.realizedOutcomes).toBe(1)
    expect(final.liveEvidence.unauthorizedExternalActions).toBe(0)
    expect(final.liveEvidence.automaticMaturityPromotions).toBe(0)
  })
})
