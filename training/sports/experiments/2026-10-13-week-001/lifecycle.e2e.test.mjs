import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {extractScoreboard} from './core.mjs';
import {evaluate,writeOutput,buildRequests} from './worker.mjs';
import {checkPublication} from './publish-check.mjs';
import {summarizeLedger} from './scoreboard.mjs';

const league='football/nfl';
const source='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20261015';
const stamp1='2026-10-13T16:00:00Z',stamp2='2026-10-16T04:00:00Z';
const completed=(id,h,a,hs,as,start,status='STATUS_FINAL')=>({
 id,date:start,status:{type:{completed:status==='STATUS_FINAL',name:status}},
 competitions:[{competitors:[
  {homeAway:'home',team:{id:h,displayName:h},score:String(hs)},
  {homeAway:'away',team:{id:a,displayName:a},score:String(as)}
 ]}]
});
const history=[
 completed('1','h','x',20,10,'2026-10-11T12:00:00Z'),
 completed('2','h','y',22,12,'2026-10-11T12:00:00Z'),
 completed('3','a','x',20,21,'2026-10-11T12:00:00Z'),
 completed('4','a','y',25,10,'2026-10-11T12:00:00Z'),
 completed('5','x','y',10,9,'2026-10-11T12:00:00Z'),
 completed('6','x','z',16,17,'2026-10-11T12:00:00Z'),
 completed('7','z','y',21,14,'2026-10-11T12:00:00Z'),
 completed('8','z','x',21,20,'2026-10-11T12:00:00Z')
];
const scheduled=completed('future-realistic','h','a',0,0,'2026-10-15T18:00:00Z','STATUS_SCHEDULED');
const manifestReport=()=>({schema_version:'jhadina.sports.week001_run.v2',placed_bets:0,virtual_bankroll_usd:3100,training_updates:0});
test('two-run paper lifecycle: scheduled -> forecast -> final -> preliminary grade -> idempotent restart',async()=>{
 const first=extractScoreboard(league,{events:[...history,scheduled]},stamp1,source);
 assert.equal(first.finals.length,8);
 const stage1=evaluate({...first,fetched:1,requested:1},[],stamp1);
 assert.equal(stage1.proposed.length,1);
 assert.equal(stage1.preliminary.length,0);
 const forecast=stage1.proposed[0];
 assert.ok(Date.parse(forecast.sealed_at_utc)<Date.parse(forecast.start_utc));
 const root=await mkdtemp(join(tmpdir(),'jhadina-lifecycle-'));
 try{
  await writeOutput({...stage1,report:manifestReport()},'100-1',root);
  const snap1=JSON.parse(await readFile(join(root,'publication.json'),'utf8'));
  assert.equal(checkPublication(snap1).forecasts,1);
  assert.ok(buildRequests('2026-10-19T00:00:00Z',[forecast]).some(r=>r.url===forecast.fixture_source_url));
  // Controlled mock provider response after event completed. This is a synthetic
  // regression fixture, not a real-world result or production ledger entry.
  const posted=completed('future-realistic','h','a',23,20,'2026-10-15T18:00:00Z');
  const second=extractScoreboard(league,{events:[posted]},stamp2,source);
  assert.equal(second.finals.length,1);
  const stage2=evaluate({...second,fetched:1,requested:1},[forecast],stamp2);
  assert.equal(stage2.proposed.length,0);
  assert.equal(stage2.preliminary.length,1);
  await writeOutput({...stage2,report:manifestReport()},'101-1',root);
  const snap2=JSON.parse(await readFile(join(root,'publication.json'),'utf8'));
  assert.equal(checkPublication(snap2).preliminary,1);
  const grade=stage2.preliminary[0];
  assert.equal(grade.eligible_for_training,false);
  assert.equal(grade.status,'PRELIMINARY_UNOFFICIAL_NOT_SETTLED');
  const score=summarizeLedger([forecast],[grade]);
  assert.equal(score.total_forecasts,1);
  assert.equal(score.preliminary_graded,1);
  assert.equal(score.real_bets,0);
  assert.ok(score.mean_multiclass_brier!==null);
  const replay=evaluate({...second,fetched:1,requested:1},[forecast],stamp2,[grade]);
  assert.equal(replay.preliminary.length,0);
  assert.equal(replay.proposed.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
