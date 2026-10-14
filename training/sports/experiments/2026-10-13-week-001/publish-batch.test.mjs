import test from 'node:test';
import assert from 'node:assert/strict';
import {publishBatch} from './publish-batch.mjs';
const sha=n=>n.repeat(40);
const report={schema_version:'jhadina.sports.week001_run.v2',placed_bets:0,virtual_bankroll_usd:3100,training_updates:0};
const body=JSON.stringify(report);
const sample={schema_version:'sports.publication.v1',files:[{path:'training/sports/paper-ledger/week001/runs/100-1.json',content:body}]};
const creds={repository:'bookieandco/crispy-waddle',branch:'main',token:'fake_test_token'};
function mock({exists=false,conflict=false,failPatchOnce=false}={}){
 const calls=[];let patches=0;
 const fetchImpl=async(url,args)=>{
  const method=args.method;const route=url.split('/repos/bookieandco/crispy-waddle')[1];
  calls.push({method,route,body:args.body&&JSON.parse(args.body)});
  const ok=data=>({ok:true,status:200,json:async()=>data});
  if(route==='/git/ref/heads/main')return ok({object:{sha:sha('a')}});
  if(route.startsWith('/contents/'))return exists?ok({encoding:'base64',content:Buffer.from(conflict?'DIFFERENT':body).toString('base64')}):{ok:false,status:404};
  if(route==='/git/commits/'+sha('a'))return ok({tree:{sha:sha('b')}});
  if(route==='/git/trees'&&method==='POST')return ok({sha:sha('c')});
  if(route==='/git/commits'&&method==='POST')return ok({sha:sha('d')});
  if(route==='/git/refs/heads/main'&&method==='PATCH'){
    patches++;return failPatchOnce&&patches===1?{ok:false,status:409}:ok({object:{sha:sha('d')}});
  }
  throw Error('UNMOCKED_'+method+'_'+route);
 };
 return {fetchImpl,calls};
}
test('one commit for one or more receipts',async()=>{
 const {fetchImpl,calls}=mock();
 const result=await publishBatch(sample,{...creds,fetchImpl});
 assert.equal(result.created,1);assert.equal(result.committed,true);
 assert.equal(calls.filter(c=>c.route==='/git/commits'&&c.method==='POST').length,1);
 assert.equal(calls.filter(c=>c.route==='/git/refs/heads/main').length,1);
 assert.equal(calls.filter(c=>c.route.includes('/contents/')&&c.method==='PUT').length,0);
 assert.equal(calls.find(c=>c.route==='/git/refs/heads/main').body.force,false);
});
test('identical receipt is idempotent without new commit',async()=>{
 const {fetchImpl,calls}=mock({exists:true});const result=await publishBatch(sample,{...creds,fetchImpl});
 assert.equal(result.created,0);assert.equal(result.idempotent,1);
 assert.equal(calls.filter(x=>x.method==='POST').length,0);
});
test('existing divergent receipt blocks whole batch',async()=>{
 const {fetchImpl,calls}=mock({exists:true,conflict:true});
 await assert.rejects(publishBatch(sample,{...creds,fetchImpl}),/IMMUTABLE_LEDGER_CONFLICT/);
 assert.equal(calls.filter(x=>x.method==='POST').length,0);
});
test('ref mismatch retries without force push',async()=>{
 const {fetchImpl,calls}=mock({failPatchOnce:true});
 const result=await publishBatch(sample,{...creds,fetchImpl});
 assert.equal(result.attempts,2);assert.equal(result.created,1);
 assert.equal(calls.filter(x=>x.route==='/git/refs/heads/main').length,2);
});
test('no repository or token scope violations',async()=>{
 const {fetchImpl}=mock();
 await assert.rejects(publishBatch(sample,{...creds,repository:'another/owner',fetchImpl}),/PUBLISH_NOT_AUTHORIZED/);
 await assert.rejects(publishBatch(sample,{...creds,token:'',fetchImpl}),/PUBLISH_NOT_AUTHORIZED/);
});

test('stale second forecast loses safely to valid first-writer while run audit still publishes',async()=>{
 const {sealResearchForecast,hash,safeId}=await import('./core.mjs');
 const historical={
   event_id:'espn:football/nfl:historical',league:'football/nfl',sport:'NFL',
   home:{id:'a',name:'A'},away:{id:'b',name:'B'},start_utc:'2026-10-11T12:00:00Z',
   home_points:21,away_points:18,verified_at_utc:'2026-10-12T00:00:00Z',
   verification_status:'THIRD_PARTY_UNCONFIRMED',source_url:'https://example.org/results'
 };
 const fixture={
   event_id:'espn:football/nfl:stale',sport:'NFL',league:'football/nfl',
   home:{id:'a',name:'A'},away:{id:'b',name:'B'},
   start_utc:'2026-10-15T12:00:00Z',
   source_url:'https://example.org/schedule',source_observed_at:'2026-10-13T12:00:00Z'
 };
 const model={model_id:'baseline-v1',home_win_probability:0.6,away_win_probability:0.4,draw_probability:0,
   home_projected_points:21,away_projected_points:18,
   input_source_urls:[historical.source_url],input_history:[historical],
   data_snapshot_sha256:hash([historical]),market_reference:null,admission_status:'RESEARCH_NOT_OFFICIAL'};
 const original=sealResearchForecast(fixture,model,'2026-10-13T12:01:00Z');
 const candidate=sealResearchForecast(fixture,{...model,home_win_probability:0.65,away_win_probability:0.35},'2026-10-13T12:02:00Z');
 const forecastPath='training/sports/paper-ledger/week001/forecasts/'+safeId(fixture.event_id)+'.json';
 const runPath='training/sports/paper-ledger/week001/runs/900-1.json';
 const summaryPath='training/sports/paper-ledger/week001/summaries/900-1.md';
 const receipt={schema_version:'jhadina.sports.week001_run.v2',run_id:'900-1',
    placed_bets:0,virtual_bankroll_usd:3100,training_updates:0,research_forecasts_created:1};
 const staged={schema_version:'sports.publication.v1',files:[
    {path:forecastPath,content:JSON.stringify(candidate,null,2)+'\n'},
    {path:runPath,content:JSON.stringify(receipt,null,2)+'\n'},
    {path:summaryPath,content:'## Jhadina Sports Lab — Week 001\nReal bets: **0**\nNo verified betting market prices'}
 ]};
 const calls=[];
 const fetchImpl=async(url,args)=>{
    const route=url.split('/repos/bookieandco/crispy-waddle')[1];
    const body=args.body&&JSON.parse(args.body);
    calls.push({route,method:args.method,body});
    const ok=data=>({ok:true,status:200,json:async()=>data});
    if(route==='/git/ref/heads/main')return ok({object:{sha:sha('a')}});
    if(route.startsWith('/contents/')){
      if(route.includes('/forecasts/'))return ok({encoding:'base64',content:Buffer.from(JSON.stringify(original,null,2)+'\n').toString('base64')});
      return {ok:false,status:404};
    }
    if(route==='/git/commits/'+sha('a'))return ok({tree:{sha:sha('b')}});
    if(route==='/git/trees'&&args.method==='POST')return ok({sha:sha('c')});
    if(route==='/git/commits'&&args.method==='POST')return ok({sha:sha('d')});
    if(route==='/git/refs/heads/main'&&args.method==='PATCH')return ok({object:{sha:sha('d')}});
    throw Error('UNMOCKED_'+route);
 };
 const response=await publishBatch(staged,{...creds,fetchImpl});
 assert.equal(response.suppressed_forecasts,1);
 assert.equal(response.accepted_forecasts,0);
 assert.equal(response.created,2);
 assert.equal(response.committed,true);
 const tree=calls.find(x=>x.route==='/git/trees'&&x.method==='POST').body.tree;
 assert.equal(tree.length,2);
 assert.equal(tree.some(x=>x.path===forecastPath),false);
 const committedRun=JSON.parse(tree.find(x=>x.path===runPath).content);
 assert.equal(committedRun.publication_resolution.candidates_dropped,1);
 assert.equal(committedRun.publication_resolution.conflicts[0].original_sha256,original.sha256);
 assert.equal(committedRun.publication_resolution.conflicts[0].discarded_candidate_sha256,candidate.sha256);
 assert.equal(committedRun.placed_bets,0);
 const committedSummary=tree.find(x=>x.path===summaryPath).content;
 assert.match(committedSummary,/suppressed 1 later candidates/);
 assert.match(committedSummary,/Real bets: \*\*0\*\*/);
});
