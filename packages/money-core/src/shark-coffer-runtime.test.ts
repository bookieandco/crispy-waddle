import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSharkCofferRuntimeResearch,
  type SharkCofferRuntimePolicy,
  type SharkMoneyRuntimeMarketEvidence,
  type SharkMoneyTransportEnvelope,
  type SharkResearchIngressContext,
} from './index.js'

const envelope=(contradiction=false):SharkMoneyTransportEnvelope=>({
  schemaVersion:'SHARK-MONEY-02',
  envelopeId:'env:1',
  proposal:{proposalId:'p1',contextId:'ctx1',disposition:'ASK',recommendation:'research',rationale:'test',uncertainty:[],alternatives:['wait','keep cash']},
  assessment:{
    assessmentId:'a1',chainId:'solana',tokenAddress:'TOKEN',assessedAt:'2026-10-03T05:00:05Z',informationCutoff:'2026-10-03T05:00:03Z',
    tradeType:'new-pair-speculation',assessmentVersion:'v1',thesis:'Momentum may persist after verified migration.',confidence:.8,
    sourceRisk:{overallRisk:.2,band:'candidate'},invalidationConditions:['liquidity collapses'],
    evidenceRefs:[
      {evidenceId:'chain:1',source:'helius',sourceGroup:'chain',stance:'SUPPORTS',direction:'BULLISH',strength:.8,confidence:.9,observedAt:'2026-10-03T05:00:00Z',availableAt:'2026-10-03T05:00:01Z',summary:'wallet and migration evidence',immutable:true},
      {evidenceId:'market:1',source:'dexscreener',sourceGroup:'market',stance:contradiction?'CONTRADICTS':'SUPPORTS',direction:contradiction?'BEARISH':'BULLISH',strength:.7,confidence:.8,observedAt:'2026-10-03T05:00:01Z',availableAt:'2026-10-03T05:00:03Z',summary:'market evidence',immutable:true},
    ],
  },
  sourceProvenance:{contentHash:'source-hash',generatedBy:'@jhadina/shark-intelligence-core'},
  allowedUses:['MONEY_RESEARCH_INPUT'],
  authority:{decision:'INTELLIGENCE_ONLY',financialExecution:'NONE',capitalAccess:'NONE',protectedFunds:'NONE',walletSigning:'NONE'},
})
const context:SharkResearchIngressContext={accountId:'acct1',requestedBy:'runtime',receivedAt:'2026-10-03T05:00:06Z',sourceNamespace:'shark',evidenceQuality:'SUPPORTED'}
const market:SharkMoneyRuntimeMarketEvidence={
  evidenceId:'money-market:1',assessmentId:'a1',chainId:'solana',tokenAddress:'TOKEN',source:'dexscreener',
  liquidityUsd:100000,volume24hUsd:300000,buys24h:120,sells24h:40,anomalyScore:.1,
  observedAt:'2026-10-03T05:00:02Z',availableAt:'2026-10-03T05:00:04Z',evidenceIds:['raw:market:1'],payloadHash:'raw-hash',
  authority:'EVIDENCE_ONLY',canExecute:false,
}
const policy:SharkCofferRuntimePolicy={
  policyId:'policy:1',strategyId:'MIGRATION_CONFIRM',modelId:'money-shark-runtime',modelVersion:'1',methodologyVersion:'runtime-01',
  minLiquidityUsd:25000,minCalibrationSamples:20,minEvidenceQualityBps:4500,maxLiquidityParticipationBps:10,minimumCapitalMinor:1000n,
  opportunityExpiresAt:'2026-10-03T05:15:00Z',authority:'POLICY_ONLY',canExecute:false,
}

test('RUNTIME.3 builds durable Money thesis, dialectic, opportunity and validation from raw market evidence',()=>{
  const r=buildSharkCofferRuntimeResearch({envelope:envelope(),ingressContext:context,market,policy,calibrationSampleSize:25,createdAt:'2026-10-03T05:00:07Z'})
  assert.equal(r.disposition,'MONEY_OPPORTUNITY_READY')
  assert.equal(r.thesis.authority,'INTELLIGENCE_ONLY')
  assert.equal(r.dialectic.status,'SUPPORTED')
  assert.equal(r.opportunity?.riskStatus,'ASSESSED')
  assert.equal(r.opportunity?.liquidityStatus,'ASSESSED')
  assert.equal(r.validation?.authority,'MONEY_VALIDATION_ONLY')
  assert.equal(r.tradeMims?.vote.status,'PASS')
  assert.equal(r.canExecute,false)
})

test('RUNTIME.4 base-rate debt yields MIMS REVIEW rather than fake live eligibility',()=>{
  const r=buildSharkCofferRuntimeResearch({envelope:envelope(),ingressContext:context,market,policy,calibrationSampleSize:3,createdAt:'2026-10-03T05:00:07Z'})
  assert.equal(r.disposition,'MONEY_OPPORTUNITY_READY')
  assert.equal(r.tradeMims?.vote.status,'REVIEW')
  assert.equal(r.tradeMims?.canAuthorizeAction,false)
})

test('RUNTIME.5 unresolved SHARK contradiction blocks opportunity creation',()=>{
  const r=buildSharkCofferRuntimeResearch({envelope:envelope(true),ingressContext:context,market,policy,calibrationSampleSize:25,createdAt:'2026-10-03T05:00:07Z'})
  assert.equal(r.disposition,'BLOCKED')
  assert.equal(r.opportunity,undefined)
  assert.ok(r.reasonCodes.includes('MONEY_DIALECTIC_NOT_SUPPORTED'))
})

test('RUNTIME.5 thin liquidity blocks before Coffer admission',()=>{
  const r=buildSharkCofferRuntimeResearch({envelope:envelope(),ingressContext:context,market:{...market,liquidityUsd:100},policy,calibrationSampleSize:25,createdAt:'2026-10-03T05:00:07Z'})
  assert.equal(r.disposition,'BLOCKED')
  assert.ok(r.reasonCodes.includes('MONEY_LIQUIDITY_BELOW_RUNTIME_FLOOR'))
})
