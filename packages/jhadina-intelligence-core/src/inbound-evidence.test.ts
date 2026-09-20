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

test('duplicate inbound replay is rejected before a second evidence append', async()=>{
 const ledger=new InMemoryActionLedger(), replayStore=new InMemoryReplayStore()
 await ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger})
 await assert.rejects(()=>ingestInboundObservation({actorId:'actor-1',observation,replayStore,ledger}),/INBOUND_REPLAY_REJECTED/)
 assert.equal(ledger.list().length,1)
})

test('failed authentication is rejected', async()=>{
 const ledger=new InMemoryActionLedger(), replayStore=new InMemoryReplayStore()
 await assert.rejects(()=>ingestInboundObservation({actorId:'actor-1',observation:{...observation,authentication:'failed'},replayStore,ledger}),/INBOUND_AUTHENTICATION_FAILED/)
 assert.equal(ledger.list().length,0)
})
