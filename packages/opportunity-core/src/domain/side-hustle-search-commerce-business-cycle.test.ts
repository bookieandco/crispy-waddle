import assert from 'node:assert/strict'
import type { OpportunityOutcome } from './outcome.js'
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
  SideHustleExperimentObservation,
} from './side-hustle-experiment.js'
import {
  buildSearchCommerceBusinessCycle,
  buildSearchCommerceEvidenceSnapshot,
  deriveSearchCommerceLastCompletedDates,
} from './side-hustle-search-commerce-business-cycle.js'
import type { VentureMarketSignal, VentureOpportunity, VentureWorkItem } from './venture-factory.js'
import type { SearchCommerceProductSniperReport } from './side-hustle-search-commerce-product-sniper.js'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  signals: [],
  evidenceRefs: ['venture:evidence'],
} as unknown as VentureOpportunity

const signals: VentureMarketSignal[] = [
  {
    id: 'signal:search',
    kind: 'search',
    sourceRef: 'https://example.com/search',
    observedAt: '2026-10-03T12:00:00.000Z',
    note: 'buyer search interest',
    confidence: 0.8,
  },
  {
    id: 'signal:etsy',
    kind: 'sales',
    sourceRef: 'https://www.etsy.com/shop/example',
    observedAt: '2026-10-03T12:00:00.000Z',
    note: 'scope:shop_level',
    confidence: 0.9,
  },
  {
    id: 'signal:velocity',
    kind: 'platform_velocity',
    sourceRef: 'https://www.etsy.com/listing/example',
    observedAt: '2026-10-03T12:00:00.000Z',
    note: 'listing favorites velocity',
    confidence: 0.82,
  },
]

const observation: SideHustleExperimentObservation = {
  id: 'obs:1',
  experimentId: 'experiment:1',
  observedAt: '2026-10-03T13:00:00.000Z',
  metrics: { impressions: 1000, clicks: 80, visits: 60, conversion_rate: 0.05 },
  spend: 0,
  hours: 1,
  evidenceRefs: ['experiment:observation:1'],
}
const experiment = {
  id: 'experiment:1',
  opportunityId: venture.opportunityId,
  status: 'completed',
  evidenceRefs: ['experiment:plan:1'],
} as SideHustleExperiment
const evaluation = {
  experimentId: experiment.id,
  opportunityId: venture.opportunityId,
  decision: 'promote',
  observationCount: 1,
  totalSpend: 0,
  totalHours: 1,
  successCriteriaMet: ['conversion'],
  successCriteriaMissed: [],
  killCriteriaMet: [],
  evidenceRefs: ['experiment:evaluation:1'],
  reasons: ['measured result'],
  evaluatedAt: '2026-10-03T14:00:00.000Z',
} as SideHustleExperimentEvaluation

const outcome = {
  id: 'outcome:1',
  opportunityId: venture.opportunityId,
  result: 'won',
  currency: 'USD',
  grossRevenue: 100,
  refunds: 0,
  directCosts: 40,
  fees: 10,
  hours: 1,
  sourceOwner: 'commerce',
  evidenceRefs: ['commerce:outcome:1'],
  observedAt: '2026-10-03T15:00:00.000Z',
  netRevenue: 100,
  totalCosts: 50,
  profit: 50,
  margin: 0.5,
  dollarsPerHour: 50,
} as OpportunityOutcome

const sniperReport = {
  ventureId: venture.id,
  family: venture.family,
  evaluatedAt: '2026-10-04T07:00:00.000Z',
  candidates: [{
    id: 'sniper:1',
    ventureId: venture.id,
    family: venture.family,
    recommendation: 'research',
    evidenceRefs: ['sniper:evidence:1'],
    publishRunway: {
      status: 'open',
      evidenceRefs: ['sniper:runway:1'],
    },
  }],
  researchQueue: [],
  holdQueue: [],
  rejected: [],
  evidenceRefs: ['sniper:evidence:1'],
  authority: 'PRODUCT_SNIPER_PORTFOLIO_ANALYTICS_ONLY',
  externalActionAuthorized: false,
  publishingAuthorized: false,
  purchasingAuthorized: false,
  moneyMovementAuthorized: false,
} as unknown as SearchCommerceProductSniperReport

const evidence = buildSearchCommerceEvidenceSnapshot({
  venture,
  observedAt: '2026-10-04T07:00:00.000Z',
  scoutSignals: signals,
  experiments: [{ experiment, observations: [observation], evaluation }],
  outcomes: [outcome],
  productSniperReport: sniperReport,
})

for (const key of [
  'market observations',
  'search observations',
  'search demand',
  'competitor observations',
  'trend observations',
  'impressions',
  'clicks',
  'visits',
  'conversion',
  'experiment results',
  'revenue',
  'refunds/reversals',
  'fees',
  'performance observations',
  'product candidates',
  'seasonal runway',
  'demand windows',
] as const) {
  assert.ok(evidence.availableInputKeys.includes(key), key)
}

for (const unproven of ['product costs', 'shipping', 'ad spend', 'provider costs'] as const) {
  assert.equal(evidence.availableInputKeys.includes(unproven), false, unproven)
}

const workItems = [
  {
    id: 'business-work:venture:pod-1:daily_shop_health:2026-10-03',
    ventureId: venture.id,
    agentId: 'marisa:operations',
    step: 'search_commerce:daily_shop_health',
    status: 'completed',
    createdAt: '2026-10-03T08:00:00.000Z',
    updatedAt: '2026-10-03T09:00:00.000Z',
    evidenceRefs: ['work:evidence'],
    outputRefs: ['work:output'],
    spendUsd: 0,
    authorizationEffect: 'NONE',
  },
] satisfies VentureWorkItem[]

const completed = deriveSearchCommerceLastCompletedDates(workItems)
assert.equal(completed.daily_shop_health, '2026-10-03')

const cycle = buildSearchCommerceBusinessCycle({
  venture,
  businessDate: '2026-10-03',
  observedAt: '2026-10-03T16:00:00.000Z',
  workItems,
  scoutSignals: signals,
  outcomes: [outcome],
  experiments: [{ experiment, observations: [observation], evaluation }],
  productSniperReport: sniperReport,
})

assert.equal(
  cycle.queue.tasks.find((task) => task.routineId === 'daily_shop_health')?.due,
  false,
)
assert.equal(
  cycle.queue.tasks.find((task) => task.routineId === 'weekly_market_research')?.periodKey,
  '2026-W40',
)
assert.equal(
  cycle.queue.tasks.find((task) => task.routineId === 'monthly_financial_review')?.periodKey,
  '2026-10',
)
assert.equal(cycle.externalActionAuthorized, false)
assert.equal(cycle.moneyMovementAuthorized, false)

console.log('side-hustle-search-commerce-business-cycle tests passed')
