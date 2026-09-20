import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryActionLedger } from '@jhadina/action-core'
import { InMemoryStoreForwardQueue, InMemoryStoreForwardRepository, RepositoryStoreForwardQueue, reconcileStoreForward } from './store-forward.js'

const dispatch:any={correlationId:'corr-1',intent:{intentId:'intent-1',correlationId:'corr-1',actorId:'actor-1',recipient:{endpointId:'peer-1',kind:'person',trustState:'trusted',authorization:{capability:'communications.send',granted:true,evidenceRef:'grant:1'}},capability:'communications.send',contentRef:'blob:1',createdAt:'2026-09-19T00:00:00.000Z'}}

test('store-forward is idempotent across reconciliation and queue restart', async()=>{
 const repository=new InMemoryStoreForwardRepository()
 let queue=new RepositoryStoreForwardQueue(repository)
 assert.equal(await queue.enqueue({itemId:'sf-1',dispatch,enqueuedAt:'2026-09-19T00:00:00.000Z'}),'enqueued')
 queue=new RepositoryStoreForwardQueue(repository)
 assert.equal((await queue.pending()).length,1)
 assert.equal(await queue.enqueue({itemId:'sf-duplicate-id',dispatch,enqueuedAt:'2026-09-19T00:00:01.000Z'}),'duplicate')
 let calls=0
 assert.deepEqual(await reconcileStoreForward({queue,forward:async()=>{calls++}}),{forwarded:['sf-1'],failed:[],evidenceFailed:[]})
 assert.equal(calls,1)
 assert.equal(await queue.enqueue({itemId:'sf-1',dispatch,enqueuedAt:'2026-09-19T00:00:00.000Z'}),'duplicate')
})

test('failed forwarding remains pending and emits sanitized evidence', async()=>{
 const queue=new InMemoryStoreForwardQueue(), ledger=new InMemoryActionLedger()
 await queue.enqueue({itemId:'sf-2',dispatch,enqueuedAt:'2026-09-19T00:00:00.000Z'})
 const result=await reconcileStoreForward({queue,ledger,forward:async()=>{throw new Error('secret provider detail')}})
 assert.deepEqual(result,{forwarded:[],failed:['sf-2'],evidenceFailed:[]})
 assert.equal((await queue.pending()).length,1)
 assert.equal(ledger.list()[0]?.metadata?.failureCode,'FORWARD_FAILED')
 assert.equal(JSON.stringify(ledger.list()[0]).includes('secret provider detail'),false)
})

test('successful forwarding reconciles before evidence failure so reconnect cannot duplicate send', async()=>{
 const queue=new InMemoryStoreForwardQueue()
 await queue.enqueue({itemId:'sf-3',dispatch:{...dispatch,correlationId:'corr-3',intent:{...dispatch.intent,intentId:'intent-3',correlationId:'corr-3'}},enqueuedAt:'2026-09-19T00:00:00.000Z'})
 let calls=0
 const ledger:any={append:async()=>{throw new Error('ledger unavailable')}}
 const first=await reconcileStoreForward({queue,ledger,forward:async()=>{calls++}})
 const second=await reconcileStoreForward({queue,ledger,forward:async()=>{calls++}})
 assert.deepEqual(first,{forwarded:['sf-3'],failed:[],evidenceFailed:['sf-3']})
 assert.deepEqual(second,{forwarded:[],failed:[],evidenceFailed:[]})
 assert.equal(calls,1)
})

test('store-forward rejects forged authorization and lineage', async()=>{
 const queue=new InMemoryStoreForwardQueue()
 await assert.rejects(()=>queue.enqueue({itemId:'sf-x',dispatch:{...dispatch,correlationId:'forged'},enqueuedAt:'now'}),/STORE_FORWARD_LINEAGE_MISMATCH/)
 await assert.rejects(()=>queue.enqueue({itemId:'sf-y',dispatch:{...dispatch,intent:{...dispatch.intent,recipient:{...dispatch.intent.recipient,authorization:{...dispatch.intent.recipient.authorization,granted:false}}}},enqueuedAt:'now'}),/RECIPIENT_NOT_AUTHORIZED/)
})
