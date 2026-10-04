import assert from 'node:assert/strict'
import { buildSearchCommerceDueTaskQueue, type VentureOpportunity } from '@jhadina/opportunity-core'
import { persistSearchCommerceBusinessPipeline } from './search-commerce-business-pipeline-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  evidenceRefs: ['evidence:venture'],
} as VentureOpportunity

const saved: unknown[] = []
const repository = {
  async getVenture() {
    return venture
  },
  async upsertWorkItems(_ownerUserId: string, items: unknown[]) {
    saved.push(...items)
    return items.length
  },
}

const queue = buildSearchCommerceDueTaskQueue({
  family: 'pod_personalized_commerce',
  businessDate: '2026-10-03',
  availableInputKeys: [
    'orders',
    'messages',
    'listing-health observations',
    'provider alerts',
  ],
})

const result = await persistSearchCommerceBusinessPipeline(
  {} as never,
  {
    ownerUserId: 'owner-1',
    ventureId: venture.id,
    queue,
    observedAt: '2026-10-04T06:58:00.000Z',
    evidenceRefs: ['evidence:storefront'],
  },
  repository as never,
)

assert.equal(result.persisted, 9)
assert.equal(saved.length, 9)
assert.equal(result.externalActionAuthorized, false)
assert.equal(result.moneyMovementAuthorized, false)
assert.ok(
  saved.every((item) =>
    typeof item === 'object'
    && item !== null
    && (item as { ventureId?: string }).ventureId === venture.id
  ),
)

await assert.rejects(
  () => persistSearchCommerceBusinessPipeline(
    {} as never,
    {
      ownerUserId: 'owner-1',
      ventureId: venture.id,
      queue: buildSearchCommerceDueTaskQueue({
        family: 'digital_products',
        businessDate: '2026-10-03',
      }),
      evidenceRefs: ['evidence:x'],
    },
    repository as never,
  ),
  /FAMILY_MISMATCH/,
)

console.log('search-commerce-business-pipeline-runtime tests passed')
