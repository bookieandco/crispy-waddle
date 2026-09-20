import assert from 'node:assert/strict'
import test from 'node:test'
import { ActionExecutor, InMemoryActionLedger } from '@jhadina/action-core'
import { CommunicationAuthorizationHandler } from './communication-action.js'
import { executeGovernedReticulumCommunication } from './governed-communication-runtime.js'
import { ReticulumTransportAdapter } from './reticulum-adapter.js'
import { TransportRegistry } from './transport-registry.js'

const intent:any={intentId:'intent-1',correlationId:'corr-1',actorId:'actor-1',recipient:{endpointId:'peer-1',kind:'person',trustState:'authorized'},capability:'communications.send',contentRef:'blob:1',createdAt:'2026-09-19T00:00:00.000Z'}
const route:any={identity:{transportId:'rns-1',adapter:'reticulum',address:'dest'},health:'healthy',capabilities:['message.send'],priority:1}

test('end-to-end governed communication preserves lineage into delivery evidence',async()=>{
 const actionLedger=new InMemoryActionLedger(), evidenceLedger=new InMemoryActionLedger()
 const executor=new ActionExecutor({evaluate:async()=> 'allow'},actionLedger,[new CommunicationAuthorizationHandler()])
 const receipt=await executeGovernedReticulumCommunication({intent,executor,registry:new TransportRegistry([route]),adapter:new ReticulumTransportAdapter({send:async()=>({receiptRef:'rns:ack:1'})}),receiptId:'receipt-1',occurredAt:'2026-09-19T00:01:00.000Z',ledger:evidenceLedger})
 assert.equal(receipt.correlationId,'corr-1')
 assert.equal(receipt.intentId,'intent-1')
 assert.equal(evidenceLedger.list()[0]?.metadata?.correlationId,'corr-1')
})

test('denied policy prevents transport send',async()=>{
 const ledger=new InMemoryActionLedger(); let sends=0
 const executor=new ActionExecutor({evaluate:async()=> 'deny'},ledger,[new CommunicationAuthorizationHandler()])
 await assert.rejects(()=>executeGovernedReticulumCommunication({intent,executor,registry:new TransportRegistry([route]),adapter:new ReticulumTransportAdapter({send:async()=>{sends++;return {receiptRef:'never'}}}),receiptId:'r',occurredAt:'now',ledger}),/Action denied/)
 assert.equal(sends,0)
})
