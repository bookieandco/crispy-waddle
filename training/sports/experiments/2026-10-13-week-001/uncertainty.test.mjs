import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,sealResearchForecast,gradeUnofficial} from './core.mjs';
import {wilson95,summarizeLedger,renderMarkdown} from './scoreboard.mjs';

test('Wilson intervals express small-sample uncertainty without a profitability claim',()=>{
 assert.equal(wilson95(0,0),null);
 const one=wilson95(1,1);
 assert.ok(one.lower>0.2&&one.lower<0.22);
 assert.equal(one.upper,1);
 const half=wilson95(20,40);
 assert.ok(half.lower>0.34&&half.lower<0.36);
 assert.ok(half.upper>0.64&&half.upper<0.66);
 assert.match(half.method,/ASSUMES_INDEPENDENT_EVENTS/);
});
test('invalid sample counts cannot be reported as a confidence interval',()=>{
 for(const [correct,n] of [[2,1],[-1,3],[1,-2],[1.5,3],[3,1.5]]){
  assert.throws(()=>wilson95(correct,n),/INTERVAL_COUNTS_INVALID/);
 }
});
const url='https://example.org/scoreboard';
const event={event_id:'espn:hockey/nhl:game-123',sport:'NHL',league:'hockey/nhl',
 start_utc:'2026-10-16T00:00:00Z',source_url:url,
 source_observed_at:'2026-10-13T00:00:00Z',
 home:{id:'home',name:'Home'},away:{id:'away',name:'Away'}};
const prior={...event,event_id:'espn:hockey/nhl:prior',
 start_utc:'2026-10-10T00:00:00Z',source_url:url,verified_at_utc:'2026-10-11T00:00:00Z',
 verification_status:'THIRD_PARTY_UNCONFIRMED',home_points:2,away_points:1};
const model={model_id:'baseline-v1',home_win_probability:0.8,away_win_probability:0.2,draw_probability:0,
 home_projected_points:3,away_projected_points:2,
 input_source_urls:[url],input_history:[prior],data_snapshot_sha256:hash([prior]),
 market_reference:null,admission_status:'RESEARCH_NOT_OFFICIAL',score_unit:'points'};
const forecast=sealResearchForecast(event,model,'2026-10-15T01:00:00Z');
const actual={...event,home_points:2,away_points:1,
 verified_at_utc:'2026-10-16T03:00:00Z',verification_status:'THIRD_PARTY_UNCONFIRMED'};
const grade=gradeUnofficial(forecast,actual);
test('sports scoreboard preserves uncertainty even with a perfectly predicted single winner',()=>{
 const s=summarizeLedger([forecast],[grade]);
 assert.equal(s.preliminary_graded,1);
 assert.equal(s.mean_winner_accuracy,1);
 assert.ok(s.winner_accuracy_interval_95.lower<0.21);
 assert.equal(s.winner_accuracy_interval_95.upper,1);
 assert.equal(s.by_sport[0].winner_accuracy_interval_95.lower,s.winner_accuracy_interval_95.lower);
 assert.ok(s.by_sport[0].reference_brier_mean>0);
 assert.ok(Number.isFinite(s.by_sport[0].brier_skill_vs_reference));
 assert.match(renderMarkdown(s),/95% descriptive Wilson winner-accuracy interval/);
 assert.match(renderMarkdown(s),/correlations may widen uncertainty/);
});
test('never fabricate intervals or calibration from zero grades',()=>{
 const s=summarizeLedger([forecast],[]);
 assert.equal(s.winner_accuracy_interval_95,null);
 assert.equal(s.by_sport[0].winner_accuracy_interval_95,null);
 assert.equal(s.by_sport[0].brier_skill_vs_reference,null);
});
