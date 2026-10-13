import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeSportsStudyCase} from './grade-case.mjs';
import {admitReviewedCase001} from './admit-reviewed-case.mjs';

const pregameBytes=readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.case.json',import.meta.url));
const availabilityBytes=readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.availability-001.json',import.meta.url));
const pregame=JSON.parse(pregameBytes.toString('utf8'));
const final={
 schema_version:'jhadina.sports.study_case.final_input.v1',
 case_id:pregame.case_id,event_id:pregame.event_id,
 status:'FINAL',source_class:'OFFICIAL_FINAL',
 source_url:'https://www.nfl.com/games/example-test-fixture',
 verified_final_at_utc:'2026-10-13T05:15:00Z',
 final_home_points:31,final_away_points:27
};
const scorecard=gradeSportsStudyCase(pregame,final);
const review={
 schema_version:'jhadina.sports.study_case.review.v1',
 case_id:pregame.case_id,event_id:pregame.event_id,
 reviewed_at_utc:'2026-10-13T05:30:00Z',
 reviewer_id:'test-fixture-reviewer',
 evidence_items:[{
   evidence_id:'E1',source_url:final.source_url,
   observed_at_utc:'2026-10-13T05:10:00Z',
   available_at_utc:'2026-10-13T05:15:00Z',
   claim:'TEST FIXTURE ONLY -- not a real NFL result'
 }],
 hypothesis_reviews:pregame.thesis.map(t=>({
   hypothesis_id:t.id,status:'INSUFFICIENT_EVIDENCE',
   rationale:'Fixture deliberately contains no box score to establish causal claims',
   evidence_ids:[]
 })),
 lessons:[],
 reasoning_vote:{makes_internal_sense:null,supported_by_verified_evidence:null,remaining_contradictions:[]}
};
const input={pregameBytes,availabilityBytes,final,scorecard,review};

test('accepts only as owner-review candidate; one synthetic fixture is not training',()=>{
 const r=admitReviewedCase001(input);
 assert.equal(r.admission_status,'REVIEWED_CANDIDATE_AWAITING_OWNER_APPROVAL');
 assert.equal(r.candidate.training_status,'AWAITING_OWNER_REVIEW');
 assert.equal(r.durable_memory_saved,false);
 assert.equal(r.weights_updated,false);
 assert.equal(r.canExecute,false);
 assert.equal(r.source_sha256.pregame.length,64);
});
test('rejects edited grade, even if original case remains unchanged',()=>{
 assert.throws(()=>admitReviewedCase001({...input,scorecard:{...scorecard,assessment:{...scorecard.assessment,brier_score:0}}}),/SCORECARD_NOT_DERIVED_FROM_LOCKED_FORECAST/);
});
test('rejects a scorecard from a different final',()=>{
 assert.throws(()=>admitReviewedCase001({...input,final:{...final,final_home_points:14}}),/SCORECARD_NOT_DERIVED_FROM_LOCKED_FORECAST/);
});
test('rejects nonofficial source host and missing source lineage',()=>{
 assert.throws(()=>admitReviewedCase001({...input,final:{...final,source_url:'https://fake-nfl.invalid/results'}}),/OFFICIAL_RESULT_HOST_UNTRUSTED/);
 assert.throws(()=>admitReviewedCase001({...input,review:{...review,evidence_items:[]}}),/REVIEW_MISSING_OFFICIAL_RESULT_LINEAGE/);
});
test('rejects changes to sealed original prediction and premature reviews',()=>{
 assert.throws(()=>admitReviewedCase001({...input,pregameBytes:Buffer.from(pregameBytes.toString('utf8')+' ')}),/PREGAME_BLOB_CHANGED/);
 assert.throws(()=>admitReviewedCase001({...input,review:{...review,reviewed_at_utc:'2026-10-13T04:15:00Z'}}),/REVIEW_CLOCK_INVALID/);
});
