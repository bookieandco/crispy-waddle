import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeSportsStudyCase} from './grade-case.mjs';
const pregame={
 schema_version:'jhadina.sports.study_case.pregame.v1',case_id:'case-001',event_id:'evt-001',
 matchup:{scheduled_kickoff_utc:'2026-10-13T00:15:00Z',home_code:'LAR',away_code:'BUF'},
 original_prediction:{home_win_probability:.60,home_projected_points:31,away_projected_points:27,winner:'LAR'},
 market_reference:{home_spread:-3.5,game_total:54.5},
 thesis:[{id:'T1'}]
};
const outcome={schema_version:'jhadina.sports.study_case.final_input.v1',case_id:'case-001',
 event_id:'evt-001',status:'FINAL',source_class:'OFFICIAL_FINAL',
 source_url:'https://www.nfl.com/games/example',verified_final_at_utc:'2026-10-13T05:15:00Z',
 final_home_points:31,final_away_points:27};
test('scores a correct Rams outcome without promoting causal thesis',()=>{
 const r=gradeSportsStudyCase(pregame,outcome);
 assert.equal(r.assessment.winner_correct,true);
 assert.equal(r.assessment.brier_score,.16);
 assert.equal(r.assessment.log_loss,.510826);
 assert.equal(r.assessment.total_absolute_error,0);
 assert.equal(r.assessment.margin_absolute_error,0);
 assert.equal(r.assessment.against_spread_outcome,'HOME');
 assert.equal(r.assessment.over_under_outcome,'OVER');
 assert.equal(r.thesis_reviews[0].status,'NOT_EVALUATED');
 assert.equal(r.training_status,'AWAITING_EVIDENCE_REVIEW');
 assert.equal(r.canAuthorizeLive,false);
});
test('losing forecast is graded, not rewritten',()=>{
 const r=gradeSportsStudyCase(pregame,{...outcome,final_home_points:20,final_away_points:24});
 assert.equal(r.assessment.winner_correct,false);
 assert.equal(r.assessment.brier_score,.36);
 assert.equal(r.assessment.home_score_absolute_error,11);
 assert.equal(r.assessment.margin_absolute_error,8);
 assert.equal(r.original_prediction_unchanged,true);
});
test('rejects fabricated final status and mismatched events',()=>{
 assert.throws(()=>gradeSportsStudyCase(pregame,{...outcome,status:'LIVE'}),/OFFICIAL_FINAL_EVIDENCE_REQUIRED/);
 assert.throws(()=>gradeSportsStudyCase(pregame,{...outcome,event_id:'wrong'}),/CASE_EVENT_MISMATCH/);
 assert.throws(()=>gradeSportsStudyCase(pregame,{...outcome,verified_final_at_utc:'2026-10-12T23:00:00Z'}),/FINAL_BEFORE_KICKOFF/);
});
test('tie cannot be graded by two-outcome moneyline probability',()=>{
 const r=gradeSportsStudyCase(pregame,{...outcome,final_home_points:24,final_away_points:24});
 assert.equal(r.assessment.brier_score,null);
 assert.equal(r.assessment.winner_correct,null);
});
