import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {hash,verifyResearchForecast} from './core.mjs';
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
export function summarizeLedger(forecasts,grades,publication){
 const supplied=publication?.files||[];
 if(publication)checkPublication(publication);
 const f=[...forecasts],g=[...grades];
 for(const file of supplied){
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
   complete.push({sport,event_id:record.event_id,correct:Number(predicted===grade.outcome),brier:grade.multiclass_brier_score,home_error:grade.home_points_absolute_error,away_error:grade.away_points_absolute_error});
 }
 for(const row of complete)grouped[row.sport].preliminary_grades++;
 for(const sport of Object.keys(grouped)){
   const rows=complete.filter(v=>v.sport===sport);
   grouped[sport].accuracy=avg(rows.map(x=>x.correct));
   grouped[sport].multiclass_brier_mean=avg(rows.map(x=>x.brier));
 }
 return {schema_version:'jhadina.sports.paper_scoreboard.v1',
   experiment_id:'JH-SPORTS-WEEK-2026-10-13-001',
   total_forecasts:byId.size,preliminary_graded:complete.length,
   unsettled_forecasts:byId.size-complete.length,
   mean_winner_accuracy:avg(complete.map(x=>x.correct)),
   mean_multiclass_brier:avg(complete.map(x=>x.brier)),
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
 return ['## Jhadina Sports Lab — Week 001','',
 '**Status:** Paper-only, uncalibrated; third-party final observations are not official settlement.','',
 '- Sealed forecasts: **'+s.total_forecasts+'**',
 '- Preliminary scored: **'+s.preliminary_graded+'**',
 '- Overall winner accuracy: **'+value(s.mean_winner_accuracy)+'**',
 '- Mean multiclass Brier: **'+value(s.mean_multiclass_brier)+'**',
 '- Conflicting results: **'+s.conflicting_results.length+'**',
 '- Real bets: **0**; simulated bankroll: **$3,100**, staked: **$0**; ROI: not available','',
 '| Sport | Forecasts | Preliminary graded | Accuracy | Brier |','|---|---:|---:|---:|---:|',rows,'',
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
   if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,md,{flag:'a'});
   console.log(JSON.stringify({forecasts:s.total_forecasts,grades:s.preliminary_graded,conflicts:s.conflicting_results.length,bet_count:0}));
 }catch(err){console.error('SCOREBOARD_FAILED:',err.message);process.exitCode=1;}
}
