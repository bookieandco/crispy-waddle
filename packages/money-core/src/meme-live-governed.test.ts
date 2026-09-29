import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import { certifyMemeGovernedLive,createMemeGovernedExecutionEnvelope,type MemeGovernedLivePolicy,type MemeProviderSoakEvidence } from './meme-live-governed.js'
import type { DexExecutionLadderReport } from './dex-four-stage-certification.js'
import type { DexRouterFinalReport } from './dex-router-final.js'
import type { CofferCommissionFinalReport } from './coffer-commission-final.js'
import type { AutonomousTradingMandate } from './autonomous-trading-contracts.js'

const ladder=(ok=true):DexExecutionLadderReport=>({
 reportId:'ladder:1',version:'DEX-EXECUTION-4STAGE-v2',stages:[],softwareCertified:true,operationallyCertified:ok,controlledLiveCanaryCertified:ok,
 unrestrictedLiveAuthorized:false,missingStages:[],reasonCodes:ok?[]:['blocked'],authority:'CERTIFICATION_ONLY',
})
const router:DexRouterFinalReport={reportId:'router:1',version:'DEX-ROUTER-FINAL-v1',status:'DEX_ROUTER_COMMISSIONED',passed:true,jupiterPrimaryVerified:true,raydiumDirectVerified:true,meteoraDirectVerified:true,fallbackOrder:['jupiter-ultra','raydium-direct','meteora-direct'],blockerCodes:[],evidenceIds:['router:e'],unrestrictedLiveAuthorized:false,authority:'CERTIFICATION_ONLY',canAuthorizeTrade:false}
const coffer:CofferCommissionFinalReport={reportId:'coffer:1',version:'COFFER-COMMISSION-v1',status:'COFFER_COMMISSIONED',passed:true,softwareReady:true,operationalEvidence:true,walletConnectionId:'coffer:1',walletAddress:'Wallet111',observedBalanceLamports:200000n,requiredBalanceLamports:100000n,fundingShortfallLamports:0n,settlementAssetId:'USDC',observedSettlementAtomic:1000000n,requiredSettlementAtomic:500000n,settlementShortfallAtomic:0n,settlementFundingVerified:true,blockerCodes:[],evidenceIds:['coffer:e'],unrestrictedLiveAuthorized:false,authority:'CERTIFICATION_ONLY',canMoveFunds:false}
const mandate:AutonomousTradingMandate={
 mandateId:'mandate:1',userId:'u1',provider:'solana-dex-router',accountId:'coffer:1',currency:'USD',mode:'LIVE_AUTONOMOUS',allowedInstrumentPrefixes:['solana:'],allowedStrategyIds:['meme:v1'],allowOpeningShorts:false,
 limits:{maxOrderNotionalMinor:1000n,maxDailySubmittedNotionalMinor:5000n,maxDailyOrders:5,maxDailyRealizedLossMinor:1000n,maxGrossExposureMinor:3000n,maxDrawdownBps:1000,maxLeverageBps:10000,minModelConfidenceBps:6000},
 startsAt:'2026-09-28T01:00:00Z',expiresAt:'2026-09-29T01:00:00Z',approvalReceiptId:'approval:owner',actionCoreAuthorityId:'authority:1',policyVersion:'meme-governed-v1',policyHash:'hash',evidenceIds:['mandate:e'],status:'ACTIVE',activatedAt:'2026-09-28T01:00:00Z',authority:'USER_APPROVED_MANDATE',canAuthorizeTrade:false,
}
const policy:MemeGovernedLivePolicy={
 minCompletedRoundTrips:3,minSoakDurationMs:60*60*1000,maxObservedSlippageBps:150,requiredVenueCoverage:['jupiter-ultra','raydium-direct','meteora-direct'],
 maxMandateOrderNotionalMinor:2000n,maxMandateDailySubmittedNotionalMinor:10000n,maxMandateDailyOrders:10,maxMandateDailyRealizedLossMinor:2000n,maxMandateGrossExposureMinor:5000n,
}
const soak=(evidenceClass:'REAL_LIVE'|'SYNTHETIC_TEST'='REAL_LIVE'):MemeProviderSoakEvidence=>({
 soakId:'soak:1',evidenceClass,provider:'solana-dex-router',walletConnectionId:'coffer:1',startedAt:'2026-09-28T01:00:00Z',endedAt:'2026-09-28T03:00:00Z',
 completedRoundTrips:3,reconciledBroadcasts:6,unresolvedExecutions:0,duplicateBroadcasts:0,unknownExecutions:0,killSwitchDrillPassed:true,restartRecoveryPassed:true,allPositionsFlatAfterRoundTrips:true,executionCostReconciliationPassed:true,maxObservedSlippageBps:75,
 venueCoverage:['jupiter-ultra','raydium-direct','meteora-direct'],providerReceiptIds:['p1','p2','p3','p4','p5','p6'],onchainSignatureIds:['s1','s2','s3','s4','s5','s6'],evidenceIds:['soak:e'],authority:'SOAK_EVIDENCE_ONLY',canAuthorizeTrade:false,
})

describe('MEME-LIVE.GOVERNED',()=>{
 it('does not promote a missing real Stage-4 canary into governed live',()=>{
  const report=certifyMemeGovernedLive({ladder:ladder(false),router,coffer,mandate,strategyId:'meme:v1',soak:soak(),policy,now:'2026-09-28T04:00:00Z'})
  assert.equal(report.passed,false)
  assert.ok(report.blockerCodes.includes('MEME_GOVERNED_CONTROLLED_CANARY_REQUIRED'))
  assert.equal(report.unrestrictedLiveAuthorized,false)
  assert.equal(report.canExecute,false)
 })
 it('rejects synthetic soak evidence even after a structurally valid canary',()=>{
  const report=certifyMemeGovernedLive({ladder:ladder(),router,coffer,mandate,strategyId:'meme:v1',soak:soak('SYNTHETIC_TEST'),policy,now:'2026-09-28T04:00:00Z'})
  assert.equal(report.passed,false)
  assert.ok(report.blockerCodes.includes('MEME_GOVERNED_REAL_SOAK_EVIDENCE_REQUIRED'))
  assert.equal(report.unrestrictedLiveAuthorized,false)
 })
 it('certifies only a bounded owner mandate after real canary, commissioned router/Coffer and clean provider soak',()=>{
  const report=certifyMemeGovernedLive({ladder:ladder(),router,coffer,mandate,strategyId:'meme:v1',soak:soak(),policy,now:'2026-09-28T04:00:00Z'})
  assert.equal(report.passed,true)
  assert.equal(report.status,'MEME_GOVERNED_LIVE_ELIGIBLE')
  assert.equal(report.ownerMandateValid,true)
  assert.equal(report.providerSoakPassed,true)
  assert.equal(report.unrestrictedLiveAuthorized,false)
  assert.equal(report.requiresExecutionPermit,true)
  assert.equal(report.requiresSharkPreExecutionBinding,true)
  assert.equal(report.requiresMoneyDexGate,true)
  const envelope=createMemeGovernedExecutionEnvelope({report,mandate,strategyId:'meme:v1',now:'2026-09-28T04:00:00Z'})
  assert.equal(envelope.canExecute,false)
  assert.equal(envelope.unrestrictedLiveAuthorized,false)
  assert.equal(envelope.maxOrderNotionalMinor,1000n)
 })
 it('blocks a user mandate whose limits exceed the system governed-live ceiling',()=>{
  const excessive={...mandate,limits:{...mandate.limits,maxOrderNotionalMinor:3000n}}
  const report=certifyMemeGovernedLive({ladder:ladder(),router,coffer,mandate:excessive,strategyId:'meme:v1',soak:soak(),policy,now:'2026-09-28T04:00:00Z'})
  assert.equal(report.passed,false)
  assert.ok(report.blockerCodes.includes('MEME_GOVERNED_OWNER_MANDATE_INVALID_OR_EXCESSIVE'))
  assert.equal(report.unrestrictedLiveAuthorized,false)
 })
})
