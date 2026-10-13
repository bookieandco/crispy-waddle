#!/usr/bin/env node
/**
 * Jhadina NFL probability baseline. Research-only, no financial actions.
 * Strictly distinguishes an already-published reference captured after kickoff
 * from an independent, timestamped original model forecast.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gradeSportsStudyCase} from './grade-case.mjs';

const finite=(n,code)=>{if(typeof n!=='number'||!Number.isFinite(n))throw Error(code);return n};
const when=(s,code)=>{const t=Date.parse(s);if(!Number.isFinite(t))throw Error(code);return t};
const rnd=n=>Number(n.toFixed(8));

export function compareArchivedProbabilityBaseline(pregame,archive,overlap,officialFinal=null){
  if(pregame?.schema_version!=='jhadina.sports.study_case.pregame.v1')throw Error('PREGAME_SCHEMA_INVALID');
  if(archive?.schema_version!=='jhadina.sports.study_case.archived_benchmark.v1')throw Error('ARCHIVE_SCHEMA_INVALID');
  if(overlap?.schema_version!=='jhadina.sports.source_overlap.v1')throw Error('OVERLAP_SCHEMA_INVALID');
  if(![archive,overlap].every(x=>x.case_id===pregame.case_id&&x.event_id===pregame.event_id))throw Error('EVENT_ID_MISMATCH');
  const start=when(pregame.matchup.scheduled_kickoff_utc,'START_TIME_INVALID');
  const firstCapture=when(pregame.provenance.first_durable_capture,'CAPTURE_TIME_INVALID');
  const published=when(archive.information_originally_published,'PUBLICATION_TIME_INVALID');
  const archived=when(archive.archived_at_utc,'ARCHIVE_TIME_INVALID');
  if(published>=start||archived<start||firstCapture>=start||published>firstCapture)throw Error('AS_OF_BOUNDARY_INVALID');
  if(archive.classification!=='POST_KICKOFF_ARCHIVE_OF_PREPUBLISHED_MARKET'||
     archive.source_class!=='PUBLISHED_ODDS_SNAPSHOT_NOT_EXECUTABLE_QUOTE'||
     archive.governance?.usable_as_original_forecast_feature!==false||
     archive.governance?.canExecute!==false)throw Error('ARCHIVE_AUTHORITY_INVALID');
  if(archive.market?.home!==pregame.matchup.home_code||
     archive.market?.away!==pregame.matchup.away_code)throw Error('MARKET_PARTICIPANT_MISMATCH');
  const h=finite(archive.market.home_moneyline_american,'HOME_PRICE_INVALID');
  const a=finite(archive.market.away_moneyline_american,'AWAY_PRICE_INVALID');
  if(!Number.isInteger(h)||h>=-100||!Number.isInteger(a)||a<=100)throw Error('MARKET_PRICE_FORMAT_INVALID');
  const rawHome=-h/(-h+100);
  const rawAway=100/(a+100);
  const baseline=rawHome/(rawHome+rawAway);
  const p=finite(pregame.original_prediction.home_win_probability,'FORECAST_INVALID');
  if(p<=0||p>=1||!Number.isFinite(baseline)||baseline<=0||baseline>=1)throw Error('PROBABILITY_INVALID');
  if(Math.abs(archive.derived.home_no_vig_probability-baseline)>1e-8||
     Math.abs(archive.derived.original_forecast_home_probability-p)>1e-8)throw Error('ARCHIVED_CALCULATION_CONFLICT');
  const other=overlap.potentially_overlapping_public_forecast;
  const scoreMatches=other.predicted_score[pregame.matchup.home_code]===pregame.original_prediction.home_projected_points&&
    other.predicted_score[pregame.matchup.away_code]===pregame.original_prediction.away_projected_points;
  if(scoreMatches!==overlap.assessment.exact_score_match)throw Error('SOURCE_OVERLAP_CONFLICT');
  if(scoreMatches&&overlap.assessment.independence_certified!==false)throw Error('UNSUPPORTED_INDEPENDENCE_CLAIM');
  let graded=null,statComparison=null;
  if(officialFinal!==null){
    graded=gradeSportsStudyCase(pregame,officialFinal);
    const winner=graded.result.winner;
    const y=winner===pregame.matchup.home_code?1:winner===pregame.matchup.away_code?0:null;
    const sq=(q)=>(q-y)*(q-y);
    const ll=(q)=>-(y*Math.log(q)+(1-y)*Math.log(1-q));
    statComparison=y===null?null:{
      original_brier:rnd(sq(p)),baseline_brier:rnd(sq(baseline)),
      brier_difference_original_minus_baseline:rnd(sq(p)-sq(baseline)),
      original_log_loss:rnd(ll(p)),baseline_log_loss:rnd(ll(baseline)),
      log_loss_difference_original_minus_baseline:rnd(ll(p)-ll(baseline)),
      lower_is_better:true
    };
  }
  return Object.freeze({
    schema_version:'jhadina.sports.probability_comparison.v1',
    case_id:pregame.case_id,event_id:pregame.event_id,
    comparison_state:officialFinal===null?'AWAITING_FINAL':'RESULT_SUPPLIED_REQUIRES_INDEPENDENT_VERIFICATION',
    original_forecast_probability:p,
    archived_baseline_probability:rnd(baseline),
    original_minus_baseline_percentage_points:rnd((p-baseline)*100),
    published_reference_date:archive.information_originally_published,
    archived_reference_date:archive.archived_at_utc,
    reference_was_captured_after_kickoff:true,
    exact_published_analyst_score_overlap:scoreMatches,
    independently_produced_forecast_certified:false,
    direct_comparison_to_matching_analyst_is_not_independent:scoreMatches,
    final_score_candidate:graded?.result??null,
    statistical_comparison:statComparison,
    source_url:archive.source_url,
    samples:officialFinal===null?0:1,
    calibrated:false,
    training_status:'RESEARCH_ONLY',
    canTrainAutomatically:false,
    canExecute:false
  });
}
const invoked=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(invoked){
  const [pregame,archive,overlap,finalPath,out]=process.argv.slice(2);
  if(!pregame||!archive||!overlap){
    console.error('Usage: node compare-probabilities.mjs PREGAME ARCHIVED_MARKET SOURCE_OVERLAP [OFFICIAL_FINAL] [OUTPUT]');
    process.exitCode=2;
  }else{
    try{
      const load=path=>JSON.parse(readFileSync(path,'utf8'));
      const result=compareArchivedProbabilityBaseline(load(pregame),load(archive),load(overlap),finalPath?load(finalPath):null);
      const body=JSON.stringify(result,null,2)+'\n';
      if(out)writeFileSync(out,body,{flag:'wx'});else process.stdout.write(body);
    }catch(error){console.error(error.message);process.exitCode=1}
  }
}
