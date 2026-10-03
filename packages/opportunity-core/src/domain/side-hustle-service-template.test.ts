import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import { buildSideHustleProfile } from './side-hustles.js'
import {
  buildSideHustleServiceWorkOrderDraft,
  getSideHustleServiceTemplate,
  SIDE_HUSTLE_SERVICE_TEMPLATE_FAMILIES,
} from './side-hustle-service-template.js'

const now = '2026-10-03T13:00:00.000Z'

function opportunity(family: Parameters<typeof buildSideHustleProfile>[0]['family']): Opportunity {
  return {
    id: `opportunity:service-template:${family}`,
    title: 'Service template fixture',
    family: 'business',
    type: 'commercial',
    sourceName: 'Side Hustle service template test',
    claims: [],
    evidence: [],
    verificationStatus: 'unverified',
    sourceConfidence: 0.9,
    riskFlags: [],
    metadata: {
      sideHustleProfile: buildSideHustleProfile({ family }),
    },
    status: 'ready',
    createdAt: now,
    updatedAt: now,
  }
}

for (const family of SIDE_HUSTLE_SERVICE_TEMPLATE_FAMILIES) {
  const row = getSideHustleServiceTemplate(family)
  assert.equal(row.family, family)
  assert.ok(row.templateId.includes(family))
  assert.ok(row.label.trim().length > 0)
  assert.ok(row.outcomePromise.trim().length > 0)
  assert.ok(row.scopeItems.length >= 3)
  assert.ok(row.acceptanceCriteria.length >= 3)
  assert.equal(new Set(row.scopeItems.map((item) => item.id)).size, row.scopeItems.length)
  assert.equal(new Set(row.acceptanceCriteria.map((item) => item.id)).size, row.acceptanceCriteria.length)
}

const draft = buildSideHustleServiceWorkOrderDraft({
  opportunity: opportunity('content_social'),
  id: 'work-order:content:1',
  customerRef: 'relationship:customer:content:1',
  price: { amount: 1250, currency: 'usd', cadence: 'monthly' },
  evidenceRefs: ['evidence:scope-call'],
  createdAt: now,
})

assert.equal(draft.opportunityId, 'opportunity:service-template:content_social')
assert.equal(draft.title, 'Content and social operations')
assert.ok(draft.outcomePromise.includes('content package'))
assert.equal(draft.scopeItems.length, 3)
assert.ok(draft.scopeItems.every((item) => item.evidenceRefs.includes('evidence:scope-call')))
assert.ok(draft.evidenceRefs.some((ref) => ref.startsWith('template:side-hustle-service:content_social')))
assert.equal(draft.price.amount, 1250)
assert.equal(draft.price.currency, 'usd')
assert.equal(draft.price.cadence, 'monthly')

const customized = buildSideHustleServiceWorkOrderDraft({
  opportunity: opportunity('media_production'),
  id: 'work-order:media:1',
  ventureId: 'venture:media:1',
  customerRef: 'relationship:customer:media:1',
  title: 'Three-video production package',
  outcomePromise: 'Deliver three approved final videos.',
  price: { amount: 2400, currency: 'USD', cadence: 'project' },
  evidenceRefs: ['evidence:client-brief'],
})

assert.equal(customized.title, 'Three-video production package')
assert.equal(customized.outcomePromise, 'Deliver three approved final videos.')
assert.equal(customized.ventureId, 'venture:media:1')
assert.equal(customized.acceptanceCriteria.filter((criterion) => criterion.required).length, 3)

assert.throws(
  () => getSideHustleServiceTemplate('digital_products'),
  /does not use the service work-order template runtime/,
)

assert.throws(
  () => buildSideHustleServiceWorkOrderDraft({
    opportunity: opportunity('digital_products'),
    id: 'work-order:digital:1',
    customerRef: 'relationship:customer:digital:1',
    price: { amount: 25, currency: 'USD', cadence: 'one_time' },
    evidenceRefs: ['evidence:product'],
  }),
  /does not use the service work-order template runtime/,
)

console.log('side hustle service template tests passed')
