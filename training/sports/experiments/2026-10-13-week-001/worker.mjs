import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {EXPERIMENT,WINDOW_START,WINDOW_END,LEAGUES,extractScoreboard,calculateBaseline,sealResearchForecast,verifyResearchForecast,gradeUnofficial,safeId} from './core.mjs';

const LEDGER='training/sports/paper-ledger/week001';
const makeDate=(timestamp)=>new Date(timestamp).toISOString().slice(0,10).replace(/-/g,'');
const day=(instant,offset)=>new Date(Date.parse(instant)+offset*86400000);
const dayIso=d=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())).toISOString();
export function buildRequests(now){
  const requests=[];
  for(const league of Object.keys(LEAGUES)){
    const sport=LEAGUES[league];const history=[];
    const lookback=sport==='NFL'||sport==='NCAAF'?35:sport==='Soccer'?18:sport==='Tennis'||sport==='UFC'?9:8;
    for(let i=1;i<=lookback;i++){
      const d=day(now,-i),dow=d.getUTCDay();
      if(sport==='NFL' && ![0,1,4].includes(dow))continue;
      if(sport==='NCAAF' && ![5,6].includes(dow))continue;
      if(sport==='Soccer' && ![0,3,6].includes(dow))continue;
      if((sport==='Tennis'||sport==='UFC') && i%2===0)continue;
      history.push(makeDate(dayIso(d)));
    }
    for(const date of [...history,...[0,1,2].map(i=>makeDate(dayIso(day(now,i))))]){
      requests.push({league,sport,date,url:`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard?dates=${date}`});
    }
  }
  return requests;
}

export async function collect({now=new Date().toISOString(),fetchJson,requests=buildRequests(now),maxConcurrent=3}){
  if(!Number.isFinite(Date.parse(now))||requests.length>130||maxConcurrent<1||maxConcurrent>6)throw Error('REQUEST_BUDGET_EXCEEDED');
  const results=[],errors=[];let fetched=0;
  async function take(request){
    try{
      const payload=await fetchJson(request.url);
      const capturedAt=new Date().toISOString();
      const data=extractScoreboard(request.league,payload,capturedAt,request.url);
      results.push(data);fetched++;
      errors.push(...data.errors.slice(0,4).map(e=>({...e,url:request.url})));
    }catch(e){errors.push({league:request.league,date:request.date,error:String(e?.message||e)});}
  }
  for(let i=0;i<requests.length;i+=maxConcurrent){await Promise.all(requests.slice(i,i+maxConcurrent).map(take));}
  const fixtures=[...new Map(results.flatMap(x=>x.fixtures).map(x=>[x.event_id,x])).values()];
  const finals=[...new Map(results.flatMap(x=>x.finals).map(x=>[x.event_id,x])).values()];
  return {fixtures,finals,errors,fetched,requested:requests.length,collected_at_utc:new Date().toISOString()};
}

export function evaluate(collected,existing,now){
  if(!Array.isArray(existing)||!Number.isFinite(Date.parse(now)))throw Error('RUN_INPUT_INVALID');
  const ledgerIds=new Set(existing.map(f=>{verifyResearchForecast(f);return f.event_id}));
  const proposed=[],preliminary=[],abstentions=[];
  const end=Date.parse(WINDOW_END),start=Date.parse(WINDOW_START),t=Date.parse(now);
  const pending=collected.fixtures.filter(x=>Date.parse(x.start_utc)>=start && Date.parse(x.start_utc)<end && Date.parse(x.start_utc)>t && !ledgerIds.has(x.event_id));
  pending.sort((a,b)=>Date.parse(a.start_utc)-Date.parse(b.start_utc));
  const counts={};
  for(const fixture of pending){
    if(proposed.length>=18)break;
    if((counts[fixture.league]||0)>=3)continue;
    const model=calculateBaseline(fixture,collected.finals,now);
    if(model.status!=='READY_RESEARCH_ONLY'){
      abstentions.push({event_id:fixture.event_id,reason:model.reason,league_sample:model.league_sample||0});
      continue;
    }
    try{
      const forecast=sealResearchForecast(fixture,model.forecast,now);
      proposed.push(forecast);counts[fixture.league]=(counts[fixture.league]||0)+1;
    }catch(error){abstentions.push({event_id:fixture.event_id,reason:error.message});}
  }
  const finalById=new Map(collected.finals.map(x=>[x.event_id,x]));
  for(const forecast of existing){
    const actual=finalById.get(forecast.event_id);
    if(actual)try{preliminary.push(gradeUnofficial(forecast,actual))}catch(error){abstentions.push({event_id:forecast.event_id,reason:error.message});}
  }
  return {proposed,preliminary,abstentions,diagnostics:{upcoming_pending:pending.length,historical_finals:collected.finals.length,requested:collected.requested,fetched:collected.fetched,error_count:collected.errors.length}};
}

export async function readLedger(root=LEDGER){
  const dir=path.join(root,'forecasts');let files=[];
  try{files=(await readdir(dir)).filter(x=>/^espn_[a-zA-Z0-9_-]+\.json$/.test(x));}catch(e){if(e.code!=='ENOENT')throw e;}
  const out=[];
  for(const filename of files){const data=JSON.parse(await readFile(path.join(dir,filename),'utf8'));verifyResearchForecast(data);out.push(data);}
  return out;
}

export function publications(out,runId){
  if(!/^[0-9]{1,20}(?:-[0-9]{1,4})?$/.test(runId))throw Error('RUN_ID_INVALID');
  const files=[];
  const add=(folder,id,obj)=>files.push({path:`${LEDGER}/${folder}/${id}.json`,content:JSON.stringify(obj,null,2)+'\n'});
  for(const s of out.proposed){verifyResearchForecast(s);add('forecasts',safeId(s.event_id),s);}
  for(const s of out.preliminary)add('preliminary',`${safeId(s.event_id)}_${s.forecast_sha256.slice(0,12)}_${s.sha256.slice(0,12)}`,s);
  add('runs',runId,out.report);
  return files;
}
export async function writeOutput(out,runId,dir='sports-lab-output'){
  await mkdir(dir,{recursive:true});const files=publications(out,runId);
  await writeFile(path.join(dir,'publication.json'),JSON.stringify({schema_version:'sports.publication.v1',files},null,2)+'\n');
  await writeFile(path.join(dir,'run-report.json'),JSON.stringify(out.report,null,2)+'\n');
  return files.length;
}

export async function run({now,fetchJson,existing=[],requests,runId='1',dir='sports-lab-output'}){
  const asOf=now||new Date().toISOString();
  if(Date.parse(asOf)>Date.parse('2026-10-29T07:00:00Z'))throw Error('EXPERIMENT_CLOSED');
  const data=await collect({now:asOf,fetchJson,requests});
  if(data.fetched===0){
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'provider-failure.json'),JSON.stringify({schema_version:'sports.feed_failure.v1',time_utc:new Date().toISOString(),requested:data.requested,errors:data.errors.slice(0,30),failed_all:true},null,2)+'\n');
    throw Error('ALL_PROVIDERS_FAILED '+JSON.stringify(data.errors.slice(0,3)));
  }
  const sealedAt=new Date().toISOString();
  const evaluated=evaluate(data,existing,sealedAt);
  const report={schema_version:'jhadina.sports.week001_run.v2',experiment_id:EXPERIMENT,run_id:runId,
    started_at_utc:asOf,completed_at_utc:sealedAt,discovered_fixtures:data.fixtures.length,
    preliminary_final_results:data.finals.length,research_forecasts_created:evaluated.proposed.length,
    preliminary_grades_created:evaluated.preliminary.length,abstentions:evaluated.abstentions.slice(0,50),
    provider_errors:data.errors.slice(0,35),diagnostics:evaluated.diagnostics,
    sport_coverage:[...new Set(data.fixtures.map(x=>x.sport))],
    source_quality:'UNOFFICIAL_UNLICENSED_FOR_COMMERCIAL_USE_NOT_ESTABLISHED',
    model_status:'UNCALIBRATED_BASELINE_RESEARCH_ONLY',official_settlements:0,market_quotes:0,
    placed_bets:0,virtual_bankroll_usd:3100,training_updates:0,
    warning:'No official fixture verification, market odds, props or settlement. No actual wagers.'};
  const out={...evaluated,report};
  await writeOutput(out,runId,dir);
  return out;
}

if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const runId=process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT||1}` : '1';
  const fetchJson=async url=>{
    const res=await fetch(url,{signal:AbortSignal.timeout(9000),headers:{accept:'application/json'}});
    if(!res.ok)throw Error(`HTTP_${res.status}`);
    return res.json();
  };
  try{
    const existing=await readLedger();
    const out=await run({fetchJson,existing,runId});
    console.log(JSON.stringify({run_id:runId,...out.report.diagnostics,new_forecasts:out.proposed.length,preliminary_grades:out.preliminary.length,bet_count:0}));
  }catch(e){console.error('PAPER_LAB_FAILED:',e.message);process.exitCode=1;}
}
