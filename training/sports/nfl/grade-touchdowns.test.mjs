import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeArchivedTouchdownProps as grade} from './grade-touchdowns.mjs';
const board=JSON.parse(readFileSync(new URL('./2026/2026-10-12-buf-at-lar/props.touchdown-odds-001.json',import.meta.url),'utf8'));
const source='https://www.nfl.com/games/synthetic-test-fixture';
const sample={
 schema_version:'jhadina.sports.td_outcomes.official.v1',
 case_id:board.case_id,event_id:board.event_id,status:'FINAL',
 source_url:source,official_source_reviewed:true,
 kickoff_utc:'2026-10-13T00:15:00Z',
 verified_at_utc:'2026-10-13T05:30:00Z',
 first_touchdown_scorer:{
  official_play_by_play_reviewed:true,
  play_by_play_url:source,available_at_utc:'2026-10-13T05:15:00Z',
  scorer_team:'BUF',scorer_player:'Josh Allen'
 },
 player_outcomes:[
  {team:'BUF',player:'Josh Allen',played:true,touchdowns_scored:1},
  {team:'LAR',player:'Puka Nacua',played:true,touchdowns_scored:0},
  {team:'LAR',player:'Matthew Stafford',played:true,touchdowns_scored:0},
  {team:'BUF',player:'DJ Moore',played:false,touchdowns_scored:null}
 ]
};
const market=(result,player,type)=>result.rows.find(r=>r.player===player&&r.market===type);
test('32 binary props stay separate from numeric over/under props',()=>{
 const r=grade(board,sample);
 assert.equal(r.total_markets,32);
 assert.equal(r.canTrainAutomatically,false);
 assert.equal(r.canExecute,false);
 assert.equal(r.no_risk_or_wager_recommendation,true);
});
test('first touchdown and anytime scorer use different official events',()=>{
 const r=grade(board,sample);
 assert.equal(market(r,'Josh Allen','FIRST_TOUCHDOWN_SCORER').official_result,'YES_OCCURRED');
 assert.equal(market(r,'Puka Nacua','FIRST_TOUCHDOWN_SCORER').official_result,'NO_OCCURRED');
 assert.equal(market(r,'Puka Nacua','ANYTIME_TOUCHDOWN_SCORER').official_result,'NO_OCCURRED');
 assert.equal(market(r,'Matthew Stafford','ANYTIME_TOUCHDOWN_SCORER').official_result,'NO_OCCURRED');
});
test('inactive player has unresolved settlement, not automatic no',()=>{
 const r=grade(board,sample);
 assert.equal(market(r,'DJ Moore','FIRST_TOUCHDOWN_SCORER').official_result,'DNP_SETTLEMENT_RULE_REQUIRED');
 assert.equal(market(r,'DJ Moore','ANYTIME_TOUCHDOWN_SCORER').official_result,'DNP_SETTLEMENT_RULE_REQUIRED');
 assert.equal(market(r,'DJ Moore','ANYTIME_TOUCHDOWN_SCORER').wager_settlement_certified,false);
});
test('passing TDs thrown do not automatically imply an anytime touchdown scorer result',()=>{
 const unknown=grade(board,{...sample,player_outcomes:sample.player_outcomes.filter(x=>x.player!=='Matthew Stafford')});
 assert.equal(market(unknown,'Matthew Stafford','ANYTIME_TOUCHDOWN_SCORER').official_result,'OFFICIAL_STAT_MISSING');
});
test('rejects unclear or premature first-scorer play-by-play',()=>{
 assert.throws(()=>grade(board,{...sample,first_touchdown_scorer:{...sample.first_touchdown_scorer,scorer_player:null}}),/TD_FIRST_SCORER_IDENTITY_INVALID/);
 assert.throws(()=>grade(board,{...sample,first_touchdown_scorer:{...sample.first_touchdown_scorer,available_at_utc:'2026-10-13T00:00:00Z'}}),/TD_FIRST_SCORER_EVIDENCE_INVALID/);
});
test('rejects invalid status, player stats, and repeated player records',()=>{
 assert.throws(()=>grade(board,{...sample,status:'LIVE'}),/TD_OFFICIAL_RESULT_REQUIRED/);
 assert.throws(()=>grade(board,{...sample,event_id:'different'}),/TD_EVENT_MISMATCH/);
 assert.throws(()=>grade(board,{...sample,player_outcomes:[sample.player_outcomes[0],sample.player_outcomes[0]]}),/TD_DUPLICATE_PLAYER/);
 assert.throws(()=>grade(board,{...sample,player_outcomes:[{team:'LAR',player:'Puka Nacua',played:false,touchdowns_scored:0}]}),/TD_DNP_STATS_CONFLICT/);
});
