import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,sealResearchForecast,gradeUnofficial} from './core.mjs';
import {summarizeLedger} from './scoreboard.mjs';

const source='https://example.org/match-observations';
const history={event_id:'espn:tennis/atp:older',league:'tennis/atp',sport:'Tennis',
 start_utc:'2026-10-10T12:00:00Z',verified_at_utc:'2026-10-11T00:00:00Z',
 verification_status:'THIRD_PARTY_UNCONFIRMED',source_url:source,
 home:{id:'a',name:'Player A'},away:{id:'b',name:'Player B'},
 home_points:1,away_points:0,score_unit:'match_win_indicator'};
const fixture={event_id:'espn:tennis/atp:new-match',league:'tennis/atp',sport:'Tennis',
 start_utc:'2026-10-14T20:00:00Z',source_url:source,
 source_observed_at:'2026-10-13T17:00:00Z',source_class:'THIRD_PARTY_UNCONFIRMED',
 home:{id:'a',name:'Player A'},away:{id:'b',name:'Player B'}};
const model={model_id:'baseline-v1',home_win_probability:0.62,away_win_probability:0.38,draw_probability:0,
 home_projected_points:0.62,away_projected_points:0.38,input_source_urls:[source],
 input_history:[history],data_snapshot_sha256:hash([history]),market_reference:null,
 score_unit:'match_win_indicator',admission_status:'RESEARCH_NOT_OFFICIAL'};
const forecast=sealResearchForecast(fixture,model,'2026-10-13T18:00:00Z');
const final={...fixture,source_url:source,home_points:1,away_points:0,score_unit:'match_win_indicator',
 verified_at_utc:'2026-10-14T23:00:00Z',verification_status:'THIRD_PARTY_UNCONFIRMED'};
const grade=gradeUnofficial(forecast,final);

test('tennis and UFC final winners can be researched without inventing score errors',()=>{
 assert.equal(grade.outcome,'HOME');
 assert.equal(grade.home_points_absolute_error,null);
 assert.equal(grade.away_points_absolute_error,null);
 assert.equal(grade.eligible_for_training,false);
 assert.equal(grade.real_bet,false);
});

test('non-point results contribute to probability scoring, not point-error means',()=>{
 const s=summarizeLedger([forecast],[grade]);
 assert.equal(s.total_forecasts,1);
 assert.equal(s.preliminary_graded,1);
 assert.equal(s.mean_home_score_error,null);
 assert.equal(s.mean_away_score_error,null);
 assert.ok(s.mean_multiclass_brier!==null);
});

test('rehashed false point-error figure cannot enter non-point scoreboard',()=>{
 const {sha256,...payload}=grade;
 const poisoned={...payload,home_points_absolute_error:0};
 assert.throws(()=>summarizeLedger([forecast],[{...poisoned,sha256:hash(poisoned)}]),/SCOREBOARD_INCOHERENT_GRADE/);
});
