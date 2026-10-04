import type {SupabaseClient} from '@supabase/supabase-js'
import {directorWatchHomebaseRuntimeHealth,directorWatchRuntimeHealth} from '@/lib/director-watch-runtime'
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository'
import {inspectSideHustleDirectorCanary} from './side-hustle-director-canary'
import {evaluateSideHustleDirectorFinalQcReadiness} from './side-hustle-director-final-qc'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type Purpose='creative'|'sports'|'take-qc'
const FINAL_QC_FORMATS=new Set(['faceless_youtube','music_video','short_film','feature_film'])
const WATCH_PURPOSES:readonly Purpose[]=Object.freeze(['creative','sports','take-qc'])

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>String(value).trim()).filter(Boolean))]
}

export type DirectorAutoFinalReceipt=Readonly<{
  projectId:string
  planId:string
  format:string
  admissible:boolean
  reasons:readonly string[]
  evidence:Readonly<{
    productionRunId:string
    automationStatus:string
    timelineRevision:number
    timelineVersionId:string
    autopilot:Readonly<{
      present:boolean
      status:string|null
      boundary:string|null
      observedAt:string|null
    }>
    watch:Readonly<{
      liveRuntimeReady:boolean
      cloudRuntimeReady:boolean
      homebaseRuntimeReady:boolean
      purposes:Readonly<Record<Purpose,Readonly<{
        commissioned:boolean
        jobId:string|null
        completedAt:string|null
        persistedResultCount:number
      }>>>
    }>
    finalQc:Readonly<{
      required:boolean
      admissible:boolean
      persistedAdmissionReceipt:boolean
      finalMasterAssetId:string|null
      blockers:readonly string[]
    }>
    canary:Readonly<{
      productionReadyForSocialProposal:boolean
      furthestVerifiedPhase:string
      nextBoundary:string
    }>
  }>
  authority:'DIRECTOR_AUTO_FINAL_CERTIFICATION'
  canApproveCreative:false
  canPublish:false
  canSpend:false
  canWager:false
}>

export async function inspectDirectorAutoFinal(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}):Promise<DirectorAutoFinalReceipt>{
  const {client,userId,projectId}=input
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('plan,production_run_id,automation_status')
    .eq('project_id',projectId)
    .eq('owner_user_id',userId)
    .maybeSingle()
  if(contextError)throw new Error('DIRECTOR_AUTO_FINAL_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('DIRECTOR_AUTO_FINAL_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('DIRECTOR_AUTO_FINAL_CONTEXT_INVALID')
  const productionRunId=String(context.production_run_id??'')
  if(!productionRunId)throw new Error('DIRECTOR_AUTO_FINAL_PRODUCTION_RUN_REQUIRED')

  const timelineRecord=await new DirectorWorkstationTimelineRepository(client).load(projectId)
  if(!timelineRecord)throw new Error('DIRECTOR_AUTO_FINAL_TIMELINE_REQUIRED')
  const timelineVersionId=
    timelineRecord.timeline.versions.at(-1)?.id??
    'workstation:'+projectId+':revision:'+timelineRecord.revision

  const [
    autopilotQuery,
    watchQuery,
    finalReceiptQuery,
    canary,
    runtime,
    homebase,
  ]=await Promise.all([
    client.from('director_business_autopilot_receipts')
      .select('status,boundary,observed_at')
      .eq('project_id',projectId)
      .eq('owner_user_id',userId)
      .order('observed_at',{ascending:false})
      .limit(1)
      .maybeSingle(),
    client.from('director_watch_commissioning_receipts')
      .select('job_id,purpose,callback_verified,persisted_result_count,status,completed_at')
      .eq('owner_user_id',userId)
      .in('purpose',[...WATCH_PURPOSES])
      .order('completed_at',{ascending:false}),
    client.from('director_project_final_qc_receipts')
      .select('admissible,evidence_snapshot,evaluated_at')
      .eq('project_id',projectId)
      .eq('owner_user_id',userId)
      .order('evaluated_at',{ascending:false})
      .limit(1)
      .maybeSingle(),
    inspectSideHustleDirectorCanary({client,userId,projectId}),
    directorWatchRuntimeHealth(),
    directorWatchHomebaseRuntimeHealth(),
  ])
  if(autopilotQuery.error)throw new Error('DIRECTOR_AUTO_FINAL_AUTOPILOT_READ_FAILED:'+autopilotQuery.error.message)
  if(watchQuery.error)throw new Error('DIRECTOR_AUTO_FINAL_WATCH_READ_FAILED:'+watchQuery.error.message)
  if(finalReceiptQuery.error)throw new Error('DIRECTOR_AUTO_FINAL_QC_RECEIPT_READ_FAILED:'+finalReceiptQuery.error.message)

  const autopilot=autopilotQuery.data
  const passedByPurpose=new Map<Purpose,{jobId:string;completedAt:string;persistedResultCount:number}>()
  for(const row of watchQuery.data??[]){
    const purpose=String(row.purpose) as Purpose
    if(!WATCH_PURPOSES.includes(purpose)||passedByPurpose.has(purpose))continue
    if(row.status==='passed'&&row.callback_verified===true&&Number(row.persisted_result_count??0)>0){
      passedByPurpose.set(purpose,{
        jobId:String(row.job_id),
        completedAt:String(row.completed_at),
        persistedResultCount:Number(row.persisted_result_count),
      })
    }
  }
  const cloudRuntimeReady=runtime.productionReady===true
  const homebaseRuntimeReady=homebase.productionReady===true
  const liveRuntimeReady=cloudRuntimeReady||homebaseRuntimeReady
  const purposes=Object.fromEntries(WATCH_PURPOSES.map(purpose=>{
    const receipt=passedByPurpose.get(purpose)
    return [purpose,Object.freeze({
      commissioned:liveRuntimeReady&&Boolean(receipt),
      jobId:receipt?.jobId??null,
      completedAt:receipt?.completedAt??null,
      persistedResultCount:receipt?.persistedResultCount??0,
    })]
  })) as Record<Purpose,Readonly<{
    commissioned:boolean
    jobId:string|null
    completedAt:string|null
    persistedResultCount:number
  }>>

  const finalQcRequired=FINAL_QC_FORMATS.has(plan.format)
  let finalQcAdmissible=false
  let finalMasterAssetId:string|null=null
  let finalQcBlockers:string[]=[]
  if(finalQcRequired){
    const readiness=await evaluateSideHustleDirectorFinalQcReadiness({client,userId,projectId})
    finalQcAdmissible=readiness.admissible
    finalMasterAssetId=readiness.finalMasterAssetId
    finalQcBlockers=[...readiness.blockers]
  }
  const finalReceipt=finalReceiptQuery.data
  const persistedAdmissionReceipt=
    finalQcRequired
      ?finalReceipt?.admissible===true&&
        String((finalReceipt.evidence_snapshot as {timelineVersionId?:unknown}|null)?.timelineVersionId??'')===timelineVersionId&&
        String((finalReceipt.evidence_snapshot as {finalMasterAssetId?:unknown}|null)?.finalMasterAssetId??'')===String(finalMasterAssetId??'')
      :true

  const reasons:string[]=[]
  if(timelineRecord.revision<1)reasons.push('DIRECTOR_AUTO_FINAL_DURABLE_TIMELINE_REQUIRED')
  if(!autopilot)reasons.push('DIRECTOR_AUTO_FINAL_AUTOPILOT_RECEIPT_REQUIRED')
  if(autopilot?.status==='failed')reasons.push('DIRECTOR_AUTO_FINAL_AUTOPILOT_FAILURE_PRESENT')
  if(!liveRuntimeReady)reasons.push('DIRECTOR_AUTO_FINAL_WATCH_RUNTIME_NOT_LIVE')
  for(const purpose of WATCH_PURPOSES){
    if(!purposes[purpose].commissioned)reasons.push('DIRECTOR_AUTO_FINAL_WATCH_COMMISSIONING_REQUIRED:'+purpose)
  }
  if(finalQcRequired&&!finalQcAdmissible){
    reasons.push('DIRECTOR_AUTO_FINAL_FINAL_QC_ADMISSION_REQUIRED',...finalQcBlockers)
  }
  if(finalQcRequired&&!persistedAdmissionReceipt){
    reasons.push('DIRECTOR_AUTO_FINAL_PERSISTED_FINAL_QC_RECEIPT_REQUIRED')
  }
  if(!canary.productionReadyForSocialProposal){
    reasons.push('DIRECTOR_AUTO_FINAL_BUSINESS_CANARY_NOT_SOCIAL_READY')
  }
  const socialPhase=canary.phases.find(item=>item.phase==='social-handoff')
  if(!socialPhase||socialPhase.state!=='verified'){
    reasons.push('DIRECTOR_AUTO_FINAL_SOCIAL_HANDOFF_NOT_VERIFIED')
  }

  return Object.freeze({
    projectId,
    planId:plan.id,
    format:plan.format,
    admissible:reasons.length===0,
    reasons:Object.freeze(unique(reasons)),
    evidence:Object.freeze({
      productionRunId,
      automationStatus:String(context.automation_status??'planned'),
      timelineRevision:timelineRecord.revision,
      timelineVersionId,
      autopilot:Object.freeze({
        present:Boolean(autopilot),
        status:autopilot?String(autopilot.status):null,
        boundary:autopilot?String(autopilot.boundary):null,
        observedAt:autopilot?String(autopilot.observed_at):null,
      }),
      watch:Object.freeze({
        liveRuntimeReady,
        cloudRuntimeReady,
        homebaseRuntimeReady,
        purposes:Object.freeze(purposes),
      }),
      finalQc:Object.freeze({
        required:finalQcRequired,
        admissible:finalQcRequired?finalQcAdmissible:true,
        persistedAdmissionReceipt,
        finalMasterAssetId,
        blockers:Object.freeze(finalQcBlockers),
      }),
      canary:Object.freeze({
        productionReadyForSocialProposal:canary.productionReadyForSocialProposal,
        furthestVerifiedPhase:canary.furthestVerifiedPhase,
        nextBoundary:canary.nextBoundary,
      }),
    }),
    authority:'DIRECTOR_AUTO_FINAL_CERTIFICATION',
    canApproveCreative:false,
    canPublish:false,
    canSpend:false,
    canWager:false,
  })
}

export async function certifyDirectorAutoFinal(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}):Promise<DirectorAutoFinalReceipt>{
  const receipt=await inspectDirectorAutoFinal(input)
  const {error}=await input.client.from('director_auto_final_receipts').insert({
    project_id:receipt.projectId,
    owner_user_id:input.userId,
    plan_id:receipt.planId,
    format:receipt.format,
    admissible:receipt.admissible,
    reasons:receipt.reasons,
    evidence:receipt.evidence,
    authority:receipt.authority,
    certified_at:new Date().toISOString(),
  })
  if(error)throw new Error('DIRECTOR_AUTO_FINAL_RECEIPT_WRITE_FAILED:'+error.message)
  return receipt
}
