import type {SupabaseClient} from '@supabase/supabase-js'
import {
  createWorkSession,
  createWorkSessionTask,
  evolveWorkSession,
  reconcileWorkSessionTaskReadiness,
  type WorkSessionTask,
} from '@jhadina/core-spine'
import {
  DEFAULT_WORKER_PROFILE_IDS,
  type OneRuntimeComputeBinding,
} from '@jhadina/compute-core'
import {SupabaseWorkSessionRepository} from '@/lib/work-session/supabase-work-session-repository'
import {SupabaseWorkSessionTaskRepository} from '@/lib/work-session/supabase-work-session-task-repository'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type AudioPostRow={
  id:string
  plan_id:string
  timeline_revision:number|string
  status:string
  blockers:string[]|null
  required_worker_profiles:string[]|null
  post_plan:{
    speechSegments?:Array<{id:string}>
    soundtrackBrief?:{id?:string}
    foleyPlan?:{id?:string;events?:Array<{id:string}>}
    lipSync?:{required?:boolean;sourceAudioArtifacts?:string[]}
    stems?:{roles?:string[]}
  }
}

export type DirectorPostTaskKind='voice'|'music'|'foley'|'lip-sync'|'mix'|'render'|'final-watch'

export type DirectorPostTaskDescriptor=Readonly<{
  kind:DirectorPostTaskKind
  taskId:string
  capability:string
  workerProfileId:string
  computeBinding:OneRuntimeComputeBinding
}>

export type DirectorPostWorkSessionResult=Readonly<{
  projectId:string
  workSessionId:string
  audioPostPlanId:string
  taskIds:readonly string[]
  readyTaskIds:readonly string[]
  descriptors:readonly DirectorPostTaskDescriptor[]
  authority:'ONE_RUNTIME_COORDINATION_ONLY'
  canExecute:false
  canPublish:false
}>

const PROFILE:Readonly<Record<DirectorPostTaskKind,Readonly<{
  capability:string
  kind:OneRuntimeComputeBinding['kind']
  queue:NonNullable<OneRuntimeComputeBinding['queue']>
  resourceProfileId:string
  workerProfileId:string
}>>>=Object.freeze({
  voice:Object.freeze({
    capability:'director.audio.voice',
    kind:'voice-generation',
    queue:'creative',
    resourceProfileId:'director.voice.default',
    workerProfileId:DEFAULT_WORKER_PROFILE_IDS.voice,
  }),
  music:Object.freeze({
    capability:'director.audio.music',
    kind:'audio-generation',
    queue:'creative',
    resourceProfileId:'director.audio.default',
    workerProfileId:DEFAULT_WORKER_PROFILE_IDS.audio,
  }),
  foley:Object.freeze({
    capability:'director.audio.foley',
    kind:'foley-generation',
    queue:'creative',
    resourceProfileId:'director.foley.default',
    workerProfileId:DEFAULT_WORKER_PROFILE_IDS.foley,
  }),
  'lip-sync':Object.freeze({
    capability:'director.video.lip-sync',
    kind:'video-generation',
    queue:'creative',
    resourceProfileId:'director.video.default',
    workerProfileId:DEFAULT_WORKER_PROFILE_IDS.video,
  }),
  mix:Object.freeze({
    capability:'director.audio.mix',
    kind:'audio-generation',
    queue:'creative',
    resourceProfileId:'director.audio.default',
    workerProfileId:DEFAULT_WORKER_PROFILE_IDS.audio,
  }),
  render:Object.freeze({
    capability:'director.render.final',
    kind:'render',
    queue:'render',
    resourceProfileId:'director.render.default',
    workerProfileId:DEFAULT_WORKER_PROFILE_IDS.render,
  }),
  'final-watch':Object.freeze({
    capability:'director.qc.final-watch',
    kind:'batch-analysis',
    queue:'background',
    resourceProfileId:'director.analysis.default',
    workerProfileId:DEFAULT_WORKER_PROFILE_IDS.analysis,
  }),
})

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>String(value).trim()).filter(Boolean))]
}

function taskId(sessionId:string,kind:DirectorPostTaskKind):string{
  return sessionId+':'+kind
}

function descriptor(
  sessionId:string,
  kind:DirectorPostTaskKind,
  input:{
    projectId:string
    allowCloudBurst?:boolean
    maxCostUsdPerHour?:number
    dataLocalityKeys:readonly string[]
  },
):DirectorPostTaskDescriptor{
  const profile=PROFILE[kind]
  return Object.freeze({
    kind,
    taskId:taskId(sessionId,kind),
    capability:profile.capability,
    workerProfileId:profile.workerProfileId,
    computeBinding:Object.freeze({
      source:'director',
      kind:profile.kind,
      resourceProfileId:profile.resourceProfileId,
      queue:profile.queue,
      constraints:{
        sensitiveData:true,
        allowCloudBurst:input.allowCloudBurst===true,
        ...(input.maxCostUsdPerHour!==undefined?{maxCostUsdPerHour:input.maxCostUsdPerHour}:{}),
      },
      dataLocalityKeys:Object.freeze(unique([
        'director-project:'+input.projectId,
        ...input.dataLocalityKeys,
      ])),
    }),
  })
}

export async function ensureSideHustleDirectorPostWorkSession(input:{
  client:SupabaseClient
  userId:string
  projectId:string
  allowCloudBurst?:boolean
  maxCostUsdPerHour?:number
}):Promise<DirectorPostWorkSessionResult>{
  const {client,userId,projectId}=input
  if(input.allowCloudBurst!==true&&input.maxCostUsdPerHour!==undefined){
    throw new Error('DIRECTOR_POST_CLOUD_COST_WITHOUT_BURST_INVALID')
  }
  if(
    input.maxCostUsdPerHour!==undefined&&
    (!Number.isFinite(input.maxCostUsdPerHour)||input.maxCostUsdPerHour<=0)
  ){
    throw new Error('DIRECTOR_POST_CLOUD_COST_INVALID')
  }

  const [{data:context,error:contextError},{data:audioRaw,error:audioError}]=await Promise.all([
    client.from('director_project_business_context')
      .select('owner_user_id,production_run_id,plan')
      .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle(),
    client.from('director_audio_post_plans')
      .select('id,plan_id,timeline_revision,status,blockers,required_worker_profiles,post_plan')
      .eq('project_id',projectId).eq('owner_user_id',userId)
      .order('updated_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  if(contextError)throw new Error('DIRECTOR_POST_CONTEXT_READ_FAILED:'+contextError.message)
  if(audioError)throw new Error('DIRECTOR_POST_AUDIO_PLAN_READ_FAILED:'+audioError.message)
  if(!context)throw new Error('DIRECTOR_POST_CONTEXT_NOT_FOUND')
  if(!audioRaw)throw new Error('DIRECTOR_POST_AUDIO_PLAN_REQUIRED')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('DIRECTOR_POST_CONTEXT_INVALID')
  const audio=audioRaw as AudioPostRow
  if(!['planned','awaiting_workers','executing'].includes(audio.status)){
    throw new Error('DIRECTOR_POST_AUDIO_PLAN_NOT_EXECUTABLE:'+audio.status)
  }

  const revision=Number(audio.timeline_revision)
  if(!Number.isSafeInteger(revision)||revision<1)throw new Error('DIRECTOR_POST_TIMELINE_REVISION_INVALID')
  const workSessionId='work:director-post:'+projectId+':'+plan.id+':r'+revision
  const sessionRepo=new SupabaseWorkSessionRepository(client,userId)
  const taskRepo=new SupabaseWorkSessionTaskRepository(client,userId)
  const existingSession=await sessionRepo.get(workSessionId)
  if(!existingSession){
    const created=createWorkSession({
      id:workSessionId,
      ownerUserId:userId,
      goal:'Execute Director post production for '+projectId+' at timeline revision '+revision+'.',
    })
    await sessionRepo.save(evolveWorkSession(created,{
      activeSubsystems:['director','workstation','compute'],
      decisionRefs:[
        'director-audio-post:'+audio.id,
        'director-production-plan:'+plan.id,
      ],
    }))
  }

  const post=audio.post_plan??{}
  const kinds:DirectorPostTaskKind[]=[]
  if((post.speechSegments??[]).length)kinds.push('voice')
  kinds.push('music')
  if((post.foleyPlan?.events??[]).length)kinds.push('foley')
  if(post.lipSync?.required)kinds.push('lip-sync')
  kinds.push('mix','render','final-watch')

  const ids=new Map(kinds.map(kind=>[kind,taskId(workSessionId,kind)] as const))
  const audioProducerIds=unique([
    ids.get('voice')??'',
    ids.get('music')??'',
    ids.get('foley')??'',
  ])
  const dependencies=(kind:DirectorPostTaskKind):string[]=>{
    switch(kind){
      case 'lip-sync':
        return unique([ids.get('voice')??'',ids.get('music')??''])
      case 'mix':
        return audioProducerIds
      case 'render':
        return unique([ids.get('mix')??'',ids.get('lip-sync')??''])
      case 'final-watch':
        return unique([ids.get('render')??''])
      default:
        return []
    }
  }

  const baseRefs=unique([
    'director-project:'+projectId,
    'director-production-plan:'+plan.id,
    'director-audio-post:'+audio.id,
    'workstation-timeline:'+projectId+':revision:'+revision,
    ...(post.lipSync?.sourceAudioArtifacts??[]).map(id=>'asset:'+id),
  ])
  const descriptors=kinds.map(kind=>descriptor(workSessionId,kind,{
    projectId,
    allowCloudBurst:input.allowCloudBurst,
    maxCostUsdPerHour:input.maxCostUsdPerHour,
    dataLocalityKeys:baseRefs,
  }))

  for(const item of descriptors){
    const existing=await taskRepo.get(workSessionId,item.taskId)
    if(existing)continue
    const task=createWorkSessionTask({
      id:item.taskId,
      workSessionId,
      ownerUserId:userId,
      domain:'director',
      capability:item.capability,
      authorityRef:'director-post-plan:'+audio.id,
      idempotencyKey:'director-post:'+audio.id+':'+item.kind,
      correlationId:'director-post:'+projectId+':r'+revision,
      dependencyIds:dependencies(item.kind),
      inputRefs:baseRefs,
      maxAttempts:3,
    })
    await taskRepo.create(task)
  }

  const promoted=await reconcileWorkSessionTaskReadiness(taskRepo,workSessionId)
  const tasks=await taskRepo.list(workSessionId)
  return Object.freeze({
    projectId,
    workSessionId,
    audioPostPlanId:audio.id,
    taskIds:Object.freeze(tasks.map(task=>task.id)),
    readyTaskIds:Object.freeze(unique([
      ...tasks.filter(task=>task.status==='ready').map(task=>task.id),
      ...promoted.map(task=>task.id),
    ])),
    descriptors:Object.freeze(descriptors),
    authority:'ONE_RUNTIME_COORDINATION_ONLY',
    canExecute:false,
    canPublish:false,
  })
}
