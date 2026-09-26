import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSportsHandicapEvidence, buildSportsHandicapEvidenceSet, type SportsHandicapEvidence } from './sports-handicap-evidence.js'

const base=(overrides:Partial<SportsHandicapEvidence>={}):SportsHandicapEvidence=>Object.freeze({
  evidenceId:'e1',eventId:'cfb:osu-ill',subjectId:'ohio-state-defense',featureKind:'TEAM_EFFICIENCY',
  evidenceClass:'MEASURED',causalStatus:'SUPPORTING_CONTEXT',value:10,unit:'POINTS_ALLOWED_PER_GAME',
  direction:'SUPPORTS_SIDE_A',observedAt:'2026-09-26T16:00:00Z',informationCutoff:'2026-09-26T17:00:00Z',
  sourceType:'stats-feed',authority:'INTELLIGENCE_ONLY',canExecute:false,...overrides,
})

test('keeps measurable, reported, market and narrative evidence separate',()=>{
  const set=buildSportsHandicapEvidenceSet({
    eventId:'cfb:osu-ill',
    informationCutoff:'2026-09-26T17:00:00Z',
    evidence:[
      base(),
      base({evidenceId:'e2',subjectId:'illinois-ol',featureKind:'INJURY_AVAILABILITY',evidenceClass:'REPORTED',causalStatus:'DIRECT_MECHANISM',value:true,sourceType:'availability-report'}),
      base({evidenceId:'e3',subjectId:'market',featureKind:'MARKET_MOVE',evidenceClass:'MARKET',causalStatus:'CORRELATIONAL',value:-2.5,unit:'POINTS',sourceType:'odds-feed'}),
      base({evidenceId:'e4',subjectId:'ohio-state',featureKind:'NARRATIVE_MOTIVATION',evidenceClass:'NARRATIVE',causalStatus:'UNTESTED_NARRATIVE',value:'bounce-back / style-points narrative',sourceType:'commentary'}),
    ],
  })
  assert.equal(set.measuredCount,1)
  assert.equal(set.reportedCount,1)
  assert.equal(set.marketCount,1)
  assert.equal(set.narrativeCount,1)
  assert.deepEqual(set.untestedNarrativeIds,['e4'])
  assert.equal(set.canExecute,false)
})

test('narrative evidence cannot claim direct causality',()=>{
  assert.throws(()=>assertSportsHandicapEvidence(base({
    featureKind:'NARRATIVE_MOTIVATION',
    evidenceClass:'NARRATIVE',
    causalStatus:'DIRECT_MECHANISM',
  })),/MONEY_SPORTS_NARRATIVE_CAUSALITY_OVERCLAIM/)
})

test('market-flow claims must remain market evidence rather than measured team truth',()=>{
  assert.throws(()=>assertSportsHandicapEvidence(base({
    featureKind:'PUBLIC_OR_SHARP_FLOW',
    evidenceClass:'MEASURED',
    causalStatus:'CORRELATIONAL',
  })),/MONEY_SPORTS_MARKET_EVIDENCE_CLASS_REQUIRED/)
})
