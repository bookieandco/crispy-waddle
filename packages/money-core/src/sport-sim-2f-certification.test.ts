import assert from 'node:assert/strict'
import test from 'node:test'
import { assessSportsSliderImpacts, resolveSportsSlider, type SportsSliderImpactRule, type SportsSliderSignal } from './sports-simulation-slider-engine.js'
import { transitionSportsState, type SportsSimState } from './sports-simulation-state.js'
import { latentFactorsFromSliders, runCorrelatedSportsMonteCarlo } from './sports-correlated-monte-carlo.js'
import { createSportsLiveResimulation } from './sports-live-resimulation.js'
import { assessSportsSimulationCalibration, assessSportsSliderAblation, assessSportsSliderSensitivity } from './sports-simulation-calibration.js'
import { automateSportsPaperCore, createSportsBetAlpha, rankSportsBetAlpha, reunderwriteSportsPositionFromAlpha, sportsAlphaToCrossDomainEvidence } from './sports-sim-bet-alpha.js'
import { createSportsVisualInferenceObservation, sportsVisualObservationToContextFeature } from './sports-vision-evidence.js'
import { certifySportSim2FSoftware } from './sport-sim-2f-certification.js'
import type { SportsMarketQuote } from './sports-paper-betting.js'
import type { OpenPositionSnapshot } from './position-management.js'

const cutoff='2026-09-27T18:00:00Z'

function q(id:string,odds:string,marketId='event:1:ml',selectionId='HOME'):SportsMarketQuote{
  return Object.freeze({
    quoteId:id,provider:'paper-book',eventId:'event:1',marketId,selectionId,
    oddsFormat:'AMERICAN',odds,observedAt:'2026-09-27T17:55:00Z',availableAt:'2026-09-27T17:55:01Z',
    evidenceIds:Object.freeze(['quote:'+id]),authority:'EVIDENCE_ONLY',canExecute:false,
  })
}

const signals:SportsSliderSignal[]=[
  {slider:'MATCHUP',observedValue:.8,learnedBaseline:.2,observedWeightBps:7000,evidenceStrengthBps:9000,evidenceIds:['matchup:e1']},
  {slider:'PLAYER_NIGHT',observedValue:.4,learnedBaseline:0,observedWeightBps:6000,evidenceStrengthBps:7000,evidenceIds:['variance:e1']},
]
const rules:SportsSliderImpactRule[]=[
  {ruleId:'r-match',sport:'FOOTBALL',marketFamily:'MONEYLINE',slider:'MATCHUP',ruleVersion:'impact-v1',outcomeLogitImpactBps:{HOME:900,AWAY:-900},volatilityImpactBps:100,sourceClass:'REAL_AS_OF',sampleSize:400,evidenceIds:['rule:match']},
  {ruleId:'r-night',sport:'FOOTBALL',marketFamily:'MONEYLINE',slider:'PLAYER_NIGHT',ruleVersion:'impact-v1',outcomeLogitImpactBps:{HOME:300,AWAY:-300},volatilityImpactBps:400,sourceClass:'REAL_AS_OF',sampleSize:400,evidenceIds:['rule:night']},
]

test('SPORT-SIM.2A sliders resolve evidence + learned values and causally alter model inputs',()=>{
  const assessed=assessSportsSliderImpacts({sport:'FOOTBALL',marketFamily:'MONEYLINE',signals,rules,baseVolatilityBps:200})
  assert.ok((assessed.outcomeLogitShiftBps.HOME??0)>0)
  assert.ok((assessed.outcomeLogitShiftBps.AWAY??0)<0)
  assert.ok(assessed.volatilityBps>200)
  assert.equal(assessed.calibrationEligible,true)
  const stress=resolveSportsSlider({...signals[0]!,overrideValue:-1})
  assert.equal(stress.mode,'STRESS_OVERRIDE')
  assert.equal(stress.effectiveValue,-1)
})

test('SPORT-SIM.2B implements state transitions for every declared sport',()=>{
  const cases:{state:SportsSimState;event:any;check:(s:SportsSimState)=>boolean}[]=[
    {state:{sport:'FOOTBALL',homeScore:0,awayScore:0,secondsRemaining:3600,possession:'HOME',down:1,distance:10,yardLine:25,drive:1},event:{sport:'FOOTBALL',kind:'PLAY',team:'HOME',yards:12,secondsElapsed:20},check:s=>s.sport==='FOOTBALL'&&s.down===1&&s.yardLine===37},
    {state:{sport:'BASKETBALL',homeScore:0,awayScore:0,secondsRemaining:2880,period:1,possession:'HOME',homeFouls:0,awayFouls:0},event:{sport:'BASKETBALL',kind:'POSSESSION',team:'HOME',points:3,secondsElapsed:20},check:s=>s.sport==='BASKETBALL'&&s.homeScore===3&&s.possession==='AWAY'},
    {state:{sport:'BASEBALL',homeScore:0,awayScore:0,inning:1,half:'TOP',outs:2,runners:[false,false,false],batting:'AWAY'},event:{sport:'BASEBALL',kind:'PLATE_APPEARANCE',runs:1,outsAdded:1},check:s=>s.sport==='BASEBALL'&&s.half==='BOTTOM'&&s.awayScore===1},
    {state:{sport:'HOCKEY',homeScore:0,awayScore:0,secondsRemaining:3600,period:1,strength:'EVEN',possession:'HOME'},event:{sport:'HOCKEY',kind:'SHIFT',team:'HOME',goal:true,secondsElapsed:45},check:s=>s.sport==='HOCKEY'&&s.homeScore===1},
    {state:{sport:'TENNIS',playerASets:0,playerBSets:0,playerAGames:0,playerBGames:0,playerAPoints:0,playerBPoints:0,server:'A'},event:{sport:'TENNIS',kind:'POINT',winner:'A'},check:s=>s.sport==='TENNIS'&&s.playerAPoints===15},
    {state:{sport:'BOXING',round:1,secondsRemainingInRound:180,redPoints:0,bluePoints:0,redDamage:0,blueDamage:0,redFatigue:0,blueFatigue:0},event:{sport:'BOXING',kind:'EXCHANGE',redPoints:2,bluePoints:1,redDamage:.01,blueDamage:.05,secondsElapsed:20},check:s=>s.sport==='BOXING'&&s.redPoints===2&&s.blueDamage>.04},
    {state:{sport:'SOCCER',homeScore:0,awayScore:0,secondsRemaining:5400,possession:'HOME',homeRedCards:0,awayRedCards:0,homeSubsUsed:0,awaySubsUsed:0},event:{sport:'SOCCER',kind:'SEQUENCE',team:'HOME',goal:true,secondsElapsed:60},check:s=>s.sport==='SOCCER'&&s.homeScore===1},
  ]
  for(const c of cases)assert.equal(c.check(transitionSportsState(c.state,c.event)),true)
})

test('SPORT-SIM.2C correlated Monte Carlo emits score/player/tail and same-path joint distributions',()=>{
  const slider=assessSportsSliderImpacts({sport:'FOOTBALL',marketFamily:'MONEYLINE',signals,rules,baseVolatilityBps:250})
  const factors=[
    ...latentFactorsFromSliders({assessment:slider,baseStdDev:.2}),
    {factorId:'GAME_SCRIPT_PASS',mean:.4,stdDev:.5,evidenceIds:['script:e1']},
  ]
  const sim=runCorrelatedSportsMonteCarlo({
    eventId:'event:1',sport:'FOOTBALL',currentHomeScore:0,currentAwayScore:0,pathCount:4000,randomSeed:'sport-sim-2c',
    teamModels:[
      {team:'HOME',baseRemainingMean:27,residualStdDev:5,sensitivities:{'SLIDER:MATCHUP':4,'GAME_SCRIPT_PASS':2}},
      {team:'AWAY',baseRemainingMean:21,residualStdDev:5,sensitivities:{'SLIDER:MATCHUP':-3,'GAME_SCRIPT_PASS':1}},
    ],
    playerModels:[
      {statId:'qb-pass-yards',playerId:'qb-home',baseRemainingMean:255,residualStdDev:45,minimum:0,sensitivities:{'GAME_SCRIPT_PASS':45,'SLIDER:PLAYER_NIGHT':25},tailThresholds:[250,300,350]},
      {statId:'rb-carries',playerId:'rb-home',baseRemainingMean:16,residualStdDev:4,minimum:0,sensitivities:{'GAME_SCRIPT_PASS':-5},tailThresholds:[15,20]},
    ],
    latentFactors:factors,
    marketLegs:[
      {legId:'home-ml',kind:'HOME_WIN'},
      {legId:'over-47',kind:'TOTAL_OVER',line:47},
      {legId:'qb-250',kind:'PLAYER_OVER',statId:'qb-pass-yards',line:250},
    ],
    jointSets:[{jointId:'sgp:1',legIds:['home-ml','over-47','qb-250']}],
    heavyTailRegimeBps:700,sliderAssessment:slider,
  })
  assert.equal(sim.playerStats.length,2)
  assert.ok(sim.playerStats[0]!.tailProbabilityByThreshold['300']!==undefined)
  assert.equal(sim.marketProbabilities.length,3)
  assert.equal(sim.jointProbabilities.length,1)
  const standalone=sim.marketProbabilities.reduce((p,x)=>p*x.probability,1)
  assert.notEqual(sim.jointProbabilities[0]!.probability,standalone)
  assert.equal(sim.heavyTailRegimeBps,700)
  assert.equal(sim.canExecute,false)
})

test('SPORT-SIM.2D live re-simulation emits market deltas and state/slider attribution',()=>{
  const lowSignals=[...signals]
  const highSignals=signals.map(s=>s.slider==='MATCHUP'?{...s,observedValue:1}:s)
  const a=assessSportsSliderImpacts({sport:'FOOTBALL',marketFamily:'MONEYLINE',signals:lowSignals,rules,baseVolatilityBps:200})
  const b=assessSportsSliderImpacts({sport:'FOOTBALL',marketFamily:'MONEYLINE',signals:highSignals,rules,baseVolatilityBps:200})
  const mk=(assessment:ReturnType<typeof assessSportsSliderImpacts>,score:number,seed:string)=>runCorrelatedSportsMonteCarlo({
    eventId:'event:1',sport:'FOOTBALL',currentHomeScore:score,currentAwayScore:0,pathCount:1200,randomSeed:seed,
    teamModels:[{team:'HOME',baseRemainingMean:20,residualStdDev:4,sensitivities:{'SLIDER:MATCHUP':5}},{team:'AWAY',baseRemainingMean:18,residualStdDev:4,sensitivities:{'SLIDER:MATCHUP':-3}}],
    latentFactors:latentFactorsFromSliders({assessment,baseStdDev:.15}),marketLegs:[{legId:'home-ml',kind:'HOME_WIN'}],sliderAssessment:assessment,
  })
  const priorState:SportsSimState={sport:'FOOTBALL',homeScore:0,awayScore:0,secondsRemaining:3600,possession:'HOME',down:1,distance:10,yardLine:25,drive:1}
  const nextState=transitionSportsState(priorState,{sport:'FOOTBALL',kind:'PLAY',team:'HOME',yards:20,secondsElapsed:120,scoreDelta:7})
  const live=createSportsLiveResimulation({
    priorState,nextState,priorSimulation:mk(a,0,'prior'),nextSimulation:mk(b,7,'next'),priorSliders:a.sliders,nextSliders:b.sliders,
    triggers:['SCORE_CHANGE','CLOCK_CHANGE'],changedEvidenceIds:['play:td'],observedAt:'2026-09-27T18:05:00Z',
  })
  assert.ok(Math.abs(live.marketDeltas[0]!.deltaBps)>0)
  assert.ok(live.driverAttribution.some(x=>x.kind==='STATE'))
  assert.ok(live.changedSliderNames.includes('MATCHUP'))
})

test('SPORT-SIM.2E calibration, ablation and sensitivity keep synthetic evidence from claiming edge',()=>{
  const synthetic=assessSportsSimulationCalibration({minimumRealSamples:2,observations:[
    {observationId:'s1',sport:'FOOTBALL',marketFamily:'MONEYLINE',modelVersion:'v1',probability:.6,actual:1,issuedAt:'2026-09-27T17:00:00Z',resolvedAt:'2026-09-27T23:00:00Z',sourceClass:'SYNTHETIC_TEST',evidenceIds:['syn:1'],kind:'MARKET'},
  ]})
  assert.equal(synthetic[0]!.status,'SOFTWARE_ONLY')
  const ablation=assessSportsSliderAblation({slider:'MATCHUP',sport:'FOOTBALL',marketFamily:'MONEYLINE',baselineMetric:.18,metricWithoutSlider:.23,sourceClass:'REAL_AS_OF',sampleSize:200,evidenceIds:['abl:1']})
  assert.equal(ablation.status,'HELPFUL')
  const sensitivity=assessSportsSliderSensitivity({slider:'MATCHUP',lowValue:-1,highValue:1,lowProbability:.42,highProbability:.66,evidenceIds:['sens:1']})
  assert.equal(sensitivity.monotonicDirection,'UP')
})

test('SPORT-SIM.2F ranks alpha, automatically creates PaperCore wagers, and preserves no-live authority',()=>{
  const good=createSportsBetAlpha({
    eventId:'event:1',instrumentId:'sports:event:1:home',marketId:'event:1:ml',selectionId:'HOME',venueKind:'SPORTSBOOK',provider:'paper-book',
    fairProbability:.62,quote:q('good','-110'),estimatedCostsBps:40,uncertaintyPenaltyBps:100,liquidityQualityBps:9000,
    simulationId:'sim:1',modelVersion:'v1',informationCutoff:cutoff,expiresAt:'2026-09-27T19:00:00Z',thesis:'Simulation clears the market after costs.',evidenceIds:['sim:e1'],
  })
  const weak=createSportsBetAlpha({
    eventId:'event:1',instrumentId:'sports:event:1:home2',marketId:'event:1:ml',selectionId:'HOME',venueKind:'SPORTSBOOK',provider:'paper-book',
    fairProbability:.51,quote:q('weak','-110'),estimatedCostsBps:80,uncertaintyPenaltyBps:120,liquidityQualityBps:9000,
    simulationId:'sim:2',modelVersion:'v1',informationCutoff:cutoff,expiresAt:'2026-09-27T19:00:00Z',thesis:'Weak candidate.',evidenceIds:['sim:e2'],
  })
  const ranking=rankSportsBetAlpha({candidates:[weak,good],minimumNetEdgeBps:200,minimumLiquidityBps:5000})
  assert.equal(ranking.rankedAlphaIds[0],good.alphaId)
  const paper=automateSportsPaperCore({candidates:[weak,good],policy:{strategyId:'sport-sim:auto',currency:'USD',stakeMinor:1000n,minimumNetEdgeBps:200,minimumConfidenceBps:8000,minimumLiquidityBps:5000,maxWagers:2},placedAt:'2026-09-27T18:01:00Z'})
  assert.equal(paper.wagers.length,1)
  assert.equal(paper.acceptedAlphaIds[0],good.alphaId)
  assert.equal(paper.canExecute,false)
  assert.equal(paper.bettingAuthority,'NONE')
  const cross=sportsAlphaToCrossDomainEvidence({alpha:good,observedAt:'2026-09-27T18:00:30Z'})
  assert.equal(cross.authority,'INTELLIGENCE_ONLY')
  assert.equal(cross.canExecute,false)

  const position:OpenPositionSnapshot=Object.freeze({
    positionId:'pos:1',domain:'SPORTS_BETTING',instrumentId:good.instrumentId,side:'YES',quantity:1,entryPrice:.5,currentExecutableExitPrice:.58,currentExecutableAddPrice:.59,
    unrealizedPnlMinor:800n,peakUnrealizedPnlMinor:900n,grossExposureMinor:1000n,currency:'USD',openedAt:'2026-09-27T17:00:00Z',observedAt:'2026-09-27T18:00:30Z',
    evidenceIds:Object.freeze(['position:e1']),authority:'EVIDENCE_ONLY',
  })
  const decision=reunderwriteSportsPositionFromAlpha({position,alpha:good,evaluatedAt:'2026-09-27T18:01:00Z',thesisStrengthBps:8000,invalidationRiskBps:2000,momentumBps:6000})
  assert.equal(decision.action,'ADD')
  assert.equal(decision.canExecute,false)
})

test('Roboflow workflow output remains inferred context-only evidence',()=>{
  const observation=createSportsVisualInferenceObservation({
    eventId:'event:1',frameAssetId:'frame:1',provider:'roboflow-serverless',workflowId:'workflow:segmentation',
    observedAt:'2026-09-27T17:50:00Z',availableAt:'2026-09-27T17:50:01Z',classScores:{field:.94,player:.88},evidenceIds:['frame:e1'],
  })
  const feature=sportsVisualObservationToContextFeature({observation,featureId:'vision:1',subjectId:'event:1',featureValue:.88,normalizedValue:.76,methodologyVersion:'vision-v1',evidenceIds:['mapping:v1']})
  assert.equal(observation.authority,'INFERRED_VISUAL_EVIDENCE_ONLY')
  assert.equal(feature.inputRole,'CONTEXT_ONLY')
  assert.equal(feature.evidenceClass,'DERIVED')
  assert.equal(feature.canExecute,false)
})

test('SPORT-SIM.2F certification matrix closes software without fabricating empirical edge or live betting',()=>{
  const names=[
    'causal-slider-impact','stress-override-separated','sport-specific-state-transitions','correlated-monte-carlo','fat-tail-regime',
    'player-stat-and-tail-distributions','same-path-joint-probability','live-resimulation-deltas','slider-ablation-and-sensitivity',
    'synthetic-cannot-certify-edge','bet-alpha-ranking','papercore-automatic-wagering','open-position-reunderwriting',
    'cross-domain-alpha-intelligence-only','roboflow-context-only','no-live-execution-authority',
  ]
  const report=certifySportSim2FSoftware({cases:names.map(name=>Object.freeze({name,passed:true,evidenceIds:Object.freeze(['test:'+name])}))})
  assert.equal(report.softwarePassed,true)
  assert.equal(report.causalSimulatorReady,true)
  assert.equal(report.liveResimulationReady,true)
  assert.equal(report.paperCoreAutomationReady,true)
  assert.equal(report.empiricalEdgeCertified,false)
  assert.equal(report.liveBettingEligible,false)
})
