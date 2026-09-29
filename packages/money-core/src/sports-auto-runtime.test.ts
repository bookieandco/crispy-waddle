import assert from 'node:assert/strict'
import test from 'node:test'
import type {SportsPredictionTransportEnvelope} from './sports-intelligence-ingress.js'
import {createSportsForwardShadowPrediction,type SportsForwardShadowPrediction} from './sports-prediction-forward-shadow.js'
import type {SportsMarketQuote} from './sports-paper-betting.js'
import {
  InMemorySportsAutoRuntimeStore,
  SportsAutoLearningRuntime,
  type SportsAutoDiscoveredOpportunity,
  type SportsAutoPredictionEngine,
  type SportsAutoResultSource,
  type SportsAutoRuntimeCandidate,
  type SportsModelFeedbackReceipt,
  type SportsModelFeedbackSink,
} from './sports-auto-runtime.js'
import {InMemorySportsLearningMemoryStore} from './sports-learning-memory.js'
import type {SportsAutoPaperPolicy} from './sports-auto-paper-league.js'
import type {SportsContinuousShadowPolicy} from './sports-continuous-shadow-league.js'

function envelope(id:string,eventId:string):SportsPredictionTransportEnvelope{
  return Object.freeze({
    schemaVersion:'SPORT-PRED-01',
    envelopeId:'runtime-env-'+id,
    sport:'basketball',
    subject:Object.freeze({subjectId:eventId,kind:'GAME',gameId:eventId}),
    informationCutoff:'2026-09-27T19:00:00.000Z',
    issuedAt:'2026-09-27T19:00:01.000Z',
    model:Object.freeze({modelId:'runtime-model',modelVersion:'1.0.0',methodologyVersion:'runtime-v1',featureSnapshotHash:'feature-'+id,codeRevision:'test'}),
    distribution:Object.freeze({outcomes:Object.freeze([
      Object.freeze({outcomeId:'home',label:'Home',probability:.62}),
      Object.freeze({outcomeId:'away',label:'Away',probability:.38}),
    ])}),
    calibration:Object.freeze({status:'FORWARD_SHADOW',sampleSize:25,brierScore:.17}),
    uncertainty:Object.freeze({aleatoric:.2,epistemic:.1,overall:.15}),
    resolution:Object.freeze({type:'OFFICIAL_FINAL',authority:'league',ruleVersion:'v1'}),
    evidenceRefs:Object.freeze([Object.freeze({evidenceId:'runtime-pred:'+id,sourceType:'OFFICIAL',observedAt:'2026-09-27T18:59:00.000Z'})]),
    provenance:Object.freeze({inputSnapshotHash:'runtime-input-'+id,evidenceSnapshotHash:'runtime-evidence-'+id,generatedBy:'runtime-test'}),
    allowedUses:Object.freeze(['MONEY_RESEARCH_INPUT']),
    authority:Object.freeze({decision:'INTELLIGENCE_ONLY',coachingExecution:'NONE',bettingExecution:'NONE',financialExecution:'NONE'}),
  })
}

function quote(id:string,eventId:string,odds='2.00',availableAt='2026-09-27T18:59:50.000Z'):SportsMarketQuote{
  return Object.freeze({
    quoteId:'runtime-quote-'+id,
    provider:'paper-book',
    eventId,
    marketId:'moneyline',
    selectionId:'home',
    oddsFormat:'DECIMAL',
    odds,
    observedAt:'2026-09-27T18:59:45.000Z',
    availableAt,
    evidenceIds:Object.freeze(['runtime-quote:'+id]),
    authority:'EVIDENCE_ONLY',
    canExecute:false,
  })
}

function prediction(id:string,eventId:string):SportsForwardShadowPrediction{
  return createSportsForwardShadowPrediction({
    envelope:envelope(id,eventId),
    eventId,
    marketFamily:'MONEYLINE',
    selectionOutcomeId:'home',
    quote:quote(id,eventId),
    sourceClass:'SYNTHETIC_TEST',
    evidenceIds:['runtime:prediction:'+id],
  })
}

const opportunities:readonly SportsAutoDiscoveredOpportunity[]=Object.freeze([
  Object.freeze({opportunityId:'opp:1',eventId:'game:1',phase:'PREGAME',discoveredAt:'2026-09-27T19:00:05.000Z',evidenceIds:Object.freeze(['discover:1']),authority:'EVIDENCE_ONLY',canExecute:false}),
  Object.freeze({opportunityId:'opp:2',eventId:'game:2',phase:'LIVE',discoveredAt:'2026-09-27T19:00:06.000Z',evidenceIds:Object.freeze(['discover:2']),authority:'EVIDENCE_ONLY',canExecute:false}),
])

const paperPolicy:SportsAutoPaperPolicy=Object.freeze({
  policyId:'runtime-paper-v1',
  bankrollMinor:100000n,
  currency:'USD',
  stakeBps:100,
  maxStakeMinor:1500n,
  minimumEdgeBps:500,
  maximumQuoteAgeSeconds:30,
  authority:'PAPER_POLICY_ONLY',
  canAuthorizeLive:false,
})

const shadowPolicy:SportsContinuousShadowPolicy=Object.freeze({
  policyId:'runtime-shadow-v1',
  sourceClass:'SYNTHETIC_TEST',
  pregameMinimumEdgeBps:500,
  liveMinimumEdgeBps:400,
  pregameMaximumQuoteAgeSeconds:30,
  liveMaximumQuoteAgeSeconds:30,
  authority:'SHADOW_POLICY_ONLY',
  canAuthorizeLive:false,
})

test('SPORT-AUTO runtime continuously discovers, deduplicates, settles, learns and feeds the next model cycle',async()=>{
  const store=new InMemorySportsAutoRuntimeStore()
  const learningMemory=new InMemorySportsLearningMemoryStore()
  const predictionByOpportunity=new Map([
    ['opp:1',prediction('1','game:1')],
    ['opp:2',prediction('2','game:2')],
  ])
  const predictionEngine:SportsAutoPredictionEngine={
    async predict(opportunity):Promise<SportsAutoRuntimeCandidate>{
      const p=predictionByOpportunity.get(opportunity.opportunityId)
      assert.ok(p)
      return Object.freeze({
        candidateId:'candidate:'+opportunity.opportunityId,
        opportunityId:opportunity.opportunityId,
        prediction:p,
        phase:opportunity.phase,
        discoveredAt:opportunity.discoveredAt,
        evidenceIds:Object.freeze([...opportunity.evidenceIds,...p.evidenceIds]),
        authority:'INTELLIGENCE_ONLY',
        canExecute:false,
      })
    },
  }
  let resultsEnabled=false
  const resultSource:SportsAutoResultSource={
    async resolve(candidates){
      if(!resultsEnabled)return Object.freeze([])
      return Object.freeze(candidates.map((candidate,index)=>Object.freeze({
        predictionId:candidate.prediction.predictionId,
        status:index===0?'WON' as const:'LOST' as const,
        actualOutcomeId:index===0?'home':'away',
        resolvedAt:'2026-09-28T01:00:00.000Z',
        closingQuote:quote('close-'+index,candidate.prediction.eventId,'1.80','2026-09-27T23:00:01.000Z'),
        evidenceIds:Object.freeze(['official-result:'+candidate.prediction.eventId]),
      })))
    },
  }
  const feedbacks:SportsModelFeedbackReceipt[]=[]
  const feedbackSink:SportsModelFeedbackSink={
    async apply(input){
      const receipt:SportsModelFeedbackReceipt=Object.freeze({
        feedbackId:'feedback:'+input.episode.episodeId,
        predictionId:input.candidate.prediction.predictionId,
        strategyId:input.episode.strategyId,
        calibrationId:input.calibration.calibrationId,
        revisionId:'model-revision:'+input.episode.episodeId,
        evidenceIds:Object.freeze([...input.episode.evidenceIds,input.thesis.thesisId,input.reusableSignal.signalId]),
        appliedAt:input.now,
        authority:'MODEL_FEEDBACK_ONLY',
        canAuthorizeLive:false,
        canExecute:false,
      })
      feedbacks.push(receipt)
      return receipt
    },
  }
  const opportunitySource={async discover(){return opportunities}}
  const runtime=new SportsAutoLearningRuntime({
    opportunitySource,
    predictionEngine,
    resultSource,
    store,
    learningMemory,
    feedbackSink,
    paperPolicy,
    shadowPolicy,
    learningMinimumSamples:2,
  })

  const first=await runtime.runDiscoveryCycle('2026-09-27T19:00:10.000Z')
  assert.equal(first.newCandidateCount,2)
  assert.equal(first.paperDecisionCount,2)
  assert.equal(first.shadowDecisionCount,2)
  assert.equal(first.canExecute,false)

  const restarted=new SportsAutoLearningRuntime({
    opportunitySource,
    predictionEngine,
    resultSource,
    store,
    learningMemory,
    feedbackSink,
    paperPolicy,
    shadowPolicy,
    learningMinimumSamples:2,
  })
  const second=await restarted.runDiscoveryCycle('2026-09-27T19:00:15.000Z')
  assert.equal(second.newCandidateCount,0)
  assert.equal(second.duplicateCandidateCount,2)
  assert.equal(second.paperDecisionCount,0)
  assert.equal(second.shadowDecisionCount,0)

  resultsEnabled=true
  const resolved=await restarted.runResolutionCycle('2026-09-28T01:05:00.000Z')
  assert.equal(resolved.resolvedOutcomeCount,2)
  assert.equal(resolved.paperResolutionCount,2)
  assert.equal(resolved.shadowResolutionCount,2)
  assert.equal(resolved.learningEpisodeCount,2)
  assert.equal(resolved.feedbackReceiptIds.length,2)
  assert.equal(feedbacks.length,2)
  assert.equal((await learningMemory.list()).length,2)
  assert.equal((await store.listOpenCandidates()).length,0)
  assert.ok(feedbacks.every(item=>item.canAuthorizeLive===false&&item.canExecute===false))

  const replay=await restarted.runResolutionCycle('2026-09-28T01:06:00.000Z')
  assert.equal(replay.openCandidateCount,0)
  assert.equal(replay.resolvedOutcomeCount,0)
  assert.equal(feedbacks.length,2)
})
