import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryActionLedger } from '@jhadina/action-core'
import { ingestInboundObservation, InMemoryReplayStore } from './inbound-evidence.js'

const observation={observationId:'in-1',transportId:'t-1',sourceRef:'peer:1',receivedAt:'2026-09-19T00:00:00.000Z',authentication:'unverified' as const,replayKey:'nonce-1',payloadRef:'blob:1'}

test('inbound data becomes evidence with no trust or authorization effect', async()=>{
 const ledger=new InMemoryActionLedger(), replayStore=new InMemoryReplayStore()
 await ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger})
 const [event]=ledger.list()
 assert.equal(event.metadata?.trustEffect,'NONE')
 assert.equal(event.metadata?.authorizationEffect,'NONE')
})

test('duplicate inbound replay is rejected and rejection is evidence-bearing', async()=>{
 const ledger=new InMemoryActionLedger(), replayStore=new InMemoryReplayStore()
 await ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger})
 await assert.rejects(()=>ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger}),/INBOUND_REPLAY_REJECTED/)
 assert.equal(ledger.list().length,2)
 assert.equal(ledger.list()[1]?.metadata?.rejectionCode,'REPLAY_REJECTED')
})

test('atomic replay claim permits only one concurrent ingestion', async()=>{
 const ledger=new InMemoryActionLedger(), replayStore=new InMemoryReplayStore()
 const results=await Promise.allSettled([
  ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger}),
  ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger}),
 ])
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1)
 assert.equal(results.filter(result=>result.status==='rejected').length,1)
})

test('failed authentication is rejected with durable security evidence', async()=>{
 const ledger=new InMemoryActionLedger(), replayStore=new InMemoryReplayStore()
 await assert.rejects(()=>ingestInboundObservation({actorId:'actor-1',observation:{...observation,authentication:'failed'},replayStore,ledger}),/INBOUND_AUTHENTICATION_FAILED/)
 assert.equal(ledger.list().length,1)
 assert.equal(ledger.list()[0]?.metadata?.rejectionCode,'AUTHENTICATION_FAILED')
 assert.equal(ledger.list()[0]?.metadata?.payloadRef,undefined)
})

test('ledger failure releases replay claim for a safe retry', async()=>{
 const replayStore=new InMemoryReplayStore()
 let attempts=0
 const ledger:any={append:async()=>{attempts++;if(attempts===1)throw new Error('ledger offline')}}
 await assert.rejects(()=>ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger}),/ledger offline/)
 await assert.doesNotReject(()=>ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger}))
})
