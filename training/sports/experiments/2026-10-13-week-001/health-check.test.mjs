import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateHealth} from './health-check.mjs';
const base={
 schema_version:'jhadina.sports.week001_run.v2',experiment_id:'JH-SPORTS-WEEK-2026-10-13-001',
 run_id:'123-1',placed_bets:0,training_updates:0,virtual_bankroll_usd:3100,
 official_settlements:0,market_quotes:0,research_forecasts_created:1,
 preliminary_grades_created:0,coherence_flags:[],
 diagnostics:{requested:10,fetched:10,overdue_12h_without_verification:0,final_visible_not_graded:0,conflicting_provider_events:0},
 provider_health:{'football/nfl':{requested:10,fetched:10,status:'FETCHED'}}
};
test('healthy paper run returns unqualified technical health only',()=>{
 const x=evaluateHealth(base);
 assert.equal(x.status,'RESEARCH_PIPELINE_HEALTHY');
 assert.equal(x.warnings.length,0);
 assert.equal(x.paper_only,true);
 assert.equal(x.real_bets,0);
 assert.match(x.caveat,/does not certify/);
});
test('zero wagers and no training updates are hard safety gates',()=>{
 for(const change of [{placed_bets:1},{training_updates:1},{virtual_bankroll_usd:3099},{official_settlements:1},{market_quotes:1}]){
  assert.throws(()=>evaluateHealth({...base,...change}),/PAPER_ONLY_SAFETY_VIOLATION/);
 }
});
test('insufficient feed coverage fails rather than claiming research health',()=>{
 assert.throws(()=>evaluateHealth({...base,diagnostics:{requested:10,fetched:5}}),/PROVIDER_COVERAGE_BELOW_MINIMUM/);
});
test('missing sport feed and overdue results produce actionable warnings',()=>{
 const report={...base,diagnostics:{requested:10,fetched:9,overdue_12h_without_verification:3},
   provider_health:{'football/nfl':{requested:5,fetched:5,status:'FETCHED'},'tennis/atp':{requested:5,fetched:0,status:'UNAVAILABLE'}}};
 const x=evaluateHealth(report);
 assert.equal(x.status,'DEGRADED');
 assert.ok(x.warnings.some(z=>z.code==='SPORT_FEED_UNAVAILABLE'&&z.league==='tennis/atp'));
 assert.ok(x.warnings.some(z=>z.code==='RESULTS_OVERDUE_12H'&&z.count===3));
 assert.equal(x.paper_only,true);
});
test('conflicting outcomes never pass silently',()=>{
 const x=evaluateHealth({...base,diagnostics:{requested:10,fetched:10,conflicting_provider_events:1}});
 assert.ok(x.warnings.some(z=>z.code==='PROVIDER_RESULT_CONFLICT'));
});

test('tournament entries excluded for missing participants are visible despite 100-percent HTTP success',()=>{
 const report={...base,provider_health:{
  'tennis/wta':{requested:8,fetched:8,fixtures:200,provider_errors:50,status:'FETCHED'},
  'football/nfl':{requested:2,fetched:2,fixtures:70,provider_errors:0,status:'FETCHED'}
 }};
 const health=evaluateHealth(report);
 assert.equal(health.status,'DEGRADED');
 assert.ok(health.warnings.some(x=>x.code==='SPORT_FEED_PARSE_EXCLUSIONS'&&
   x.league==='tennis/wta'&&x.exclusion_fraction===0.2));
 assert.equal(health.warnings.some(x=>x.code==='SPORT_FEED_PARSE_EXCLUSIONS'&&x.league==='football/nfl'),false);
 assert.equal(health.paper_only,true);
});
