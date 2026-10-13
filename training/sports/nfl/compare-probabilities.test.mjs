import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareArchivedProbabilityBaseline as compare} from './compare-probabilities.mjs';

const root=new URL('./2026/2026-10-12-buf-at-lar/',import.meta.url);
const read=n=>JSON.parse(readFileSync(new URL(n,root),'utf8'));
const p=read('pregame.case.json');
const market=read('audit.market-benchmark-001.json');
const overlap=read('audit.source-overlap-001.json');
const outcome={schema_version:'jhadina.sports.study_case.final_input.v1',
 case_id:p.case_id,event_id:p.event_id,status:'FINAL',source_class:'OFFICIAL_FINAL',
 source_url:'https://www.nfl.com/games/example-test-fixture',
 verified_final_at_utc:'2026-10-13T04:15:00Z',final_home_points:31,final_away_points:27};

test('pre-final model baseline is not scored or misrepresented as independent',()=>{
 const r=compare(p,market,overlap);
 assert.equal(r.comparison_state,'AWAITING_FINAL');
 assert.equal(r.statistical_comparison,null);
 assert.equal(r.samples,0);
 assert.equal(r.exact_published_analyst_score_overlap,true);
 assert.equal(r.independently_produced_forecast_certified,false);
 assert.equal(r.reference_was_captured_after_kickoff,true);
 assert.equal(r.canTrainAutomatically,false);
 assert.ok(Math.abs(r.archived_baseline_probability-.61262071)<1e-6);
});

test('supplied hypothetical home win is scored against model and published baseline',()=>{
 const r=compare(p,market,overlap,outcome);
 assert.equal(r.comparison_state,'RESULT_SUPPLIED_REQUIRES_INDEPENDENT_VERIFICATION');
 assert.equal(r.statistical_comparison.original_brier,.16);
 assert.ok(r.statistical_comparison.baseline_brier<.16);
 assert.equal(r.final_score_candidate.home_points,31);
 assert.equal(r.calibrated,false);
});

test('supplied hypothetical away win changes relative scoring without future leakage',()=>{
 const r=compare(p,market,overlap,{...outcome,final_home_points:20,final_away_points:24});
 assert.equal(r.statistical_comparison.original_brier,.36);
 assert.ok(r.statistical_comparison.baseline_brier>.36);
});

test('rejects retroactive or mismatched archived market references',()=>{
 assert.throws(()=>compare(p,{...market,archived_at_utc:'2026-10-12T23:55:00Z'},overlap),/AS_OF_BOUNDARY_INVALID/);
 assert.throws(()=>compare(p,{...market,information_originally_published:'2026-10-13T01:00:00Z'},overlap),/AS_OF_BOUNDARY_INVALID/);
 assert.throws(()=>compare(p,{...market,event_id:'other'},overlap),/EVENT_ID_MISMATCH/);
 assert.throws(()=>compare(p,{...market,derived:{...market.derived,home_no_vig_probability:.7}},overlap),/ARCHIVED_CALCULATION_CONFLICT/);
});

test('rejects invented model independence and false overlap status',()=>{
 assert.throws(()=>compare(p,market,{...overlap,assessment:{...overlap.assessment,independence_certified:true}}),/UNSUPPORTED_INDEPENDENCE_CLAIM/);
 assert.throws(()=>compare(p,market,{...overlap,assessment:{...overlap.assessment,exact_score_match:false}}),/SOURCE_OVERLAP_CONFLICT/);
});

test('final evidence is not accepted from a provisional score or wrong event',()=>{
 assert.throws(()=>compare(p,market,overlap,{...outcome,status:'LIVE'}),/OFFICIAL_FINAL_EVIDENCE_REQUIRED/);
 assert.throws(()=>compare(p,market,overlap,{...outcome,event_id:'other'}),/CASE_EVENT_MISMATCH/);
});
