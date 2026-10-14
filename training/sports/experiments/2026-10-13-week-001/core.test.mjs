import test from 'node:test';
import assert from 'node:assert/strict';
import {extractScoreboard,calculateBaseline,sealResearchForecast,verifyResearchForecast,gradeUnofficial,safeId} from './core.mjs';
const time='2026-10-13T17:00:00Z';
const url='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20261012';
const raw=(id,home,away,h,a,date='2026-10-10T12:00:00Z',final=true)=>({id,date,status:{type:{completed:final,name:final?'STATUS_FINAL':'STATUS_SCHEDULED'}},competitions:[{competitors:[{homeAway:'home',team:{id:home,displayName:home},score:String(h)},{homeAway:'away',team:{id:away,displayName:away},score:String(a)}]}]});
const events=[raw('1','a','x',20,10),raw('2','b','y',14,10),raw('3','a','z',27,14),raw('4','b','q',24,21),raw('5','x','z',17,13),raw('6','y','q',21,20),raw('7','x','y',27,27),raw('8','q','z',13,10)];
const result=extractScoreboard('football/nfl',{events},time,url);
const planned=extractScoreboard('football/nfl',{events:[raw('future','a','b',0,0,'2026-10-15T18:00:00Z',false)]},time,url).fixtures[0];
const baseline=calculateBaseline(planned,result.finals,time);
test('fixture extraction preserves traceability',()=>{assert.equal(result.fixtures.length,8);assert.equal(result.finals.length,8);assert.equal(result.fixtures[0].source_class,'THIRD_PARTY_UNCONFIRMED')});
test('reject missing provider fields',()=>assert.throws(()=>extractScoreboard('football/nfl',{},time,url),/INVALID_PROVIDER_DATA/));
test('do not misclassify scheduled event as final',()=>{const s=extractScoreboard('football/nfl',{events:[raw('future','a','b',0,0,'2026-10-15T18:00:00Z',false)]},time,url);assert.equal(s.finals.length,0)});
test('research baseline from observations, not made-up odds',()=>{assert.equal(baseline.status,'READY_RESEARCH_ONLY');assert.equal(baseline.forecast.market_reference,null);assert.equal(baseline.forecast.model_id,'baseline-v1');assert.ok(baseline.forecast.home_win_probability>0)});
test('reject poststart forecast',()=>assert.equal(calculateBaseline(planned,result.finals,'2026-10-16T00:00:00Z').status,'ABSTAIN'));
test('no history => abstain',()=>assert.equal(calculateBaseline(planned,[],time).reason,'INSUFFICIENT_PRE_EVENT_HISTORY'));
test('future observed final cannot leak',()=>{const h=result.finals.map(x=>({...x,verified_at_utc:'2026-10-14T00:00:00Z'}));assert.equal(calculateBaseline(planned,h,time).status,'ABSTAIN')});
test('sealed paper-only receipt',()=>{const f=sealResearchForecast(planned,baseline.forecast,time);assert.ok(verifyResearchForecast(f));assert.equal(f.stake_usd,0)});
test('tampering rejected',()=>{const f=sealResearchForecast(planned,baseline.forecast,time);assert.throws(()=>verifyResearchForecast({...f,home_win_probability:.999}),/RECEIPT_INVALID/)});
test('provisional result is not settlement',()=>{const f=sealResearchForecast(planned,baseline.forecast,time);const final={...planned,home_points:17,away_points:21,verified_at_utc:'2026-10-16T00:00:00Z',verification_status:'THIRD_PARTY_UNCONFIRMED'};const g=gradeUnofficial(f,final);assert.equal(g.status,'PRELIMINARY_UNOFFICIAL_NOT_SETTLED');assert.equal(g.eligible_for_training,false)});
test('unconfirmed nonfinal rejected',()=>{const f=sealResearchForecast(planned,baseline.forecast,time);assert.throws(()=>gradeUnofficial(f,{...planned,home_points:12,away_points:11,verified_at_utc:'2026-10-16T00:00:00Z'}),/UNVERIFIED_RESULT/)});
test('event ID sanitized',()=>{assert.equal(safeId('espn:football/nfl:456'),'espn_football_nfl_456');assert.throws(()=>safeId('evil/../../etc'),/EVENT_ID_INVALID/)});
test('tennis participants without homeAway accepted',()=>{const ev={id:'t1',date:'2026-10-14T12:00:00Z',status:{type:{completed:false}},competitions:[{competitors:[{athlete:{id:'p',displayName:'Player P'}},{athlete:{id:'q',displayName:'Player Q'}}]}]};const r=extractScoreboard('tennis/atp',{events:[ev]},time,'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard');assert.equal(r.fixtures[0].home.name,'Player P')});
test('receipt embeds auditable historical observations',()=>{const f=sealResearchForecast(planned,baseline.forecast,time);assert.ok(Array.isArray(f.input_history));assert.ok(f.input_history.length>=2);assert.throws(()=>verifyResearchForecast({...f,input_history:[]}),/RECEIPT_INVALID/)});

test('grouped tennis event expands match with its own timestamp',()=>{
 const competition={id:'match-909',date:'2026-10-16T17:00:00Z',status:{type:{completed:false,name:'STATUS_SCHEDULED'}},
   competitors:[{athlete:{id:'p1',displayName:'One'}},{athlete:{id:'p2',displayName:'Two'}}]};
 const tournament={id:'cup-2026',date:'2026-10-12T01:00:00Z',groupings:[{competitions:[competition]}]};
 const out=extractScoreboard('tennis/atp',{events:[tournament]},time,'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=20261016');
 assert.equal(out.fixtures.length,1);assert.equal(out.fixtures[0].event_id,'espn:tennis/atp:match-909');
 assert.equal(out.fixtures[0].start_utc,competition.date);
});
test('tournament alone never becomes a fabricated match',()=>{
 const out=extractScoreboard('tennis/atp',{events:[{id:'cup',date:'2026-10-13T00:00:00Z',groupings:[]}]},time,'https://example.org/tennis');
 assert.equal(out.fixtures.length,0);assert.equal(out.errors[0].error,'TOURNAMENT_WITHOUT_TIMESTAMPED_MATCHES');
});

test('tennis completed match uses verified winner flags, not nonexistent score',()=>{
 const c={id:'match-910',date:'2026-10-10T17:00:00Z',status:{type:{completed:true,name:'STATUS_FINAL'}},
   competitors:[{homeAway:'home',athlete:{id:'p1',displayName:'One'},winner:true},
                {homeAway:'away',athlete:{id:'p2',displayName:'Two'},winner:false}]};
 const r=extractScoreboard('tennis/atp',{events:[{id:'tournament-1',groupings:[{competitions:[c]}]}]},time,'https://example.org/tennis');
 assert.equal(r.finals.length,1);assert.equal(r.finals[0].home_points,1);
 assert.equal(r.finals[0].away_points,0);assert.equal(r.finals[0].score_unit,'match_win_indicator');
});
test('ambiguous completed match does not invent outcome',()=>{
 const c={id:'match-911',date:'2026-10-10T17:00:00Z',status:{type:{completed:true,name:'STATUS_FINAL'}},
   competitors:[{athlete:{id:'p1',displayName:'One'},winner:false},{athlete:{id:'p2',displayName:'Two'},winner:false}]};
 const r=extractScoreboard('tennis/atp',{events:[{id:'tournament-1',groupings:[{competitions:[c]}]}]},time,'https://example.org/tennis');
 assert.equal(r.finals.length,0);assert.equal(r.errors[0].error,'MATCH_WINNER_NOT_VERIFIED');
});

test('soccer full-time completed result is a historical final',()=>{
 const e={id:'fixture-s1',date:'2026-10-10T18:00:00Z',status:{type:{completed:true,name:'STATUS_FULL_TIME'}},
  competitions:[{competitors:[{homeAway:'home',team:{id:'a',displayName:'A'},score:'2'},
                             {homeAway:'away',team:{id:'b',displayName:'B'},score:'1'}]}]};
 const r=extractScoreboard('soccer/eng.1',{events:[e]},time,'https://example.org/football');
 assert.equal(r.finals.length,1);assert.equal(r.finals[0].home_points,2);
});
test('soccer live match cannot be admitted as completed',()=>{
 const e={id:'fixture-s2',date:'2026-10-10T18:00:00Z',status:{type:{completed:false,name:'STATUS_FULL_TIME'}},
  competitions:[{competitors:[{homeAway:'home',team:{id:'a',displayName:'A'},score:'2'},
                             {homeAway:'away',team:{id:'b',displayName:'B'},score:'1'}]}]};
 const r=extractScoreboard('soccer/eng.1',{events:[e]},time,'https://example.org/football');
 assert.equal(r.finals.length,0);
});

test('historical final rejects null or blank scores instead of coercing to zero',()=>{
 for(const malformed of [null,'', '   ',undefined]){
  const event=raw('missing-result','a','b',1,2);
  event.competitions[0].competitors[0].score=malformed;
  const parsed=extractScoreboard('football/nfl',{events:[event]},time,url);
  assert.equal(parsed.finals.length,0);
  assert.equal(parsed.errors[0].error,'INVALID_FINAL_SCORE');
 }
});
test('explicit recorded 0–0 remains valid completed final',()=>{
 const event=raw('recorded-zero','a','b',0,0);
 const parsed=extractScoreboard('football/nfl',{events:[event]},time,url);
 assert.equal(parsed.finals.length,1);
 assert.equal(parsed.finals[0].home_points,0);
 assert.equal(parsed.finals[0].away_points,0);
});
