import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {EXPERIMENT,WINDOW_START,WINDOW_END,LEAGUES,extractScoreboard,calculateBaseline,sealResearchForecast,verifyResearchForecast,gradeUnofficial,safeId,hash} from './core.mjs';
import {marketCoverage} from './markets.mjs';

const LEDGER='training/sports/paper-ledger/week001';
const makeDate=(timestamp)=>new Date(timestamp).toISOString().slice(0,10).replace(/-/g,'');
const day=(instant,offset)=>new Date(Date.parse(instant)+offset*86400000);
const dayIso=d=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())).toISOString();
export function buildRequests(now,existing=[],existingGrades=[]){
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
  // Recover original date-scoped schedule observations for games still awaiting
  // a final result, even when the normal historical lookback has rolled past
  // their date. Reuse saved provenance URLs, with an exact provider allowlist.
  const observedGraded=new Set(existingGrades.map(g=>g.forecast_sha256));
  const seen=new Set(requests.map(r=>r.url));
  const t=Date.parse(now);
  const pending=existing
    .filter(f=>{verifyResearchForecast(f);return Date.parse(f.start_utc)+30*60000<t&&Date.parse(f.start_utc)>t-20*86400000;})
    .sort((a,b)=>{
      const aGraded=observedGraded.has(a.sha256),bGraded=observedGraded.has(b.sha256);
      return Number(aGraded)-Number(bGraded)||Date.parse(a.start_utc)-Date.parse(b.start_utc);
    });
  let targeted=0;
  for(const f of pending){
    if(targeted>=25)break;
    if(observedGraded.has(f.sha256)&&t-Date.parse(f.start_utc)>2*86400000)continue;
    const url=f.fixture_source_url;
    const allowed=`https://site.api.espn.com/apis/site/v2/sports/${f.league}/scoreboard?dates=`;
    if(typeof url!=='string'||!url.startsWith(allowed)||!/^\d{8}$/.test(url.slice(allowed.length)))continue;
    if(seen.has(url))continue;
    seen.add(url);targeted++;
    requests.push({league:f.league,sport:f.sport,date:url.slice(allowed.length),url,targeted_result_check:true});
  }
  return requests;
}

export async function collect({now=new Date().toISOString(),fetchJson,requests=buildRequests(now),maxConcurrent=3}){
  if(!Number.isFinite(Date.parse(now))||requests.length>160||maxConcurrent<1||maxConcurrent>6)throw Error('REQUEST_BUDGET_EXCEEDED');
  const results=[],errors=[];let fetched=0;
  const league_health={};
  for(const req of requests){
    const entry=league_health[req.league]??={requested:0,fetched:0,fixtures:0,finals:0,provider_errors:0};
    entry.requested++;
  }
  async function take(request){
    try{
      const payload=await fetchJson(request.url);
      const capturedAt=new Date().toISOString();
      const data=extractScoreboard(request.league,payload,capturedAt,request.url);
      results.push(data);fetched++;
      const health=league_health[request.league];
      health.fetched++;health.fixtures+=data.fixtures.length;
      health.finals+=data.finals.length;health.provider_errors+=data.errors.length;
      errors.push(...data.errors.slice(0,4).map(e=>({...e,url:request.url})));
    }catch(e){
      league_health[request.league].provider_errors++;
      errors.push({league:request.league,date:request.date,error:String(e?.message||e)});
    }
  }
  for(let i=0;i<requests.length;i+=maxConcurrent){await Promise.all(requests.slice(i,i+maxConcurrent).map(take));}
  // Multiple daily endpoints sometimes repeat the same game. Do not let
  // completion order silently select between contradictory results.
  const conflicts=new Set();
  const reconcile=(records,isFinal)=>{
    const byId=new Map();
    for(const item of records){
      const previous=byId.get(item.event_id);
      if(previous){
        const mismatch=previous.league!==item.league||
          previous.home?.id!==item.home?.id||previous.away?.id!==item.away?.id||
          Date.parse(previous.start_utc)!==Date.parse(item.start_utc)||
          (isFinal&&(previous.home_points!==item.home_points||
            previous.away_points!==item.away_points||previous.score_unit!==item.score_unit));
        if(mismatch)conflicts.add(item.event_id);
      }else byId.set(item.event_id,item);
    }
    return byId;
  };
  const byFixture=reconcile(results.flatMap(x=>x.fixtures),false);
  const byFinal=reconcile(results.flatMap(x=>x.finals),true);
  for(const id of conflicts)errors.push({event_id:id,error:'CONFLICTING_PROVIDER_OBSERVATIONS'});
  const fixtures=[...byFixture.values()].filter(f=>!conflicts.has(f.event_id));
  const finals=[...byFinal.values()].filter(f=>!conflicts.has(f.event_id));
  for(const entry of Object.values(league_health)){
    entry.status=entry.fetched===0?'UNAVAILABLE':
      entry.fetched<Math.ceil(entry.requested*0.6)?'DEGRADED':'FETCHED';
  }
  return {fixtures,finals,errors,fetched,requested:requests.length,
    collected_at_utc:new Date().toISOString(),
    conflicting_event_ids:[...conflicts],league_health};
}

export function meetsFeedCoverage(data){
  return data&&Number.isInteger(data.requested)&&data.requested>0&&
    Number.isInteger(data.fetched)&&data.fetched>=Math.ceil(data.requested*0.6)&&
    data.fetched<=data.requested;
}

export function forecastSignalDisagreement(forecast){
  if(!forecast||forecast.score_unit==='match_win_indicator')return false;
  const numbers=[forecast.home_win_probability,forecast.away_win_probability,
    forecast.home_projected_points,forecast.away_projected_points];
  if(!numbers.every(Number.isFinite))return false;
  const probabilityGap=forecast.home_win_probability-forecast.away_win_probability;
  const scoreGap=forecast.home_projected_points-forecast.away_projected_points;
  return Math.abs(probabilityGap)>0.03&&Math.abs(scoreGap)>0.5&&probabilityGap*scoreGap<0;
}

export function evaluate(collected,existing,now,existingGrades=[]){
  if(!Array.isArray(existing)||!Number.isFinite(Date.parse(now)))throw Error('RUN_INPUT_INVALID');
  const ledgerIds=new Set(existing.map(f=>{verifyResearchForecast(f);return f.event_id}));
  const gradedOutcomes=new Set(existingGrades.map(g=>{
    const {sha256,...record}=g;
    if(hash(record)!==sha256||g.status!=='PRELIMINARY_UNOFFICIAL_NOT_SETTLED'||g.real_bet!==false)throw Error('HISTORICAL_GRADE_INVALID');
    return [g.forecast_sha256,g.home_points,g.away_points].join(':');
  }));
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
      // Do not seal a new forecast that predicts one team to win while
      // its projected points clearly favor the opponent. Keep older
      // immutable case studies untouched for audit and learning.
      if(forecastSignalDisagreement(model.forecast)){
        abstentions.push({event_id:fixture.event_id,reason:'PROBABILITY_SCORE_SIGNAL_DISAGREEMENT',
          training_allowed:false,model_id:model.forecast.model_id});
        continue;
      }
      const forecast=sealResearchForecast(fixture,model.forecast,now);
      proposed.push(forecast);counts[fixture.league]=(counts[fixture.league]||0)+1;
    }catch(error){abstentions.push({event_id:fixture.event_id,reason:error.message});}
  }
  const finalById=new Map(collected.finals.map(x=>[x.event_id,x]));
  // A completed fixture without a grade must remain visible to the owner.
  // Provider absence does not mean the team won, lost or the event was canceled.
  const resultBacklog=[];
  for(const forecast of existing){
    const hoursSinceStart=(t-Date.parse(forecast.start_utc))/3600000;
    if(hoursSinceStart>=0&&
       ![...gradedOutcomes].some(key=>key.startsWith(forecast.sha256+':'))){
      const final=finalById.get(forecast.event_id);
      resultBacklog.push({
        event_id:forecast.event_id,sport:forecast.sport,
        scheduled_start_utc:forecast.start_utc,
        hours_since_start:Math.round(hoursSinceStart*10)/10,
        forecast_sha256:forecast.sha256,
        status:final?'PRELIMINARY_FINAL_VISIBLE_PENDING_GRADE':'RESULT_NOT_YET_VERIFIED',
        action:final?'CHECK_GRADING_CONSISTENCY':'RECHECK_ORIGINAL_EVENT_DATE',
        source_url:forecast.fixture_source_url
      });
    }
  }
  for(const forecast of existing){
    const actual=finalById.get(forecast.event_id);
    if(actual&&!gradedOutcomes.has([forecast.sha256,actual.home_points,actual.away_points].join(':')))
      try{preliminary.push(gradeUnofficial(forecast,actual))}catch(error){abstentions.push({event_id:forecast.event_id,reason:error.message});}
  }
  const gradedThisRun=new Set(preliminary.map(g=>g.forecast_sha256));
  for(const item of resultBacklog){
    if(gradedThisRun.has(item.forecast_sha256)){
      item.status='PRELIMINARY_GRADE_GENERATED_THIS_RUN';
      item.action='AWAIT_APPEND_ONLY_PUBLICATION';
    }
  }
  return {proposed,preliminary,abstentions,resultBacklog,
    diagnostics:{upcoming_pending:pending.length,historical_finals:collected.finals.length,
    requested:collected.requested,fetched:collected.fetched,error_count:collected.errors.length,
    awaiting_result_verification:resultBacklog.filter(x=>x.status==='RESULT_NOT_YET_VERIFIED').length,
    overdue_12h_without_verification:resultBacklog.filter(x=>x.hours_since_start>=12&&x.status==='RESULT_NOT_YET_VERIFIED').length,
    final_visible_not_graded:resultBacklog.filter(x=>x.status==='PRELIMINARY_FINAL_VISIBLE_PENDING_GRADE').length,
    newly_graded_preliminary:gradedThisRun.size,
    conflicting_provider_events:collected.conflicting_event_ids?.length||0}};
}

export async function readLedger(root=LEDGER){
  const dir=path.join(root,'forecasts');let files=[];
  try{files=(await readdir(dir)).filter(x=>/^espn_[a-zA-Z0-9_-]+\.json$/.test(x));}catch(e){if(e.code!=='ENOENT')throw e;}
  const out=[];
  for(const filename of files){const data=JSON.parse(await readFile(path.join(dir,filename),'utf8'));verifyResearchForecast(data);out.push(data);}
  return out;
}

export async function readPreliminary(root=LEDGER){
  const dir=path.join(root,'preliminary');let files=[];
  try{files=(await readdir(dir)).filter(x=>/^[a-zA-Z0-9_.-]+\.json$/.test(x));}catch(e){if(e.code!=='ENOENT')throw e;}
  const out=[];
  for(const name of files)out.push(JSON.parse(await readFile(path.join(dir,name),'utf8')));
  return out;
}

export function publications(out,runId){
  if(!/^[0-9]{1,20}(?:-[0-9]{1,4})?$/.test(runId))throw Error('RUN_ID_INVALID');
  const files=[];
  const add=(folder,id,obj)=>files.push({path:`${LEDGER}/${folder}/${id}.json`,content:JSON.stringify(obj,null,2)+'\n'});
  for(const s of out.proposed){verifyResearchForecast(s);add('forecasts',safeId(s.event_id),s);}
  for(const s of out.preliminary)add('preliminary',`${safeId(s.event_id)}_${s.forecast_sha256.slice(0,12)}_${hash([s.home_points,s.away_points,s.outcome]).slice(0,16)}`,s);
  add('runs',runId,out.report);
  return files;
}
export async function writeOutput(out,runId,dir='sports-lab-output'){
  await mkdir(dir,{recursive:true});const files=publications(out,runId);
  await writeFile(path.join(dir,'publication.json'),JSON.stringify({schema_version:'sports.publication.v1',files},null,2)+'\n');
  await writeFile(path.join(dir,'run-report.json'),JSON.stringify(out.report,null,2)+'\n');
  return files.length;
}

export async function run({now,fetchJson,existing=[],existingGrades=[],requests,runId='1',dir='sports-lab-output'}){
  const asOf=now||new Date().toISOString();
  if(Date.parse(asOf)>Date.parse('2026-10-29T07:00:00Z'))throw Error('EXPERIMENT_CLOSED');
  const data=await collect({now:asOf,fetchJson,requests:requests??buildRequests(asOf,existing,existingGrades)});
  if(!meetsFeedCoverage(data)){
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'provider-failure.json'),JSON.stringify({
      schema_version:'sports.feed_failure.v1',time_utc:new Date().toISOString(),
      requested:data.requested,fetched:data.fetched,
      errors:data.errors.slice(0,30),failed_all:data.fetched===0,
      status:'INSUFFICIENT_SNAPSHOT_COVERAGE',minimum_fraction:0.6,
      paper_bets:0,training_admission:false
    },null,2)+'\n');
    throw Error('INSUFFICIENT_SNAPSHOT_COVERAGE '+JSON.stringify({requested:data.requested,fetched:data.fetched,errors:data.errors.slice(0,3)}));
  }
  const sealedAt=new Date().toISOString();
  const evaluated=evaluate(data,existing,sealedAt,existingGrades);
  const coherence_flags=[...existing,...evaluated.proposed].filter(forecastSignalDisagreement)
    .map(s=>({event_id:s.event_id,issue:'PROBABILITY_SCORE_SIGNAL_DISAGREEMENT',training_allowed:false}));
  const coverage=(existing[0]||evaluated.proposed[0])?marketCoverage(existing[0]||evaluated.proposed[0]):[];
  const trigger=['schedule','push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)?
    process.env.GITHUB_EVENT_NAME:'unknown';
  const report={schema_version:'jhadina.sports.week001_run.v2',experiment_id:EXPERIMENT,run_id:runId,
    execution_trigger:trigger,
    started_at_utc:asOf,completed_at_utc:sealedAt,discovered_fixtures:data.fixtures.length,
    preliminary_final_results:data.finals.length,research_forecasts_created:evaluated.proposed.length,
    preliminary_grades_created:evaluated.preliminary.length,abstentions:evaluated.abstentions.slice(0,50),
    provider_errors:data.errors.slice(0,35),provider_health:data.league_health,diagnostics:evaluated.diagnostics,
    pending_result_review:evaluated.resultBacklog
      .slice().sort((a,b)=>b.hours_since_start-a.hours_since_start).slice(0,35),
    sport_coverage:[...new Set(data.fixtures.map(x=>x.sport))],
    source_quality:'UNOFFICIAL_UNLICENSED_FOR_COMMERCIAL_USE_NOT_ESTABLISHED',
    model_status:'UNCALIBRATED_BASELINE_RESEARCH_ONLY',market_coverage:coverage,coherence_flags,official_settlements:0,market_quotes:0,
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
    const existingGrades=await readPreliminary();
    const out=await run({fetchJson,existing,existingGrades,runId});
    console.log(JSON.stringify({run_id:runId,...out.report.diagnostics,new_forecasts:out.proposed.length,preliminary_grades:out.preliminary.length,bet_count:0}));
  }catch(e){console.error('PAPER_LAB_FAILED:',e.message);process.exitCode=1;}
}
