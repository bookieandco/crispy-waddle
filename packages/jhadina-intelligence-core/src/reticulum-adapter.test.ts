import assert from 'node:assert/strict'
import test from 'node:test'
import { ReticulumTransportAdapter } from './reticulum-adapter.js'

const dispatch:any={correlationId:'corr-1',intent:{intentId:'intent-1',correlationId:'corr-1',actorId:'actor-1',recipient:{endpointId:'peer-1'},contentRef:'blob:1'}}
const route:any={identity:{transportId:'rns-1',adapter:'reticulum',address:'dest-hash'},health:'healthy',capabilities:['message.send'],priority:1}

test('Reticulum adapter preserves governed dispatch lineage and returns evidence',async()=>{
 let sent:any
 const adapter=new ReticulumTransportAdapter({send:async input=>{sent=input;return {receiptRef:'rns:receipt:1'}}})
 const receipt=await adapter.send({dispatch,route,receiptId:'receipt-1',occurredAt:'2026-09-19T00:00:00.000Z'})
 assert.equal(sent.correlationId,'corr-1')
 assert.equal(sent.contentRef,'blob:1')
 assert.equal(receipt.transportId,'rns-1')
 assert.deepEqual(receipt.evidenceRefs,['rns:receipt:1'])
})

test('Reticulum cannot send through an unavailable route',async()=>{
 const adapter=new ReticulumTransportAdapter({send:async()=>({receiptRef:'never'})})
 await assert.rejects(()=>adapter.send({dispatch,route:{...route,health:'offline'},receiptId:'r',occurredAt:'now'}),/RETICULUM_ROUTE_UNAVAILABLE/)
})
