import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compileProcessRecipe,
  compileRecipeToCreativeStageGraph,
  improveProcessRecipe,
} from '@jhadina/director-core/process-replication';
import {
  deriveDirectorNativeImprovements,
  extractDirectorProcessObservation,
} from '@jhadina/director-core/process-observation';
import { createSupabaseStudyObservationStore } from '@/lib/director-study-observation-store';

type ReplicationStatus='queued'|'studying'|'recipe_ready'|'executing'|'review'|'completed'|'blocked'|'failed';
type JobRow={
  id:string;
  owner_user_id:string;
  client_request_id:string;
  project_id:string;
  objective:string;
  source_urls:string[]|null;
  source_artifact_refs:string[]|null;
  study_ids:string[]|null;
  improve_before_execute:boolean;
  editable_delivery:boolean;
  target_duration_seconds:number|null;
  target_kind:'ad'|'short'|'episode'|'film'|'video';
  status:ReplicationStatus;
  phase:string;
  error:string|null;
  updated_at:string;
};
type StudyRow={
  id:string;
  source_url:string;
  status:'queued'|'running'|'paused'|'completed'|'failed';
  error:string|null;
  updated_at:string;
};

export interface DirectorProcessReplicationSummary{
  inspected:number;
  dispatchedStudies:number;
  studying:number;
  recipeReady:number;
  blocked:number;
  failed:number;
}

async function patchJob(client:SupabaseClient,id:string,patch:Record<string,unknown>):Promise<void>{
  const {error}=await client.from('director_process_replication_jobs')
    .update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
  if(error) throw error;
}

async function patchStudy(client:SupabaseClient,id:string,patch:Record<string,unknown>):Promise<void>{
  const {error}=await client.from('director_studies')
    .update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
  if(error) throw error;
}

function studyWorkerConfigured():boolean{
  return Boolean(
    process.env.JHADINA_DIRECTOR_STUDY_WORKER_URL?.trim() &&
    process.env.JHADINA_DIRECTOR_STUDY_CALLBACK_URL?.trim() &&
    process.env.JHADINA_DIRECTOR_STUDY_WORKER_TOKEN?.trim()
  );
}

async function dispatchStudy(study:StudyRow,replicationJobId:string):Promise<void>{
  const endpoint=process.env.JHADINA_DIRECTOR_STUDY_WORKER_URL!.trim();
  const callbackUrl=process.env.JHADINA_DIRECTOR_STUDY_CALLBACK_URL!.trim();
  const token=process.env.JHADINA_DIRECTOR_STUDY_WORKER_TOKEN!.trim();
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
    body:JSON.stringify({
      studyId:study.id,
      sourceUrl:study.source_url,
      callbackUrl,
      replicationJobId,
      contract:'DIRECTOR_STUDY_WORKER_V1',
    }),
  });
  if(!response.ok){
    const body=await response.text().catch(()=> '');
    throw new Error(`DIRECTOR_STUDY_WORKER_DISPATCH_FAILED:${response.status}:${body.slice(0,240)}`);
  }
}


async function materializeDirectorPlan(client:SupabaseClient,job:JobRow,studies:readonly StudyRow[]):Promise<void>{
  const observationStore=createSupabaseStudyObservationStore(client);
  const observations=await observationStore.list(studies.map(study=>study.id));
  const processObservations=observations
    .map((observation,index)=>extractDirectorProcessObservation(observation,index))
    .filter((value):value is NonNullable<typeof value>=>Boolean(value));

  if(!processObservations.length){
    await patchJob(client,job.id,{
      status:'blocked',phase:'recipe-evidence',
      error:'DIRECTOR_PROCESS_STEP_EVIDENCE_REQUIRED',
    });
    return;
  }

  const sourceRefs=[...(job.source_urls??[]),...(job.source_artifact_refs??[])];
  const referenceRecipe=compileProcessRecipe({
    id:`${job.id}:reference:v1`,
    projectId:job.project_id,
    objective:job.objective,
    sourceRefs:sourceRefs.length?sourceRefs:studies.map(study=>study.source_url),
    observations:processObservations,
    ...(job.target_duration_seconds!==null?{targetDurationSeconds:Number(job.target_duration_seconds)}:{}),
    evidenceIds:observations.map(observation=>observation.id),
  });
  const improvements=job.improve_before_execute?deriveDirectorNativeImprovements(referenceRecipe):[];
  const executableRecipe=improvements.length?improveProcessRecipe(referenceRecipe,improvements):referenceRecipe;
  const graph=compileRecipeToCreativeStageGraph(executableRecipe);
  const stages=graph.list();
  const now=new Date().toISOString();
  const runId=`${job.id}:run`;

  const {error:projectError}=await client.from('director_production_projects').upsert({
    id:job.project_id,
    owner_user_id:job.owner_user_id,
    version:executableRecipe.version,
    title:job.objective.slice(0,240),
    status:'preproduction',
    snapshot:{
      processRecipeId:executableRecipe.id,
      sourceRecipeId:referenceRecipe.id,
      targetKind:job.target_kind,
      targetDurationSeconds:job.target_duration_seconds,
      editableDelivery:true,
      stageIds:stages.map(stage=>stage.id),
      improvementReceiptIds:executableRecipe.improvementReceipts.map(receipt=>receipt.id),
    },
    evidence_ids:[...new Set(executableRecipe.evidenceIds)],
    updated_at:now,
  },{onConflict:'id'});
  if(projectError) throw projectError;

  const {error:runError}=await client.from('director_production_runs').upsert({
    id:runId,
    project_id:job.project_id,
    status:'planning',
    shot_ids:[],
    gate_ids:[],
    version:executableRecipe.version,
    updated_at:now,
  },{onConflict:'id'});
  if(runError) throw runError;

  const stageRows=stages.map(stage=>({
    id:stage.id,
    project_id:job.project_id,
    kind:stage.kind,
    depends_on:[...stage.dependsOn],
    status:stage.status,
    input_artifact_ids:[...stage.inputArtifactIds],
    output_artifact_ids:[...stage.outputArtifactIds],
    version:stage.version,
    updated_at:now,
  }));
  const {error:stageError}=await client.from('director_creative_stages').upsert(stageRows,{onConflict:'id'});
  if(stageError) throw stageError;

  await patchJob(client,job.id,{
    status:'recipe_ready',
    phase:'director-planning',
    reference_recipe:referenceRecipe,
    improved_recipe:executableRecipe,
    stage_plan:stages,
    error:null,
  });
}

export async function reconcileDirectorProcessReplicationJobs(
  client:SupabaseClient,
  options:{limit?:number;jobId?:string}={},
):Promise<DirectorProcessReplicationSummary>{
  const limit=Math.max(1,Math.min(25,options.limit??5));
  let query=client.from('director_process_replication_jobs')
    .select('id,owner_user_id,client_request_id,project_id,objective,source_urls,source_artifact_refs,study_ids,improve_before_execute,editable_delivery,target_duration_seconds,target_kind,status,phase,error,updated_at')
    .in('status',['queued','studying','blocked'])
    .order('updated_at',{ascending:true})
    .limit(limit);
  if(options.jobId) query=query.eq('id',options.jobId);
  const {data,error}=await query;
  if(error) throw error;

  const summary:DirectorProcessReplicationSummary={inspected:0,dispatchedStudies:0,studying:0,recipeReady:0,blocked:0,failed:0};

  for(const raw of data??[]){
    const job=raw as JobRow;
    summary.inspected+=1;
    try{
      const studyIds=job.study_ids??[];
      if(!studyIds.length){
        await patchJob(client,job.id,{status:'blocked',phase:'study',error:'DIRECTOR_PROCESS_STUDY_REQUIRED'});
        summary.blocked+=1;
        continue;
      }
      const {data:studyData,error:studyError}=await client.from('director_studies')
        .select('id,source_url,status,error,updated_at').in('id',studyIds);
      if(studyError) throw studyError;
      const studies=(studyData??[]) as StudyRow[];
      if(studies.length!==studyIds.length){
        await patchJob(client,job.id,{status:'blocked',phase:'study',error:'DIRECTOR_PROCESS_STUDY_MISSING'});
        summary.blocked+=1;
        continue;
      }
      const failed=studies.find(study=>study.status==='failed');
      if(failed){
        await patchJob(client,job.id,{status:'failed',phase:'study',error:failed.error??`DIRECTOR_STUDY_FAILED:${failed.id}`});
        summary.failed+=1;
        continue;
      }

      const queued=studies.filter(study=>study.status==='queued');
      if(queued.length){
        if(!studyWorkerConfigured()){
          await patchJob(client,job.id,{status:'blocked',phase:'study-provider',error:'DIRECTOR_STUDY_WORKER_NOT_CONFIGURED'});
          summary.blocked+=1;
          continue;
        }
        for(const study of queued){
          await patchStudy(client,study.id,{status:'running',started_at:new Date().toISOString(),error:null});
          try{
            await dispatchStudy(study,job.id);
            summary.dispatchedStudies+=1;
          }catch(cause){
            const message=cause instanceof Error?cause.message:'DIRECTOR_STUDY_WORKER_DISPATCH_FAILED';
            await patchStudy(client,study.id,{status:'failed',completed_at:new Date().toISOString(),error:message});
            throw cause;
          }
        }
      }

      const refreshed=queued.length
        ? (await client.from('director_studies').select('id,source_url,status,error,updated_at').in('id',studyIds)).data as StudyRow[]|null
        : studies;
      if(!(refreshed??[]).every(study=>study.status==='completed')){
        await patchJob(client,job.id,{status:'studying',phase:'study',error:null});
        summary.studying+=1;
        continue;
      }

      await materializeDirectorPlan(client,job,refreshed??studies);
      const {data:state,error:stateError}=await client.from('director_process_replication_jobs')
        .select('status').eq('id',job.id).single();
      if(stateError) throw stateError;
      if(state.status==='recipe_ready') summary.recipeReady+=1;
      else if(state.status==='blocked') summary.blocked+=1;
    }catch(cause){
      const message=cause instanceof Error?cause.message:'DIRECTOR_PROCESS_REPLICATION_RECONCILIATION_FAILED';
      await patchJob(client,job.id,{status:'failed',phase:'reconciliation',error:message});
      summary.failed+=1;
    }
  }
  return summary;
}
