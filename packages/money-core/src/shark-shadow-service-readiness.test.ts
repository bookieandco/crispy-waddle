import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyShadowServiceReadiness} from './shark-shadow-service-readiness.js'

const now='2026-10-08T18:00:00.000Z'
const live={authority:'SHADOW_LEARNING_ONLY',canExecute:false,canSign:false,canBroadcast:false}
const outcome={authority:'SHADOW_LEARNING_ONLY',canExecute:false,canAuthorizeLive:false}
const service={
  ...live,status:'ready',updatedAt:'2026-10-08T17:59:00.000Z',
  lastCycle:{live:{...live},outcomes:{...outcome}},
}
const check=(state:unknown,lastError?:string)=>classifyShadowServiceReadiness({
  now,service:state,lastError,intervalSeconds:300,
})
test('real fresh completed paper cycle is ready but never authorizes trades',()=>{
  assert.deepEqual(check(service),{status:'ready',code:'READY',httpStatus:200})
})
test('DB-only liveness, no cycles or a failed cycle must never be READY',()=>{
  assert.equal(check(null).httpStatus,503)
  assert.equal(check({...service,lastCycle:null}).code,'NO_SUCCESSFUL_CYCLE')
  assert.equal(check(service,'failed db probe').code,'CYCLE_FAILURE')
})
test('stale, invalid and future-dated cycle receipts fail closed',()=>{
  assert.equal(check({...service,updatedAt:'2026-10-08T17:40:00.000Z'}).code,'STALE_CYCLE')
  assert.equal(check({...service,updatedAt:'garbage'}).httpStatus,503)
  assert.equal(check({...service,updatedAt:'2026-10-08T18:01:00.000Z'}).httpStatus,503)
})
test('no signer, broadcast, money authority or missing outcomes may be hidden in readiness',()=>{
  assert.equal(check({...service,lastCycle:{live:{...live,canSign:true},outcomes:outcome}}).code,'PAPER_AUTHORITY_INVALID')
  assert.equal(check({...service,lastCycle:{live,outcomes:{...outcome,canAuthorizeLive:true}}}).httpStatus,503)
  assert.equal(check({...service,canExecute:true}).httpStatus,503)
})
