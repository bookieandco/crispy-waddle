import assert from 'node:assert/strict'
import test from 'node:test'
import type { SportsPredictionTransportEnvelope } from './sports-intelligence-ingress.js'
import type { SportsMarketQuote } from './sports-paper-betting.js'
import { compareSportsMarketLine, scoreSportsCompositeMarket, assertProjectionMethodForSportsMarket, assertSportsMarketDefinition, type SportsMarketDefinition } from './sports-market-semantics.js'
import { createSportsPredictionRevision } from './sports-prediction-revision-lineage.js'
import { createSportsForwardShadowPrediction, resolveSportsForwardShadowPrediction } from './sports-prediction-forward-shadow.js'
import { reviewSportsPredictionProcess } from './sports-prediction-process-review.js'
import { assertAmericanFootballMatchupContext, assertSoccerPlayerRoleContext } from './sports-specialist-context.js'

function envelope(overrides:Partial<SportsPredictionTransportEnvelope>={}):SportsPredictionTransportEnvelope{
  return Object.freeze({
    schemaVersion:'SPORT-PRED-01',
    envelopeId:'env:1',
    sport:'football',
    subject:Object.freeze({subjectId:'event:1',kind:'EVENT',gameId:'event:1'}),
    informationCutoff:'2026-09-26T18:00:00Z',
    issuedAt:'2026-09-26T18:00:01Z',
    model:Object.freeze({
      modelId:'sport-model',
      modelVersion:'v1',
      methodologyVersion:'method-v1',
      featureSnapshotHash:'feature-hash',
      codeRevision:'abc123',
    }),
    distribution:Object.freeze({
      outcomes:Object.freeze([
        Object.freeze({outcomeId:'HOME',label:'Home',probability:.62}),
        Object.freeze({outcomeId:'AWAY',label:'Away',probability:.38}),
      ]),
    }),
    calibration:Object.freeze({status:'CALIBRATING',sampleSize:20,brierScore:.21,evaluatedAt:'2026-09-26T17:00:00Z',calibrationModelVersion:'cal-v1'}),
    uncertainty:Object.freeze({aleatoric:.3,epistemic:.2,overall:.25}),
    resolution:Object.freeze({type:'FINAL_SCORE',authority:'official-league',ruleVersion:'r1'}),
    evidenceRefs:Object.freeze([{evidenceId:'e1',sourceType:'official',observedAt:'2026-09-26T17:00:00Z'}]),
    provenance:Object.freeze({inputSnapshotHash:'input-hash',evidenceSnapshotHash:'evidence-hash',generatedBy:'SPORT-PRED.FINAL'}),
    allowedUses:Object.freeze(['MONEY_RESEARCH_INPUT']),
    authority:Object.freeze({decision:'INTELLIGENCE_ONLY',coachingExecution:'NONE',bettingExecution:'NONE',financialExecution:'NONE'}),
    ...overrides,
  })
}

function quote(id:string,odds:string,availableAt:string):SportsMarketQuote{
  return Object.freeze({
    quoteId:id,provider:'shadow-book',eventId:'event:1',marketId:'event:1:prop',selectionId:'HOME',
    oddsFormat:'AMERICAN',odds,observedAt:availableAt,availableAt,evidenceIds:Object.freeze(['quote:'+id]),
    authority:'EVIDENCE_ONLY',canExecute:false,
  })
}

test('NFL coverage and usage context requires a complete coverage distribution',()=>{
  assert.doesNotThrow(()=>assertAmericanFootballMatchupContext({
    contextId:'nfl:1',eventId:'event:1',playerId:'player:wr',
    coverageRatesBps:{TWO_HIGH:5700,COVER_3:4300},
    yardsPerRouteRunByCoverage:{TWO_HIGH:2.39,COVER_3:2.79},
    routeParticipationBps:9800,snapShareBps:9900,targetShareBps:3000,
    observedAt:'2026-09-26T17:00:00Z',informationCutoff:'2026-09-26T18:00:00Z',
    evidenceIds:['coverage-feed','tracking-feed'],authority:'SPECIALIST_CONTEXT_ONLY',canExecute:false,
  }))
  assert.throws(()=>assertAmericanFootballMatchupContext({
    contextId:'nfl:bad',eventId:'event:1',playerId:'player:wr',
    coverageRatesBps:{TWO_HIGH:5700,COVER_3:3000},
    yardsPerRouteRunByCoverage:{TWO_HIGH:2.39},
    routeParticipationBps:9800,snapShareBps:9900,
    observedAt:'2026-09-26T17:00:00Z',informationCutoff:'2026-09-26T18:00:00Z',
    evidenceIds:['coverage-feed'],authority:'SPECIALIST_CONTEXT_ONLY',canExecute:false,
  }),/SPORT_PRED_NFL_COVERAGE_RATES_MUST_SUM_TO_10000/)
})

test('soccer role context carries possession, set-piece, projected-minutes and substitution risk',()=>{
  assert.doesNotThrow(()=>assertSoccerPlayerRoleContext({
    contextId:'soccer:1',eventId:'match:1',playerId:'player:mid',
    lineupStatus:'PROJECTED_STARTER',formationRole:'CAM',projectedMinutes:82,
    substitutionRiskBps:4200,expectedTeamPossessionBps:5900,setPieceDuty:'MULTIPLE',
    shotsPer90:1.72,passesPer90:38.4,
    observedAt:'2026-09-26T17:00:00Z',informationCutoff:'2026-09-26T18:00:00Z',
    evidenceIds:['lineup-projection','possession-model','role-history'],
    authority:'SPECIALIST_CONTEXT_ONLY',canExecute:false,
  }))
  assert.throws(()=>assertSoccerPlayerRoleContext({
    contextId:'soccer:out',eventId:'match:1',playerId:'player:mid',
    lineupStatus:'OUT',formationRole:'CAM',projectedMinutes:20,
    substitutionRiskBps:10000,expectedTeamPossessionBps:5900,setPieceDuty:'NONE',
    observedAt:'2026-09-26T17:00:00Z',informationCutoff:'2026-09-26T18:00:00Z',
    evidenceIds:['injury-report'],authority:'SPECIALIST_CONTEXT_ONLY',canExecute:false,
  }),/SPORT_PRED_SOCCER_OUT_PLAYER_MINUTES_NONZERO/)
})

test('composite fantasy-score markets preserve exact scoring semantics and forbid mean-only probability shortcuts',()=>{
  const definition:SportsMarketDefinition=Object.freeze({
    marketDefinitionId:'fantasy:haaland:22.5',eventId:'match:1',marketId:'fantasy-score',selectionId:'UNDER',
    provider:'pickem',settlementKind:'COMPOSITE_SCORE_THRESHOLD',threshold:22.5,side:'UNDER',
    scoringRuleVersion:'provider-rules-2026-09-27',
    compositeRules:Object.freeze([
      Object.freeze({statId:'goals',pointsPerUnit:10,evidenceIds:Object.freeze(['rules:goals'])}),
      Object.freeze({statId:'shots',pointsPerUnit:1.2,evidenceIds:Object.freeze(['rules:shots'])}),
      Object.freeze({statId:'passes',pointsPerUnit:.05,evidenceIds:Object.freeze(['rules:passes'])}),
    ]),
    requiresTailDistribution:false,observedAt:'2026-09-26T18:00:00Z',evidenceIds:Object.freeze(['rules:v1']),
    authority:'MARKET_SEMANTICS_ONLY',canExecute:false,
  })
  assertSportsMarketDefinition(definition)
  const score=scoreSportsCompositeMarket({definition,stats:{goals:1,shots:4,passes:30},evidenceIds:['boxscore:1']})
  assert.equal(score.totalScore,16.3)
  assert.equal(score.hit,true)
  assert.throws(()=>assertProjectionMethodForSportsMarket({definition,projectionMethod:'MEAN_ONLY'}),/SPORT_PRED_COMPOSITE_MARKET_MEAN_ONLY_INSUFFICIENT/)
})

test('longest-play markets require a tail distribution instead of average-yardage reasoning',()=>{
  const bad:SportsMarketDefinition=Object.freeze({
    marketDefinitionId:'longest:35',eventId:'event:1',marketId:'longest-reception',selectionId:'OVER',
    provider:'book',settlementKind:'LONGEST_EVENT_THRESHOLD',threshold:35,side:'OVER',
    requiresTailDistribution:false,observedAt:'2026-09-26T18:00:00Z',evidenceIds:Object.freeze(['rules']),
    authority:'MARKET_SEMANTICS_ONLY',canExecute:false,
  })
  assert.throws(()=>assertSportsMarketDefinition(bad),/SPORT_PRED_TAIL_MARKET_REQUIRES_TAIL_DISTRIBUTION/)
  const good=Object.freeze({...bad,requiresTailDistribution:true})
  assert.throws(()=>assertProjectionMethodForSportsMarket({definition:good,projectionMethod:'MEAN_ONLY'}),/SPORT_PRED_TAIL_MARKET_MEAN_ONLY_FORBIDDEN/)
})

test('line movement is recorded as market evidence rather than proof of sharp intent',()=>{
  const move=compareSportsMarketLine({
    fromQuote:quote('early','-110','2026-09-26T16:00:00Z'),
    toQuote:quote('later','-125','2026-09-26T17:00:00Z'),
    fromLine:43.5,toLine:45.5,
  })
  assert.equal(move.lineDelta,2)
  assert.equal(move.direction,'MORE_EXPENSIVE')
  assert.equal(move.interpretation,'MARKET_OBSERVATION_ONLY')
  assert.equal(move.canExecute,false)
})

test('pre-lineup and post-lineup predictions are immutable revisions, not overwritten picks',()=>{
  const previous=envelope()
  const next=envelope({
    envelopeId:'env:2',
    informationCutoff:'2026-09-26T18:30:00Z',
    issuedAt:'2026-09-26T18:30:01Z',
    evidenceRefs:Object.freeze([{evidenceId:'lineup:confirmed',sourceType:'official-lineup',observedAt:'2026-09-26T18:29:00Z'}]),
  })
  const revision=createSportsPredictionRevision({
    previous,next,reasonCodes:['LINEUP_CONFIRMED','ROLE_CHANGE'],changedEvidenceIds:['lineup:confirmed'],
  })
  assert.equal(revision.previousEnvelopeRetained,true)
  assert.equal(revision.previousEnvelopeId,'env:1')
  assert.equal(revision.nextEnvelopeId,'env:2')

  assert.throws(()=>createSportsPredictionRevision({
    previous,next:envelope({envelopeId:'env:3',informationCutoff:'2026-09-26T18:30:00Z',issuedAt:'2026-09-26T18:30:01Z',model:Object.freeze({...previous.model,modelVersion:'v2'})}),
    reasonCodes:['LINEUP_CONFIRMED'],changedEvidenceIds:['lineup:confirmed'],
  }),/SPORT_PRED_REVISION_MODEL_MUTATION_REQUIRES_NEW_COHORT/)
})

test('a near miss never rewrites a loss, even when process evidence is favorable',()=>{
  const env=envelope()
  const prediction=createSportsForwardShadowPrediction({
    envelope:env,eventId:'event:1',marketFamily:'MONEYLINE',selectionOutcomeId:'HOME',
    quote:quote('entry','+120','2026-09-26T17:00:00Z'),sourceClass:'REAL_AS_OF',evidenceIds:['issued:1'],
  })
  const record=resolveSportsForwardShadowPrediction({
    prediction,status:'LOST',actualOutcomeId:'AWAY',resolvedAt:'2026-09-27T01:00:00Z',
    closingQuote:quote('close','-110','2026-09-26T19:50:00Z'),evidenceIds:['official-result'],
  })
  const review=reviewSportsPredictionProcess({record})
  assert.equal(review.officialResult,'LOST')
  assert.equal(review.nearMissCreditBps,0)
  assert.equal(review.canRewriteOutcome,false)
  assert.ok(review.reasonCodes.includes('LOSS_REMAINS_LOSS_NO_NEAR_MISS_CREDIT'))
})
