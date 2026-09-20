import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryActionLedger } from '@jhadina/action-core'
import { appendDeliveryEvidence, createDeliveryReceipt } from './delivery-evidence.js'

const dispatch:any={correlationId:'corr-1',intent:{intentId:'intent-1',correlationId:'corr-1',actorId:'actor-1',recipient:{endpointId:'peer-1'}}}
const route:any={identity:{transportId:'transport-1',adapter:'test',address:'opaque'},health:'healthy',capabilities:['message.send'],priority:1}

test('delivery evidence preserves intent recipient correlation and transport lineage', async () => {
  const receipt=createDeliveryReceipt({receiptId:'r1',dispatch,route,status:'delivered',occurredAt:'2026-09-19T00:00:00.000Z',evidenceRefs:['provider:ack:1']})
  const ledger=new InMemoryActionLedger()
  await appendDeliveryEvidence(ledger,receipt)
  const [event]=ledger.list()
  assert.equal(event.actionId,'intent-1')
  assert.equal(event.metadata?.correlationId,'corr-1')
  assert.equal(event.metadata?.recipientEndpointId,'peer-1')
  assert.equal(event.metadata?.transportId,'transport-1')
})

test('failed delivery requires sanitized failure code', () => {
  assert.throws(()=>createDeliveryReceipt({receiptId:'r2',dispatch,route,status:'failed',occurredAt:'2026-09-19T00:00:00.000Z'}),/DELIVERY_FAILURE_CODE_INVALID/)
  assert.throws(()=>createDeliveryReceipt({receiptId:'r2',dispatch,route,status:'failed',occurredAt:'2026-09-19T00:00:00.000Z',failureCode:'provider said secret=abc'}),/DELIVERY_FAILURE_CODE_INVALID/)
  assert.doesNotThrow(()=>createDeliveryReceipt({receiptId:'r2',dispatch,route,status:'failed',occurredAt:'2026-09-19T00:00:00.000Z',failureCode:'PROVIDER_TIMEOUT'}))
})

test('manually forged receipt is rejected before evidence append', async()=>{
 const ledger=new InMemoryActionLedger()
 await assert.rejects(()=>appendDeliveryEvidence(ledger,{receiptId:'r3',intentId:'intent-1',correlationId:'corr-1',actorId:'actor-1',recipientEndpointId:'',transportId:'t1',adapter:'test',status:'sent',occurredAt:'now'}),/DELIVERY_IDENTITY_REQUIRED/)
 assert.equal(ledger.list().length,0)
})
