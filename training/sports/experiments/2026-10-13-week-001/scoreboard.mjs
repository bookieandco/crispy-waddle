import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {hash,verifyResearchForecast,safeId} from './core.mjs';
import {checkPublication} from './publish-check.mjs';
import {readLedger,readPreliminary} from './worker.mjs';

const digits=n=>n===null?null:Math.round(n*1e5)/1e5;
const avg=arr=>arr.length?digits(arr.reduce((a,b)=>a+b,0)/arr.length):null;
function validateGrade(g,forecast){
 const {sha256,...body}=g;
 if(hash(body)!==sha256||g.schema_version!=='jhadina.sports.preliminary_grade.v2'||
    g.status!=='PRELIMINARY_UNOFFICIAL_NOT_SETTLED'||g.eligible_for_training!==false||
    g.real_bet!==false||g.stake_usd!==0||
    !forecast||g.event_id!==forecast.event_id||g.forecast_sha256!==forecast.sha256||
    !(Date.parse(g.verified_at_utc)>Date.parse(forecast.start_utc))||
    !Number.isFinite(g.home_points)||!Number.isFinite(g.away_points))
    throw Error('SCOREBOARD_INVALID_GRADE');
 const outcome=g.home_points===g.away_points?'DRAW':g.home_points>g.away_points?'HOME':'AWAY';
 const expectedBrier=['HOME','DRAW','AWAY'].reduce((sum,side)=>{
   const probability=forecast[side==='HOME'?'home_win_probability':side==='DRAW'?'draw_probability':'away_win_probability'];
   return sum+(probability-Number(outcome===side))**2;
 },0);
 const close=(a,b)=>typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<=0.000011;
 if(g.outcome!==outcome||
    !close(g.multiclass_brier_score,expectedBrier)||
    !close(g.home_points_absolute_error,Math.abs(forecast.home_projected_points-g.home_points))||
    !close(g.away_points_absolute_error,Math.abs(forecast.away_projected_points-g.away_points)))
    throw Error('SCOREBOARD_INCOHERENT_GRADE');
 return g;
}
export function summarizeLedger(forecasts,grades,publication,asOfMs=Date.now()){
 const supplied=publication?.files||[];
 if(publication)checkPublication(publication);
 const reportFile=supplied.find(x=>x.path.includes('/runs/')&&x.path.endsWith('.json'));
 const runReport=reportFile?JSON.parse(reportFile.content):null;
 const source_health=runReport?{
   run_id:runReport.run_id,
   fetched:runReport.diagnostics?.fetched??0,
   requested:runReport.diagnostics?.requested??0,
   parse_exclusions:runReport.diagnostics?.error_count??0,
   overdue_12h:runReport.diagnostics?.overdue_12h_without_verification??0,
   provider_conflicts:runReport.diagnostics?.conflicting_provider_events??0,
   model_signal_disagreements:runReport.coherence_flags?.length??0,
   unavailable_leagues:Object.entries(runReport.provider_health||{})
     .filter(([,v])=>v.status==='UNAVAILABLE'||v.status==='DEGRADED')
     .map(([league,v])=>league+' ('+v.status+')'),
   official_results_verified:false,licensed_odds_verified:false
 }:null;
 const f=[...forecasts],g=[...grades];
 for(const file of supplied){
   if(!file.path.endsWith('.json'))continue;
   const record=JSON.parse(file.content);
   if(file.path.includes('/forecasts/'))f.push(record);
   if(file.path.includes('/preliminary/'))g.push(record);
 }
 const byId=new Map();
 for(const forecast of f){
   verifyResearchForecast(forecast);
   const old=byId.get(forecast.event_id);
   if(old&&old.sha256!==forecast.sha256)throw Error('SCOREBOARD_DUPLICATE_FORECAST');
   byId.set(forecast.event_id,forecast);
 }
 const gradesByForecast=new Map();
 for(const grade of g){
   const forecast=[...byId.values()].find(x=>x.sha256===grade.forecast_sha256);
   validateGrade(grade,forecast);
   const arr=gradesByForecast.get(grade.forecast_sha256)||[];
   arr.push(grade);gradesByForecast.set(grade.forecast_sha256,arr);
 }
 const grouped={},complete=[],conflicts=[];
 for(const record of byId.values()){
   const sport=record.sport;
   grouped[sport]??={sport,forecasts:0,preliminary_grades:0,accuracy:null,multiclass_brier_mean:null};
   grouped[sport].forecasts++;
   const observed=gradesByForecast.get(record.sha256)||[];
   if(!observed.length)continue;
   const finalKeys=[...new Set(observed.map(v=>[v.home_points,v.away_points].join(':')))];
   if(finalKeys.length>1){conflicts.push({event_id:record.event_id,status:'CONFLICTING_UNOFFICIAL_RESULTS'});continue;}
   const grade=observed.sort((a,b)=>a.verified_at_utc.localeCompare(b.verified_at_utc))[0];
   const predicted=['HOME','DRAW','AWAY'].reduce((best,side)=>record[side==='HOME'?'home_win_probability':side==='DRAW'?'draw_probability':'away_win_probability']>record[best==='HOME'?'home_win_probability':best==='DRAW'?'draw_probability':'away_win_probability']?side:best,'HOME');
   const labels=['HOME','DRAW','AWAY'];
   const probabilities=[record.home_win_probability,record.draw_probability,record.away_win_probability];
   const actualIndex=labels.indexOf(grade.outcome);
   const reference=record.sport==='Soccer'?[1/3,1/3,1/3]:[0.5,0,0.5];
   const referenceBrier=reference.reduce((sum,p,i)=>sum+(p-Number(i===actualIndex))**2,0);
   complete.push({
     sport,event_id:record.event_id,correct:Number(predicted===grade.outcome),
     brier:grade.multiclass_brier_score,reference_brier:referenceBrier,
     confidence:Math.max(...probabilities),log_loss:-Math.log(Math.max(0.00001,probabilities[actualIndex])),
     home_error:grade.home_points_absolute_error,away_error:grade.away_points_absolute_error
   });
 }
 for(const row of complete)grouped[row.sport].preliminary_grades++;
 for(const sport of Object.keys(grouped)){
   const rows=complete.filter(v=>v.sport===sport);
   grouped[sport].accuracy=avg(rows.map(x=>x.correct));
   grouped[sport].multiclass_brier_mean=avg(rows.map(x=>x.brier));
 }
 const calibrationBands=[
   {label:'0–49%',min:0,max:0.5},
   {label:'50–59%',min:0.5,max:0.6},
   {label:'60–69%',min:0.6,max:0.7},
   {label:'70–79%',min:0.7,max:0.8},
   {label:'80–100%',min:0.8,max:1.00001}
 ].map(b=>{
   const rows=complete.filter(x=>x.confidence>=b.min&&x.confidence<b.max);
   return {label:b.label,count:rows.length,
     mean_confidence:avg(rows.map(x=>x.confidence)),
     observed_accuracy:avg(rows.map(x=>x.correct))};
 }).filter(b=>b.count>0);
 const calibrationGap=complete.length?
   digits(calibrationBands.reduce((total,b)=>total+b.count/complete.length*
     Math.abs(b.mean_confidence-b.observed_accuracy),0)):null;
 const referenceMean=avg(complete.map(x=>x.reference_brier));
 const researchBrier=avg(complete.map(x=>x.brier));
 const skill=referenceMean===null||referenceMean===0?null:
   digits(1-researchBrier/referenceMean);
 const now=asOfMs;
 if(!Number.isFinite(now)||now<0)throw Error('SCOREBOARD_CLOCK_INVALID');
 const upcoming_previews=[...byId.values()]
   .filter(f=>Date.parse(f.start_utc)>now)
   .sort((a,b)=>Date.parse(a.start_utc)-Date.parse(b.start_utc))
   .slice(0,12).map(f=>({
     event_id:f.event_id,sport:f.sport,start_utc:f.start_utc,
     home:f.home.name,away:f.away.name,
     home_win_probability:f.home_win_probability,draw_probability:f.draw_probability,
     away_win_probability:f.away_win_probability,
     score_unit:f.score_unit||'points',
     projected_home:f.home_projected_points,projected_away:f.away_projected_points,
     receipt_url:'https://github.com/bookieandco/crispy-waddle/blob/main/training/sports/paper-ledger/week001/forecasts/'+safeId(f.event_id)+'.json'
   }));
 const awaiting_final_records=[...byId.values()]
   .filter(f=>Date.parse(f.start_utc)<=now&&!gradesByForecast.has(f.sha256))
   .sort((a,b)=>Date.parse(a.start_utc)-Date.parse(b.start_utc))
   .slice(0,15).map(f=>({
     event_id:f.event_id,sport:f.sport,start_utc:f.start_utc,
     home:f.home.name,away:f.away.name,
     hours_since_kickoff:Math.round((now-Date.parse(f.start_utc))/360000)/10,
     receipt_url:'https://github.com/bookieandco/crispy-waddle/blob/main/training/sports/paper-ledger/week001/forecasts/'+safeId(f.event_id)+'.json',
     status:'NO_PRELIMINARY_GRADE_YET'
   }));
 const awaiting_final=[...byId.values()].filter(f=>Date.parse(f.start_utc)<=now&&!gradesByForecast.has(f.sha256)).length;
 return {schema_version:'jhadina.sports.paper_scoreboard.v1',
   experiment_id:'JH-SPORTS-WEEK-2026-10-13-001',
   total_forecasts:byId.size,preliminary_graded:complete.length,source_health,
   unsettled_forecasts:byId.size-complete.length,
   awaiting_final_count:awaiting_final,awaiting_final_previews:awaiting_final_records,upcoming_previews,
   mean_winner_accuracy:avg(complete.map(x=>x.correct)),
   mean_multiclass_brier:researchBrier,
   mean_reference_brier:referenceMean,
   provisional_brier_skill_vs_reference:skill,
   mean_log_loss:avg(complete.map(x=>x.log_loss)),
   expected_calibration_error:calibrationGap,
   calibration_bands:calibrationBands,
   calibration_status:complete.length>=50?'RESEARCH_ONLY_SAMPLE_50_PLUS':'INSUFFICIENT_OUT_OF_SAMPLE_RESULTS',
   mean_home_score_error:avg(complete.map(x=>x.home_error)),
   mean_away_score_error:avg(complete.map(x=>x.away_error)),
   conflicting_results:conflicts,by_sport:Object.values(grouped).sort((a,b)=>a.sport.localeCompare(b.sport)),
   virtual_bankroll_usd:3100,staked_usd:0,real_bets:0,roi:null,
   eligibility:'RESEARCH_ONLY_NOT_CALIBRATED_NOT_SETTLED',
   caveat:'Unofficial score feed only. No bookmaker lines, player props, market settlement or ROI. Owner approval required for training.'};
}
export function renderMarkdown(s){
 const value=x=>x===null?'—':String(x);
 const rows=s.by_sport.map(v=>'| '+v.sport+' | '+v.forecasts+' | '+v.preliminary_grades+' | '+value(v.accuracy)+' | '+value(v.multiclass_brier_mean)+' |').join('\n');
 const safe=v=>String(v).replace(/[|\r\n]/g,' ').slice(0,70);
 const percent=v=>(v*100).toFixed(1)+'%';
 const waiting=(s.awaiting_final_previews||[]).map(x=>{
   const event='['+safe(x.away)+' at '+safe(x.home)+']('+x.receipt_url+')';
   return '| '+safe(x.start_utc.slice(0,16))+' | '+safe(x.sport)+' | '+event+' | '+String(x.hours_since_kickoff)+' |';
 }).join('\n');
 const upcoming=(s.upcoming_previews||[]).map(x=>{
   const game='['+safe(x.away)+' at '+safe(x.home)+']('+x.receipt_url+')';
   const score=x.score_unit==='points'?String(x.projected_away)+'–'+String(x.projected_home):'Not a score projection';
   return '| '+safe(x.start_utc.slice(0,16))+' | '+safe(x.sport)+' | '+game+' | '+percent(x.home_win_probability)+' | '+score+' |';
 }).join('\n');
 return ['## Jhadina Sports Lab — Week 001','',
 '**Status:** Paper-only, uncalibrated; third-party final observations are not official settlement.','',
 '- Sealed forecasts: **'+s.total_forecasts+'**',
 '- Preliminary scored: **'+s.preliminary_graded+'**',
 '- Events started, awaiting provisional result: **'+s.awaiting_final_count+'**',
 '- Overall winner accuracy: **'+value(s.mean_winner_accuracy)+'**',
 '- Mean multiclass Brier: **'+value(s.mean_multiclass_brier)+'**',
 '- Mean reference Brier (uniform outcomes): **'+value(s.mean_reference_brier)+'**',
 '- Provisional Brier skill vs reference: **'+value(s.provisional_brier_skill_vs_reference)+'**',
 '- Expected calibration error: **'+value(s.expected_calibration_error)+'**',
 '- Calibration readiness: **'+s.calibration_status+'** (a minimum of 50 preliminary grades is an indicative threshold, not certification)',
 '- Conflicting results: **'+s.conflicting_results.length+'**',
 '### Data health from this cloud run','',
 s.source_health?
 ('- Feed responses: **'+s.source_health.fetched+'/'+s.source_health.requested+
   '**; parsing exclusions / provider errors: **'+s.source_health.parse_exclusions+'**'): '- No attached run diagnostics',
 ...(s.source_health?[
   '- Started results overdue more than 12 hours: **'+s.source_health.overdue_12h+'**',
   '- Contradictory provider event observations: **'+s.source_health.provider_conflicts+'**',
   '- Model probability-versus-score review flags: **'+s.source_health.model_signal_disagreements+'**',
   '- Unavailable or degraded sport feeds: **'+
      (s.source_health.unavailable_leagues.length?s.source_health.unavailable_leagues.join(', '):'None')+'**',
   '- Unofficial data only; no licensed odds or official result settlement verified.'
 ]:[]),'',
 '- Real bets: **0**; simulated bankroll: **$3,100**, staked: **$0**; ROI: not available','',
 '### Started events awaiting provisional result evidence','',
 'These events have started but have no published provisional grade. This does not establish that a game has finished or that its source is available.','',
 '| UTC start | Sport | Forecast receipt | Hours since start |',
 '|---|---|---|---:|',waiting||'| — | — | None awaiting | — |','',
 '| Sport | Forecasts | Preliminary graded | Accuracy | Brier |','|---|---:|---:|---:|---:|',rows,'',
 '### Confidence calibration — unofficial paper results only','',
 'Brier skill above zero beats the naive equally likely outcome reference on this small observed sample; negative skill is worse. Calibration is exploratory and must not be presented as a proven edge.','',
 '| Forecast confidence | Count | Mean confidence | Observed hit rate |',
 '|---|---:|---:|---:|',
 (s.calibration_bands||[]).map(b=>'| '+b.label+' | '+b.count+' | '+value(b.mean_confidence)+' | '+value(b.observed_accuracy)+' |').join('\n')||'| — | 0 | — | — |','',
 '### Upcoming paper predictions',
 '',
 'Times in UTC. Home win is an uncalibrated research estimate, not a betting line or guaranteed chance.',
 '',
 '| UTC kickoff | Sport | Event / evidence | Home win | Projected away–home |',
 '|---|---|---|---:|---|',upcoming||'| — | — | No upcoming sealed events | — | — |','',
 'No verified betting market prices or official settlement. No automated training updates.',''].join('\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
   const existing=await readLedger();
   const grades=await readPreliminary();
   let publication;
   try{publication=JSON.parse(await readFile('sports-lab-output/publication.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e;}
   const s=summarizeLedger(existing,grades,publication);
   await mkdir('sports-lab-output',{recursive:true});
   await writeFile('sports-lab-output/scoreboard.json',JSON.stringify(s,null,2)+'\n');
   const md=renderMarkdown(s);
   await writeFile('sports-lab-output/scoreboard.md',md);
   if(publication){
     const runReceipts=publication.files.filter(f=>f.path.includes('/runs/')&&f.path.endsWith('.json'));
     if(runReceipts.length!==1)throw Error('SCOREBOARD_RUN_RECEIPT_REQUIRED');
     const runId=JSON.parse(runReceipts[0].content).run_id;
     if(typeof runId!=='string'||!/^[0-9]{1,20}(?:-[0-9]{1,4})?$/.test(runId))throw Error('SCOREBOARD_RUN_ID_INVALID');
     const summaryPath='training/sports/paper-ledger/week001/summaries/'+runId+'.md';
     const revised={...publication,files:[...publication.files,{path:summaryPath,content:md+'\n'}]};
     checkPublication(revised);
     await writeFile('sports-lab-output/publication.json',JSON.stringify(revised,null,2)+'\n');
   }
   if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,md,{flag:'a'});
   console.log(JSON.stringify({forecasts:s.total_forecasts,grades:s.preliminary_graded,conflicts:s.conflicting_results.length,bet_count:0}));
 }catch(err){console.error('SCOREBOARD_FAILED:',err.message);process.exitCode=1;}
}
