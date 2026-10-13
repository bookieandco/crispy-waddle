#!/usr/bin/env node
/**
 * Build deterministic, append-only study events for later database replay.
 * Makes NO network request, does NOT write to Supabase, and DOES NOT train.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {verifyCase001} from './verify-case.mjs';
import {validateLiveObservation} from './validate-live.mjs';

const sha=(x)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const urls=(xs)=>[...new Set(xs.filter(x=>typeof x==='string'&&/^https:\/\//.test(x)))].sort();

export function exportCase001Events(pregameBytes,availabilityBytes,live){
 const seal=verifyCase001(pregameBytes,availabilityBytes);
 const p=JSON.parse(pregameBytes.toString('utf8'));
 const a=JSON.parse(availabilityBytes.toString('utf8'));
 validateLiveObservation(p,live);
 const base={case_id:p.case_id,event_id:p.event_id,scheduled_kickoff:p.matchup.scheduled_kickoff_utc};
 const records=[
  {
   ...base,event_type:'PREGAME_FORECAST',source_class:'ORIGINAL_CHAT',
   information_cutoff:p.provenance.first_durable_capture,
   evidence_urls:urls(p.thesis.flatMap(t=>t.supports||[]).concat([p.market_reference?.source_url])),
   payload_json:p
  },
  {
   ...base,event_type:'PREGAME_OBSERVATION',source_class:'SOURCE_CAPTURED_AS_OF',
   information_cutoff:a.information_cutoff_utc,
   evidence_urls:urls(a.evidence.map(e=>e.source_url)),
   payload_json:a
  },
  {
   ...base,event_type:'LIVE_OBSERVATION',source_class:'LIVE_PROVISIONAL',
   information_cutoff:live.as_of_utc,
   evidence_urls:urls([live.source_url_context]),
   payload_json:live
  }
 ];
 const kickoff=Date.parse(base.scheduled_kickoff);
 const issued=new Set();
 for(const r of records){
  const asOf=Date.parse(r.information_cutoff);
  if(!Number.isFinite(asOf)||r.case_id!==seal.caseId)throw new Error('STUDY_EVENT_LINEAGE_INVALID');
  if(r.event_type==='LIVE_OBSERVATION'?asOf<kickoff:asOf>=kickoff)throw new Error('STUDY_EVENT_LOOKAHEAD');
  r.record_id='jhadina-sport-study:'+sha({event_type:r.event_type,case_id:r.case_id,
    information_cutoff:r.information_cutoff,payload_json:r.payload_json});
  if(issued.has(r.record_id))throw new Error('STUDY_DUPLICATE_EVENT');
  issued.add(r.record_id);
 }
 return Object.freeze({
  schema_version:'jhadina.sports.study_event_batch.v1',
  case_id:p.case_id,event_id:p.event_id,
  rows:records,
  row_count:records.length,
  source_git_commit:seal.sourceCommit,
  authority:'STAGED_REPLAY_ONLY',
  database_write_performed:false,
  canExecute:false,
  training_run_executed:false
 });
}
const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isMain){
 const [pregame,availability,liveFile,out]=process.argv.slice(2);
 if(!pregame||!availability||!liveFile){console.error('Usage: node export-study-events.mjs PREGAME AVAILABILITY LIVE [OUTPUT]');process.exitCode=2}
 else {
  try{
   const output=JSON.stringify(exportCase001Events(readFileSync(pregame),readFileSync(availability),
     JSON.parse(readFileSync(liveFile,'utf8'))),null,2)+'\n';
   if(out)writeFileSync(out,output,{flag:'wx'});else process.stdout.write(output);
  }catch(e){console.error(e.message);process.exitCode=1}
 }
}
