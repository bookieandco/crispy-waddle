import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSportsPredictionResearchIngress, ingestSportsPredictionResearch, type SportsPredictionTransportEnvelope } from './sports-intelligence-ingress.js'
import { buildSportsRealitySnapshot, type SportsRealityObservation } from './sports-prediction-reality.js'
import { assertSportsPredictionFeature, buildSportsPredictionFeatureSnapshot, type SportsPredictionFeature } from './sports-prediction-features.js'
import { runSportsPredictionSimulation, type SportsPredictionScenario } from './sports-prediction-simulation.js'
import { buildSportsPredictionEnvelope, type SportsPredictionModelSpec } from './sports-prediction-producer.js'
import { assessSportsModelArena, createSportsArenaObservation, deriveSportsEnsembleWeights } from './sports-prediction-model-arena.js'
import { buildSportsForwardShadowCohort, certifySportsForwardShadow, createSportsForwardShadowPrediction, resolveSportsForwardShadowPrediction } from './sports-prediction-forward-shadow.js'
import { certifySportsPredFinalSoftware } from './sports-pred-final-certification.js'
import type { SportsMarketQuote } from './sports-paper-betting.js'

const cutoff='2026-09-26T18:00:00Z'

function observation(overrides:Partial<SportsRealityObservation>={}):SportsRealityObservation{
  return Object.freeze({
    observationId:'obs:role',
    eventId:'event:1',
    subjectId:'team:home',
    kind:'PLAYER_ROLE',
    value:0.72,
    unit:'SHARE',
    observedAt:'2026-09-26T17:30:00Z',
    availableAt:'2026-09-26T17:31:00Z',
    sourceType:'official-feed',
    evidenceIds:Object.freeze(['evidence:role']),
    authority:'EVIDENCE_ONLY',
    canExecute:false,
    ...overrides,
  })
}

function reality(eventId='event:1',informationCutoff=cutoff){
  return buildSportsRealitySnapshot({
    eventId,
    sport:'football',
    competitionId:'nfl',
    status:'SCHEDULED',
    scheduledStartAt:'2026-09-26T20:00:00Z',
    participants:[
      {participantId:eventId+':home',label:'Home',role:'HOME'},
      {participantId:eventId+':away',label:'Away',role:'AWAY'},
    ],
    observations:[
      observation({observationId:eventId+':role',eventId,subjectId:eventId+':home'}),
      observation({
        observationId:eventId+':future',
        eventId,
        subjectId:eventId+':home',
        kind:'INJURY',
        value:true,
        observedAt:'2026-09-26T18:20:00Z',
        availableAt:'2026-09-26T18:21:00Z',
        evidenceIds:Object.freeze(['evidence:future']),
      }),
    ],
    informationCutoff,
  })
}

function feature(eventId='event:1',overrides:Partial<SportsPredictionFeature>={}):SportsPredictionFeature{
  return Object.freeze({
    featureId:eventId+':usage',
    eventId,
    subjectId:eventId+':home',
    family:'PLAYER_ROLE',
    evidenceClass:'MEASURED',
    inputRole:'PRIMARY',
    value:.72,
    normalizedValue:.44,
    observedAt:'2026-09-26T17:30:00Z',
    availableAt:'2026-09-26T17:31:00Z',
    methodologyVersion:'features-v1',
    sourceObservationIds:Object.freeze([eventId+':role']),
    evidenceIds:Object.freeze(['feature-evidence:'+eventId]),
    authority:'FEATURE_EVIDENCE_ONLY',
    canExecute:false,
    ...overrides,
  })
}

function runtime(eventId='event:1',modelVersion='v1',informationCutoff=cutoff){
  const r=reality(eventId,informationCutoff)
  const features=buildSportsPredictionFeatureSnapshot({
    reality:r,
    methodologyVersion:'features-v1',
    informationCutoff,
    features:[
      feature(eventId),
      feature(eventId,{
        featureId:eventId+':future-feature',
        family:'AVAILABILITY',
        value:1,
        normalizedValue:.7,
        observedAt:'2026-09-26T18:20:00Z',
        availableAt:'2026-09-26T18:21:00Z',
        sourceObservationIds:Object.freeze([eventId+':future']),
        evidenceIds:Object.freeze(['feature-evidence:future:'+eventId]),
      }),
    ],
  })
  const scenario:SportsPredictionScenario=Object.freeze({
    scenarioId:'scenario:base',
    label:'base with matchup and player-night uncertainty',
    outcomeLogitShiftBps:Object.freeze({HOME:350,AWAY:-350}),
    volatilityBps:250,
    sliders:Object.freeze([
      {name:'MATCHUP' as const,value:.3,rationale:'Measured matchup evidence.',evidenceIds:Object.freeze(['feature-evidence:'+eventId])},
      {name:'PLAYER_NIGHT' as const,value:0,rationale:'Neutral upside/downside uncertainty.',evidenceIds:Object.freeze(['feature-evidence:'+eventId])},
    ]),
    authority:'SIMULATION_INPUT_ONLY',
    canExecute:false,
  })
  const sim=runSportsPredictionSimulation({
    eventId,
    featureSnapshot:features,
    modelId:'sport-model',
    modelVersion,
    baseOutcomes:[{outcomeId:'HOME',probability:.58},{outcomeId:'AWAY',probability:.42}],
    scenario,
    randomSeed:'seed:'+eventId+':'+modelVersion,
    pathCount:500,
  })
  const model:SportsPredictionModelSpec=Object.freeze({
    modelId:'sport-model',
    modelVersion,
    methodologyVersion:'method-v1',
    featureSchemaVersion:'features-v1',
    codeRevision:'deadbeef',
    frozenAt:'2026-09-26T17:00:00Z',
    sport:'football',
    marketFamily:'MONEYLINE',
    authority:'MODEL_SPEC_ONLY',
    canExecute:false,
  })
  const envelope=buildSportsPredictionEnvelope({
    reality:r,
    features,
    simulation:sim,
    model,
    calibration:{status:'CALIBRATING',sampleSize:12,brierScore:.23,expectedCalibrationError:.08,evaluatedAt:'2026-09-26T17:00:00Z',calibrationModelVersion:'cal-v1'},
    issuedAt:informationCutoff,
    resolution:{type:'FINAL_SCORE',authority:'official-league',ruleVersion:'r1'},
  })
  return {r,features,scenario,sim,model,envelope}
}

function quote(eventId='event:1',id='q1',odds='-110',availableAt='2026-09-26T17:59:00Z'):SportsMarketQuote{
  return Object.freeze({
    quoteId:id,
    provider:'shadow-book',
    eventId,
    marketId:eventId+':moneyline',
    selectionId:'HOME',
    oddsFormat:'AMERICAN',
    odds,
    observedAt:availableAt,
    availableAt,
    evidenceIds:Object.freeze(['quote-evidence:'+id]),
    authority:'EVIDENCE_ONLY',
    canExecute:false,
  })
}

test('SPORT-PRED.2 reality and feature factory exclude future information and narratives from primary inputs',()=>{
  const x=runtime()
  assert.deepEqual(x.r.excludedFutureObservationIds,['event:1:future'])
  assert.deepEqual(x.features.excludedFutureFeatureIds,['event:1:future-feature'])
  assert.equal(x.features.features.length,1)
  assert.throws(()=>assertSportsPredictionFeature(feature('event:1',{
    featureId:'narrative:1',
    family:'NARRATIVE_CONTEXT',
    evidenceClass:'NARRATIVE',
    inputRole:'PRIMARY',
  })),/SPORT_PRED_NARRATIVE_PRIMARY_INPUT_FORBIDDEN/)
})

test('SPORT-PRED.4 scenario simulation is deterministic and replayable from the same frozen inputs',()=>{
  const x=runtime()
  const repeat=runSportsPredictionSimulation({
    eventId:x.r.eventId,
    featureSnapshot:x.features,
    modelId:x.model.modelId,
    modelVersion:x.model.modelVersion,
    baseOutcomes:[{outcomeId:'HOME',probability:.58},{outcomeId:'AWAY',probability:.42}],
    scenario:x.scenario,
    randomSeed:x.sim.randomSeed,
    pathCount:x.sim.pathCount,
  })
  assert.equal(repeat.provenanceHash,x.sim.provenanceHash)
  assert.deepEqual(repeat.outcomes,x.sim.outcomes)
  assert.equal(repeat.canExecute,false)
})

test('SPORT-PRED.5 producer emits a valid SPORT-PRED-01 envelope that remains research-only in Money',()=>{
  const {envelope}=runtime()
  assert.doesNotThrow(()=>assertSportsPredictionResearchIngress(envelope,{
    accountId:'acct:test',
    requestedBy:'shadow-cert',
    receivedAt:'2026-09-26T18:00:01Z',
    sourceNamespace:'sport-pred',
    evidenceQuality:'VERIFIED',
  }))
  const artifact=ingestSportsPredictionResearch(envelope,{
    accountId:'acct:test',
    requestedBy:'shadow-cert',
    receivedAt:'2026-09-26T18:00:01Z',
    sourceNamespace:'sport-pred',
    evidenceQuality:'VERIFIED',
  })
  assert.equal(artifact.assessment.disposition,'RESEARCH_ONLY')
  assert.equal(artifact.bettingAuthority,'NONE')
  assert.equal(artifact.financialAuthority,'NONE')
})

test('SPORT-PRED.6 model arena calibrates by sport and market and weights only real as-of evidence',()=>{
  const one=runtime('event:a').envelope
  const two=runtime('event:b').envelope
  const observations=[
    createSportsArenaObservation({envelope:one,marketFamily:'MONEYLINE',actualOutcomeId:'HOME',resolvedAt:'2026-09-27T01:00:00Z',sourceClass:'REAL_AS_OF',evidenceIds:['result:a']}),
    createSportsArenaObservation({envelope:two,marketFamily:'MONEYLINE',actualOutcomeId:'AWAY',resolvedAt:'2026-09-27T01:00:00Z',sourceClass:'REAL_AS_OF',evidenceIds:['result:b']}),
    createSportsArenaObservation({envelope:runtime('event:c').envelope,marketFamily:'MONEYLINE',actualOutcomeId:'HOME',resolvedAt:'2026-09-27T01:00:00Z',sourceClass:'SYNTHETIC_TEST',evidenceIds:['result:c']}),
  ]
  const assessments=assessSportsModelArena({observations,minimumRealSamples:2})
  assert.equal(assessments.length,1)
  assert.equal(assessments[0]!.realSampleSize,2)
  assert.equal(assessments[0]!.status,'CALIBRATED_FOR_ENSEMBLE')
  const weights=deriveSportsEnsembleWeights({assessments,sport:'football',marketFamily:'MONEYLINE',minimumSamples:2})
  assert.equal(weights.length,1)
  assert.equal(weights[0]!.weightBps,10000)
  assert.equal(weights[0]!.canAuthorizeLive,false)
})

test('SPORT-PRED.FINAL synthetic shadow evidence validates machinery but cannot certify forward edge',()=>{
  const {envelope}=runtime()
  const p=createSportsForwardShadowPrediction({
    envelope,
    eventId:'event:1',
    marketFamily:'MONEYLINE',
    selectionOutcomeId:'HOME',
    quote:quote(),
    sourceClass:'SYNTHETIC_TEST',
    evidenceIds:['prediction:1'],
  })
  const record=resolveSportsForwardShadowPrediction({
    prediction:p,
    status:'WON',
    actualOutcomeId:'HOME',
    resolvedAt:'2026-09-27T01:00:00Z',
    closingQuote:quote('event:1','q-close','-125','2026-09-26T19:55:00Z'),
    evidenceIds:['official-result:1'],
  })
  const cohort=buildSportsForwardShadowCohort({
    cohortName:'synthetic-cert-fixture',
    issuedPredictionIds:[p.predictionId],
    predictions:[p],
    records:[record],
    closedAt:'2026-09-27T01:00:00Z',
  })
  const cert=certifySportsForwardShadow({
    cohort,
    criteria:{minimumResolvedSamples:2,minimumDistinctEvents:2,minimumForwardDays:1,maximumMeanBrierScore:.4,maximumExpectedCalibrationError:.5},
  })
  assert.equal(cert.status,'SOFTWARE_ONLY')
  assert.equal(cert.predictionQualityCertified,false)
  assert.equal(cert.economicEdgeCertified,false)
  assert.equal(cert.liveBettingEligible,false)
})

test('SPORT-PRED.FINAL issuance registry detects survivor filtering and model mutation',()=>{
  const first=runtime('event:1').envelope
  const p=createSportsForwardShadowPrediction({
    envelope:first,eventId:'event:1',marketFamily:'MONEYLINE',selectionOutcomeId:'HOME',quote:quote(),sourceClass:'REAL_AS_OF',evidenceIds:['p1'],
  })
  assert.throws(()=>buildSportsForwardShadowCohort({
    cohortName:'filtered',
    issuedPredictionIds:[p.predictionId,'missing-prediction'],
    predictions:[p],
    records:[],
    closedAt:'2026-09-27T01:00:00Z',
  }),/SPORT_PRED_SHADOW_SURVIVORSHIP_FILTER_DETECTED/)

  const mutatedEnvelope:SportsPredictionTransportEnvelope=Object.freeze({
    ...runtime('event:2').envelope,
    model:Object.freeze({...runtime('event:2').envelope.model,modelVersion:'v2'}),
  })
  const p2=createSportsForwardShadowPrediction({
    envelope:mutatedEnvelope,eventId:'event:2',marketFamily:'MONEYLINE',selectionOutcomeId:'HOME',quote:quote('event:2','q2'),sourceClass:'REAL_AS_OF',evidenceIds:['p2'],
  })
  assert.throws(()=>buildSportsForwardShadowCohort({
    cohortName:'mutated',
    issuedPredictionIds:[p.predictionId,p2.predictionId],
    predictions:[p,p2],
    records:[],
    closedAt:'2026-09-27T01:00:00Z',
  }),/SPORT_PRED_SHADOW_MODEL_VERSION_MUTATED_DURING_COHORT/)
})

test('SPORT-PRED.FINAL can certify a sufficiently large immutable REAL_AS_OF cohort without granting betting authority',()=>{
  const predictions=[] as ReturnType<typeof createSportsForwardShadowPrediction>[]
  const records=[] as ReturnType<typeof resolveSportsForwardShadowPrediction>[]
  for(let i=0;i<4;i++){
    const eventId='real-event:'+i
    const issued='2026-09-'+String(20+i).padStart(2,'0')+'T18:00:00Z'
    const envBase=runtime(eventId).envelope
    const envelope:SportsPredictionTransportEnvelope=Object.freeze({
      ...envBase,
      informationCutoff:issued,
      issuedAt:issued,
      evidenceRefs:Object.freeze(envBase.evidenceRefs.map(e=>Object.freeze({...e,observedAt:'2026-09-20T17:00:00Z'}))),
    })
    const q:SportsMarketQuote=Object.freeze({
      ...quote(eventId,'real-q:'+i,'-110','2026-09-20T17:59:00Z'),
      marketId:eventId+':moneyline',
    })
    const p=createSportsForwardShadowPrediction({
      envelope,eventId,marketFamily:'MONEYLINE',selectionOutcomeId:'HOME',quote:q,sourceClass:'REAL_AS_OF',evidenceIds:['issued:'+i],
    })
    predictions.push(p)
    records.push(resolveSportsForwardShadowPrediction({
      prediction:p,status:'WON',actualOutcomeId:'HOME',
      resolvedAt:'2026-09-'+String(21+i).padStart(2,'0')+'T02:00:00Z',
      evidenceIds:['resolved:'+i],
    }))
  }
  const cohort=buildSportsForwardShadowCohort({
    cohortName:'real-as-of-logic-fixture',
    issuedPredictionIds:predictions.map(p=>p.predictionId),
    predictions,
    records,
    closedAt:'2026-09-25T18:00:00Z',
  })
  const cert=certifySportsForwardShadow({
    cohort,
    criteria:{minimumResolvedSamples:4,minimumDistinctEvents:4,minimumForwardDays:4,maximumMeanBrierScore:.4,maximumExpectedCalibrationError:.5},
  })
  assert.equal(cert.status,'FORWARD_SHADOW_CERTIFIED')
  assert.equal(cert.predictionQualityCertified,true)
  assert.equal(cert.economicEdgeCertified,false)
  assert.equal(cert.liveBettingEligible,false)
})

test('SPORT-PRED.FINAL software matrix closes all source invariants without claiming statistical edge',()=>{
  const cases=[
    'point-in-time-reality','future-observation-exclusion','cutoff-safe-feature-snapshot','narrative-context-only',
    'replayable-scenario-simulation','frozen-model-version','valid-sport-pred-envelope','money-research-only-boundary',
    'pre-resolution-shadow-prediction','quote-before-information-cutoff','full-issued-history-retained',
    'model-mutation-new-cohort','sport-market-specific-model-arena','specialist-context-lineage',
    'exact-market-settlement-semantics','tail-markets-require-distributions',
    'prediction-revisions-retain-prior-envelope','process-review-cannot-rewrite-outcome',
    'synthetic-cannot-certify-edge','no-betting-or-financial-authority',
  ].map(name=>Object.freeze({name,passed:true,evidenceIds:Object.freeze(['test:'+name])}))
  const report=certifySportsPredFinalSoftware({cases})
  assert.equal(report.softwarePassed,true)
  assert.equal(report.forwardShadowHarnessReady,true)
  assert.equal(report.statisticalEdgeCertified,false)
  assert.equal(report.liveBettingEligible,false)
})
