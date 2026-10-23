import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {RESULT_STATES} from './result-status.mjs';

// Run logs are historic, not official outcomes. They can diagnose why the
// archived grader refused a result, but cannot supply a missing result.
const EVIDENCE_REQUIREMENTS=Object.freeze({
  PARTICIPANT_ID_MISMATCH:'Independently verify both competitor IDs against the forecast',
  START_TIME_DRIFT_OVER_12H:'Verify actual event schedule, postponement and unique event ID',
  SCORE_UNIT_MISMATCH:'Verify match winner or score units; do not convert indicators into points',
  INVALID_RESULT_SCORE:'Obtain a permitted completed event record with a nonblank score',
  MISSING_OBSERVATION_TIME:'Obtain permitted observation provenance and event timestamps',
  OBSERVATION_NOT_AFTER_START:'Obtain a result observation recorded after the event began'
});
const generic='Permitted independent event evidence with matching IDs, credible final status and timestamps';
const norm=x=>typeof x==='string'?x:'';
export function buildResultReviewQueue(unresolved,runReports=[]){
 if(!Array.isArray(unresolved)||!Array.isArray(runReports))throw Error('RESULT_QUEUE_INPUT_INVALID');
 const known=new Set();
 const logs=[...runReports]
   .filter(r=>r&&typeof r==='object'&&typeof r.run_id==='string')
   .sort((a,b)=>Date.parse(a.completed_at_utc||0)-Date.parse(b.completed_at_utc||0));
 const cases=[];
 for(const item of unresolved){
   if(!item||typeof item.event_id!=='string'||known.has(item.event_id))throw Error('RESULT_QUEUE_EVENT_INVALID');
   known.add(item.event_id);
   if(!['NO_ACCEPTED_UNOFFICIAL_RESULT','NOT_STARTED_AT_REVIEW','CONFLICTING_UNOFFICIAL_RESULTS'].includes(item.status))
     throw Error('RESULT_QUEUE_STATUS_INVALID');
   const rejections=[],mentions=[];
   for(const report of logs){
     const abstentions=(Array.isArray(report.abstentions)?report.abstentions:[])
       .filter(a=>a.event_id===item.event_id);
     for(const a of abstentions){
       const code=norm(a.detail||a.reason);
       if(code&&!rejections.includes(code))rejections.push(code);
     }
     const backlog=(Array.isArray(report.pending_result_review)?report.pending_result_review:[])
       .find(p=>p.event_id===item.event_id);
     if(backlog)mentions.push({run_id:report.run_id,status:backlog.status,
       action:backlog.action,observed_at_utc:report.completed_at_utc||null});
   }
   const requirement=new Set([generic]);
   for(const detail of rejections){
     const name=detail.split(':').at(-1);
     if(EVIDENCE_REQUIREMENTS[name])requirement.add(EVIDENCE_REQUIREMENTS[name]);
   }
   const prior=mentions.at(-1)||null;
   cases.push({
     event_id:item.event_id,sport:item.sport,league:item.league,
     scheduled_start_utc:item.scheduled_start_utc,
     resolution:item.status,
     archived_grade_rejections:rejections,
     most_recent_archived_run:prior,
     source_url:item.source_url||null,
     evidence_required:[...requirement],
     contradictory_observations:item.conflicting_observations||[],
     official_sport_result_verified:false,bookmaker_settlement_verified:false,
     approved_for_training:false,
     action:item.status==='CONFLICTING_UNOFFICIAL_RESULTS'?
       'QUARANTINE_PENDING_AUTHORIZED_INDEPENDENT_EVIDENCE':
       'REQUIRE_PERMITTED_INDEPENDENT_EVIDENCE'
   });
 }
 return {schema_version:'jhadina.sports.result_review_queue.v1',
   unresolved_count:cases.length,
   conflicting_count:cases.filter(c=>c.resolution===RESULT_STATES.CONFLICT).length,
   official_settlements:0,training_updates:0,real_bets:0,
   requires_permitted_evidence:true,
   caveat:'Past run logs and rejected results do not independently verify final scores or official settlement.',
   cases:cases.sort((a,b)=>a.scheduled_start_utc.localeCompare(b.scheduled_start_utc)||
     a.event_id.localeCompare(b.event_id))};
}
export async function readArchivedRunReports(dir='training/sports/paper-ledger/week001/runs'){
 let names=[];
 try{names=(await readdir(dir)).filter(x=>/^[0-9]+-[0-9]+\.json$/.test(x));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const reports=[];
 for(const name of names){
   const r=JSON.parse(await readFile(path.join(dir,name),'utf8'));
   if(r.schema_version!=='jhadina.sports.week001_run.v2')throw Error('ARCHIVED_RUN_SCHEMA_INVALID');
   reports.push(r);
 }
 return reports;
}
