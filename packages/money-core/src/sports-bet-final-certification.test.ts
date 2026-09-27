import test from 'node:test'
import assert from 'node:assert/strict'
import type { SportsPredictionTransportEnvelope } from './sports-intelligence-ingress.js'
import { createSportsForwardShadowPrediction,resolveSportsForwardShadowPrediction } from './sports-prediction-forward-shadow.js'
import type { SportsMarketQuote } from './sports-paper-betting.js'
import { createSportsBetShadowDecision,buildSportsBetShadowSoakEvidence,certifySportsBetShadowSoak } from './sports-bet-shadow-runtime.js'
import {
  assertSportsBetLiveCanaryPolicy,createSportsBetCanaryApproval,executeSportsBetLiveCanary,certifySportsBetLiveCanary,
  type SportsBetCanaryAttempt,type SportsBetCanaryAttemptStore,type SportsBetLiveCanaryPolicy,type SportsBetLiveCanaryRuntimeState,
  type SportsBetLiveWagerRequest,type SportsBetManualCanaryTrigger,type SportsbookLiveCanaryAdapter,
} from './sports-bet-live-canary.js'
import { certifySportsBetFinalSoftware,certifySportsBetFinal,type SportsBetFinalSoftwareCaseName } from './sports-bet-final-certification.js'

const envelope:SportsPredictionTransportEnvelope=Object.freeze({
  schemaVersion:'SPORT-PRED-01',
  envelopeId:'env-sport-bet-final-1',
  sport:'basketball',
  subject:Object.freeze({subjectId:'game-1',kind:'GAME',gameId:'game-1'}),
  informationCutoff:'2026-09-27T19:00:00.000Z',
  issuedAt:'2026-09-27T19:00:01.000Z',
  model:Object.freeze({modelId:'sports-model',modelVersion:'1.0.0',methodologyVersion:'m1',featureSnapshotHash:'feature-hash',codeRevision:'test'}),
  distribution:Object.freeze({outcomes:Object.freeze([
    Object.freeze({outcomeId:'home',label:'Home',probability:0.60}),
    Object.freeze({outcomeId:'away',label:'Away',probability:0.40}),
  ])}),
  calibration:Object.freeze({status:'FORWARD_SHADOW',sampleSize:0}),
  uncertainty:Object.freeze({aleatoric:0.20,epistemic:0.20,overall:0.20}),
  resolution:Object.freeze({type:'OFFICIAL_FINAL',authority:'league',ruleVersion:'v1'}),
  evidenceRefs:Object.freeze([Object.freeze({evidenceId:'pred-e1',sourceType:'OFFICIAL',observedAt:'2026-09-27T18:59:00.000Z'})]),
  provenance:Object.freeze({inputSnapshotHash:'input-hash',evidenceSnapshotHash:'evidence-hash',generatedBy:'sport-pred-test'}),
  allowedUses:Object.freeze(['MONEY_RESEARCH_INPUT']),
  authority:Object.freeze({decision:'INTELLIGENCE_ONLY',coachingExecution:'NONE',bettingExecution:'NONE',financialExecution:'NONE'}),
})

const quote:SportsMarketQuote=Object.freeze({
  quoteId:'quote-1',provider:'sportsbook-fixture',eventId:'game-1',marketId:'moneyline',selectionId:'home',
  oddsFormat:'DECIMAL',odds:'2.00',observedAt:'2026-09-27T18:59:45.000Z',availableAt:'2026-09-27T18:59:50.000Z',
  evidenceIds:Object.freeze(['quote-e1']),authority:'EVIDENCE_ONLY',canExecute:false,
})

const prediction=createSportsForwardShadowPrediction({
  envelope,eventId:'game-1',marketFamily:'MONEYLINE',selectionOutcomeId:'home',quote,sourceClass:'SYNTHETIC_TEST',evidenceIds:['shadow-e1'],
})

class AttemptStore implements SportsBetCanaryAttemptStore{
  rows=new Map<string,SportsBetCanaryAttempt>()
  get(id:string){return this.rows.get(id)}
  start(attempt:SportsBetCanaryAttempt){if(this.rows.has(attempt.executionId))throw new Error('duplicate');this.rows.set(attempt.executionId,attempt)}
  complete(id:string,update:Pick<SportsBetCanaryAttempt,'state'|'providerReference'|'completedAt'>){
    const prior=this.rows.get(id);if(!prior)throw new Error('missing')
    this.rows.set(id,Object.freeze({...prior,...update}))
  }
}

const policy:SportsBetLiveCanaryPolicy=Object.freeze({
  policyId:'sports-canary-v1',provider:'sportsbook-fixture',accountId:'acct-1',currency:'USD',maxStakeMinor:100n,maxDailyStakeMinor:500n,maxDailyWagers:5,
  maxDailyRealizedLossMinor:500n,maxOpenUnknownExecutions:0,maxQuoteAgeSeconds:30,requireExplicitHumanTrigger:true,autonomousBettingEnabled:false,authority:'RISK_POLICY_ONLY',
})
const runtime:SportsBetLiveCanaryRuntimeState=Object.freeze({tradingDate:'2026-09-27',dailyStakeMinor:0n,dailyWagers:0,dailyRealizedLossMinor:0n,openUnknownExecutions:0,halted:false})
const liveQuote:SportsMarketQuote=Object.freeze({...quote,quoteId:'quote-live-1',observedAt:'2026-09-27T19:00:02.000Z',availableAt:'2026-09-27T19:00:03.000Z'})
const request:SportsBetLiveWagerRequest=Object.freeze({
  requestId:'live-request-1',provider:'sportsbook-fixture',accountId:'acct-1',eventId:'game-1',marketId:'moneyline',selectionId:'home',quote:liveQuote,stakeMinor:50n,currency:'USD',requestedAt:'2026-09-27T19:00:05.000Z',
})
const approval=createSportsBetCanaryApproval({
  approvalId:'approval-1',userId:'user-1',request,maximumStakeMinor:100n,approvedAt:'2026-09-27T19:00:05.000Z',expiresAt:'2026-09-27T19:01:05.000Z',evidenceIds:['approval-e1'],
})
const trigger:SportsBetManualCanaryTrigger=Object.freeze({triggerId:'trigger-1',kind:'EXPLICIT_HUMAN_EXECUTE',source:'INTERACTIVE_USER_ACTION',userId:'user-1',approvalId:'approval-1',confirmedAt:'2026-09-27T19:00:08.000Z'})

const adapter:SportsbookLiveCanaryAdapter={
  provider:'sportsbook-fixture',environment:'LIVE',
  async submitCanaryWager(){
    return Object.freeze({providerReference:'provider-ref-1',providerEventId:'provider-event-1',state:'ACKNOWLEDGED' as const,occurredAt:'2026-09-27T19:00:09.000Z',observedAt:'2026-09-27T19:00:09.000Z',receivedAt:'2026-09-27T19:00:09.100Z',availableAt:'2026-09-27T19:00:09.100Z',evidenceIds:Object.freeze(['provider-e1'])})
  },
}

test('SPORT-BET shadow runtime never gains execution authority',()=>{
  const decision=createSportsBetShadowDecision({prediction,decisionAt:'2026-09-27T19:00:10.000Z',minimumEdgeBps:500,maxQuoteAgeSeconds:30,sourceClass:'SYNTHETIC_TEST',evidenceIds:['decision-e1']})
  assert.equal(decision.action,'SHADOW_WAGER')
  assert.equal(decision.canExecute,false)
  assert.equal(decision.bettingAuthority,'NONE')
  assert.equal(decision.financialAuthority,'NONE')
})

test('SPORT-BET shadow blocks future and stale quotes',()=>{
  assert.throws(()=>createSportsBetShadowDecision({prediction,decisionAt:'2026-09-27T18:59:49.000Z',minimumEdgeBps:500,maxQuoteAgeSeconds:30,sourceClass:'SYNTHETIC_TEST',evidenceIds:['decision-e2']}),/SPORT_BET_SHADOW_DECISION_BEFORE_PREDICTION|SPORT_BET_SHADOW_FUTURE_QUOTE/)
  const stale=createSportsBetShadowDecision({prediction,decisionAt:'2026-09-27T19:01:00.000Z',minimumEdgeBps:500,maxQuoteAgeSeconds:30,sourceClass:'SYNTHETIC_TEST',evidenceIds:['decision-e3']})
  assert.equal(stale.action,'NO_BET')
  assert.deepEqual(stale.reasonCodes,['STALE_QUOTE'])
})

test('synthetic shadow evidence can prove software only, never operational certification',()=>{
  const decision=createSportsBetShadowDecision({prediction,decisionAt:'2026-09-27T19:00:10.000Z',minimumEdgeBps:500,maxQuoteAgeSeconds:30,sourceClass:'SYNTHETIC_TEST',evidenceIds:['decision-e4']})
  const record=resolveSportsForwardShadowPrediction({prediction,status:'WON',actualOutcomeId:'home',resolvedAt:'2026-09-28T01:00:00.000Z',evidenceIds:['resolution-e1']})
  const evidence=buildSportsBetShadowSoakEvidence({sourceClass:'SYNTHETIC_TEST',decisions:[decision],records:[record],startedAt:'2026-09-27T19:00:00.000Z',endedAt:'2026-09-27T19:02:00.000Z',evidenceIds:['soak-e1']})
  const cert=certifySportsBetShadowSoak({evidence,criteria:{minimumDecisions:1,minimumResolvedWagers:1,minimumForwardMinutes:1,minimumResolutionRateBps:10000,maximumStaleQuoteCount:0,maximumDuplicateDecisionCount:0,maximumFutureLeakCount:0,maximumSettlementMismatchCount:0,maximumAuthorityEscalationCount:0}})
  assert.equal(cert.status,'SOFTWARE_ONLY')
  assert.equal(cert.operationallyCertified,false)
  assert.equal(cert.economicEdgeCertified,false)
  assert.equal(cert.liveBettingEligible,false)
})

test('live canary requires exact manual authority and executes only one tiny bound request',async()=>{
  assertSportsBetLiveCanaryPolicy(policy)
  const store=new AttemptStore()
  const result=await executeSportsBetLiveCanary({
    adapter,store,policy,runtime,request,approval,trigger,now:'2026-09-27T19:00:10.000Z',sourceClass:'SYNTHETIC_TEST',jurisdictionStatus:'ALLOWED',ageEligibilityVerified:true,credentialVerified:true,evidenceIds:['runtime-e1'],
  })
  assert.equal(result.providerState,'ACKNOWLEDGED')
  assert.equal(result.authority,'TINY_MANUAL_CANARY_ONLY')
  assert.equal(result.autonomousBettingEnabled,false)
  assert.equal(result.canIncreaseLimits,false)
  await assert.rejects(()=>executeSportsBetLiveCanary({
    adapter,store,policy,runtime,request,approval,trigger,now:'2026-09-27T19:00:10.000Z',sourceClass:'SYNTHETIC_TEST',jurisdictionStatus:'ALLOWED',ageEligibilityVerified:true,credentialVerified:true,evidenceIds:['runtime-e1'],
  }),/SPORT_BET_CANARY_DUPLICATE_SUBMISSION_BLOCKED/)
})

test('live canary rejects autonomous trigger, blocked jurisdiction, missing credentials, stale quote, and oversized stake',async()=>{
  const badTrigger={...trigger,kind:'AUTONOMOUS_EXECUTE'} as unknown as SportsBetManualCanaryTrigger
  await assert.rejects(()=>executeSportsBetLiveCanary({adapter,store:new AttemptStore(),policy,runtime,request,approval,trigger:badTrigger,now:'2026-09-27T19:00:10.000Z',sourceClass:'SYNTHETIC_TEST',jurisdictionStatus:'ALLOWED',ageEligibilityVerified:true,credentialVerified:true,evidenceIds:['e']}),/AUTONOMOUS_TRIGGER_FORBIDDEN/)
  await assert.rejects(()=>executeSportsBetLiveCanary({adapter,store:new AttemptStore(),policy,runtime,request,approval,trigger,now:'2026-09-27T19:00:10.000Z',sourceClass:'SYNTHETIC_TEST',jurisdictionStatus:'BLOCKED',ageEligibilityVerified:true,credentialVerified:true,evidenceIds:['e']}),/JURISDICTION_NOT_ALLOWED/)
  await assert.rejects(()=>executeSportsBetLiveCanary({adapter,store:new AttemptStore(),policy,runtime,request,approval,trigger,now:'2026-09-27T19:00:10.000Z',sourceClass:'SYNTHETIC_TEST',jurisdictionStatus:'ALLOWED',ageEligibilityVerified:true,credentialVerified:false,evidenceIds:['e']}),/CREDENTIAL_VERIFICATION_REQUIRED/)
  await assert.rejects(()=>executeSportsBetLiveCanary({adapter,store:new AttemptStore(),policy,runtime,request,approval,trigger,now:'2026-09-27T19:02:00.000Z',sourceClass:'SYNTHETIC_TEST',jurisdictionStatus:'ALLOWED',ageEligibilityVerified:true,credentialVerified:true,evidenceIds:['e']}),/APPROVAL_EXPIRED|STALE_QUOTE/)
  const bigRequest=Object.freeze({...request,requestId:'big-request',stakeMinor:101n})
  const bigApproval=createSportsBetCanaryApproval({approvalId:'approval-big',userId:'user-1',request:bigRequest,maximumStakeMinor:101n,approvedAt:'2026-09-27T19:00:05.000Z',expiresAt:'2026-09-27T19:01:05.000Z',evidenceIds:['approval-big-e']})
  const bigTrigger:SportsBetManualCanaryTrigger=Object.freeze({...trigger,triggerId:'trigger-big',approvalId:'approval-big'})
  await assert.rejects(()=>executeSportsBetLiveCanary({adapter,store:new AttemptStore(),policy,runtime,request:bigRequest,approval:bigApproval,trigger:bigTrigger,now:'2026-09-27T19:00:10.000Z',sourceClass:'SYNTHETIC_TEST',jurisdictionStatus:'ALLOWED',ageEligibilityVerified:true,credentialVerified:true,evidenceIds:['e']}),/SPORT_BET_CANARY_STAKE_LIMIT/)
})

test('synthetic live-canary evidence cannot certify a real live canary',()=>{
  const cert=certifySportsBetLiveCanary({maxCanaryStakeMinor:100n,evidence:{
    evidenceClass:'SYNTHETIC_TEST',environment:'LIVE',provider:'sportsbook-fixture',accountId:'acct-1',executionId:'exec-1',requestId:'req-1',approvalId:'approval-1',triggerId:'trigger-1',stakeMinor:50n,currency:'USD',
    providerReference:'ref-1',providerStates:['ACKNOWLEDGED','SETTLED'],receiptIds:['receipt-1'],settlementEvidenceIds:['settle-1'],reconciliationId:'recon-1',reconciliationStatus:'MATCH',
    credentialVerificationEvidenceIds:['cred-1'],jurisdictionEvidenceIds:['jurisdiction-1'],ageEligibilityEvidenceIds:['age-1'],killSwitchDrillVerified:true,killSwitchEvidenceIds:['kill-1'],
    duplicateSubmissionBlocked:true,unknownExecutionBlocksNewCanary:true,settlementReconciled:true,recordedAt:'2026-09-27T19:05:00.000Z',evidenceIds:['live-fixture-e1'],
  }})
  assert.equal(cert.status,'SOFTWARE_ONLY')
  assert.equal(cert.liveCanaryCertified,false)
  assert.equal(cert.autonomousBettingEnabled,false)
  assert.equal(cert.canIncreaseLimits,false)
})

test('SPORT-BET.FINAL source certification is complete while external real evidence remains required',()=>{
  const names:readonly SportsBetFinalSoftwareCaseName[]=[
    'prediction-authority-isolated','shadow-never-executes','quote-freshness-enforced','future-quote-blocked','manual-live-trigger-required','canary-stake-capped',
    'jurisdiction-and-age-gated','credential-verification-required','idempotency-replay-blocked','unknown-execution-blocks-new-canary','settlement-reconciliation-required',
    'kill-switch-required','synthetic-evidence-cannot-certify-live',
  ]
  const software=certifySportsBetFinalSoftware(names.map(name=>Object.freeze({caseId:'case:'+name,name,passed:true,evidenceIds:Object.freeze(['test:'+name])})))
  assert.equal(software.passed,true)

  const decision=createSportsBetShadowDecision({prediction,decisionAt:'2026-09-27T19:00:10.000Z',minimumEdgeBps:500,maxQuoteAgeSeconds:30,sourceClass:'SYNTHETIC_TEST',evidenceIds:['decision-final']})
  const record=resolveSportsForwardShadowPrediction({prediction,status:'WON',actualOutcomeId:'home',resolvedAt:'2026-09-28T01:00:00.000Z',evidenceIds:['resolution-final']})
  const shadow=certifySportsBetShadowSoak({
    evidence:buildSportsBetShadowSoakEvidence({sourceClass:'SYNTHETIC_TEST',decisions:[decision],records:[record],startedAt:'2026-09-27T19:00:00.000Z',endedAt:'2026-09-27T19:02:00.000Z',evidenceIds:['soak-final']}),
    criteria:{minimumDecisions:1,minimumResolvedWagers:1,minimumForwardMinutes:1,minimumResolutionRateBps:10000,maximumStaleQuoteCount:0,maximumDuplicateDecisionCount:0,maximumFutureLeakCount:0,maximumSettlementMismatchCount:0,maximumAuthorityEscalationCount:0},
  })
  const liveCanary=certifySportsBetLiveCanary({maxCanaryStakeMinor:100n,evidence:{
    evidenceClass:'SYNTHETIC_TEST',environment:'LIVE',provider:'sportsbook-fixture',accountId:'acct-1',executionId:'exec-final',requestId:'req-final',approvalId:'approval-final',triggerId:'trigger-final',stakeMinor:50n,currency:'USD',
    providerReference:'ref-final',providerStates:['ACKNOWLEDGED','SETTLED'],receiptIds:['receipt-final'],settlementEvidenceIds:['settle-final'],reconciliationId:'recon-final',reconciliationStatus:'MATCH',
    credentialVerificationEvidenceIds:['cred-final'],jurisdictionEvidenceIds:['jurisdiction-final'],ageEligibilityEvidenceIds:['age-final'],killSwitchDrillVerified:true,killSwitchEvidenceIds:['kill-final'],
    duplicateSubmissionBlocked:true,unknownExecutionBlocksNewCanary:true,settlementReconciled:true,recordedAt:'2026-09-27T19:05:00.000Z',evidenceIds:['live-final'],
  }})
  const final=certifySportsBetFinal({software,shadow,liveCanary})
  assert.equal(final.softwarePassed,true)
  assert.equal(final.shadowOperationallyCertified,false)
  assert.equal(final.liveCanaryCertified,false)
  assert.equal(final.status,'SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED')
  assert.deepEqual(final.blockers,['REAL_AS_OF_SHADOW_SOAK_REQUIRED','REAL_LIVE_CANARY_REQUIRED'])
  assert.equal(final.productionAutonomousBettingEnabled,false)
  assert.equal(final.canIncreaseCanaryLimits,false)
  assert.equal(final.canExecute,false)
})
