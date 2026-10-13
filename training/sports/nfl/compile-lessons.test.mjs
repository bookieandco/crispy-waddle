import test from 'node:test';
import assert from 'node:assert/strict';
import {compileJhadinaSportsLearningCandidate as compile} from './compile-lessons.mjs';

const pre={
 schema_version:'jhadina.sports.study_case.pregame.v1',case_id:'C',event_id:'E',
 matchup:{scheduled_kickoff_utc:'2026-10-13T00:15:00Z'},
 original_prediction:{winner:'LAR',home_win_probability:.60,home_projected_points:31,away_projected_points:27,model_id:'chatgpt-judgment-baseline',model_version:'2026-10-12-v0'},
 thesis:[{id:'T1'},{id:'T2'}],governance:{canExecute:false,canAuthorizeBet:false}
};
const score={
 schema_version:'jhadina.sports.study_case.scorecard.v1',case_id:'C',event_id:'E',
 calibrated:false,sample_size:1,canExecute:false,original_prediction_unchanged:true,
 training_status:'AWAITING_EVIDENCE_REVIEW',verified_final_at_utc:'2026-10-13T04:30:00Z',
 assessment:{winner_correct:false,brier_score:.36,home_score_absolute_error:11}
};
const review={
 schema_version:'jhadina.sports.study_case.review.v1',case_id:'C',event_id:'E',
 reviewed_at_utc:'2026-10-13T06:00:00Z',reviewer_id:'human-reviewer',
 evidence_items:[{evidence_id:'E1',source_url:'https://www.nfl.com/games/example',
 observed_at_utc:'2026-10-13T04:00:00Z',available_at_utc:'2026-10-13T04:35:00Z',claim:'Verified box score'}],
 hypothesis_reviews:[
  {hypothesis_id:'T1',status:'SUPPORTED',rationale:'Supported by observed passing production; not proven causal',evidence_ids:['E1']},
  {hypothesis_id:'T2',status:'INSUFFICIENT_EVIDENCE',rationale:'Injury effect not isolated',evidence_ids:[]}
 ],
 lessons:[{kind:'HYPOTHESIS',statement:'Check how receiver availability changes pass efficiency',evidence_ids:['E1']}],
 reasoning_vote:{makes_internal_sense:true,supported_by_verified_evidence:false,remaining_contradictions:['Injury effect not isolated']}
};
test('builds learning-only candidate while separating coherence and truth',()=>{
 const c=compile(pre,score,review);
 assert.equal(c.training_status,'AWAITING_OWNER_REVIEW');
 assert.equal(c.sample_size,1);
 assert.equal(c.canTrainAutomatically,false);
 assert.equal(c.canAuthorizeLive,false);
 assert.equal(c.canExecute,false);
 assert.equal(c.reasoning_vote.makes_internal_sense,true);
 assert.equal(c.reasoning_vote.supported_by_verified_evidence,false);
 assert.equal(c.hypotheses[1].status,'INSUFFICIENT_EVIDENCE');
});
test('refuses unsupported causal verdict',()=>{
 const bad={...review,hypothesis_reviews:[{...review.hypothesis_reviews[0],evidence_ids:[]},review.hypothesis_reviews[1]]};
 assert.throws(()=>compile(pre,score,bad),/SUPPORTED_WITHOUT_EVIDENCE/);
});
test('refuses omitted or swapped original hypotheses',()=>{
 const bad={...review,hypothesis_reviews:[review.hypothesis_reviews[0]]};
 assert.throws(()=>compile(pre,score,bad),/INCOMPLETE_HYPOTHESIS_REVIEW/);
});
test('rejects evidence only available after review, and mismatched case',()=>{
 const future={...review,evidence_items:[{...review.evidence_items[0],available_at_utc:'2026-10-13T06:30:00Z'}]};
 assert.throws(()=>compile(pre,score,future),/FUTURE_EVIDENCE/);
 assert.throws(()=>compile(pre,{...score,case_id:'other'},review),/CASE_EVENT_MISMATCH/);
});
test('refuses auto-training and authority promotion in source scorecard',()=>{
 assert.throws(()=>compile(pre,{...score,canExecute:true},review),/SCORECARD_GOVERNANCE_INVALID/);
 assert.throws(()=>compile({...pre,governance:{canExecute:true,canAuthorizeBet:false}},score,review),/CASE_AUTHORITY_INVALID/);
});
