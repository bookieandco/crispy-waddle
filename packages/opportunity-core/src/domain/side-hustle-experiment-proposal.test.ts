import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import { SIDE_HUSTLE_DEFINITIONS, buildSideHustleProfile, type SideHustleFamily } from './side-hustles.js'
import { proposeSideHustleExperiment } from './side-hustle-experiment-proposal.js'

function opportunity(family: SideHustleFamily): Opportunity {
  return {
    id: `opportunity:${family}`,
    title: `${family} fixture`,
    description: `Validate ${family} without scaling first.`,
    family: 'business',
    type: 'commercial',
    sourceUrl: 'https://example.test/source',
    sourceName: 'Fixture',
    claims: [{
      id: 'claim:1',
      field: 'discovery',
      value: 'fixture',
      sourceId: 'source:1',
      sourceType: 'user',
      confidence: 0.8,
      verified: false,
    }],
    evidence: [{
      id: 'evidence:1',
      sourceId: 'source:1',
      sourceUrl: 'https://example.test/source',
      sourceName: 'Fixture',
      sourceType: 'user',
      capturedAt: '2026-09-22T15:20:00.000Z',
      confidence: 0.8,
    }],
    verificationStatus: 'unverified',
    sourceConfidence: 0.8,
    riskFlags: [],
    metadata: {
      sideHustleProfile: buildSideHustleProfile({ family }),
    },
    status: 'discovered',
    createdAt: '2026-09-22T15:20:00.000Z',
    updatedAt: '2026-09-22T15:20:00.000Z',
  }
}

for (const definition of SIDE_HUSTLE_DEFINITIONS) {
  if (definition.family === 'trading_investing_intelligence') continue
  const proposal = proposeSideHustleExperiment({
    opportunity: opportunity(definition.family),
    generatedAt: '2026-09-22T15:30:00.000Z',
  })
  assert.equal(proposal.family, definition.family)
  assert.equal(proposal.familyLabel, definition.label)
  assert.equal(proposal.requiresReview, true)
  assert.ok(proposal.maxSpend >= 0 && proposal.maxSpend <= 500)
  assert.ok(proposal.maxHours > 0 && proposal.maxHours <= 40)
  assert.ok(proposal.maxDurationDays > 0 && proposal.maxDurationDays <= 45)
  assert.ok(proposal.successCriteria.length >= 2)
  assert.ok(proposal.evidenceRefs.includes('evidence:1'))
  assert.ok(proposal.assumptions.some((item) => item.includes('not a prediction')))
}

{
  const service = proposeSideHustleExperiment({
    opportunity: opportunity('ai_discovery_seo'),
    targetCustomer: 'Independent dental practices',
    offer: 'Paid AI-discovery audit',
    maxSpend: 80,
    maxHours: 6,
    maxDurationDays: 10,
    generatedAt: '2026-09-22T15:30:00.000Z',
  })
  assert.equal(service.archetype, 'service_demand')
  assert.equal(service.targetCustomer, 'Independent dental practices')
  assert.equal(service.offer, 'Paid AI-discovery audit')
  assert.equal(service.maxSpend, 80)
  assert.equal(service.maxHours, 6)
  assert.equal(service.maxDurationDays, 10)
}

{
  const commerce = proposeSideHustleExperiment({
    opportunity: opportunity('pod_personalized_commerce'),
    generatedAt: '2026-09-22T15:30:00.000Z',
  })
  assert.equal(commerce.archetype, 'product_preorder')
  assert.ok(commerce.successCriteria.some((criterion) => criterion.metric === 'paid_orders'))
}

{
  const procurement = proposeSideHustleExperiment({
    opportunity: opportunity('procurement_subcontracting'),
    generatedAt: '2026-09-22T15:30:00.000Z',
  })
  assert.equal(procurement.archetype, 'procurement_fit')
  assert.ok(procurement.assumptions.some((item) => item.includes('Bid submission remains a separate governed action')))
}

assert.throws(
  () => proposeSideHustleExperiment({
    opportunity: opportunity('trading_investing_intelligence'),
    generatedAt: '2026-09-22T15:30:00.000Z',
  }),
  /do not receive standalone business experiments/,
)

assert.throws(
  () => proposeSideHustleExperiment({
    opportunity: opportunity('software_apps'),
    maxSpend: 501,
    generatedAt: '2026-09-22T15:30:00.000Z',
  }),
  /between 0 and 500/,
)

console.log('side hustle experiment proposal tests passed')
