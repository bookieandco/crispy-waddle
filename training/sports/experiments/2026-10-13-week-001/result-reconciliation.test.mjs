import test from 'node:test';
import assert from 'node:assert/strict';
import {buildResultReviewQueue} from './result-reconciliation.mjs';
const unresolved=[
 {event_id:'espn:tennis/wta:1',sport:'Tennis',league:'tennis/wta',status:'NO_ACCEPTED_UNOFFICIAL_RESULT',scheduled_start_utc:'2026-10-15T04:00:00Z',source_url:'https://example.org/original'},
 {event_id:'espn:basketball/nba:2',sport:'NBA',league:'basketball/nba',status:'CONFLICTING_UNOFFICIAL_RESULTS',scheduled_start_utc:'2026-10-16T04:00:00Z',source_url:'https://example.org/final',
 conflicting_observations:[{reported_home_points:99,reported_away_points:100},{reported_home_points:99,reported_away_points:101}]}
];
const reports=[{run_id:'1-1',completed_at_utc:'2026-10-21T00:00:00Z',
 abstentions:[{event_id:'espn:tennis/wta:1',reason:'UNVERIFIED_RESULT',detail:'UNVERIFIED_RESULT:PARTICIPANT_ID_MISMATCH'}],
 pending_result_review:[{event_id:'espn:tennis/wta:1',status:'PRELIMINARY_FINAL_VISIBLE_PENDING_GRADE',action:'CHECK_GRADING_CONSISTENCY'}]}];
test('backlog links archived diagnostic provenance without promoting score evidence',()=>{
 const r=buildResultReviewQueue(unresolved,reports);
 assert.equal(r.unresolved_count,2);assert.equal(r.conflicting_count,1);
 assert.match(r.cases[0].archived_grade_rejections[0],/PARTICIPANT_ID_MISMATCH/);
 assert.equal(r.cases[0].most_recent_archived_run.run_id,'1-1');
 assert.equal(r.cases[0].bookmaker_settlement_verified,false);
 assert.equal(r.cases[0].approved_for_training,false);
 assert.equal(r.cases[1].contradictory_observations.length,2);
});
test('no archived log does not imply the event was cancelled or lost',()=>{
 const r=buildResultReviewQueue(unresolved,[]);
 assert.equal(r.cases[0].archived_grade_rejections.length,0);
 assert.equal(r.cases[0].official_sport_result_verified,false);
 assert.equal(r.real_bets,0);
});
test('unsupported status or duplicate case is rejected',()=>{
 assert.throws(()=>buildResultReviewQueue([...unresolved,unresolved[0]]),/RESULT_QUEUE_EVENT_INVALID/);
 assert.throws(()=>buildResultReviewQueue([{...unresolved[0],status:'OFFICIAL_SPORT_RESULT_VERIFIED'}]),/RESULT_QUEUE_STATUS_INVALID/);
});
