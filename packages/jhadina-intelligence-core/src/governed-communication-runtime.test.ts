import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryActionLedger } from '@jhadina/action-core'
import { executeGovernedReticulumCommunication } from './governed-communication-runtime.js'
import { ReticulumTransportAdapter } from './reticulum-adapter.js'
import { TransportRegistry } from './transport-registry.js'

const intent:any={intentId:'intent-1',correlationId:'corr-1',actorId:'actor-1',recipient:{endpointId:'peer-1',kind:'person',trustState:'trusted',authorization:{capability:'communications.send',granted:true,evidenceRef:'grant:1'}},capability:'communications.send',contentRef:'blob:1',createdAt:'2026-09-19T00:00:00.000Z'}
const route:any={identity:{transportId:'rns-1',adapter:'reticulum',address:'dest'},health:'healthy',capabilities:['message.send'],priority:1}

test('end-to-end send occurs inside ActionExecutor and preserves delivery lineage',async()=>{
 const actionLedger=new InMemoryActionLedger(), deliveryLedger=new InMemoryActionLedger()
 let statusesDuringSend:string[]=[]
 const result=await executeGovernedReticulumCommunication({
  intent,
  policy:{evaluate:async()=> 'allow'},
  actionLedger,
  registry:new TransportRegistry([route]),
  adapter:new ReticulumTransportAdapter({send:async()=>{statusesDuringSend=actionLedger.list().map(e=>e.status);return {receiptRef:'rns:ack:1'}}}),
  receiptId:'receipt-1',
  occurredAt:'2026-09-19T00:01:00.000Z',
  deliveryLedger,
 })
 assert.deepEqual(statusesDuringSend,['started'])
 assert.deepEqual(actionLedger.list().map(e=>e.status),['started','completed'])
 assert.equal(result.receipt.correlationId,'corr-1')
 assert.equal(result.receipt.recipientEndpointId,'peer-1')
 assert.equal(result.deliveryEvidence,'recorded')
 assert.equal(deliveryLedger.list()[0]?.metadata?.correlationId,'corr-1')
})

test('denied policy prevents transport send',async()=>{
 const actionLedger=new InMemoryActionLedger(), deliveryLedger=new InMemoryActionLedger(); let sends=0
 await assert.rejects(()=>executeGovernedReticulumCommunication({
  intent,
  policy:{evaluate:async()=> 'deny'},
  actionLedger,
  registry:new TransportRegistry([route]),
  adapter:new ReticulumTransportAdapter({send:async()=>{sends++;return {receiptRef:'never'}}}),
  receiptId:'r',
  occurredAt:'now',
  deliveryLedger,
 }),/Action denied/)
 assert.equal(sends,0)
 assert.deepEqual(actionLedger.list().map(e=>e.status),['started','denied'])
})

test('approval-required policy cannot send without a consumed receipt',async()=>{
 const actionLedger=new InMemoryActionLedger(), deliveryLedger=new InMemoryActionLedger(); let sends=0
 await assert.rejects(()=>executeGovernedReticulumCommunication({
  intent,
  policy:{evaluate:async()=> 'approval_required'},
  actionLedger,
  registry:new TransportRegistry([route]),
  adapter:new ReticulumTransportAdapter({send:async()=>{sends++;return {receiptRef:'never'}}}),
  receiptId:'r',
  occurredAt:'now',
  deliveryLedger,
 }),/Approval required/)
 assert.equal(sends,0)
 assert.deepEqual(actionLedger.list().map(e=>e.status),['started','approval_required'])
})

test('delivery evidence outage does not misreport a successful transport as failed',async()=>{
 const actionLedger=new InMemoryActionLedger()
 const deliveryLedger:any={append:async()=>{throw new Error('evidence unavailable')}}
 let sends=0
 const result=await executeGovernedReticulumCommunication({
  intent,
  policy:{evaluate:async()=> 'allow'},
  actionLedger,
  registry:new TransportRegistry([route]),
  adapter:new ReticulumTransportAdapter({send:async()=>{sends++;return {receiptRef:'rns:ack:2'}}}),
  receiptId:'receipt-2',
  occurredAt:'2026-09-19T00:02:00.000Z',
  deliveryLedger,
 })
 assert.equal(sends,1)
 assert.equal(result.deliveryEvidence,'record_failed')
 assert.deepEqual(actionLedger.list().map(e=>e.status),['started','completed'])
})
