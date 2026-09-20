import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryStoreForwardQueue, reconcileStoreForward } from './store-forward.js'

const dispatch:any={correlationId:'corr-1',intent:{intentId:'intent-1',correlationId:'corr-1',actorId:'actor-1'}}

test('store-forward queue is idempotent across enqueue and reconciliation', async()=>{
 const queue=new InMemoryStoreForwardQueue()
 assert.equal(await queue.enqueue({itemId:'sf-1',dispatch,enqueuedAt:'2026-09-19T00:00:00.000Z'}),'enqueued')
 assert.equal(await queue.enqueue({itemId:'sf-1',dispatch,enqueuedAt:'2026-09-19T00:00:00.000Z'}),'duplicate')
 let calls=0
 assert.deepEqual(await reconcileStoreForward({queue,forward:async()=>{calls++}}),{forwarded:['sf-1'],failed:[]})
 assert.equal(calls,1)
 assert.equal(await queue.enqueue({itemId:'sf-1',dispatch,enqueuedAt:'2026-09-19T00:00:00.000Z'}),'duplicate')
})

test('failed forwarding remains pending for later reconciliation', async()=>{
 const queue=new InMemoryStoreForwardQueue()
 await queue.enqueue({itemId:'sf-2',dispatch,enqueuedAt:'2026-09-19T00:00:00.000Z'})
 const result=await reconcileStoreForward({queue,forward:async()=>{throw new Error('offline')}})
 assert.deepEqual(result,{forwarded:[],failed:['sf-2']})
 assert.equal((await queue.pending()).length,1)
})
