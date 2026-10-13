import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildRequests,collect,evaluate,writeOutput,publications} from './worker.mjs';
import {extractScoreboard} from './core.mjs';
const now='2026-10-13T22:50:00Z';
const url='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20261013';
const game=(id,home,away,h,a,date,completed=true)=>({id,date,status:{type:{completed,name:completed?'STATUS_FINAL':'STATUS_SCHEDULED'}},competitions:[{competitors:[{homeAway:'home',team:{id:home,displayName:home},score:String(h)},{homeAway:'away',team:{id:away,displayName:away},score:String(a)}]}]});
const before='2026-10-10T17:00:00Z';
const raw=[game('1','a','x',20,10,before),game('2','b','y',14,10,before),game('3','a','z',27,14,before),game('4','b','q',24,21,before),game('5','x','z',17,13,before),game('6','y','q',21,20,before),game('7','x','y',27,27,before),game('8','q','z',13,10,before),game('future','a','b',0,0,'2026-10-15T18:00:00Z',false)];
const provider=extractScoreboard('football/nfl',{events:raw},now,url);
const gathered={fixtures:provider.fixtures,finals:provider.finals,errors:[],fetched:1,requested:1};
test('fetch budget limits',()=>assert.ok(buildRequests(now).length<=130));
test('research forecast requires adequate sample',()=>{const e=evaluate(gathered,[],now);assert.equal(e.proposed.length,1);assert.equal(e.proposed[0].stake_usd,0);assert.equal(e.proposed[0].market_reference,null)});
test('first-writer-wins forecasts',()=>{const first=evaluate(gathered,[],now);const again=evaluate(gathered,first.proposed,now);assert.equal(again.proposed.length,0)});
test('preliminary grade only when final appears',()=>{const first=evaluate(gathered,[],now);const final={...first.proposed[0],home_points:27,away_points:21,verified_at_utc:'2026-10-16T00:00:00Z',verification_status:'THIRD_PARTY_UNCONFIRMED',source_url:url};const e=evaluate({...gathered,finals:[final]},first.proposed,'2026-10-16T01:00:00Z');assert.equal(e.preliminary.length,1);assert.equal(e.preliminary[0].eligible_for_training,false)});
test('publication uses sanitized paths',()=>{const e=evaluate(gathered,[],now);const files=publications({...e,report:{ok:1}},'123-1');assert.equal(files.length,2);assert.match(files[0].path,/paper-ledger\/week001\/forecasts\/espn_football_nfl_future.json$/)});
test('malformed run ID denied',()=>assert.throws(()=>publications({proposed:[],preliminary:[],report:{}},'../oops'),/RUN_ID_INVALID/));
test('writeOutput creates manifest and report',async()=>{const folder=await mkdtemp(join(tmpdir(),'jhadina-'));try{const e=evaluate(gathered,[],now);await writeOutput({...e,report:{ok:true}},'123-1',folder);const parsed=JSON.parse(await readFile(join(folder,'publication.json'),'utf8'));assert.equal(parsed.files.length,2)}finally{await rm(folder,{recursive:true,force:true})}});
test('collect isolates provider failure',async()=>{const r=await collect({now,requests:[{league:'football/nfl',date:'20261013',url},{league:'football/nfl',date:'20261014',url:'https://broken.test'}],fetchJson:async x=>{if(x.includes('broken'))throw Error('HTTP_429');return {events:raw}},maxConcurrent:2});assert.equal(r.fetched,1);assert.equal(r.errors.length,1)});

test('all provider URLs use valid YYYYMMDD date tokens',()=>{const tasks=buildRequests(now);assert.ok(tasks.length>0);for(const t of tasks){assert.match(t.date,/^2026[0-9]{4}$/);assert.match(t.url,/\?dates=2026[0-9]{4}$/)}});

test('skip duplicate preliminary outcome but retain corrections',()=>{
 const original=evaluate(gathered,[],now).proposed[0];
 const firstFinal={...original,home_points:19,away_points:22,verified_at_utc:'2026-10-16T00:00:00Z',verification_status:'THIRD_PARTY_UNCONFIRMED',source_url:url};
 const first=evaluate({...gathered,finals:[firstFinal]},[original],'2026-10-16T01:00:00Z');
 assert.equal(first.preliminary.length,1);
 const again=evaluate({...gathered,finals:[{...firstFinal,verified_at_utc:'2026-10-16T02:00:00Z'}]},[original],'2026-10-16T03:00:00Z',first.preliminary);
 assert.equal(again.preliminary.length,0);
 const correction=evaluate({...gathered,finals:[{...firstFinal,home_points:20,verified_at_utc:'2026-10-16T04:00:00Z'}]},[original],'2026-10-16T05:00:00Z',first.preliminary);
 assert.equal(correction.preliminary.length,1);
});

test('recover original date-scoped URL for an overdue event',()=>{
 const forecast=evaluate(gathered,[],now).proposed[0];
 const requests=buildRequests('2026-10-19T00:00:00Z',[forecast]);
 assert.ok(requests.length<=160);
 assert.ok(requests.some(x=>x.url===forecast.fixture_source_url&&x.targeted_result_check===true));
});
test('already graded matches older than 48 hours need no redundant targeted request',()=>{
 const forecast=evaluate(gathered,[],now).proposed[0];
 const requests=buildRequests('2026-10-19T00:00:00Z',[forecast],[{forecast_sha256:forecast.sha256}]);
 assert.equal(requests.some(x=>x.url===forecast.fixture_source_url&&x.targeted_result_check===true),false);
});
test('reject spoofed final carrying same event id but different opponents',()=>{
 const forecast=evaluate(gathered,[],now).proposed[0];
 const spoof={...forecast,home:{id:'not-home'},away:forecast.away,home_points:10,away_points:7,
   verified_at_utc:'2026-10-16T00:00:00Z',verification_status:'THIRD_PARTY_UNCONFIRMED',source_url:url};
 const graded=evaluate({...gathered,finals:[spoof]},[forecast],'2026-10-16T01:00:00Z');
 assert.equal(graded.preliminary.length,0);
 assert.equal(graded.abstentions.some(x=>x.reason==='UNVERIFIED_RESULT'),true);
});

test('contradictory finals from two source date pages are quarantined',async()=>{
 const date='2026-10-10T17:00:00Z';
 const original=game('conflict','h','a',14,10,date,true);
 const changed=game('conflict','h','a',17,10,date,true);
 const r=await collect({
   now:'2026-10-13T22:50:00Z',
   requests:[
     {league:'football/nfl',date:'20261010',url:'https://example.org/scoreboard?dates=20261010'},
     {league:'football/nfl',date:'20261011',url:'https://example.org/scoreboard?dates=20261011'}
   ],
   fetchJson:async source=>({events:[source.endsWith('10')?original:changed]})
 });
 assert.equal(r.fetched,2);
 assert.equal(r.finals.length,0);
 assert.equal(r.fixtures.length,0);
 assert.deepEqual(r.conflicting_event_ids,['espn:football/nfl:conflict']);
 assert.equal(r.errors.some(e=>e.error==='CONFLICTING_PROVIDER_OBSERVATIONS'),true);
});
