import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {decideSportsAutomaticPaperWager,settleSportsAutomaticPaperWager,type SportsAutoPaperPolicy} from './sports-auto-paper-league.js'
import {certifySportAuto1To7,type SportAuto1To7CaseName} from './sports-auto-1-7-certification.js'
import {SportsContinuousShadowLeague,type SportsContinuousShadowPolicy} from './sports-continuous-shadow-league.js'
import {directorPerceptionToContextFeature,ingestDirectorSportsWatchObservation,type DirectorSportsWatchIngressEnvelope} from './sports-director-watch-ingress.js'
import {InMemorySportsHistoricalWarehouseStore,buildSportsHistoricalSnapshot,type SportsHistoricalRecord} from './sports-historical-warehouse.js'
import {calibrateSportsLearningMemory,createSportsLearningEpisode,InMemorySportsLearningMemoryStore} from './sports-learning-memory.js'
import {SportsLiveRealityBus} from './sports-live-reality-bus.js'
import {buildSportsRealitySnapshot,type SportsRealityObservation} from './sports-prediction-reality.js'
import {buildSportsPredictionFeatureSnapshot} from './sports-prediction-features.js'
import {createSportsForwardShadowPrediction,type SportsForwardShadowPrediction} from './sports-prediction-forward-shadow.js'
import type {SportsPredictionTransportEnvelope} from './sports-intelligence-ingress.js'
import type {SportsMarketQuote} from './sports-paper-betting.js'
import {buildSportsThesisLearningRecord,projectSportsThesisToReusableAlpha} from './sports-shark-learning-bridge.js'
import {deriveHistoricalBaseOutcomes,type SportsSimulationModuleSpec} from './sports-simulation-module.js'

function envelope(id:string,eventId:string):SportsPredictionTransportEnvelope{
  return Object.freeze({
    schemaVersion:'SPORT-PRED-01',
    envelopeId:'env-'+id,
    sport:'basketball',
    subject:Object.freeze({subjectId:eventId,kind:'GAME',gameId:eventId}),
    informationCutoff:'2026-09-27T19:00:00.000Z',
    issuedAt:'2026-09-27T19:00:01.000Z',
    model:Object.freeze({modelId:'sports-model',modelVersion:'1.0.0',methodologyVersion:'sport-auto',featureSnapshotHash:'feature-'+id,codeRevision:'test'}),
    distribution:Object.freeze({outcomes:Object.freeze([
      Object.freeze({outcomeId:'home',label:'Home',probability:.60}),
      Object.freeze({outcomeId:'away',label:'Away',probability:.40}),
    ])}),
    calibration:Object.freeze({status:'FORWARD_SHADOW',sampleSize:20,brierScore:.18}),
    uncertainty:Object.freeze({aleatoric:.20,epistemic:.15,overall:.175}),
    resolution:Object.freeze({type:'OFFICIAL_FINAL',authority:'league',ruleVersion:'v1'}),
    evidenceRefs:Object.freeze([Object.freeze({evidenceId:'pred:'+id,sourceType:'OFFICIAL',observedAt:'2026-09-27T18:59:00.000Z'})]),
    provenance:Object.freeze({inputSnapshotHash:'input-'+id,evidenceSnapshotHash:'evidence-'+id,generatedBy:'sport-auto-test'}),
    allowedUses:Object.freeze(['MONEY_RESEARCH_INPUT']),
    authority:Object.freeze({decision:'INTELLIGENCE_ONLY',coachingExecution:'NONE',bettingExecution:'NONE',financialExecution:'NONE'}),
  })
}

function quote(id:string,eventId:string):SportsMarketQuote{
  return Object.freeze({
    quoteId:'quote-'+id,
    provider:'paper-book',
    eventId,
    marketId:'moneyline',
    selectionId:'home',
    oddsFormat:'DECIMAL',
    odds:'2.00',
    observedAt:'2026-09-27T18:59:45.000Z',
    availableAt:'2026-09-27T18:59:50.000Z',
    evidenceIds:Object.freeze(['quote:'+id]),
    authority:'EVIDENCE_ONLY',
    canExecute:false,
  })
}

function prediction(id:string,eventId='game-1',sourceClass:'REAL_AS_OF'|'SYNTHETIC_TEST'='SYNTHETIC_TEST'):SportsForwardShadowPrediction{
  return createSportsForwardShadowPrediction({
    envelope:envelope(id,eventId),
    eventId,
    marketFamily:'MONEYLINE',
    selectionOutcomeId:'home',
    quote:quote(id,eventId),
    sourceClass,
    evidenceIds:['prediction:'+id],
  })
}

function history(id:string,subjectId:string,value:number,availableAt:string):SportsHistoricalRecord{
  return Object.freeze({
    recordId:id,
    sport:'basketball',
    competitionId:'nba',
    seasonId:'2025-26',
    subjectId,
    kind:'TEAM_GAME',
    metric:'net_rating',
    value,
    unit:'points_per_100',
    observedAt:availableAt,
    availableAt,
    sourceType:'OFFICIAL_BOX_SCORE',
    evidenceIds:Object.freeze(['history:'+id]),
    authority:'HISTORICAL_EVIDENCE_ONLY',
    canExecute:false,
  })
}

test('SPORT-AUTO.1 builds a point-in-time all-history snapshot and feeds a sport module',async()=>{
  const store=new InMemorySportsHistoricalWarehouseStore()
  store.append(history('h1','team-home',8,'2026-09-20T00:00:00.000Z'))
  store.append(history('h2','team-home',6,'2026-09-21T00:00:00.000Z'))
  store.append(history('a1','team-away',1,'2026-09-20T00:00:00.000Z'))
  store.append(history('a2','team-away',2,'2026-09-21T00:00:00.000Z'))
  store.append(history('future','team-home',100,'2026-10-01T00:00:00.000Z'))
  const snapshot=await buildSportsHistoricalSnapshot({store,query:{sport:'basketball',competitionId:'nba',informationCutoff:'2026-09-28T00:00:00.000Z'}})
  assert.equal(snapshot.records.length,4)
  assert.deepEqual(snapshot.excludedFutureRecordIds,['future'])
  const module:SportsSimulationModuleSpec=Object.freeze({
    moduleId:'basketball-relative-strength-v1',
    sport:'basketball',
    moduleVersion:'1',
    homeSubjectId:'team-home',
    awaySubjectId:'team-away',
    metricWeights:Object.freeze([Object.freeze({metric:'net_rating',weight:1,higherIsBetter:true})]),
    methodology:'WEIGHTED_RELATIVE_STRENGTH',
    authority:'SIMULATION_SPEC_ONLY',
    canExecute:false,
  })
  const base=deriveHistoricalBaseOutcomes({snapshot,module,recentSampleSize:2})
  assert.ok(base.outcomes[0]!.probability>.5)
  assert.equal(base.canExecute,false)
})

test('SPORT-AUTO.2 live reality bus orders provider updates and rejects replay',async()=>{
  const bus=new SportsLiveRealityBus()
  const first=await bus.publish({
    provider:'official-feed',sourceClass:'OFFICIAL',sequence:1,eventId:'game-live',eventStatus:'LIVE',subjectId:'game-live',kind:'SCORE',value:'80-79',
    observedAt:'2026-09-29T02:00:00.000Z',availableAt:'2026-09-29T02:00:00.100Z',receivedAt:'2026-09-29T02:00:00.200Z',evidenceIds:['official:1'],
  })
  assert.equal(first.canonicalRealityEligible,true)
  assert.equal(first.observation.evidenceClass,'OFFICIAL_LIVE')
  await assert.rejects(()=>bus.publish({
    provider:'official-feed',sourceClass:'OFFICIAL',sequence:1,eventId:'game-live',eventStatus:'LIVE',subjectId:'game-live',kind:'CLOCK',value:'05:31',
    observedAt:'2026-09-29T02:00:01.000Z',availableAt:'2026-09-29T02:00:01.100Z',receivedAt:'2026-09-29T02:00:01.200Z',evidenceIds:['official:2'],
  }),/SPORT_AUTO_LIVE_SEQUENCE_REPLAY_OR_REGRESSION/)
})

test('SPORT-AUTO.3 Director can watch live sports but inferred vision is context-only',()=>{
  const envelopeInput:DirectorSportsWatchIngressEnvelope=Object.freeze({
    schemaVersion:'director-sports-watch.v1',
    observationId:'director:g1:f1:tempo',
    eventId:'game-live',
    subjectId:'team-home',
    frameId:'frame-1',
    kind:'TEMPO',
    value:.78,
    confidence:.90,
    observedAt:'2026-09-29T02:00:00.000Z',
    availableAt:'2026-09-29T02:00:00.250Z',
    sourceLocator:'licensed-feed://game-live',
    evidenceIds:Object.freeze(['frame:1']),
    rightsVerified:true,
    sourceAuthorized:true,
    requiresOfficialReconciliation:false,
    authority:'DIRECTOR_INFERENCE_ONLY',
    canEstablishOfficialScore:false,
    canAuthorizeBet:false,
    canExecute:false,
  })
  const update=ingestDirectorSportsWatchObservation(envelopeInput)
  const official:SportsRealityObservation=Object.freeze({
    observationId:'official:g1:score',eventId:'game-live',subjectId:'game-live',kind:'SCORE',value:'80-79',
    observedAt:'2026-09-29T02:00:00.000Z',availableAt:'2026-09-29T02:00:00.100Z',sourceType:'OFFICIAL',
    evidenceIds:Object.freeze(['official:score']),evidenceClass:'OFFICIAL_LIVE',confidence:1,authority:'EVIDENCE_ONLY',canExecute:false,
  })
  const reality=buildSportsRealitySnapshot({
    eventId:'game-live',sport:'basketball',competitionId:'nba',status:'LIVE',scheduledStartAt:'2026-09-29T01:00:00.000Z',
    participants:Object.freeze([
      Object.freeze({participantId:'team-home',label:'Home',role:'HOME'}),
      Object.freeze({participantId:'team-away',label:'Away',role:'AWAY'}),
    ]),
    observations:Object.freeze([official,update.observation]),
    informationCutoff:'2026-09-29T02:00:00.250Z',
  })
  const feature=directorPerceptionToContextFeature({update,normalizedValue:.56,methodologyVersion:'director-context-v1'})
  const snapshot=buildSportsPredictionFeatureSnapshot({reality,features:[feature],methodologyVersion:'director-context-v1',informationCutoff:reality.informationCutoff})
  assert.deepEqual(snapshot.contextOnlyFeatureIds,[feature.featureId])
  assert.throws(()=>buildSportsPredictionFeatureSnapshot({
    reality,
    features:[Object.freeze({...feature,inputRole:'PRIMARY' as const})],
    methodologyVersion:'director-context-v1',
    informationCutoff:reality.informationCutoff,
  }),/SPORT_PRED_DIRECTOR_INFERRED_PRIMARY_INPUT_FORBIDDEN/)
})

test('SPORT-AUTO.4-.6 automate paper settlement, progressive learning memory, and SHARK-style reusable evidence',async()=>{
  const p=prediction('paper-1')
  const policy:SportsAutoPaperPolicy=Object.freeze({
    policyId:'paper-v1',bankrollMinor:100000n,currency:'USD',stakeBps:100,maxStakeMinor:2000n,minimumEdgeBps:500,maximumQuoteAgeSeconds:30,
    authority:'PAPER_POLICY_ONLY',canAuthorizeLive:false,
  })
  const decision=decideSportsAutomaticPaperWager({prediction:p,policy,decisionAt:'2026-09-27T19:00:10.000Z',evidenceIds:['paper:decision']})
  assert.equal(decision.action,'PAPER_WAGER')
  assert.equal(decision.canExecute,false)
  const closing=Object.freeze({...quote('paper-close','game-1'),odds:'1.80',observedAt:'2026-09-27T23:00:00.000Z',availableAt:'2026-09-27T23:00:01.000Z'})
  const settled=settleSportsAutomaticPaperWager({decision,status:'WON',resolvedAt:'2026-09-28T01:00:00.000Z',closingQuote:closing,evidenceIds:['official:result']})
  assert.equal(settled.review.processClass,'GOOD_PROCESS_GOOD_RESULT')
  const wager=decision.paperWager
  assert.ok(wager)
  const episode=createSportsLearningEpisode({prediction:p,decision,wager,settlement:settled.settlement,review:settled.review})
  const store=new InMemorySportsLearningMemoryStore()
  await store.put(episode)
  const second=Object.freeze({
    ...episode,
    episodeId:episode.episodeId+':2',
    predictionId:episode.predictionId+':2',
    settlementId:episode.settlementId+':2',
    learningRecord:Object.freeze({
      ...episode.learningRecord,
      learningRecordId:episode.learningRecord.learningRecordId+':2',
      paperRunId:episode.learningRecord.paperRunId+':2',
      strategyResultId:episode.learningRecord.strategyResultId+':2',
    }),
  })
  await store.put(second)
  const calibration=calibrateSportsLearningMemory({episodes:await store.list(),strategyId:episode.strategyId,calibratedAt:'2026-09-28T02:00:00.000Z',minimumSamples:2})
  assert.equal(calibration.status,'SIMULATION_SUPPORTED')
  assert.equal(calibration.canAuthorizeLive,false)
  const thesis=buildSportsThesisLearningRecord({prediction:p,episode,calibration})
  const reusable=projectSportsThesisToReusableAlpha({thesis,availableAt:'2026-09-28T02:00:01.000Z',expiresAt:'2026-09-29T02:00:01.000Z'})
  assert.equal(reusable.alpha.sourceDomain,'SPORTS_BETTING')
  assert.equal(reusable.targetTruthClaim,false)
  assert.equal(reusable.canAuthorizeLive,false)
  assert.equal(reusable.canExecute,false)
})

test('SPORT-AUTO.7 continuously evaluates pregame and live shadow candidates idempotently and learns on resolution',()=>{
  const policy:SportsContinuousShadowPolicy=Object.freeze({
    policyId:'shadow-v1',sourceClass:'SYNTHETIC_TEST',pregameMinimumEdgeBps:500,liveMinimumEdgeBps:400,
    pregameMaximumQuoteAgeSeconds:30,liveMaximumQuoteAgeSeconds:30,authority:'SHADOW_POLICY_ONLY',canAuthorizeLive:false,
  })
  const league=new SportsContinuousShadowLeague(policy)
  const pregame=prediction('shadow-pre','game-shadow')
  const live=prediction('shadow-live','game-shadow')
  const first=league.runTick({tickAt:'2026-09-27T19:00:10.000Z',candidates:[
    Object.freeze({prediction:pregame,phase:'PREGAME',evidenceIds:Object.freeze(['tick:pre'])}),
    Object.freeze({prediction:live,phase:'LIVE',evidenceIds:Object.freeze(['tick:live'])}),
  ]})
  assert.equal(first.newDecisionCount,2)
  assert.equal(first.pregameDecisionCount,1)
  assert.equal(first.liveDecisionCount,1)
  const replay=league.runTick({tickAt:'2026-09-27T19:00:15.000Z',candidates:[
    Object.freeze({prediction:pregame,phase:'PREGAME',evidenceIds:Object.freeze(['tick:pre:replay'])}),
    Object.freeze({prediction:live,phase:'LIVE',evidenceIds:Object.freeze(['tick:live:replay'])}),
  ]})
  assert.equal(replay.newDecisionCount,0)
  assert.equal(replay.duplicatePredictionCount,2)
  const one=league.resolve({predictionId:pregame.predictionId,status:'WON',actualOutcomeId:'home',resolvedAt:'2026-09-28T01:00:00.000Z',evidenceIds:['result:pre']})
  const two=league.resolve({predictionId:live.predictionId,status:'LOST',actualOutcomeId:'away',resolvedAt:'2026-09-28T01:00:00.000Z',evidenceIds:['result:live']})
  assert.equal(one.canExecute,false)
  assert.equal(two.review.canAuthorizeLive,false)
  const soak=league.buildSoakEvidence({startedAt:'2026-09-27T19:00:00.000Z',endedAt:'2026-09-28T01:01:00.000Z',evidenceIds:['shadow:soak']})
  assert.equal(soak.decisionCount,2)
  assert.equal(soak.resolvedWagerCount,2)
  assert.equal(soak.sourceClass,'SYNTHETIC_TEST')
})

test('SPORT-AUTO.1-.7 durable schema and source certification are complete without claiming real forward evidence',()=>{
  const migration=readFileSync(new URL('../migrations/023_sports_auto_1_7.sql',import.meta.url),'utf8')
  for(const table of ['sports_historical_records','sports_learning_episodes','sports_shadow_decisions','sports_shadow_records']){
    assert.match(migration,new RegExp('CREATE TABLE IF NOT EXISTS '+table))
  }
  assert.match(migration,/FORCE ROW LEVEL SECURITY/)
  assert.match(migration,/REVOKE ALL ON sports_shadow_decisions FROM PUBLIC, anon, authenticated/)

  const names:readonly SportAuto1To7CaseName[]=[
    'historical-warehouse-point-in-time',
    'historical-stats-feed-simulation-module',
    'live-reality-bus-ordered',
    'director-live-watch-inference-firewall',
    'automatic-paper-league',
    'paper-settlement-progressive-learning',
    'durable-sports-memory',
    'shark-style-thesis-reuse-no-authority',
    'continuous-pregame-live-shadow',
    'shadow-idempotency-and-settlement-review',
  ]
  const certification=certifySportAuto1To7({cases:names.map(name=>Object.freeze({caseId:'case:'+name,name,passed:true,evidenceIds:Object.freeze(['test:'+name])}))})
  assert.equal(certification.softwarePassed,true)
  assert.equal(certification.status,'SOFTWARE_COMPLETE_REAL_FORWARD_INPUTS_REQUIRED')
  assert.deepEqual(certification.completedStages,['SPORT-AUTO.1','SPORT-AUTO.2','SPORT-AUTO.3','SPORT-AUTO.4','SPORT-AUTO.5','SPORT-AUTO.6','SPORT-AUTO.7'])
  assert.equal(certification.productionAutonomousBettingEnabled,false)
  assert.equal(certification.liveBettingAuthorityGranted,false)
  assert.equal(certification.canExecute,false)
  assert.deepEqual(certification.blockers,[
    'COMMISSIONED_LIVE_SPORTS_FEED_REQUIRED',
    'REAL_AS_OF_CONTINUOUS_SHADOW_SOAK_REQUIRED',
    'REAL_HISTORICAL_BACKFILL_REQUIRED',
  ])
})
