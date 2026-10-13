import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeArchivedNflProps as grade} from './grade-props.mjs';
const board=JSON.parse(readFileSync(new URL('./2026/2026-10-12-buf-at-lar/props.archived-dk-splits-001.json',import.meta.url),'utf8'));
const evidence='https://www.nfl.com/games/synthetic-test-fixture';
const stat=(metric,period,value)=>({metric,period,value,evidence_url:evidence,available_at_utc:'2026-10-13T05:00:00Z'});
const sample={
 schema_version:'jhadina.sports.official_player_stats.v1',
 case_id:board.case_id,event_id:board.event_id,
 status:'FINAL',evidence_class:'OFFICIAL_RESULT_REVIEWED',source_url:evidence,
 source_verified_by_reviewer:true,
 kickoff_utc:'2026-10-13T00:15:00Z',verified_at_utc:'2026-10-13T05:30:00Z',
 players:[
  {team:'LAR',player:'Puka Nacua',played:true,statistics:[
   stat('receiving_yards','FULL',101),stat('receptions','FULL',8)
  ]},
  {team:'LAR',player:'Matthew Stafford',played:true,statistics:[
   stat('passing_yards','FULL',270),stat('rushing_yards','FULL',1)
  ]},
  {team:'BUF',player:'James Cook',played:true,statistics:[
   stat('rushing_yards','FULL',80),stat('receiving_yards','FULL',20)
  ]},
  {team:'BUF',player:'Dalton Kincaid',played:true,statistics:[stat('receptions','FULL',5)]},
  {team:'BUF',player:'Joshua Palmer',played:false,statistics:[]}
 ]
};
const find=(out,player,metric,period='FULL')=>out.rows.find(r=>r.player===player&&r.metric===metric&&r.period===period);
test('scores all 104 published thresholds without claiming prop picks',()=>{
 const out=grade(board,sample);
 assert.equal(out.count,104);
 assert.equal(out.original_prop_forecasts_present,false);
 assert.equal(out.canExecute,false);
 assert.equal(out.no_auto_training,true);
 assert.equal(out.summary.OFFICIAL_STAT_MISSING>0,true);
});
test('grades direct receiving and passing markets separately',()=>{
 const out=grade(board,sample);
 assert.equal(find(out,'Puka Nacua','receiving_yards').classification,'OVER_RESULT');
 assert.equal(find(out,'Matthew Stafford','passing_yards').classification,'UNDER_RESULT');
 assert.equal(find(out,'Dalton Kincaid','receptions').classification,'OVER_RESULT');
});
test('combination props are derived from same-period official component stats only',()=>{
 const out=grade(board,sample);
 const cook=find(out,'James Cook','rushing_plus_receiving_yards');
 assert.equal(cook.actual,100);
 assert.equal(cook.classification,'OVER_RESULT');
 assert.equal(cook.calculation,'SUM_OF_SAME_PERIOD_VERIFIED_COMPONENTS');
 const missing=find(out,'Puka Nacua','receiving_yards','Q1');
 assert.equal(missing.classification,'OFFICIAL_STAT_MISSING');
 assert.equal(missing.actual,null);
});
test('inactive player is not guessed as an under, and no market payout inferred',()=>{
 const out=grade(board,sample);
 const p=find(out,'Joshua Palmer','receptions');
 assert.equal(p.classification,'DNP_OR_INACTIVE_SETTLEMENT_REVIEW');
 assert.equal(p.model_prediction_correct,null);
 assert.equal(p.book_settlement_verified,false);
});
test('push is recognized and score is descriptive, not a wager outcome',()=>{
 const custom={...board,markets:[{...board.markets[0],threshold:270,metric:'passing_yards',player:'Matthew Stafford',team:'LAR',period:'FULL'}]};
 const out=grade(custom,sample);
 assert.equal(out.rows[0].classification,'PUSH_RESULT');
 assert.equal(out.rows[0].model_prediction_correct,null);
});
test('invalid stats, future evidence, and wrong event fail closed',()=>{
 assert.throws(()=>grade(board,{...sample,event_id:'other'}),/PROP_EVENT_MISMATCH/);
 assert.throws(()=>grade(board,{...sample,source_verified_by_reviewer:false}),/PROP_STATS_HUMAN_SOURCE_REVIEW_REQUIRED/);
 const wrong={...sample,players:[{...sample.players[0],statistics:[stat('receiving_yards','FULL',101),stat('receiving_yards','FULL',105)]}]};
 assert.throws(()=>grade(board,wrong),/PROP_DUPLICATE_STAT/);
 const future={...sample,players:[{...sample.players[0],statistics:[{...stat('receiving_yards','FULL',10),available_at_utc:'2026-10-13T08:00:00Z'}]}]};
 assert.throws(()=>grade(board,future),/PROP_STAT_TIME_INCONSISTENT/);
});
