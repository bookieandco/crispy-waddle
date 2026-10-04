import assert from 'node:assert/strict'
import { buildSearchCommerceDueTaskQueue } from './side-hustle-search-commerce-task-engine.js'
import { projectSearchCommerceToBusinessPipeline } from './side-hustle-search-commerce-business-pipeline.js'

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

const projection = projectSearchCommerceToBusinessPipeline({
  ventureId: 'venture:etsy-pod-1',
  queue,
  observedAt: '2026-10-04T06:55:00.000Z',
  evidenceRefs: ['evidence:storefront-snapshot'],
})

assert.equal(projection.ventureId, 'venture:etsy-pod-1')
assert.equal(projection.items.length, 9)
assert.equal(projection.externalActionAuthorized, false)
assert.equal(projection.moneyMovementAuthorized, false)

const health = projection.items.find((item) => item.routineId === 'daily_shop_health')
assert.equal(health?.businessPipelineStatus, 'queued')
assert.equal(health?.ventureWorkItem.agentId, 'marisa:operations')
assert.equal(health?.ventureWorkItem.spendUsd, 0)
assert.equal(health?.ventureWorkItem.authorizationEffect, 'NONE')

const research = projection.items.find((item) => item.routineId === 'weekly_market_research')
assert.equal(research?.businessPipelineStatus, 'blocked')
assert.ok((research?.missingInputs.length ?? 0) > 0)
assert.equal(research?.ventureWorkItem.status, 'blocked')

assert.throws(
  () => projectSearchCommerceToBusinessPipeline({
    ventureId: '',
    queue,
    observedAt: '2026-10-04T06:55:00.000Z',
    evidenceRefs: ['evidence:x'],
  }),
  /ventureId is required/,
)

assert.throws(
  () => projectSearchCommerceToBusinessPipeline({
    ventureId: 'venture:x',
    queue,
    observedAt: '2026-10-04T06:55:00.000Z',
    evidenceRefs: [],
  }),
  /requires evidence references/,
)

console.log('side-hustle-search-commerce-business-pipeline tests passed')
