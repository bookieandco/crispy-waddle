import test from 'node:test';
import assert from 'node:assert/strict';
import {extractScoreboard,calculateBaseline,sealResearchForecast,gradeUnofficial} from './core.mjs';
import {reconcileWeek001,markdownReview} from './offline-review.mjs';
const time='2026-10-13T17:00:00Z',url='https://example.org/third-party';
const raw=(id,h,a,hs,as)=>({id,date:'2026-10-12T00:00:00Z',status:{type:{completed:true,name:'STATUS_FINAL'}},competitions:[{competitors:[{homeAway:'home',team:{id:h,displayName:h},score:String(hs)},{homeAway:'away',team:{id:a,displayName:a},score:String(as)}]}]});
const history=extractScoreboard('football/nfl',{events:[
 raw('1','a','x',10,7),raw('2','b','y',9,7),raw('3','a','z',11,4),
 raw('4','b','q',14,9),raw('5','x','y',8,6),raw('6','y','z',7,5),
 raw('7','q','x',11,9),raw('8','z','q',12,9)
]},time,url).finals;
const fixture={event_id:'espn:football/nfl:future',sport:'NFL',league:'football/nfl',
 start_utc:'2026-10-16T00:00:00Z',home:{id:'a',name:'a'},away:{id:'b',name:'b'},
 source_url:url,source_observed_at:time,source_class:'THIRD_PARTY_UNCONFIRMED'};
const forecast=sealResearchForecast(fixture,calculateBaseline(fixture,history,time).forecast,time);
const final=(home,away,stamp)=>({...fixture,home_points:home,away_points:away,
 verified_at_utc:stamp,verification_status:'THIRD_PARTY_UNCONFIRMED'});
const a=gradeUnofficial(forecast,final(14,12,'2026-10-16T03:00:00Z'));
const aLater=gradeUnofficial(forecast,final(14,12,'2026-10-16T04:00:00Z'));
const b=gradeUnofficial(forecast,final(12,14,'2026-10-16T05:00:00Z'));

test('no result yields unresolved and never invents winner or official settlement',()=>{
 const r=reconcileWeek001([forecast],[],Date.parse('2026-10-17T00:00:00Z'));
 assert.equal(r.missing_unofficial_results,1);
 assert.equal(r.unresolved[0].score,null);
 assert.equal(r.official_settlements,0);
 assert.equal(r.real_bets,0);assert.equal(r.training_updates,0);
});
test('repeated same score is a single unofficial graded event',()=>{
 const r=reconcileWeek001([forecast],[a,aLater],Date.parse('2026-10-17T00:00:00Z'));
 assert.equal(r.unofficial_scored_unique,1);
 assert.equal(r.duplicate_identical_result_observations,1);
 assert.equal(r.unresolved.length,0);
 assert.equal(r.calibration.preregistered_fixed_control.scored_eligible_events,1);
});
test('conflicting score is quarantined, remains unresolved, never backfills a preferred outcome',()=>{
 const r=reconcileWeek001([forecast],[a,b],Date.parse('2026-10-17T00:00:00Z'));
 assert.equal(r.unofficial_scored_unique,0);
 assert.equal(r.conflicting_unofficial_results,1);
 assert.equal(r.unresolved[0].status,'CONFLICTING_UNOFFICIAL_RESULTS');
 assert.equal(r.unresolved[0].score,null);
 assert.equal(r.unresolved[0].conflicting_observations.length,2);
 assert.match(markdownReview(r),/no official verdict/);
});
test('tampered unofficial result cannot enter offline review',()=>{
 assert.throws(()=>reconcileWeek001([forecast],[{...a,home_points:999}]),/SCOREBOARD_INVALID_GRADE/);
});
