import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyTimelineCommand } from '@jhadina/director-core/timeline-command';
import { createTimeline, type EditableTimeline, type TimelineVersion } from '@jhadina/director-core/timeline-model';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  advanceAskProcessReplicationJob,
  createAskProcessReplicationJob,
  getProcessReplicationJobForUser,
} from '@/lib/director-process-replication-service';
import { createAndSubmitAskVideoJob } from '@/lib/director-video-job-service';
import { reconcileDirectorVideoJobs } from '@/lib/director-video-job-reconciler';
import { runDirectorCertificationStudy } from '@/lib/director-certification-study';
import { readDirectorCertificationMp4Duration } from '@/lib/director-certification-mp4';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

const DEFAULT_DIRECTOR_CERT_GATEWAY_URL =
  'https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-live-cert-gateway';

async function vercelOidcToken(request:Request):Promise<string|undefined>{
  const environmentToken=process.env.VERCEL_OIDC_TOKEN?.trim();
  if(environmentToken) return environmentToken;
  return request.headers.get('x-vercel-oidc-token')?.trim()||undefined;
}

async function forwardToDirectorGateway(request:Request,body:CertBody):Promise<NextResponse>{
  const token=await vercelOidcToken(request);
  if(!token){
    return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});
  }
  const endpoint=process.env.JHADINA_DIRECTOR_LIVE_CERT_GATEWAY_URL?.trim()||DEFAULT_DIRECTOR_CERT_GATEWAY_URL;
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store',
  });
  const payload=await response.json().catch(()=>({ok:false,error:'DIRECTOR_LIVE_CERT_GATEWAY_INVALID_JSON'})) as Record<string,unknown>;
  return NextResponse.json(payload,{status:response.status});
}

type CertBody={
  action?:'start'|'advance';
  runId?:string;
  sourceUrl?:string;
  durations?:number[];
  runToken?:string;
};

type CertRun={
  id:string;
  source_url:string;
  status:string;
  replication_job_id:string|null;
  video_job_ids:string[]|null;
  artifact_ids:string[]|null;
  requested_durations:number[]|null;
  measured_durations:Record<string,number>|null;
  receipts:Record<string,unknown>|null;
  error:string|null;
};

function boundedDurations(input:unknown):number[]{
  const raw=Array.isArray(input)?input:[30,600,1500,3600];
  const values=[...new Set(raw.map(Number).filter(value=>Number.isFinite(value)&&value>=1&&value<=3600).map(value=>Math.round(value)))];
  if(!values.length||values.length>4)throw new Error('DIRECTOR_LIVE_CERT_DURATION_MATRIX_INVALID');
  return values;
}

async function loadRun(client:SupabaseClient,runId:string):Promise<CertRun>{
  const {data,error}=await client.from('director_live_certification_runs').select('*').eq('id',runId).single();
  if(error)throw error;
  return data as CertRun;
}

async function patchRun(client:SupabaseClient,runId:string,patch:Record<string,unknown>):Promise<void>{
  const {error}=await client.from('director_live_certification_runs')
    .update({...patch,updated_at:new Date().toISOString()}).eq('id',runId);
  if(error)throw error;
}

async function ensureCertificationUser(client:SupabaseClient):Promise<string>{
  const email='director-certification@system.jhadina.test';
  const {data:list,error:listError}=await client.auth.admin.listUsers({page:1,perPage:100});
  if(listError)throw listError;
  const existing=list.users.find(user=>user.email===email);
  if(existing)return existing.id;
  const {data,error}=await client.auth.admin.createUser({
    email,
    email_confirm:true,
    app_metadata:{system_principal:'director-live-certification'},
    user_metadata:{display_name:'Director Live Certification'},
  });
  if(error)throw error;
  if(!data.user?.id)throw new Error('DIRECTOR_LIVE_CERT_USER_BOOTSTRAP_FAILED');
  return data.user.id;
}

async function consumeRunToken(client:SupabaseClient,runToken:string|undefined):Promise<string>{
  if(!runToken?.trim())throw new Error('DIRECTOR_LIVE_CERT_UNAUTHORIZED');
  const hash=createHash('sha256').update(runToken.trim()).digest('hex');
  const now=new Date().toISOString();
  const {data,error}=await client.from('director_live_certification_tokens')
    .update({consumed_at:now})
    .eq('token_hash',hash)
    .is('consumed_at',null)
    .gt('expires_at',now)
    .select('user_id')
    .maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('DIRECTOR_LIVE_CERT_UNAUTHORIZED');
  const userId=data.user_id?String(data.user_id):await ensureCertificationUser(client);
  if(!data.user_id){
    const {error:bindError}=await client.from('director_live_certification_tokens')
      .update({user_id:userId}).eq('token_hash',hash);
    if(bindError)throw bindError;
  }
  return userId;
}

async function launchVideoMatrix(client:SupabaseClient,run:CertRun,userId:string){
  const replication=run.replication_job_id
    ? await getProcessReplicationJobForUser(userId,run.replication_job_id)
    : undefined;
  if(!replication||replication.status!=='recipe_ready') return run;

  const durations=boundedDurations(run.requested_durations);
  const jobIds:string[]=[];
  for(let index=0;index<durations.length;index+=1){
    const duration=durations[index]!;
    const result=await createAndSubmitAskVideoJob({
      userId,
      activeTask:`create a ${duration} second film using the replicated Director process. This is a live runtime certification smoke artifact; preserve editability and do not claim cinematic quality.`,
      ...(index===0?{activeProject:replication.projectId}:{}),
      clientRequestId:`${run.id}:video:${duration}`,
      certification:true,
    });
    jobIds.push(result.job.id);
  }
  await patchRun(client,run.id,{status:'rendering',video_job_ids:jobIds,error:null});
  return loadRun(client,run.id);
}

function snapshot(timeline:EditableTimeline){
  return {
    tracks:timeline.tracks,
    transitions:timeline.transitions,
    markers:timeline.markers,
    playheadSeconds:timeline.playheadSeconds,
  };
}

function versionEntry(
  timeline:EditableTimeline,
  version:number,
  message:string,
  parentVersionId?:string,
):TimelineVersion{
  const snap=snapshot(timeline);
  const id=`timeline:${timeline.projectId}:v${version}`;
  return {
    id,version,
    ...(parentVersionId?{parentVersionId}:{}),
    createdAt:new Date().toISOString(),
    createdBy:'system',
    message,
    snapshotHash:createHash('sha256').update(JSON.stringify(snap)).digest('hex'),
    snapshot:snap,
  };
}

async function persistEditableProof(client:SupabaseClient,userId:string,job:any,asset:any,duration:number,replicationJobId:string){
  const clipId=`clip:${job.id}:master`;
  let timeline=createTimeline({
    projectId:job.project_id,
    fps:24,width:1920,height:1080,durationSeconds:duration,playheadSeconds:0,
    tracks:[{
      id:`track:${job.id}:video`,name:'Certification master',kind:'video',index:0,relationship:'primary',
      clips:[{
        id:clipId,assetId:asset.id,trackId:`track:${job.id}:video`,name:`${duration}s smoke master`,
        startSeconds:0,durationSeconds:duration,sourceInSeconds:0,sourceOutSeconds:duration,sourceDurationSeconds:duration,
        effects:[],generativeRegions:[],
      }],
    }],
    transitions:[],markers:[],
  });
  const v1=versionEntry(timeline,1,'Live certification baseline');
  timeline={...timeline,versions:[v1]};
  const trimAmount=Math.min(0.5,Math.max(0.1,duration/100));
  const edited=applyTimelineCommand(timeline,{
    type:'trim',clipId,startSeconds:0,durationSeconds:Math.max(0.1,duration-trimAmount),
  });
  const v2=versionEntry(edited,2,'Live certification localized trim',v1.id);
  const editedTimeline={...edited,versions:[v1,v2]};

  const rows=[
    {id:v1.id,project_id:job.project_id,owner_user_id:userId,version:1,parent_id:null,timeline:{...timeline,versions:[v1]},evidence_ids:[asset.id,job.id]},
    {id:v2.id,project_id:job.project_id,owner_user_id:userId,version:2,parent_id:v1.id,timeline:editedTimeline,evidence_ids:[asset.id,job.id,'localized-edit-proof']},
  ];
  const {error}=await client.from('director_editable_timeline_snapshots').upsert(rows,{onConflict:'id'});
  if(error) throw error;

  await client.from('director_production_projects').upsert({
    id:job.project_id,
    owner_user_id:userId,
    version:2,
    title:`Director live certification ${duration}s`,
    status:'final',
    snapshot:{
      liveCertification:true,
      qualityClaim:false,
      sourceReplicationJobId:replicationJobId,
      videoJobId:job.id,
      targetDurationSeconds:duration,
      timelineVersionId:v2.id,
      finalMasterAssetId:asset.id,
      editable:true,
    },
    evidence_ids:[asset.id,job.id,v1.id,v2.id],
    updated_at:new Date().toISOString(),
  },{onConflict:'id'});

  const {error:stageError}=await client.from('director_creative_stages')
    .update({status:'approved',output_artifact_ids:[asset.id,v2.id],updated_at:new Date().toISOString()})
    .eq('project_id',job.project_id)
    .eq('kind','final');
  if(stageError) throw stageError;
  return {baseline:v1.id,edited:v2.id,assetId:asset.id};
}

async function storedMeasuredDuration(client:SupabaseClient,asset:{uri?:string}):Promise<number>{
  const uri=String(asset.uri??'');
  const prefix='storage://director-media/';
  if(!uri.startsWith(prefix)) throw new Error('DIRECTOR_LIVE_CERT_STORAGE_URI_INVALID');
  const objectPath=uri.slice(prefix.length);
  const {data,error}=await client.storage.from('director-media').download(objectPath);
  if(error) throw error;
  const bytes=new Uint8Array(await data.arrayBuffer());
  return readDirectorCertificationMp4Duration(bytes);
}

async function advanceRun(client:SupabaseClient,run:CertRun,userId:string){
  let current=run;
  if(!current.replication_job_id) throw new Error('DIRECTOR_LIVE_CERT_REPLICATION_JOB_MISSING');
  const replication=await advanceAskProcessReplicationJob(userId,current.replication_job_id);
  if(!replication) throw new Error('DIRECTOR_LIVE_CERT_REPLICATION_JOB_NOT_FOUND');
  if(replication.status==='failed'||replication.status==='blocked'){
    await patchRun(client,current.id,{status:'failed',error:`REPLICATION:${replication.status}:${replication.phase}`});
    return loadRun(client,current.id);
  }
  if(replication.status!=='recipe_ready'&&replication.status!=='completed'){
    await patchRun(client,current.id,{status:'studying',error:null});
    return loadRun(client,current.id);
  }

  if(!(current.video_job_ids??[]).length){
    current=await launchVideoMatrix(client,current,userId);
  }

  await reconcileDirectorVideoJobs(client,{limit:25});
  const ids=current.video_job_ids??[];
  const {data:jobs,error:jobsError}=await client.from('director_video_jobs')
    .select('id,project_id,target_duration_seconds,status,provider_id,provider_job_id,preview_asset_id,spec,error')
    .in('id',ids);
  if(jobsError) throw jobsError;
  const jobRows=jobs??[];
  const failure=jobRows.find((job:any)=>job.status==='failed'||job.status==='blocked');
  if(failure){
    await patchRun(client,current.id,{status:'failed',error:`VIDEO:${failure.id}:${failure.error??failure.status}`});
    return loadRun(client,current.id);
  }
  if(jobRows.length!==ids.length||jobRows.some((job:any)=>job.status!=='preview_ready')){
    await patchRun(client,current.id,{status:'rendering',error:null});
    return loadRun(client,current.id);
  }

  const assetIds=jobRows.map((job:any)=>String(job.preview_asset_id));
  const {data:assets,error:assetError}=await client.from('director_generated_editing_assets')
    .select('id,project_id,generation_job_id,provider_id,uri,mime_type,sha256,metadata')
    .in('id',assetIds);
  if(assetError) throw assetError;
  const assetById=new Map((assets??[]).map((asset:any)=>[String(asset.id),asset]));
  const measured:Record<string,number>={};
  const timelines:Record<string,unknown>={};

  for(const job of jobRows as any[]){
    const duration=Number(job.target_duration_seconds);
    const asset=assetById.get(String(job.preview_asset_id));
    if(!asset) throw new Error(`DIRECTOR_LIVE_CERT_ASSET_MISSING:${job.id}`);
    const measuredDuration=await storedMeasuredDuration(client,asset);
    measured[String(duration)]=measuredDuration;
    if(Math.abs(measuredDuration-duration)>1.25){
      throw new Error(`DIRECTOR_LIVE_CERT_DURATION_MISMATCH:${duration}:${measuredDuration}`);
    }
    timelines[String(duration)]=await persistEditableProof(client,userId,job,asset,duration,replication.id);
  }

  const {data:rehearsalEvents,error:rehearsalError}=await client.from('director_video_job_events')
    .select('job_id,event_type,metadata,created_at')
    .in('job_id',ids)
    .eq('event_type','certification_rehearsal_approved');
  if(rehearsalError) throw rehearsalError;
  if((rehearsalEvents??[]).length!==ids.length) throw new Error('DIRECTOR_LIVE_CERT_REHEARSAL_RECEIPTS_INCOMPLETE');

  const {data:studyRows,error:studyError}=await client.from('director_studies')
    .select('id,status,observations_seen,source_url').in('id',replication.studyIds);
  if(studyError) throw studyError;
  const {data:obsRows,error:obsError}=await client.from('director_study_observations')
    .select('id,study_id,kind,start_seconds,end_seconds,confidence,provenance')
    .in('study_id',replication.studyIds);
  if(obsError) throw obsError;
  if(!(studyRows??[]).length||!(obsRows??[]).length) throw new Error('DIRECTOR_LIVE_CERT_STUDY_EVIDENCE_MISSING');

  const receipts={
    sourceUrl:current.source_url,
    replicationJobId:replication.id,
    studyIds:replication.studyIds,
    studyObservationCount:(obsRows??[]).length,
    rehearsalReceipts:rehearsalEvents,
    timelines,
    durationToleranceSeconds:1.25,
    qualityClaim:false,
    smokeRenderer:true,
  };

  await client.from('director_process_replication_jobs')
    .update({status:'completed',phase:'live-certification',updated_at:new Date().toISOString()})
    .eq('id',replication.id);
  await patchRun(client,current.id,{
    status:'completed',
    artifact_ids:assetIds,
    measured_durations:measured,
    receipts,
    error:null,
    completed_at:new Date().toISOString(),
  });
  return loadRun(client,current.id);
}

export async function POST(request:Request){
  const body=await request.json().catch(()=>({})) as CertBody;
  const client=createServiceRoleClient();
  if(!client) return forwardToDirectorGateway(request,body);
  try{
    const userId=await consumeRunToken(client,body.runToken);
    const action=body.action??'start';

    if(action==='start'){
      if(typeof body.sourceUrl!=='string'||!/^https?:\/\//i.test(body.sourceUrl)){
        return NextResponse.json({ok:false,error:'DIRECTOR_LIVE_CERT_SOURCE_URL_REQUIRED'},{status:400});
      }
      const runId=body.runId?.trim()||`director-live-cert:${randomUUID()}`;
      const durations=boundedDurations(body.durations);
      const {error:runError}=await client.from('director_live_certification_runs').insert({
        id:runId,source_url:body.sourceUrl,status:'queued',requested_durations:durations,updated_at:new Date().toISOString(),
      });
      if(runError) throw runError;

      const created=await createAskProcessReplicationJob({
        userId:userId,
        activeTask:`Study this process at ${body.sourceUrl} and replicate this process better as an editable 30 second film with no AI slop.`,
        clientRequestId:`${runId}:replication`,
      });
      await patchRun(client,runId,{status:'studying',replication_job_id:created.job.id});
      const studyReceipt=await runDirectorCertificationStudy({
        client,
        sourceUrl:body.sourceUrl,
        studyIds:created.job.studyIds,
      });
      await patchRun(client,runId,{receipts:{studyAdapter:'in-process',studyObservationCount:studyReceipt.observationCount}});
      const advanced=await advanceRun(
        client,
        await loadRun(client,runId),
        userId,
      );
      return NextResponse.json({ok:true,run:advanced});
    }

    if(!body.runId?.trim()) return NextResponse.json({ok:false,error:'DIRECTOR_LIVE_CERT_RUN_ID_REQUIRED'},{status:400});
    const advanced=await advanceRun(
      client,
      await loadRun(client,body.runId.trim()),
      userId,
    );
    return NextResponse.json({ok:true,run:advanced});
  }catch(cause){
    const message=cause instanceof Error?cause.message:'DIRECTOR_LIVE_CERT_FAILED';
    const status=message==='DIRECTOR_LIVE_CERT_UNAUTHORIZED'?401:500;
    return NextResponse.json({ok:false,error:message},{status});
  }
}


export async function GET(request:Request){
  const url=new URL(request.url);
  const durations=url.searchParams.get('durations')?.split(',').map(Number);
  const body:CertBody={
    action:url.searchParams.get('action')==='advance'?'advance':'start',
    runToken:url.searchParams.get('runToken')??undefined,
    runId:url.searchParams.get('runId')??undefined,
    sourceUrl:url.searchParams.get('sourceUrl')??undefined,
    ...(durations?.length?{durations}:{}),
  };
  const headers=new Headers(request.headers);
  headers.set('content-type','application/json');
  const response=await POST(new Request(request.url,{
    method:'POST',
    headers,
    body:JSON.stringify(body),
  }));
  response.headers.set('cache-control','no-store');
  response.headers.set('referrer-policy','no-referrer');
  return response;
}
