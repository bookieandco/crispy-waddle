import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from './core.mjs';
import {publications} from './worker.mjs';
import {equivalentPreliminaryObservation,publishBatch} from './publish-batch.mjs';
const gradeBody={
 schema_version:'jhadina.sports.preliminary_grade.v2',
 event_id:'espn:basketball/nba:fixture-1',forecast_sha256:'a'.repeat(64),
 verified_at_utc:'2026-10-14T01:00:00Z',
 result_source_url:'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20261013',
 outcome:'HOME',home_points:23,away_points:20,multiclass_brier_score:0.47529,
 home_points_absolute_error:1.2,away_points_absolute_error:2.3,
 status:'PRELIMINARY_UNOFFICIAL_NOT_SETTLED',eligible_for_training:false,stake_usd:0,real_bet:false
};
const sealed=body=>({...body,sha256:hash(body)});
const first=sealed(gradeBody);
const again=sealed({...gradeBody,verified_at_utc:'2026-10-14T01:02:00Z'});
const corrected=sealed({...gradeBody,verified_at_utc:'2026-10-14T01:04:00Z',
 home_points:25,home_points_absolute_error:3.2});
const report={schema_version:'jhadina.sports.week001_run.v2',run_id:'400-1',
 placed_bets:0,virtual_bankroll_usd:3100,training_updates:0};
const publish=(grade,runId)=>({schema_version:'sports.publication.v1',
 files:publications({proposed:[],preliminary:[grade],report},runId)});
test('identical repeated final yields one deterministic path across observed times',()=>{
 const a=publish(first,'400-1').files.find(x=>x.path.includes('/preliminary/'));
 const b=publish(again,'401-1').files.find(x=>x.path.includes('/preliminary/'));
 assert.equal(a.path,b.path);
 assert.notEqual(a.content,b.content);
 assert.match(a.path,/^training\/sports\/paper-ledger\/week001\/preliminary\/espn_basketball_nba_fixture-1_/);
});
test('score correction gets new append-only path rather than rewriting previous observation',()=>{
 const a=publish(first,'400-1').files.find(x=>x.path.includes('/preliminary/'));
 const b=publish(corrected,'401-1').files.find(x=>x.path.includes('/preliminary/'));
 assert.notEqual(a.path,b.path);
});
test('equal scores with newer verified timestamp remain idempotent',()=>{
 assert.equal(equivalentPreliminaryObservation(first,again),true);
 assert.equal(equivalentPreliminaryObservation(first,corrected),false);
});
test('cannot bypass first-writer protection with rehashed different scores or altered metrics',()=>{
 const poisoned={...gradeBody,home_points_absolute_error:99};
 assert.equal(equivalentPreliminaryObservation(first,sealed(poisoned)),false);
 assert.equal(equivalentPreliminaryObservation(first,{...again,home_points:32}),false);
});
test('publisher preserves earliest grade but commits a new run receipt for racing duplicate',async()=>{
 const staged=publish(again,'401-1');
 const preliminaryPath=staged.files.find(x=>x.path.includes('/preliminary/')).path;
 const calls=[],sha=x=>x.repeat(40);
 const fetchImpl=async(url,options)=>{
  const route=url.split('/repos/bookieandco/crispy-waddle')[1];
  const body=options.body&&JSON.parse(options.body);
  calls.push({route,method:options.method,body});
  const ok=data=>({ok:true,status:200,json:async()=>data});
  if(route==='/git/ref/heads/main')return ok({object:{sha:sha('a')}});
  if(route.startsWith('/contents/')){
   if(route.includes('/preliminary/'))return ok({encoding:'base64',
     content:Buffer.from(JSON.stringify(first,null,2)+'\n').toString('base64')});
   return {ok:false,status:404};
  }
  if(route==='/git/commits/'+sha('a'))return ok({tree:{sha:sha('b')}});
  if(route==='/git/trees'&&options.method==='POST')return ok({sha:sha('c')});
  if(route==='/git/commits'&&options.method==='POST')return ok({sha:sha('d')});
  if(route==='/git/refs/heads/main'&&options.method==='PATCH')return ok({object:{sha:sha('d')}});
  throw Error('UNMOCKED_'+route);
 };
 const result=await publishBatch(staged,{token:'mock',repository:'bookieandco/crispy-waddle',branch:'main',fetchImpl});
 assert.equal(result.suppressed_preliminary,1);
 assert.equal(result.created,1);
 const tree=calls.find(x=>x.route==='/git/trees'&&x.method==='POST').body.tree;
 assert.equal(tree.some(x=>x.path===preliminaryPath),false);
 const run=JSON.parse(tree.find(x=>x.path.includes('/runs/')).content);
 assert.equal(run.publication_resolution.repeated_final_observations_suppressed,1);
 assert.equal(run.placed_bets,0);
});
