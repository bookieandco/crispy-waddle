#!/usr/bin/env node
/** Read-only validator for postkickoff sports observations.
 * Provisional observations never enter the original pregame feature set.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const time=(s,name)=>{
  const t=Date.parse(s);
  if(!Number.isFinite(t))throw new Error(name+'_INVALID');
  return t;
};
export function validateLiveObservation(pregame,observation){
  if(pregame?.schema_version!=='jhadina.sports.study_case.pregame.v1')throw new Error('PREGAME_SCHEMA_INVALID');
  if(observation?.schema_version!=='jhadina.sports.live_observation.v1')throw new Error('LIVE_SCHEMA_INVALID');
  if(pregame.case_id!==observation.case_id||pregame.event_id!==observation.event_id)throw new Error('LIVE_EVENT_MISMATCH');
  if(observation.evidence_class!=='LIVE_PROVISIONAL'||observation.provider_reported_status!=='inprogress')throw new Error('PROVISIONAL_STATUS_INVALID');
  const kickoff=time(pregame.matchup.scheduled_kickoff_utc,'KICKOFF');
  const at=time(observation.as_of_utc,'AS_OF');
  const capture=time(observation.capture_utc,'CAPTURE');
  if(at<kickoff||capture<at)throw new Error('LIVE_CLOCK_CONTRADICTION');
  if(!observation.provider_game_id?.trim()||!observation.data_provider?.trim())throw new Error('LIVE_PROVIDER_ID_REQUIRED');
  const result=observation.provider_reported_score;
  if(!result||![pregame.matchup.home_code,pregame.matchup.away_code].every(team=>Number.isSafeInteger(result[team])&&result[team]>=0)){
    throw new Error('LIVE_SCORE_INVALID');
  }
  const q=observation.provider_reported_clock?.period;
  const clock=observation.provider_reported_clock?.remaining;
  if(!['Q1','Q2','Q3','Q4','OT'].includes(q)||!/^(?:0?\d|1[0-5]):[0-5]\d$/.test(clock||'')){
    throw new Error('LIVE_CLOCK_INVALID');
  }
  if(observation.relationships?.forecast_is_immutable!==true||observation.relationships?.observed_after_kickoff!==true||
     observation.governance?.mayChangeOriginalForecast!==false||observation.governance?.canUpdateModelWeights!==false||
     observation.governance?.canExecute!==false)throw new Error('LIVE_EVIDENCE_AUTHORITY_INVALID');
  if(observation.training_eligibility!=='NONE_UNTIL_VERIFIED_FINAL_AND_REVIEW')throw new Error('LIVE_TRAINING_ELIGIBILITY_INVALID');
  return Object.freeze({
    valid:true,caseId:pregame.case_id,eventId:pregame.event_id,
    source:observation.data_provider,observedAt:observation.as_of_utc,
    capturedAt:observation.capture_utc,status:'PROVISIONAL_ONLY',
    score:{[pregame.matchup.away_code]:result[pregame.matchup.away_code],
           [pregame.matchup.home_code]:result[pregame.matchup.home_code]},
    forecastUnchanged:true,trainingEligible:false
  });
}
const main=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(main){
  const [pregameFile,observationFile]=process.argv.slice(2);
  if(!pregameFile||!observationFile){console.error('Usage: node validate-live.mjs PREGAME.json OBSERVATION.json');process.exitCode=2}
  else {
    try{
      process.stdout.write(JSON.stringify(validateLiveObservation(JSON.parse(readFileSync(pregameFile,'utf8')),
        JSON.parse(readFileSync(observationFile,'utf8'))),null,2)+'\n');
    }catch(e){console.error(e.message);process.exitCode=1}
  }
}
