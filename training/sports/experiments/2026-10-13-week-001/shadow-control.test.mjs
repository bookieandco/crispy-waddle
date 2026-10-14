import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,sealResearchForecast,gradeUnofficial} from './core.mjs';
import {computeShadowControl,scoreProspectiveControl,summarizeProspectiveControl,
  ELIGIBLE_SEAL_START_UTC,CONTROL_ID} from './shadow-control.mjs';
import {summarizeLedger,renderMarkdown} from './scoreboard.mjs';

const url='https://example.org/feed';
const source={event_id:'espn:football/nfl:source-1',sport:'NFL',league:'football/nfl',
 start_utc:'2026-10-12T00:00:00Z',verified_at_utc:'2026-10-13T00:00:00Z',
 verification_status:'THIRD_PARTY_UNCONFIRMED',source_url:url,
 home:{id:'a',name:'A'},away:{id:'b',name:'B'},home_points:24,away_points:20};
const scheduled={event_id:'espn:football/nfl:new-event',sport:'NFL',league:'football/nfl',
 start_utc:'2026-10-16T00:00:00Z',source_url:url,
 source_observed_at:'2026-10-13T12:00:00Z',
 home:{id:'a',name:'A'},away:{id:'b',name:'B'}};
const model={model_id:'baseline-v1',home_win_probability:0.8,
 away_win_probability:0.2,draw_probability:0,
 home_projected_points:25,away_projected_points:18,
 input_source_urls:[url],input_history:[source],data_snapshot_sha256:hash([source]),
 market_reference:null,admission_status:'RESEARCH_NOT_OFFICIAL',score_unit:'points'};
const create=at=>sealResearchForecast(scheduled,model,at);
const f=create('2026-10-15T01:00:00Z');
const finalResult={...scheduled,home_points:24,away_points:21,
 verified_at_utc:'2026-10-16T06:00:00Z',verification_status:'THIRD_PARTY_UNCONFIRMED'};
const grade=gradeUnofficial(f,finalResult);

test('frozen control moves overconfident two-way estimates halfway toward 50-50',()=>{
 const s=computeShadowControl(f);
 assert.equal(s.control_id,CONTROL_ID);
 assert.ok(s.preregistered_seal_start_utc===ELIGIBLE_SEAL_START_UTC);
 assert.equal(s.home_probability,0.65);
 assert.equal(s.away_probability,0.35);
 assert.equal(s.draw_probability,0);
 assert.equal(s.paper_only,true);
 assert.equal(s.trained_on_results,false);
 assert.equal(s.real_stake,0);
});

test('control never scores an older forecast registered before the start',()=>{
 const old=create('2026-10-14T00:00:00Z');
 assert.equal(scoreProspectiveControl(old,'HOME'),null);
});

test('control uses the correct multiclass Brier and does not invent a market edge',()=>{
 const row=scoreProspectiveControl(f,'HOME');
 assert.equal(row.brier,0.245);
 const report=summarizeProspectiveControl([{control_brier:row.brier,original_brier:0.08}]);
 assert.equal(report.scored_eligible_events,1);
 assert.equal(report.champion_mean_brier,0.08);
 assert.equal(report.challenger_mean_brier,0.245);
 assert.equal(report.challenger_minus_champion_brier,0.165);
 assert.equal(report.claimed_edge,false);
 assert.equal(report.training_updates,0);
});

test('scoreboard pairs eligible sealed forecasts and real preliminary grades only',()=>{
 const s=summarizeLedger([f],[grade]);
 assert.equal(s.preliminary_graded,1);
 assert.equal(s.prospective_control.scored_eligible_events,1);
 assert.equal(s.prospective_control.champion_mean_brier,s.mean_multiclass_brier);
 assert.equal(s.prospective_control.challenger_mean_brier,0.245);
 assert.match(renderMarkdown(s),/Preregistered control eligible games: \*\*1\*\*/);
 assert.equal(s.real_bets,0);
});

test('no graded outcomes means no shadow model performance claims',()=>{
 const s=summarizeLedger([f],[]);
 assert.equal(s.prospective_control.scored_eligible_events,0);
 assert.equal(s.prospective_control.challenger_mean_brier,null);
 assert.equal(s.prospective_control.champion_mean_brier,null);
 assert.equal(s.prospective_control.claimed_edge,false);
});

test('unsealed or altered forecast is ineligible for the control',()=>{
 assert.throws(()=>computeShadowControl({...f,home_win_probability:0.99}),/RECEIPT_INVALID/);
});
