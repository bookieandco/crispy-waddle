import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readLedger,readPreliminary} from './worker.mjs';
import {summarizeLedger} from './scoreboard.mjs';
import {scoreProspectiveControl} from './shadow-control.mjs';
import {SOURCE_ID,requireSourceOperation,sourcePolicyReport} from './source-policy.mjs';
import {buildResultReviewQueue,readArchivedRunReports} from './result-reconciliation.mjs';

const round=x=>Math.round(x*1e5)/1e5;
const mean=values=>values.length?round(values.reduce((a,b)=>a+b,0)/values.length):null;

// Replay only archived, hash-validated forecast and unofficial-grade receipts.
// This report cannot query providers, override scores, settle wagers or train models.
export function reconcileWeek001(forecasts,grades,asOfMs=Date.now(),runReports=[]){
  requireSourceOperation(SOURCE_ID,'HASH_VALIDATE_ARCHIVED_RECEIPTS');
  const scoreboard=summarizeLedger(forecasts,grades,undefined,asOfMs);
  const unique=new Map(forecasts.map(f=>[f.event_id,f]));
  const byHash=new Map([...unique.values()].map(f=>[f.sha256,f]));
  const byForecast=new Map();
  for(const grade of grades){
    if(!byHash.has(grade.forecast_sha256))throw Error('ORPHAN_PRELIMINARY_GRADE');
    const arr=byForecast.get(grade.forecast_sha256)||[];
    arr.push(grade);byForecast.set(grade.forecast_sha256,arr);
  }
  const unresolved=[], pairedBySport=new Map(), counts={};
  let duplicateObservations=0, provisionalOnly=0;
  for(const forecast of unique.values()){
    const sport=forecast.sport;
    counts[sport]??={sport,forecasts:0,provisional_scored:0,missing_preliminary:0,conflicting_unofficial:0};
    counts[sport].forecasts++;
    const observations=byForecast.get(forecast.sha256)||[];
    const scores=new Map();
    for(const grade of observations){
      const key=grade.home_points+':'+grade.away_points;
      if(!scores.has(key))scores.set(key,[]);
      scores.get(key).push(grade);
    }
    duplicateObservations+=observations.length-scores.size;
    if(scores.size===0){
      counts[sport].missing_preliminary++;
      unresolved.push({event_id:forecast.event_id,sport,league:forecast.league,
        scheduled_start_utc:forecast.start_utc,
        status:Date.parse(forecast.start_utc)>asOfMs?'NOT_STARTED_AT_REVIEW':'NO_ACCEPTED_UNOFFICIAL_RESULT',
        source_url:forecast.fixture_source_url,official_settlement:false,
        score:null,action:'REQUIRES_PERMITTED_INDEPENDENT_RESULT_EVIDENCE'});
      continue;
    }
    if(scores.size>1){
      counts[sport].conflicting_unofficial++;
      unresolved.push({event_id:forecast.event_id,sport,league:forecast.league,
        scheduled_start_utc:forecast.start_utc,status:'CONFLICTING_UNOFFICIAL_RESULTS',
        conflicting_observations:[...scores.values()].map(group=>({
          reported_home_points:group[0].home_points,reported_away_points:group[0].away_points,
          observed_at_utc:group.map(x=>x.verified_at_utc),
          source_urls:[...new Set(group.map(x=>x.result_source_url))]
        })),official_settlement:false,score:null,
        action:'QUARANTINE_UNTIL_AUTHORIZED_INDEPENDENT_RECONCILIATION'});
      continue;
    }
    provisionalOnly++;counts[sport].provisional_scored++;
    const first=[...scores.values()][0][0];
    const candidate=scoreProspectiveControl(forecast,first.outcome);
    if(candidate){
      const arr=pairedBySport.get(sport)||[];
      arr.push({original:first.multiclass_brier_score,control:candidate.brier});
      pairedBySport.set(sport,arr);
    }
  }
  if(provisionalOnly!==scoreboard.preliminary_graded ||
     duplicateObservations!==scoreboard.duplicate_result_observations ||
     unresolved.length!==scoreboard.total_forecasts-provisionalOnly)
    throw Error('RECONCILIATION_COUNT_MISMATCH');
  const prospective_by_sport=[...pairedBySport].map(([sport,rows])=>({
    sport,events:rows.length,baseline_mean_brier:mean(rows.map(x=>x.original)),
    fixed_control_mean_brier:mean(rows.map(x=>x.control)),
    control_minus_baseline:mean(rows.map(x=>x.control-x.original))
  })).sort((a,b)=>a.sport.localeCompare(b.sport));
  return {
    schema_version:'jhadina.sports.week001_offline_review.v1',
    experiment_id:'JH-SPORTS-WEEK-2026-10-13-001',
    reviewed_as_of_utc:new Date(asOfMs).toISOString(),
    source_access:'ON_HOLD_UNTIL_RIGHTS_AND_PERMITTED_REPLACEMENT_VERIFIED',
    read_only:true,collect_network:false,
    original_receipts_modified:0,official_settlements:0,
    authorized_licensed_market_quotes:0,real_bets:0,training_updates:0,
    sealed_forecasts:scoreboard.total_forecasts,
    unofficial_scored_unique:provisionalOnly,
    unofficial_grade_receipt_files:grades.length,
    duplicate_identical_result_observations:duplicateObservations,
    missing_unofficial_results:unresolved.filter(x=>x.status==='NO_ACCEPTED_UNOFFICIAL_RESULT').length,
    not_started_at_review:unresolved.filter(x=>x.status==='NOT_STARTED_AT_REVIEW').length,
    conflicting_unofficial_results:unresolved.filter(x=>x.status==='CONFLICTING_UNOFFICIAL_RESULTS').length,
    unresolved,
    result_review_queue:buildResultReviewQueue(unresolved,runReports),
    source_policy:sourcePolicyReport(),
    source_provenance_counts:{
      archived_forecast_urls:new Set([...unique.values()].map(f=>f.fixture_source_url)).size,
      archived_grade_urls:new Set(grades.map(g=>g.result_source_url)).size,
      independent_result_sources_verified:0,
      permission_documents_verified:0
    },
    by_sport:Object.values(counts).sort((a,b)=>a.sport.localeCompare(b.sport)),
    calibration:{
      overall_brier:scoreboard.mean_multiclass_brier,
      equal_outcome_reference_brier:scoreboard.mean_reference_brier,
      brier_skill:scoreboard.provisional_brier_skill_vs_reference,
      ece_descriptive:scoreboard.expected_calibration_error,
      preregistered_fixed_control:scoreboard.prospective_control,
      paired_control_by_sport:prospective_by_sport,
      not_independent_official_ground_truth:true,
      not_market_validated:true,
      note:'All outcomes are unofficial third-party observations; event selection, dependence, source errors and small samples limit calibration. No data fitting or model promotion.'
    },
    rights_and_provenance:{
      historical_provider:'ESPN_UNDOCUMENTED_SITE_FEED',
      automated_retrieval_permission:'NOT_ESTABLISHED',
      public_redistribution_permission:'NOT_ESTABLISHED',
      grades:'UNOFFICIAL_THIRD_PARTY_NOT_BOOKMAKER_SETTLEMENT',
      required:'Owner-approved permitted fixture/result/statistic source with provenance, rights, and separate settlement evidence'
    }
  };
}
export function markdownReview(report){
  return [
    '# Jhadina Sports Lab — Week 001 offline repair review','',
    '**Collection:** PAUSED pending rights review. **Mode:** archived evidence only; no provider calls.','',
    '| Metric | Value |','|---|---:|',
    '| Sealed forecasts | '+report.sealed_forecasts+' |',
    '| Unofficial unique grades | '+report.unofficial_scored_unique+' |',
    '| Unofficial grade receipt files | '+report.unofficial_grade_receipt_files+' |',
    '| Missing unofficial results | '+report.missing_unofficial_results+' |',
    '| Not started at review | '+report.not_started_at_review+' |',
    '| Conflicting unofficial outcomes | '+report.conflicting_unofficial_results+' |',
    '| Model Brier (unofficial) | '+report.calibration.overall_brier+' |',
    '| Reference Brier (unofficial) | '+report.calibration.equal_outcome_reference_brier+' |',
    '| Fixed control paired games | '+report.calibration.preregistered_fixed_control.scored_eligible_events+' |',
    '| Betting / training updates | 0 / 0 |','',
    '## Evidence rights and reconciliation','',
    '- Automated provider collection: **DENIED**',
    '- Historical rejection diagnostics reviewed: **'+report.result_review_queue.cases.filter(c=>c.archived_grade_rejections.length).length+' events**',
    '- Official sporting results verified: **0**',
    '- Official bookmaker settlements verified: **0**','',
    '## Unresolved or conflicting events','',
    ...report.unresolved.map(v=>'- '+v.event_id+': '+v.status+
      (v.conflicting_observations?' (opposing third-party scores preserved in JSON; no official verdict)':'')),
    '',
    '## Limitations','',
    'These observations do not certify official results or sportsbook settlement, data usage rights, or predictive edge.',
    'Prospective fixed-control comparisons remain exploratory. No auto weight changes, payments, or wagers.',''
  ].join('\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const report=reconcileWeek001(await readLedger(),await readPreliminary(),Date.now(),await readArchivedRunReports());
    await mkdir('sports-lab-output',{recursive:true});
    await writeFile('sports-lab-output/offline-review.json',JSON.stringify(report,null,2)+'\n');
    await writeFile('sports-lab-output/offline-review.md',markdownReview(report)+'\n');
    if(process.env.GITHUB_STEP_SUMMARY)
      await writeFile(process.env.GITHUB_STEP_SUMMARY,markdownReview(report)+'\n',{flag:'a'});
    console.log(JSON.stringify({forecasts:report.sealed_forecasts,
      unofficial_scored:report.unofficial_scored_unique,
      unresolved:report.unresolved.length,conflicts:report.conflicting_unofficial_results,
      real_bets:0,training_updates:0,source_access:report.source_access}));
  }catch(err){console.error('OFFLINE_REVIEW_FAILED',err.message);process.exitCode=1;}
}
