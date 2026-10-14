import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function evaluateHealth(report){
 if(report?.schema_version!=='jhadina.sports.week001_run.v2')throw Error('INVALID_RUN_REPORT');
 if(report.placed_bets!==0||report.training_updates!==0||report.virtual_bankroll_usd!==3100||
    report.official_settlements!==0||report.market_quotes!==0)throw Error('PAPER_ONLY_SAFETY_VIOLATION');
 const d=report.diagnostics;
 if(!d||!Number.isInteger(d.fetched)||!Number.isInteger(d.requested)||d.requested<=0||
    d.fetched<0||d.fetched>d.requested)throw Error('INVALID_PROVIDER_DIAGNOSTICS');
 const providerFraction=d.fetched/d.requested;
 if(providerFraction<0.6)throw Error('PROVIDER_COVERAGE_BELOW_MINIMUM');
 const warnings=[];
 const health=report.provider_health||{};
 for(const [league,item] of Object.entries(health)){
   if(item.status==='UNAVAILABLE'||item.status==='DEGRADED'){
     warnings.push({code:'SPORT_FEED_'+item.status,league,requested:item.requested,fetched:item.fetched});
   }
 }
 if((d.overdue_12h_without_verification||0)>0)warnings.push({
   code:'RESULTS_OVERDUE_12H',count:d.overdue_12h_without_verification,
   action:'Review event-specific source URLs and provider errors; do not invent results'
 });
 if((d.final_visible_not_graded||0)>0)warnings.push({
   code:'FINAL_VISIBLE_UNGRADED',count:d.final_visible_not_graded,
   action:'Inspect grading rejection reasons; leave predictions unchanged'
 });
 if((d.conflicting_provider_events||0)>0)warnings.push({
   code:'PROVIDER_RESULT_CONFLICT',count:d.conflicting_provider_events,
   action:'Quarantine conflicting scores; await independent verification'
 });
 if((report.coherence_flags||[]).length>0)warnings.push({
   code:'MODEL_SIGNAL_DISAGREEMENT',count:report.coherence_flags.length,
   action:'Review uncalibrated forecast, do not modify sealed receipts'
 });
 return {schema_version:'jhadina.sports.health.v1',experiment_id:report.experiment_id,
   run_id:report.run_id,status:warnings.length?'DEGRADED':'RESEARCH_PIPELINE_HEALTHY',
   requested:d.requested,fetched:d.fetched,provider_fraction:Math.round(providerFraction*1000)/1000,
   new_forecasts:report.research_forecasts_created,preliminary_grades:report.preliminary_grades_created,
   outstanding_12h:d.overdue_12h_without_verification||0,
   warnings,real_bets:0,paper_only:true,
   caveat:'Feed health does not certify schedules, market odds or settlement.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
   const file=process.argv[2]||'sports-lab-output/run-report.json';
   const report=JSON.parse(await readFile(file,'utf8'));
   const status=evaluateHealth(report);
   await mkdir('sports-lab-output',{recursive:true});
   await writeFile('sports-lab-output/health.json',JSON.stringify(status,null,2)+'\n');
   for(const w of status.warnings)console.log('::warning title=Jhadina Sports Lab '+w.code+'::'+JSON.stringify(w));
   console.log(JSON.stringify({status:status.status,requests:status.requested,successful:status.fetched,
     warnings:status.warnings.length,paper_only:true}));
 }catch(e){console.error('SPORTS_HEALTH_FAILED:',e.message);process.exitCode=1;}
}
