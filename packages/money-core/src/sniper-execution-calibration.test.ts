import test from 'node:test'
import assert from 'node:assert/strict'
import {calibrateSniperExecution,type SniperExecutionSample} from './sniper-execution-calibration.js'
const stamp='2026-10-21T20:00:00Z'
const sample=(i:number,extra:Partial<SniperExecutionSample>={}):SniperExecutionSample=>({
 sampleId:'s'+i,chainId:'solana-mainnet',venue:'raydium-direct',side:'BUY',
 quoteObservedAt:stamp,submittedAt:stamp,settledAt:stamp,observedAt:stamp,
 observedSlippageBps:i,baseFeeLamports:5000n,priorityFeeLamports:500n,
 jitoTipLamports:1000n,nonRecoverableRentLamports:0n,
 outcome:'CONFIRMED_FILL',source:'CONFIRMED_ONCHAIN',chainAttestation:'INDEPENDENT_RPC_VERIFIED',
 signature:'sig'+i,evidenceIds:['chain:'+i],...extra,
})
const query=(samples:readonly SniperExecutionSample[])=>calibrateSniperExecution({
 samples,venue:'raydium-direct',side:'BUY',cutoff:'2026-10-21T21:00:00Z',
 minConfirmedSamples:10,maximumCandidateSlippageBps:100,slippageBufferBps:5,
})
test('calibration requires actual verified samples and never adjusts money limits',()=>{
 const samples=Array.from({length:10},(_,i)=>sample(i+1))
 const r=query([...samples,sample(11,{source:'PAPER_SIMULATION'}),sample(12,{chainAttestation:'UNVERIFIED'})])
 assert.equal(r.status,'OBSERVATION_ONLY')
 assert.equal(r.eligibleSampleCount,10)
 assert.equal(r.p90AdverseSlippageBps,9)
 assert.equal(r.p90FixedFeeLamports,6500n)
 assert.equal(r.candidateSlippageBudgetBps,14)
 assert.equal(r.canChangeMoneyLimits,false)
 assert.equal(r.canExecute,false)
})
test('failed/unknown fills never turn into profitable execution samples',()=>{
 const r=query([sample(1,{outcome:'FAILED'}),sample(2,{outcome:'UNKNOWN'})])
 assert.equal(r.status,'EVIDENCE_INSUFFICIENT')
 assert.equal(r.failedCount,1)
 assert.equal(r.unresolvedCount,1)
 assert.equal(r.p90AdverseSlippageBps,undefined)
})
test('future evidence and duplicate IDs do not inflate an edge',()=>{
 const examples=Array.from({length:10},(_,i)=>sample(i,{observedAt:'2026-10-21T22:00:00Z'}))
 assert.equal(query(examples).eligibleSampleCount,0)
 assert.equal(query(Array(10).fill(sample(1))).eligibleSampleCount,1)
})
