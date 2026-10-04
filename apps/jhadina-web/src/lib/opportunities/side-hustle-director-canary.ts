import type {SupabaseClient} from '@supabase/supabase-js'
import {evaluateSideHustleDirectorFinalQcReadiness} from './side-hustle-director-final-qc'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type PhaseState='verified'|'waiting'|'blocked'|'not-applicable'
export type DirectorBusinessCanaryPhase=Readonly<{
  phase:string
  state:PhaseState
  evidence:readonly string[]
  note:string
}>

export type DirectorBusinessCanaryReceipt=Readonly<{
  projectId:string
  planId:string
  format:string
  opportunityId:string
  furthestVerifiedPhase:string
  nextBoundary:string
  productionReadyForSocialProposal:boolean
  phases:readonly DirectorBusinessCanaryPhase[]
  authority:'DIRECTOR_BUSINESS_CANARY_READ_ONLY'
  canGenerate:false
  canApprove:false
  canPublish:false
  canSpend:false
}>

function refs(values:unknown):string[]{
  return Array.isArray(values)?[...new Set(values.map(String).map(value=>value.trim()).filter(Boolean))]:[]
}
function phase(phase:string,state:PhaseState,evidence:string[],note:string):DirectorBusinessCanaryPhase{
  return Object.freeze({phase,state,evidence:Object.freeze(evidence),note})
}

export async function inspectSideHustleDirectorCanary(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}):Promise<DirectorBusinessCanaryReceipt>{
  const {client,userId,projectId}=input
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('plan,production_run_id,video_job_id,automation_status,source_ref,updated_at')
    .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(contextError)throw new Error('DIRECTOR_BUSINESS_CANARY_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('DIRECTOR_BUSINESS_CANARY_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('DIRECTOR_BUSINESS_CANARY_CONTEXT_INVALID')

  const phases:DirectorBusinessCanaryPhase[]=[]
  phases.push(phase('business-context','verified',[
    'opportunity:'+plan.opportunityId,
    'source:'+plan.sourceRef,
    ...plan.rightsEvidenceRefs,
  ],'Business Factory plan is durably bound to this Director project.'))

  if(context.video_job_id){
    const {data:job,error}=await client.from('director_video_jobs')
      .select('id,status,preview_asset_id,current_phase,error')
      .eq('id',context.video_job_id).eq('user_id',userId).maybeSingle()
    if(error)throw new Error('DIRECTOR_BUSINESS_CANARY_VIDEO_JOB_READ_FAILED:'+error.message)
    let assetApproved=false
    let approvalEvidence:string[]=[]
    if(job?.preview_asset_id){
      const {data:approval,error:approvalError}=await client.from('director_editing_asset_approvals')
        .select('approval_id,approved_at,approved_by_user_id')
        .eq('asset_id',String(job.preview_asset_id))
        .eq('approved_by_user_id',userId)
        .maybeSingle()
      if(approvalError)throw new Error('DIRECTOR_BUSINESS_CANARY_VIDEO_APPROVAL_READ_FAILED:'+approvalError.message)
      assetApproved=Boolean(approval?.approval_id)
      if(approval){
        approvalEvidence=[
          'asset-approval:'+String(approval.approval_id),
          'asset-approved-at:'+String(approval.approved_at),
        ]
      }
    }

    if(!job){
      phases.push(phase('whole-video-runtime','blocked',[],'Director whole-video job is missing.'))
    }else if(job.status==='preview_ready'){
      phases.push(phase('whole-video-runtime','verified',[
        'video-job:'+job.id,
        ...(job.preview_asset_id?['asset:'+String(job.preview_asset_id)]:[]),
      ],'Whole-video provider completed and produced a reviewable preview.'))
      phases.push(phase(
        'whole-video-review',
        assetApproved?'verified':'waiting',
        assetApproved?approvalEvidence:[],
        assetApproved
          ?'The exact whole-video preview is explicitly approved for use.'
          :'The generated preview still requires explicit asset approval before Social handoff.',
      ))
      phases.push(phase(
        'social-handoff',
        assetApproved?'verified':'waiting',
        assetApproved&&job.preview_asset_id?['approved-final-master:'+String(job.preview_asset_id),...approvalEvidence]:[],
        assetApproved
          ?'The approved whole-video master is eligible to become a Social proposal; publication approval remains separate.'
          :'Social handoff is blocked until the preview asset is explicitly approved.',
      ))
    }else if(['failed','blocked','cancelled'].includes(String(job.status))){
      phases.push(phase('whole-video-runtime','blocked',['video-job:'+job.id],String(job.error??job.status)))
    }else{
      phases.push(phase('whole-video-runtime','waiting',['video-job:'+job.id],'Provider phase: '+String(job.current_phase??job.status)))
    }
    const ready=job?.status==='preview_ready'&&assetApproved
    const furthest=phases.filter(item=>item.state==='verified').at(-1)?.phase??'business-context'
    const firstUnverified=phases.find(item=>item.state!=='verified')
    return Object.freeze({
      projectId,planId:plan.id,format:plan.format,opportunityId:plan.opportunityId,
      furthestVerifiedPhase:furthest,
      nextBoundary:firstUnverified?.phase??'SOCIAL_PUBLICATION_APPROVAL',
      productionReadyForSocialProposal:ready,
      phases:Object.freeze(phases),
      authority:'DIRECTOR_BUSINESS_CANARY_READ_ONLY',
      canGenerate:false,canApprove:false,canPublish:false,canSpend:false,
    })
  }

  const runId=String(context.production_run_id??'')
  if(!runId)throw new Error('DIRECTOR_BUSINESS_CANARY_RUN_REQUIRED')
  const [{data:stages,error:stageError},{data:gates,error:gateError},{data:selections,error:selectionError},{data:rough,error:roughError},{data:audio,error:audioError}]=await Promise.all([
    client.from('director_creative_stages')
      .select('kind,status,output_artifact_ids,approved_at,approved_by')
      .eq('project_id',projectId),
    client.from('director_creative_gates')
      .select('kind,decision,evidence_ids,decided_at,decided_by')
      .eq('project_id',projectId).eq('run_id',runId),
    client.from('director_take_selections')
      .select('take_group_id,status,selected_take_id,selected_asset_id,evidence_ids')
      .eq('project_id',projectId).eq('owner_user_id',userId),
    client.from('director_edit_assembly_proposals')
      .select('id,status,timeline_revision,selected_asset_ids,required_approval_asset_ids')
      .eq('project_id',projectId).eq('owner_user_id',userId)
      .order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    client.from('director_audio_post_plans')
      .select('id,status,blockers,required_worker_profiles,ready_worker_profiles,timeline_revision')
      .eq('project_id',projectId).eq('owner_user_id',userId)
      .order('updated_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  if(stageError)throw new Error('DIRECTOR_BUSINESS_CANARY_STAGE_READ_FAILED:'+stageError.message)
  if(gateError)throw new Error('DIRECTOR_BUSINESS_CANARY_GATE_READ_FAILED:'+gateError.message)
  if(selectionError)throw new Error('DIRECTOR_BUSINESS_CANARY_SELECTION_READ_FAILED:'+selectionError.message)
  if(roughError)throw new Error('DIRECTOR_BUSINESS_CANARY_ROUGH_CUT_READ_FAILED:'+roughError.message)
  if(audioError)throw new Error('DIRECTOR_BUSINESS_CANARY_AUDIO_READ_FAILED:'+audioError.message)

  const stageByKind=new Map((stages??[]).map(row=>[String(row.kind),row]))
  const gateByKind=new Map((gates??[]).map(row=>[String(row.kind),row]))
  const storyboard=stageByKind.get('storyboard')
  const shotlist=stageByKind.get('shotlist')
  const storyboardGate=gateByKind.get('storyboard')
  const shotlistGate=gateByKind.get('shotlist')
  const storyboardVerified=
    storyboard?.status==='approved'&&shotlist?.status==='approved'&&
    storyboardGate?.decision==='approved'&&shotlistGate?.decision==='approved'
  phases.push(phase(
    'storyboard-shotlist',
    storyboardVerified?'verified':'waiting',
    storyboardVerified?[
      ...refs(storyboard?.output_artifact_ids),
      ...refs(shotlist?.output_artifact_ids),
      ...refs(storyboardGate?.evidence_ids),
      ...refs(shotlistGate?.evidence_ids),
    ]:[],
    storyboardVerified?'Storyboard and shot list are approved.':'Storyboard/shot-list approval remains incomplete.',
  ))

  const previs=stageByKind.get('previs'),rehearsal=stageByKind.get('rehearsal')
  const rehearsalEvidence=refs(rehearsal?.output_artifact_ids)
  const rehearsalVerified=
    previs?.status==='approved'&&refs(previs?.output_artifact_ids).length>0&&
    rehearsal?.status==='approved'&&rehearsalEvidence.length>0
  phases.push(phase(
    'previs-rehearsal',
    rehearsalVerified?'verified':storyboardVerified?'waiting':'blocked',
    rehearsalVerified?[...refs(previs?.output_artifact_ids),...rehearsalEvidence]:[],
    rehearsalVerified?'Previs and rehearsal carry approved evidence.':'Real previs/rehearsal evidence is still required.',
  ))

  const generationGate=gateByKind.get('generation')
  const generation=stageByKind.get('generation')
  const selected=(selections??[]).filter(row=>row.status==='selected'&&row.selected_take_id&&row.selected_asset_id)
  const generationVerified=
    generationGate?.decision==='approved'&&
    ['running','review','approved','completed'].includes(String(generation?.status??''))&&
    selected.length>0
  phases.push(phase(
    'generation-take-selection',
    generationVerified?'verified':rehearsalVerified?'waiting':'blocked',
    generationVerified?selected.flatMap(row=>[
      'take:'+String(row.selected_take_id),
      'asset:'+String(row.selected_asset_id),
      ...refs(row.evidence_ids),
    ]):[],
    generationVerified?'At least one take set has an evidence-selected winner.':'Generation approval, completed takes and Watch QC selection are still required.',
  ))

  const roughVerified=rough?.status==='materialized'&&Number(rough.timeline_revision)>0
  phases.push(phase(
    'rough-cut',
    roughVerified?'verified':generationVerified?'waiting':'blocked',
    roughVerified?['rough-cut:'+String(rough.id),'timeline-revision:'+String(rough.timeline_revision)]:[],
    roughVerified?'Evidence-selected rough cut is materialized in the canonical Workstation timeline.':'Rough cut has not been materialized yet.',
  ))

  const audioPrepared=Boolean(audio?.id)&&['planned','awaiting_workers','executing','ready','completed'].includes(String(audio?.status??''))
  phases.push(phase(
    'post-production',
    audio?.status==='completed'?'verified':audioPrepared?'waiting':roughVerified?'waiting':'blocked',
    audio?.id?['audio-post:'+String(audio.id)]:[],
    audio?.status==='completed'
      ?'Post-production tasks completed.'
      :audioPrepared
        ?'Post-production graph exists but real worker outputs are not all complete.'
        :'Audio/post-production plan has not been compiled.',
  ))

  let finalQc:null|Awaited<ReturnType<typeof evaluateSideHustleDirectorFinalQcReadiness>>=null
  try{
    finalQc=await evaluateSideHustleDirectorFinalQcReadiness({client,userId,projectId})
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    if(!message.includes('FORMAT_USES_WHOLE_VIDEO_REVIEW'))throw error
  }
  if(finalQc){
    phases.push(phase(
      'final-qc',
      finalQc.admissible?'verified':'waiting',
      finalQc.admissible?[
        ...(finalQc.finalMasterAssetId?['asset:'+finalQc.finalMasterAssetId]:[]),
        ...finalQc.selectedTakeIds.map(id=>'take:'+id),
        ...finalQc.rightsEvidenceIds,
      ]:[],
      finalQc.admissible?'Normal-project final QC admitted the final master.':finalQc.blockers.join(' · '),
    ))
  }

  const readyForSocial=
    storyboardVerified&&
    rehearsalVerified&&
    generationVerified&&
    roughVerified&&
    audio?.status==='completed'&&
    finalQc?.admissible===true
  phases.push(phase(
    'social-handoff',
    readyForSocial?'verified':'waiting',
    readyForSocial?['qc-admitted-final-master:'+String(finalQc?.finalMasterAssetId)]:[],
    readyForSocial
      ?'The QC-admitted final master is eligible to become a Social publication proposal; publication approval remains separate.'
      :'Social handoff is blocked until final QC admits the production.',
  ))

  const furthest=phases.filter(item=>item.state==='verified').at(-1)?.phase??'business-context'
  const firstUnverified=phases.find(item=>item.state!=='verified')
  return Object.freeze({
    projectId,planId:plan.id,format:plan.format,opportunityId:plan.opportunityId,
    furthestVerifiedPhase:furthest,
    nextBoundary:firstUnverified?.phase??'SOCIAL_PUBLICATION_APPROVAL',
    productionReadyForSocialProposal:readyForSocial,
    phases:Object.freeze(phases),
    authority:'DIRECTOR_BUSINESS_CANARY_READ_ONLY',
    canGenerate:false,canApprove:false,canPublish:false,canSpend:false,
  })
}


export async function certifySideHustleDirectorCanary(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}):Promise<DirectorBusinessCanaryReceipt>{
  const receipt=await inspectSideHustleDirectorCanary(input)
  const {error}=await input.client.from('director_business_canary_receipts').insert({
    project_id:receipt.projectId,
    owner_user_id:input.userId,
    plan_id:receipt.planId,
    opportunity_id:receipt.opportunityId,
    format:receipt.format,
    furthest_verified_phase:receipt.furthestVerifiedPhase,
    next_boundary:receipt.nextBoundary,
    production_ready_for_social_proposal:receipt.productionReadyForSocialProposal,
    phase_receipts:receipt.phases,
    authority:'DIRECTOR_BUSINESS_CANARY_CERTIFICATION',
    certified_at:new Date().toISOString(),
  })
  if(error)throw new Error('DIRECTOR_BUSINESS_CANARY_RECEIPT_WRITE_FAILED:'+error.message)
  return receipt
}
