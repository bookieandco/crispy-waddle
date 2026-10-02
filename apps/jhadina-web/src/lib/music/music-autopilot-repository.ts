import type {SupabaseClient} from '@supabase/supabase-js';
import type {MusicAutopilotActionPlan,MusicAutopilotCharter} from '@jhadina/growth-core';
import {defaultMusicAutopilotCharter,validateMusicAutopilotCharter} from '@jhadina/growth-core';
import {createServiceRoleClient} from '@/lib/supabase/service-role';

type Row=Record<string,unknown>;

export type MusicAutopilotRunStatus='queued'|'running'|'blocked'|'completed'|'failed';
export type MusicAutopilotActionStatus='planned'|'running'|'blocked'|'awaiting_approval'|'completed'|'failed'|'ambiguous';

export interface MusicAutopilotRunRecord{
  id:string;
  userId:string;
  projectId:string;
  runKey:string;
  status:MusicAutopilotRunStatus;
  mode:'SEARCH'|'ATTACK';
  currentStage?:string;
  stageReceipts:readonly unknown[];
  lastError?:string;
  leaseOwner?:string;
  leaseExpiresAt?:string;
}

export interface MusicAutopilotActionRecord{
  id:string;
  runId:string;
  userId:string;
  projectId:string;
  actionKey:string;
  stage:string;
  kind:string;
  status:MusicAutopilotActionStatus;
  authority:string;
  authorityRef?:string;
  evidenceRefs:readonly string[];
  inputRefs:readonly string[];
  outputRefs:readonly string[];
  providerReference?:string;
  sideEffectState:'NONE'|'CONFIRMED'|'AMBIGUOUS';
  attempt:number;
  lastError?:string;
}

export interface MusicAutopilotRepository{
  getCharter(userId:string,projectId:string):Promise<MusicAutopilotCharter>;
  beginRun(input:{userId:string;projectId:string;runKey:string;mode:'SEARCH'|'ATTACK'}):Promise<MusicAutopilotRunRecord>;
  claimRun(input:{runId:string;userId:string;workerId:string;leaseSeconds?:number}):Promise<MusicAutopilotRunRecord|null>;
  releaseRun(input:{runId:string;userId:string;workerId:string;status:Exclude<MusicAutopilotRunStatus,'running'>;currentStage?:string;lastError?:string}):Promise<MusicAutopilotRunRecord|null>;
  appendStageReceipt(input:{runId:string;userId:string;workerId:string;stage:string;receipt:Record<string,unknown>}):Promise<MusicAutopilotRunRecord|null>;
  getAction(userId:string,projectId:string,actionKey:string):Promise<MusicAutopilotActionRecord|null>;
  upsertPlannedAction(input:{runId:string;userId:string;projectId:string;plan:MusicAutopilotActionPlan;authorityRef?:string;inputRefs?:readonly string[]}):Promise<MusicAutopilotActionRecord>;
  transitionAction(input:{userId:string;projectId:string;actionKey:string;status:MusicAutopilotActionStatus;sideEffectState?:'NONE'|'CONFIRMED'|'AMBIGUOUS';outputRefs?:readonly string[];providerReference?:string;lastError?:string;incrementAttempt?:boolean}):Promise<MusicAutopilotActionRecord>;
}

export function createMusicAutopilotRepository(clientOverride?:SupabaseClient):MusicAutopilotRepository{
  const client=clientOverride??createServiceRoleClient();
  if(!client)throw new Error('MUSIC_AUTOPILOT_SERVICE_ROLE_NOT_CONFIGURED');
  return {
    async getCharter(userId,projectId){
      const {data,error}=await client.from('jhadina_music_autopilot_charters')
        .select('*').eq('user_id',userId).eq('project_id',projectId).maybeSingle();
      if(error)throw new Error('MUSIC_AUTOPILOT_CHARTER_READ_FAILED:'+error.message);
      if(!data)return defaultMusicAutopilotCharter();
      const row=data as Row;
      return validateMusicAutopilotCharter({
        enabled:Boolean(row.enabled),
        allowedSocialAccountIds:stringArray(row.allowed_social_account_ids),
        maxDirectorJobsPerRun:integer(row.max_director_jobs_per_run,3),
        maxSocialProposalsPerRun:integer(row.max_social_proposals_per_run,3),
        maxPreapprovedPaidMinorPerRun:integer(row.max_preapproved_paid_minor_per_run,0),
        maxPreapprovedPaidMinorPerDay:integer(row.max_preapproved_paid_minor_per_day,0),
        currency:String(row.currency??'USD'),
        allowPreparedAssets:Boolean(row.allow_prepared_assets),
        allowApprovedContentScheduling:Boolean(row.allow_approved_content_scheduling),
        allowPreapprovedPaidTests:Boolean(row.allow_preapproved_paid_tests),
        pauseOnAmbiguousExternalState:row.pause_on_ambiguous_external_state!==false,
      });
    },

    async beginRun(input){
      const payload={
        user_id:input.userId,
        project_id:input.projectId,
        run_key:input.runKey,
        status:'queued',
        mode:input.mode,
        stage_receipts:[],
        last_error:null,
        updated_at:new Date().toISOString(),
      };
      const {error:upsertError}=await client.from('jhadina_music_autopilot_runs')
        .upsert(payload,{onConflict:'user_id,project_id,run_key',ignoreDuplicates:true});
      if(upsertError)throw new Error('MUSIC_AUTOPILOT_RUN_CREATE_FAILED:'+upsertError.message);
      const {data,error}=await client.from('jhadina_music_autopilot_runs').select('*')
        .eq('user_id',input.userId).eq('project_id',input.projectId).eq('run_key',input.runKey).single();
      if(error||!data)throw new Error('MUSIC_AUTOPILOT_RUN_READ_FAILED:'+(error?.message??'missing'));
      return runFromRow(data as Row);
    },

    async claimRun(input){
      const {data,error}=await client.rpc('jhadina_music_autopilot_claim_run',{
        p_run_id:input.runId,
        p_user_id:input.userId,
        p_worker_id:input.workerId,
        p_lease_seconds:input.leaseSeconds??120,
      });
      if(error)throw new Error('MUSIC_AUTOPILOT_RUN_CLAIM_FAILED:'+error.message);
      return objectOrFirst(data,runFromRow);
    },

    async releaseRun(input){
      const {data,error}=await client.rpc('jhadina_music_autopilot_release_run',{
        p_run_id:input.runId,
        p_user_id:input.userId,
        p_worker_id:input.workerId,
        p_status:input.status,
        p_current_stage:input.currentStage??null,
        p_last_error:input.lastError??null,
      });
      if(error)throw new Error('MUSIC_AUTOPILOT_RUN_RELEASE_FAILED:'+error.message);
      return objectOrFirst(data,runFromRow);
    },

    async appendStageReceipt(input){
      const {data,error}=await client.rpc('jhadina_music_autopilot_append_stage_receipt',{
        p_run_id:input.runId,
        p_user_id:input.userId,
        p_worker_id:input.workerId,
        p_stage:input.stage,
        p_receipt:input.receipt,
      });
      if(error)throw new Error('MUSIC_AUTOPILOT_STAGE_RECEIPT_FAILED:'+error.message);
      return objectOrFirst(data,runFromRow);
    },

    async getAction(userId,projectId,actionKey){
      const {data,error}=await client.from('jhadina_music_autopilot_actions').select('*')
        .eq('user_id',userId).eq('project_id',projectId).eq('action_key',actionKey).maybeSingle();
      if(error)throw new Error('MUSIC_AUTOPILOT_ACTION_READ_FAILED:'+error.message);
      return data?actionFromRow(data as Row):null;
    },

    async upsertPlannedAction(input){
      const now=new Date().toISOString();
      const {data,error}=await client.from('jhadina_music_autopilot_actions').upsert({
        run_id:input.runId,
        user_id:input.userId,
        project_id:input.projectId,
        action_key:input.plan.actionKey,
        stage:input.plan.stage,
        kind:input.plan.kind,
        status:'planned',
        authority:input.plan.authority,
        authority_ref:input.authorityRef??null,
        evidence_refs:[...input.plan.evidenceRefs],
        input_refs:[...(input.inputRefs??[])],
        updated_at:now,
      },{onConflict:'user_id,project_id,action_key',ignoreDuplicates:true}).select('*').maybeSingle();
      if(error)throw new Error('MUSIC_AUTOPILOT_ACTION_PLAN_FAILED:'+error.message);
      if(data)return actionFromRow(data as Row);
      const existing=await this.getAction(input.userId,input.projectId,input.plan.actionKey);
      if(!existing)throw new Error('MUSIC_AUTOPILOT_ACTION_PLAN_MISSING');
      return existing;
    },

    async transitionAction(input){
      const current=await this.getAction(input.userId,input.projectId,input.actionKey);
      if(!current)throw new Error('MUSIC_AUTOPILOT_ACTION_NOT_FOUND');
      const patch:Row={
        status:input.status,
        side_effect_state:input.sideEffectState??current.sideEffectState,
        output_refs:input.outputRefs?[...input.outputRefs]:[...current.outputRefs],
        provider_reference:input.providerReference??current.providerReference??null,
        last_error:input.lastError??null,
        attempt:input.incrementAttempt?current.attempt+1:current.attempt,
        updated_at:new Date().toISOString(),
      };
      if(input.status==='running')patch.started_at=new Date().toISOString();
      if(input.status==='completed')patch.completed_at=new Date().toISOString();
      const {data,error}=await client.from('jhadina_music_autopilot_actions').update(patch)
        .eq('user_id',input.userId).eq('project_id',input.projectId).eq('action_key',input.actionKey)
        .select('*').single();
      if(error||!data)throw new Error('MUSIC_AUTOPILOT_ACTION_UPDATE_FAILED:'+(error?.message??'missing'));
      return actionFromRow(data as Row);
    },
  };
}

function runFromRow(row:Row):MusicAutopilotRunRecord{
  return Object.freeze({
    id:String(row.id),
    userId:String(row.user_id),
    projectId:String(row.project_id),
    runKey:String(row.run_key),
    status:String(row.status) as MusicAutopilotRunStatus,
    mode:String(row.mode)==='ATTACK'?'ATTACK':'SEARCH',
    currentStage:optionalString(row.current_stage),
    stageReceipts:Array.isArray(row.stage_receipts)?Object.freeze([...row.stage_receipts]):Object.freeze([]),
    lastError:optionalString(row.last_error),
    leaseOwner:optionalString(row.lease_owner),
    leaseExpiresAt:optionalString(row.lease_expires_at),
  });
}

function actionFromRow(row:Row):MusicAutopilotActionRecord{
  const side=String(row.side_effect_state);
  return Object.freeze({
    id:String(row.id),
    runId:String(row.run_id),
    userId:String(row.user_id),
    projectId:String(row.project_id),
    actionKey:String(row.action_key),
    stage:String(row.stage),
    kind:String(row.kind),
    status:String(row.status) as MusicAutopilotActionStatus,
    authority:String(row.authority),
    authorityRef:optionalString(row.authority_ref),
    evidenceRefs:Object.freeze(stringArray(row.evidence_refs)),
    inputRefs:Object.freeze(stringArray(row.input_refs)),
    outputRefs:Object.freeze(stringArray(row.output_refs)),
    providerReference:optionalString(row.provider_reference),
    sideEffectState:side==='CONFIRMED'||side==='AMBIGUOUS'?side:'NONE',
    attempt:integer(row.attempt,0),
    lastError:optionalString(row.last_error),
  });
}

function objectOrFirst<T>(value:unknown,map:(row:Row)=>T):T|null{
  if(Array.isArray(value))return value.length?map(value[0] as Row):null;
  if(value&&typeof value==='object')return map(value as Row);
  return null;
}
function optionalString(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value:undefined;
}
function stringArray(value:unknown):string[]{
  return Array.isArray(value)?value.map(String).filter(Boolean):[];
}
function integer(value:unknown,fallback:number):number{
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=0?n:fallback;
}
