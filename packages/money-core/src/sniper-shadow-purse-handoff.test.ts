import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSniperShadowPurseHandoff} from './sniper-shadow-purse-handoff.js'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {SharkShadowDecisionTwin} from './shark-shadow-learning.js'
const cutoff='2026-10-21T21:00:00Z'
const base={tradeId:'t1',tokenAddress:'TOKEN1',informationCutoff:cutoff,evidenceIds:['fastpath:intake:1']}
const purse={
 authority:'OPPORTUNITY_BUS_ONLY',canExecute:false,admitted:true,ingestedAt:'2026-10-21T20:00:00Z',
 busEventId:'purse:bus:1',
 opportunity:{opportunityId:'opp1',sourceKind:'SHARK',lane:'MEME',instrumentId:'solana-mainnet:TOKEN1',evidenceIds:['purse:one']},
} as unknown as PurseOpportunityEnvelope
const shadow={
 authority:'SHADOW_DECISION_ONLY',canExecute:false,decisionId:'shadow:1',
 tokenAddress:'TOKEN1',decidedAt:'2026-10-21T20:00:10Z',
 market:{availableAt:'2026-10-21T20:00:05Z'},evidenceIds:['shadow:one'],
} as unknown as SharkShadowDecisionTwin
const settlement={
 outcomeId:'outcome:1',tokenAddress:'TOKEN1',settledAt:'2026-10-21T20:30:00Z',
 availableAt:'2026-10-21T20:31:00Z',realizedNetPnlLamports:-12000n,
 independentlyVerified:true,evidenceIds:['chain:settle'],kind:'ONCHAIN' as const,
}
test('reconciles existing Purse/Shadow types without granting signing or accounting authority',()=>{
 const result=buildSniperShadowPurseHandoff({...base,purse,shadow,settlement})
 assert.equal(result.shadowReplayReady,true)
 assert.equal(result.purseAccountingCandidate,true)
 assert.equal(result.canCreditPurse,false)
 assert.equal(result.canMutateModel,false)
 assert.equal(result.canExecute,false)
 assert.equal(result.purseOpportunityId,'opp1')
})
test('incomplete evidence remains research-only rather than synthetic success',()=>{
 const result=buildSniperShadowPurseHandoff(base)
 assert.equal(result.shadowReplayReady,false)
 assert.equal(result.purseAccountingCandidate,false)
 assert.ok(result.deferredReasons.includes('SETTLEMENT_MISSING'))
})
test('unverified or future settlement never passes handoff',()=>{
 const unverified=buildSniperShadowPurseHandoff({...base,purse,shadow,settlement:{...settlement,independentlyVerified:false}})
 assert.equal(unverified.shadowReplayReady,false)
 assert.equal(unverified.purseAccountingCandidate,false)
 assert.throws(()=>buildSniperShadowPurseHandoff({...base,purse,shadow,settlement:{...settlement,availableAt:'2026-10-21T22:00:00Z'}}),/SETTLEMENT_INVALID/)
})
