import test from 'node:test';
import assert from 'node:assert/strict';
import {RESULT_STATES,classifyArchivedGradeSet,requestStatusPromotion} from './result-status.mjs';
const grade=(h,a)=>({home_points:h,away_points:a,status:RESULT_STATES.PRELIMINARY,eligible_for_training:false,real_bet:false,stake_usd:0});
test('empty archived result is not a loss, a win, or a settlement',()=>{
 const r=classifyArchivedGradeSet([]);
 assert.equal(r.status,RESULT_STATES.MISSING);
 assert.equal(r.bookmaker_settlement_verified,false);
});
test('duplicate unofficial score is one result; contradictory outcomes are quarantined',()=>{
 assert.equal(classifyArchivedGradeSet([grade(5,2),grade(5,2)]).distinct_scores,1);
 assert.equal(classifyArchivedGradeSet([grade(5,2),grade(5,3)]).status,RESULT_STATES.CONFLICT);
});
test('unofficial and official settlement remain separate even if score is present',()=>{
 const r=classifyArchivedGradeSet([grade(3,1)]);
 assert.equal(r.status,RESULT_STATES.PRELIMINARY);
 assert.equal(r.official_sport_result_verified,false);
 assert.equal(r.bookmaker_settlement_verified,false);
});
test('preliminary score cannot be promoted to official result, bookmaker settlement or training',()=>{
 for(const target of [RESULT_STATES.OFFICIAL_SPORT_RESULT,RESULT_STATES.BOOKMAKER_SETTLEMENT])
   assert.throws(()=>requestStatusPromotion(RESULT_STATES.PRELIMINARY,target),/EVIDENCE_GATE_REQUIRED/);
 assert.throws(()=>classifyArchivedGradeSet([{...grade(1,2),eligible_for_training:true}]),/ARCHIVED_GRADE_NOT_UNOFFICIAL/);
 assert.throws(()=>classifyArchivedGradeSet([{...grade(1,2),status:RESULT_STATES.BOOKMAKER_SETTLEMENT}]),/ARCHIVED_GRADE_NOT_UNOFFICIAL/);
});
