import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryActionLedger } from '@jhadina/action-core'
import { appendDeliveryEvidence, createDeliveryReceipt } from './delivery-evidence.js'

const dispatch:any={correlationId:'corr-1',intent:{intentId:'intent-1',correlationId:'corr-1',actorId:'actor-1'}}
const route:any={identity:{transportId:'transport-1',adapter:'test',address:'opaque'},health:'healthy',capabilities:['message.send'],priority:1}

test('delivery evidence preserves intent correlation and transport lineage', async () => {
  const receipt=createDeliveryReceipt({receiptId:'r1',dispatch,route,status:'delivered',occurredAt:'2026-09-19T00:00:00.000Z',evidenceRefs:['provider:ack:1']})
  const ledger=new InMemoryActionLedger()
  await appendDeliveryEvidence(ledger,receipt)
  const [event]=ledger.list()
  assert.equal(event.actionId,'intent-1')
  assert.equal(event.metadata?.correlationId,'corr-1')
  assert.equal(event.metadata?.transportId,'transport-1')
})

test('failed delivery requires explicit failure evidence', () => {
  assert.throws(()=>createDeliveryReceipt({receiptId:'r2',dispatch,route,status:'failed',occurredAt:'2026-09-19T00:00:00.000Z'}),/DELIVERY_FAILURE_REASON_REQUIRED/)
})
