import { NextResponse } from 'next/server';
import type { Observation } from '@jhadina/director-core/observation-bus';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createSupabaseStudyObservationStore } from '@/lib/director-study-observation-store';
import { reconcileDirectorProcessReplicationJobs } from '@/lib/director-process-replication-reconciler';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Body={
  studyId?:unknown;
  replicationJobId?:unknown;
  status?:unknown;
  error?:unknown;
  observations?:unknown;
};

function boundedText(value:unknown,max=500):string|undefined{
  return typeof value==='string'&&value.trim()?value.trim().slice(0,max):undefined;
}

function parseObservation(studyId:string,raw:unknown,index:number):Observation{
  if(!raw||typeof raw!=='object') throw new Error(`DIRECTOR_STUDY_OBSERVATION_INVALID:${index}`);
  const item=raw as Record<string,unknown>;
  const id=boundedText(item.id,240);
  const kind=boundedText(item.kind,120);
  const time=item.time&&typeof item.time==='object'?item.time as Record<string,unknown>:undefined;
  const startSeconds=typeof time?.startSeconds==='number'?time.startSeconds:NaN;
  const endSeconds=typeof time?.endSeconds==='number'?time.endSeconds:NaN;
  const confidence=typeof item.confidence==='number'?item.confidence:NaN;
  const provenance=item.provenance&&typeof item.provenance==='object'&&!Array.isArray(item.provenance)
    ? item.provenance as Record<string,unknown>
    : {};
  const provider=boundedText(provenance.provider,120);
  const source=boundedText(provenance.source,240);
  if(!id||!kind||!provider||!source) throw new Error(`DIRECTOR_STUDY_OBSERVATION_FIELDS_REQUIRED:${index}`);
  if(!Number.isFinite(startSeconds)||startSeconds<0||!Number.isFinite(endSeconds)||endSeconds<startSeconds){
    throw new Error(`DIRECTOR_STUDY_OBSERVATION_TIME_INVALID:${index}`);
  }
  if(!Number.isFinite(confidence)||confidence<0||confidence>1){
    throw new Error(`DIRECTOR_STUDY_OBSERVATION_CONFIDENCE_INVALID:${index}`);
  }
  return {
    id,
    assetId:studyId,
    kind,
    time:{startSeconds,endSeconds},
    payload:item.payload??{},
    confidence,
    provenance:{...provenance,provider,source},
  };
}

export async function POST(request:Request){
  const expected=process.env.JHADINA_DIRECTOR_STUDY_WORKER_TOKEN?.trim();
  if(!expected||request.headers.get('authorization')!==`Bearer ${expected}`){
    return NextResponse.json({ok:false},{status:401});
  }
  let body:Body;
  try{body=await request.json() as Body;}
  catch{return NextResponse.json({ok:false,error:'DIRECTOR_STUDY_CALLBACK_JSON_INVALID'},{status:400});}

  const studyId=boundedText(body.studyId,240);
  const replicationJobId=boundedText(body.replicationJobId,240);
  const status=body.status==='running'||body.status==='completed'||body.status==='failed'?body.status:undefined;
  if(!studyId||!replicationJobId||!status){
    return NextResponse.json({ok:false,error:'DIRECTOR_STUDY_CALLBACK_FIELDS_REQUIRED'},{status:400});
  }

  const client=createServiceRoleClient();
  if(!client) return NextResponse.json({ok:false,error:'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED'},{status:503});

  const {data:job,error:jobError}=await client.from('director_process_replication_jobs')
    .select('id,study_ids').eq('id',replicationJobId).maybeSingle();
  if(jobError) throw jobError;
  const studyIds=Array.isArray(job?.study_ids)?job.study_ids.filter((value):value is string=>typeof value==='string'):[];
  if(!job||!studyIds.includes(studyId)){
    return NextResponse.json({ok:false,error:'DIRECTOR_STUDY_CALLBACK_JOB_MISMATCH'},{status:409});
  }

  const rawObservations=Array.isArray(body.observations)?body.observations:[];
  if(rawObservations.length>500){
    return NextResponse.json({ok:false,error:'DIRECTOR_STUDY_CALLBACK_BATCH_TOO_LARGE'},{status:413});
  }

  try{
    const observations=rawObservations.map((raw,index)=>parseObservation(studyId,raw,index));
    const store=createSupabaseStudyObservationStore(client);
    await store.save(studyId,observations);

    const {count,error:countError}=await client.from('director_study_observations')
      .select('id',{head:true,count:'exact'}).eq('study_id',studyId);
    if(countError) throw countError;
    const {data:lastObservation,error:lastError}=await client.from('director_study_observations')
      .select('end_seconds').eq('study_id',studyId).order('end_seconds',{ascending:false}).limit(1).maybeSingle();
    if(lastError) throw lastError;
    const lastTime=lastObservation?Number(lastObservation.end_seconds):0;
    const update:Record<string,unknown>={
      status,
      observations_seen:count??0,
      ...(lastTime>0?{last_time_seconds:lastTime}:{}),
      ...(status==='completed'?{completed_at:new Date().toISOString(),error:null}:{}),
      ...(status==='failed'?{completed_at:new Date().toISOString(),error:boundedText(body.error,2000)??'DIRECTOR_STUDY_WORKER_FAILED'}:{}),
    };
    const {error:updateError}=await client.from('director_studies')
      .update({...update,updated_at:new Date().toISOString()}).eq('id',studyId);
    if(updateError) throw updateError;

    const reconciliation=await reconcileDirectorProcessReplicationJobs(client,{limit:1,jobId:replicationJobId});
    return NextResponse.json({ok:true,accepted:observations.length,totalObservations:count??0,reconciliation});
  }catch(cause){
    return NextResponse.json({
      ok:false,
      error:cause instanceof Error?cause.message:'DIRECTOR_STUDY_CALLBACK_FAILED',
    },{status:500});
  }
}
