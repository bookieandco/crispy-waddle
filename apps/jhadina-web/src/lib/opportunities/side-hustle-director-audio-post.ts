import type {SupabaseClient} from '@supabase/supabase-js'
import {
  compileGenerationAudioIntent,
  validateFoleyEventPlan,
  validateSoundtrackGenerationBrief,
  type FoleyEvent,
  type FoleyEventPlan,
  type GenerationAudioIntent,
  type ScreenplayScene,
  type SoundtrackGenerationBrief,
  type StoryTreatment,
} from '@jhadina/director-core'
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type BlueprintRow={
  id:string
  version:number
  blueprint:{
    treatment?:StoryTreatment
    scenes?:ScreenplayScene[]
    authority?:string
  }
  evidence_ids:string[]|null
}
type BoardRow={
  id:string
  shot_id:string
  title:string|null
  action:string|null
}
type SelectionRow={
  take_group_id:string
  selected_asset_id:string|null
  selected_take_id:string|null
  evidence_ids:string[]|null
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(String).map(value=>value.trim()).filter(Boolean))]
}
function words(text:string):number{
  return text.trim()?text.trim().split(/\s+/).length:0
}

function distributeSegments<T extends {text:string}>(segments:readonly T[],durationSeconds:number){
  const totalWords=Math.max(1,segments.reduce((sum,item)=>sum+Math.max(1,words(item.text)),0))
  let cursor=0
  return segments.map((item,index)=>{
    const last=index===segments.length-1
    const share=last?durationSeconds-cursor:durationSeconds*(Math.max(1,words(item.text))/totalWords)
    const startSeconds=cursor
    const endSeconds=Math.max(startSeconds+.1,last?durationSeconds:startSeconds+share)
    cursor=endSeconds
    return {...item,startSeconds,endSeconds}
  })
}

function requiredWorkers(plan:SideHustleDirectorProductionPlan,hasSpeech:boolean){
  const profiles:string[]=[]
  if(hasSpeech)profiles.push('creative.voice')
  profiles.push('creative.audio')
  if(plan.format!=='faceless_youtube')profiles.push('creative.foley')
  if(plan.format==='music_video'||hasSpeech)profiles.push('creative.video')
  return unique(profiles)
}

export async function compileSideHustleDirectorAudioPostPlan(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}){
  const {client,userId,projectId}=input
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('owner_user_id,production_run_id,plan')
    .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(contextError)throw new Error('DIRECTOR_AUDIO_POST_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('DIRECTOR_AUDIO_POST_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('DIRECTOR_AUDIO_POST_CONTEXT_INVALID')
  const runId=String(context.production_run_id??'')
  if(!runId)throw new Error('DIRECTOR_AUDIO_POST_RUN_REQUIRED')

  const repository=new DirectorWorkstationTimelineRepository(client)
  const timelineRecord=await repository.load(projectId)
  if(!timelineRecord)throw new Error('DIRECTOR_AUDIO_POST_TIMELINE_REQUIRED')
  const timeline=timelineRecord.timeline
  const primary=timeline.tracks.find(track=>track.id==='video-primary')
  if(!primary?.clips.length)throw new Error('DIRECTOR_AUDIO_POST_ROUGH_CUT_REQUIRED')

  const {data:blueprintRaw,error:blueprintError}=await client.from('director_screenplay_blueprints')
    .select('id,version,blueprint,evidence_ids')
    .eq('project_id',projectId).eq('owner_user_id',userId)
    .order('version',{ascending:false}).limit(1).maybeSingle()
  if(blueprintError)throw new Error('DIRECTOR_AUDIO_POST_SCREENPLAY_READ_FAILED:'+blueprintError.message)
  if(!blueprintRaw)throw new Error('DIRECTOR_AUDIO_POST_SCREENPLAY_REQUIRED')
  const blueprint=blueprintRaw as BlueprintRow
  if(blueprint.blueprint.authority!=='DIRECTOR_SCREENPLAY_BLUEPRINT'||!blueprint.blueprint.treatment||!blueprint.blueprint.scenes?.length){
    throw new Error('DIRECTOR_AUDIO_POST_SCREENPLAY_INVALID')
  }
  const treatment=blueprint.blueprint.treatment
  const scenes=[...blueprint.blueprint.scenes].sort((a,b)=>a.order-b.order)
  const evidenceIds=unique([
    ...(blueprint.evidence_ids??[]),
    ...plan.evidenceRefs,
    'workstation-timeline:'+projectId+':revision:'+timelineRecord.revision,
  ])

  const speechSource=plan.format==='faceless_youtube'
    ? scenes.flatMap(scene=>{
        const sceneText=[
          ...scene.action,
          ...scene.dialogue.map(line=>line.text),
        ].map(value=>value.trim()).filter(Boolean).join(' ')
        return sceneText?[{
          id:'narration:'+scene.id,
          sceneId:scene.id,
          characterId:'narrator',
          role:'voiceover' as const,
          text:sceneText,
          evidenceIds:unique([...scene.evidenceIds,...scene.dialogue.flatMap(line=>line.evidenceIds)]),
        }]:[]
      })
    : scenes.flatMap(scene=>scene.dialogue.map(line=>({
        id:'dialogue:'+line.id,
        sceneId:scene.id,
        characterId:line.characterId,
        role:'dialogue' as const,
        text:line.text,
        evidenceIds:unique([...scene.evidenceIds,...line.evidenceIds]),
      })))

  const speechSegments=distributeSegments(speechSource,timeline.durationSeconds)
  const captionSegments=speechSegments.map((segment,index)=>({
    id:'caption:'+plan.id+':'+(index+1),
    text:segment.text,
    startSeconds:segment.startSeconds,
    endSeconds:segment.endSeconds,
    evidenceIds:segment.evidenceIds,
    timingAuthority:'PROVISIONAL_UNTIL_AUDIO_ALIGNMENT',
  }))

  const musicPreferences=plan.approvedCreativePreferences.filter(item=>item.domain==='music'||item.domain==='editing'||item.domain==='story')
  const moodTags=unique(musicPreferences.map(item=>item.preference).slice(0,5))
  const soundtrackBrief:SoundtrackGenerationBrief={
    id:'soundtrack:'+plan.id+':v1',
    projectId,
    purpose:plan.format==='music_video'
      ?'support the supplied song/performance without replacing the canonical song'
      :plan.format==='faceless_youtube'
        ?'support narration and pacing without masking speech'
        :'support story, pacing and emotional continuity without masking dialogue',
    moodTags:moodTags.length?moodTags:['neutral-supportive'],
    styleTags:[plan.format.replaceAll('_','-'),'editable-stems'],
    energy:(plan.format==='tiktok_short'||plan.format==='ugc_ad') ? .75 : .55,
    tempo:{mode:(plan.format==='tiktok_short'||plan.format==='ugc_ad') ? 'fast' : 'medium'},
    durationSeconds:timeline.durationSeconds,
    variationCount:3,
    evidenceIds,
    authority:'DIRECTOR_SOUNDTRACK_BRIEF',
  }
  const soundtrackReasons=validateSoundtrackGenerationBrief(soundtrackBrief)
  if(soundtrackReasons.length)throw new Error('DIRECTOR_AUDIO_POST_SOUNDTRACK_INVALID:'+soundtrackReasons.join(','))

  const {data:boardsRaw,error:boardError}=await client.from('director_storyboard_boards')
    .select('id,shot_id,title,action').eq('project_id',projectId).order('sequence_id',{ascending:true}).order('ordinal',{ascending:true})
  if(boardError)throw new Error('DIRECTOR_AUDIO_POST_BOARD_READ_FAILED:'+boardError.message)
  const boards=(boardsRaw??[]) as BoardRow[]
  const {data:selectionsRaw,error:selectionError}=await client.from('director_take_selections')
    .select('take_group_id,selected_asset_id,selected_take_id,evidence_ids')
    .eq('project_id',projectId).eq('status','selected')
  if(selectionError)throw new Error('DIRECTOR_AUDIO_POST_SELECTION_READ_FAILED:'+selectionError.message)
  const selections=(selectionsRaw??[]) as SelectionRow[]
  const selectedByBoard=new Map(selections.map(selection=>[
    selection.take_group_id.slice(('take-group:'+plan.id+':').length),
    selection,
  ]))
  const clipByAsset=new Map(primary.clips.map(clip=>[clip.assetId,clip]))
  const foleyEvents:FoleyEvent[]=plan.format==='faceless_youtube'?[]:boards.flatMap((board,index)=>{
    const selection=selectedByBoard.get(board.id)
    const assetId=selection?.selected_asset_id??''
    const clip=clipByAsset.get(assetId)
    const action=board.action?.trim()??''
    if(!selection||!assetId||!clip||!action)return[]
    return[{
      id:'foley:'+plan.id+':'+(index+1),
      projectId,
      sourceAssetId:assetId,
      startSeconds:clip.startSeconds,
      endSeconds:clip.startSeconds+clip.durationSeconds,
      action,
      sourceKind:'generated' as const,
      rightsStatus:'generated' as const,
      evidenceIds:unique([
        ...(selection.evidence_ids??[]),
        'storyboard-board:'+board.id,
        'selected-take:'+String(selection.selected_take_id??''),
      ]),
      prompt:'Create synchronized Foley/SFX for the visible action only: '+action+'. Keep dialogue intelligible and return an isolated editable stem.',
    }]
  })
  const foleyPlan:FoleyEventPlan={
    id:'foley-plan:'+plan.id+':v1',
    projectId,
    timelineVersionId:'workstation-timeline:'+projectId+':revision:'+timelineRecord.revision,
    events:foleyEvents,
    authority:'PROPOSAL_ONLY',
  }
  const foleyDecision=validateFoleyEventPlan(foleyPlan,{durationSeconds:timeline.durationSeconds,commercialUse:true})
  if(!foleyDecision.valid)throw new Error('DIRECTOR_AUDIO_POST_FOLEY_INVALID:'+foleyDecision.reasons.join(','))

  const audioIntents:GenerationAudioIntent[]=scenes.map(scene=>{
    const hasDialogue=scene.dialogue.length>0
    const allowed=unique([
      ...(hasDialogue?['dialogue']:[]),
      ...(plan.format==='faceless_youtube'?['ambience']:['foley','sfx','ambience']),
    ]) as GenerationAudioIntent['allowedRoles']
    const forbidden=unique([
      ...(plan.format==='faceless_youtube'?['dialogue','foley']:[]),
      'music',
    ]) as GenerationAudioIntent['forbiddenRoles']
    const intent:GenerationAudioIntent={
      id:'audio-intent:'+scene.id,
      projectId,
      sceneId:scene.id,
      allowedRoles:allowed.length?allowed:['ambience'],
      forbiddenRoles:forbidden,
      forbidUnrequestedMusic:true,
      notes:['Music is authored as a separate editable stem. Do not bake it into generated picture/audio.'],
      evidenceIds:unique([...scene.evidenceIds,...evidenceIds]),
      authority:'DIRECTOR_GENERATION_AUDIO_INTENT',
    }
    compileGenerationAudioIntent(intent)
    return intent
  })

  const musicVideoSource=plan.format==='music_video'
    ?await client.from('director_project_inputs').select('artifact_id,label,metadata')
      .eq('project_id',projectId).eq('owner_user_id',userId).eq('role','audio').order('created_at',{ascending:true})
    :{data:[],error:null}
  if(musicVideoSource.error)throw new Error('DIRECTOR_AUDIO_POST_MUSIC_SOURCE_READ_FAILED:'+musicVideoSource.error.message)

  const blockers:string[]=[]
  if(plan.format==='music_video'&&!(musicVideoSource.data??[]).length){
    blockers.push('DIRECTOR_MUSIC_VIDEO_SOURCE_AUDIO_REQUIRED')
  }
  if(speechSegments.length){
    blockers.push('DIRECTOR_COMPUTE_WORKER_REQUIRED:creative.voice')
  }
  blockers.push('DIRECTOR_COMPUTE_WORKER_REQUIRED:creative.audio')
  if(foleyEvents.length)blockers.push('DIRECTOR_COMPUTE_WORKER_REQUIRED:creative.foley')
  if(plan.format==='music_video'||speechSegments.some(segment=>segment.role==='dialogue')){
    blockers.push('DIRECTOR_LIP_SYNC_RUNTIME_REQUIRED')
  }

  const requiredWorkerProfiles=requiredWorkers(plan,speechSegments.length>0)
  const postPlan={
    id:'audio-post:'+plan.id+':v1',
    projectId,
    productionRunId:runId,
    timelineRevision:timelineRecord.revision,
    format:plan.format,
    treatmentId:treatment.id,
    speechSegments,
    captions:{
      required:true,
      segments:captionSegments,
      timing:'provisional-until-generated-speech-or-final-dialogue-alignment',
    },
    soundtrackBrief,
    foleyPlan,
    audioIntents,
    stems:{
      required:true,
      roles:unique([
        ...(plan.format==='faceless_youtube'?['voiceover']:['dialogue']),
        'music',
        ...(foleyEvents.length?['foley','sfx']:[]),
        'ambience',
      ]),
      preserveSeparateFiles:true,
    },
    lipSync:{
      required:plan.format==='music_video'||speechSegments.some(segment=>segment.role==='dialogue'),
      mode:plan.format==='music_video'?'music-vocal-stem':'dialogue-phoneme-viseme',
      sourceAudioArtifacts:(musicVideoSource.data??[]).map(row=>String(row.artifact_id)),
    },
    mixPolicy:{
      minimumPeakHeadroomDb:1,
      maximumLayerGainDb:6,
      requireDialogueDuckingForFoley:true,
    },
    evidenceIds,
    authority:'DIRECTOR_AUDIO_POST_PLAN_ONLY',
  }
  const now=new Date().toISOString()
  const status=blockers.length?'awaiting_workers':'planned'
  const {error:writeError}=await client.from('director_audio_post_plans').upsert({
    id:'audio-post:'+plan.id+':v1',
    project_id:projectId,
    owner_user_id:userId,
    production_run_id:runId,
    plan_id:plan.id,
    timeline_revision:timelineRecord.revision,
    format:plan.format,
    post_plan:postPlan,
    required_worker_profiles:requiredWorkerProfiles,
    ready_worker_profiles:[],
    blockers:unique(blockers),
    status,
    updated_at:now,
  },{onConflict:'project_id,plan_id,timeline_revision'})
  if(writeError)throw new Error('DIRECTOR_AUDIO_POST_PLAN_WRITE_FAILED:'+writeError.message)

  return Object.freeze({
    postPlan,
    status,
    blockers:Object.freeze(unique(blockers)),
    requiredWorkerProfiles:Object.freeze(requiredWorkerProfiles),
    nextBoundary:blockers.length?'DIRECTOR_AUDIO_WORKER_COMMISSIONING':'DIRECTOR_AUDIO_EXECUTION',
    publicationAuthority:'NONE' as const,
    paidMediaAuthority:'NONE' as const,
  })
}
