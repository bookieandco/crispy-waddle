import test from 'node:test';import assert from 'node:assert/strict';
import {MARKET_CATEGORIES,validateQuote} from './markets.mjs';
const fixture={event_id:'fixture-1',start_utc:'2026-10-16T00:00:00Z'};
const q={event_id:'fixture-1',market:'winner',provider:'TEST_PROVIDER',decimal_odds:1.85,source_url:'https://example.org/market',observed_at_utc:'2026-10-15T22:00:00Z'};
const rights={provider:'TEST_PROVIDER',analysis_permitted:true,evidence_url:'https://example.org/rights'};
test('six markets enumerated',()=>assert.equal(MARKET_CATEGORIES.length,6));
test('permitted sourced quote validates',()=>assert.equal(validateQuote(q,fixture,rights,'2026-10-15T23:00:00Z').research_only,true));
test('no rights => no quote',()=>assert.throws(()=>validateQuote(q,fixture,{},'2026-10-15T23:00:00Z'),/DATA_RIGHTS_UNCONFIRMED/));
test('poststart odds rejected',()=>assert.throws(()=>validateQuote({...q,observed_at_utc:'2026-10-16T00:01:00Z'},fixture,rights,'2026-10-16T00:02:00Z'),/QUOTE_NOT_PRE_EVENT/));
test('spread line mandatory',()=>assert.throws(()=>validateQuote({...q,market:'spread'},fixture,rights,'2026-10-15T23:00:00Z'),/MARKET_LINE_REQUIRED/));
test('props require athlete',()=>assert.throws(()=>validateQuote({...q,market:'player_props',line:1.5},fixture,rights,'2026-10-15T23:00:00Z'),/PLAYER_ID_REQUIRED/));
test('period market requires valid period',()=>assert.throws(()=>validateQuote({...q,market:'period_props',line:1.5},fixture,rights,'2026-10-15T23:00:00Z'),/PERIOD_REQUIRED/));
test('scorer market requires ID',()=>assert.throws(()=>validateQuote({...q,market:'touchdowns_or_scorers'},fixture,rights,'2026-10-15T23:00:00Z'),/SCORER_REQUIRED/));

test('tennis and UFC result indicators cannot masquerade as game spread or total',async()=>{
 const {hash,sealResearchForecast}=await import('./core.mjs');
 const {marketCoverage}=await import('./markets.mjs');
 for(const [league,sport] of [['tennis/atp','Tennis'],['mma/ufc','UFC']]){
  const past={event_id:'espn:'+league+':past',league,sport,start_utc:'2026-10-11T10:00:00Z',
   verified_at_utc:'2026-10-11T12:00:00Z',verification_status:'THIRD_PARTY_UNCONFIRMED',
   home:{id:'a',name:'a'},away:{id:'b',name:'b'},home_points:1,away_points:0,source_url:'https://example.org/previous'};
  const event={event_id:'espn:'+league+':future',sport,league,start_utc:'2026-10-16T10:00:00Z',
   home:{id:'a',name:'a'},away:{id:'b',name:'b'},source_url:'https://example.org/schedule',source_observed_at:'2026-10-13T10:00:00Z'};
  const predicted={model_id:'baseline-v1',home_win_probability:0.6,draw_probability:0,away_win_probability:0.4,
   home_projected_points:0.65,away_projected_points:0.35,input_source_urls:[past.source_url],
   input_history:[past],data_snapshot_sha256:hash([past]),market_reference:null,
   score_unit:'match_win_indicator',admission_status:'RESEARCH_NOT_OFFICIAL'};
  const forecast=sealResearchForecast(event,predicted,'2026-10-13T12:00:00Z');
  const coverage=marketCoverage(forecast);
  assert.equal(coverage.find(x=>x.market==='spread').status,'NOT_APPLICABLE_MATCH_WIN_INDICATOR');
  assert.equal(coverage.find(x=>x.market==='game_total').can_compare_market,false);
  assert.equal(coverage.find(x=>x.market==='winner').status,'UNCALIBRATED_RESEARCH_PROBABILITY');
 }
});
