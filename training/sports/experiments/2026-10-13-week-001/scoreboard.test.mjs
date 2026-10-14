import test from 'node:test';
import assert from 'node:assert/strict';
import {extractScoreboard,calculateBaseline,sealResearchForecast,gradeUnofficial} from './core.mjs';
import {summarizeLedger,renderMarkdown} from './scoreboard.mjs';
const now='2026-10-13T17:00:00Z',url='https://example.org/scoreboard';
const raw=(id,h,a,hs,as,date='2026-10-12T00:00:00Z')=>({id,date,status:{type:{completed:true,name:'STATUS_FINAL'}},competitions:[{competitors:[{homeAway:'home',team:{id:h,displayName:h},score:String(hs)},{homeAway:'away',team:{id:a,displayName:a},score:String(as)}]}]});
const events=[raw('1','a','x',10,7),raw('2','b','y',9,7),raw('3','a','z',11,4),raw('4','b','q',14,9),raw('5','x','y',8,6),raw('6','y','z',7,5),raw('7','q','x',11,9),raw('8','z','q',12,9)];
const hist=extractScoreboard('football/nfl',{events},now,url).finals;
const future={event_id:'espn:football/nfl:future',sport:'NFL',league:'football/nfl',start_utc:'2026-10-15T00:00:00Z',home:{id:'a',name:'a'},away:{id:'b',name:'b'},source_url:url,source_observed_at:now,source_class:'THIRD_PARTY_UNCONFIRMED'};
const model=calculateBaseline(future,hist,now);
const forecast=sealResearchForecast(future,model.forecast,now);
const final=(h,a,when='2026-10-16T00:00:00Z')=>({...future,home_points:h,away_points:a,verified_at_utc:when,verification_status:'THIRD_PARTY_UNCONFIRMED'});
const grade=gradeUnofficial(forecast,final(10,7));
test('scoreboard with no grades preserves 3100 unspent and null ROI',()=>{const s=summarizeLedger([forecast],[]);assert.equal(s.total_forecasts,1);assert.equal(s.preliminary_graded,0);assert.equal(s.mean_multiclass_brier,null);assert.equal(s.roi,null);assert.equal(s.staked_usd,0)});
test('scoreboard grades valid early observations only',()=>{const s=summarizeLedger([forecast],[grade]);assert.equal(s.preliminary_graded,1);assert.equal(s.conflicting_results.length,0);assert.equal(s.by_sport[0].sport,'NFL');assert.ok(s.mean_multiclass_brier>=0);assert.ok(s.mean_multiclass_brier<=2)});
test('tampered grading receipt cannot enter scoreboard',()=>assert.throws(()=>summarizeLedger([forecast],[{...grade,multiclass_brier_score:1.99}]),/SCOREBOARD_INVALID_GRADE/));
test('two conflicting outcome receipts quarantined',()=>{const revised=gradeUnofficial(forecast,final(1,17,'2026-10-16T01:00:00Z'));const s=summarizeLedger([forecast],[grade,revised]);assert.equal(s.preliminary_graded,0);assert.equal(s.conflicting_results.length,1)});
test('same original forecast does not double count',()=>{const s=summarizeLedger([forecast,forecast],[grade,grade]);assert.equal(s.total_forecasts,1);assert.equal(s.preliminary_graded,1)});
test('markdown is phone-readable and explicit about missing official data',()=>{const m=renderMarkdown(summarizeLedger([forecast],[grade]));assert.match(m,/No verified betting market prices/);assert.match(m,/3,100/);assert.match(m,/NFL/)});
test('orphan grade rejected without forecast',()=>assert.throws(()=>summarizeLedger([],[grade]),/SCOREBOARD_INVALID_GRADE/));

test('grade cannot claim opposite winner even with recomputed SHA',async()=>{
 const {hash}=await import('./core.mjs');
 const {sha256:discard,...data}=grade;
 const forged={...data,outcome:data.outcome==='HOME'?'AWAY':'HOME'};
 const bad={...forged,sha256:hash(forged)};
 assert.throws(()=>summarizeLedger([forecast],[bad]),/SCOREBOARD_INCOHERENT_GRADE/);
});
test('grade cannot forge Brier score even with recomputed SHA',async()=>{
 const {hash}=await import('./core.mjs');
 const {sha256:discard,...data}=grade;
 const forged={...data,multiclass_brier_score:0.001};
 const bad={...forged,sha256:hash(forged)};
 assert.throws(()=>summarizeLedger([forecast],[bad]),/SCOREBOARD_INCOHERENT_GRADE/);
});
test('grade cannot forge projected score error even with recomputed SHA',async()=>{
 const {hash}=await import('./core.mjs');
 const {sha256:discard,...data}=grade;
 const forged={...data,home_points_absolute_error:99999};
 const bad={...forged,sha256:hash(forged)};
 assert.throws(()=>summarizeLedger([forecast],[bad]),/SCOREBOARD_INCOHERENT_GRADE/);
});

test('upcoming sealed predictions are shown with evidence links and non-market estimates',()=>{
 const summary=summarizeLedger([forecast],[]);
 assert.ok(summary.upcoming_previews.length>=1);
 const markdown=renderMarkdown(summary);
 assert.match(markdown,/Upcoming paper predictions/);
 assert.match(markdown,/forecast[s]?\/espn_football_nfl_future\.json/);
 assert.match(markdown,/uncalibrated research estimate/);
});
test('rechecking a publication with its permanent markdown report is safe',()=>{
 const report={schema_version:'jhadina.sports.week001_run.v2',placed_bets:0,virtual_bankroll_usd:3100,training_updates:0,run_id:'123-1'};
 const summaryFile={path:'training/sports/paper-ledger/week001/summaries/123-1.md',
  content:'## Jhadina Sports Lab — Week 001\nReal bets: **0**\nNo verified betting market prices or official settlement.'};
 const pub={schema_version:'sports.publication.v1',files:[
  {path:'training/sports/paper-ledger/week001/runs/123-1.json',content:JSON.stringify(report)},summaryFile
 ]};
 const summary=summarizeLedger([forecast],[],pub);
 assert.equal(summary.total_forecasts,1);
});

test('ungraded started events appear as a separate source-linked table without invented score',()=>{
 const summary=summarizeLedger([forecast],[],undefined,Date.parse('2026-10-16T00:00:00Z'));
 assert.equal(summary.awaiting_final_count,1);
 assert.equal(summary.awaiting_final_previews.length,1);
 assert.equal(summary.awaiting_final_previews[0].status,'NO_PRELIMINARY_GRADE_YET');
 assert.equal(summary.awaiting_final_previews[0].hours_since_kickoff,24);
 const md=renderMarkdown(summary);
 assert.match(md,/Started events awaiting provisional result evidence/);
 assert.match(md,/forecast[s]?\/espn_football_nfl_future\.json/);
 assert.match(md,/\| 2026-10-15T00:00 \| NFL \|/);
 assert.match(md,/This does not establish that a game has finished/);
});
test('published provisional grade removes event from awaiting results',()=>{
 const summary=summarizeLedger([forecast],[grade],undefined,Date.parse('2026-10-16T00:00:00Z'));
 assert.equal(summary.awaiting_final_count,0);
 assert.equal(summary.awaiting_final_previews.length,0);
 assert.equal(summary.preliminary_graded,1);
});
