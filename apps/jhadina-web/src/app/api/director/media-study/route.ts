import type {SupabaseClient} from '@supabase/supabase-js'
import {NextResponse} from 'next/server'
import {
  InMemoryEntertainmentCore,
  type CreativeDomain,
  type CreativeFeedback,
  type CreativeObservation,
  type MediaItem,
} from '@jhadina/entertainment-core'
import type {CinematicNoteKind} from '@jhadina/director-core'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

type Body=Record<string,unknown>&{action?:string}
const domains=new Set<CreativeDomain>(['music','visual','story','editing','performance','writing','design'])
const noteKinds=new Set<CinematicNoteKind>(['general','shot','camera','edit','sound','lighting','performance','transition'])

function text(body:Body,key:string):string{
  const value=body[key]
  if(typeof value!=='string'||!value.trim())throw new Error(key+' is required')
  return value.trim()
}
const optionalText=(body:Body,key:string)=>typeof body[key]==='string'&&String(body[key]).trim()?String(body[key]).trim():undefined
async function loadEngine(client:SupabaseClient,userId:string){
  const engine=new InMemoryEntertainmentCore()
  const {data:observations,error:observationError}=await client.from('jhadina_entertainment_observations')
    .select('id,media_id,domain,technique,start_ms,end_ms,measurement,interpretation,evidence,confidence')
    .eq('owner_user_id',userId)
  if(observationError)throw new Error('ENTERTAINMENT_OBSERVATION_READ_FAILED:'+observationError.message)
  for(const row of observations??[]){
    engine.addObservation({
      id:String(row.id),mediaId:String(row.media_id),domain:row.domain as CreativeDomain,
      technique:String(row.technique),
      ...(row.start_ms===null?{}:{startMs:Number(row.start_ms)}),
      ...(row.end_ms===null?{}:{endMs:Number(row.end_ms)}),
      ...(row.measurement?{measurement:row.measurement as Record<string,number|string|boolean>}:{}),
      interpretation:String(row.interpretation),
      evidence:Array.isArray(row.evidence)?row.evidence as CreativeObservation['evidence']:[],
      confidence:Number(row.confidence),
    })
  }
  const {data:feedback,error:feedbackError}=await client.from('jhadina_entertainment_feedback')
    .select('id,target_id,signal,scope,reason,created_at').eq('owner_user_id',userId).order('created_at',{ascending:true})
  if(feedbackError)throw new Error('ENTERTAINMENT_FEEDBACK_READ_FAILED:'+feedbackError.message)
  for(const row of feedback??[]){
    engine.recordFeedback({
      id:String(row.id),targetId:String(row.target_id),signal:row.signal as CreativeFeedback['signal'],
      scope:row.scope as CreativeFeedback['scope'],reason:row.reason?String(row.reason):undefined,createdAt:String(row.created_at),
    })
  }
  return engine
}

export async function GET(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'ENTERTAINMENT_STORE_NOT_CONFIGURED'},{status:503})
    const domain=new URL(request.url).searchParams.get('domain') as CreativeDomain|null
    if(domain&&!domains.has(domain))return NextResponse.json({ok:false,error:'ENTERTAINMENT_DOMAIN_INVALID'},{status:400})

    const engine=await loadEngine(client,user.id)
    const [{data:preferences,error:preferenceError},{data:notes,error:noteError},{data:media,error:mediaError}]=await Promise.all([
      client.from('jhadina_entertainment_preferences').select('id,hypothesis_id,domain,preference,confidence,provenance,approved_at').eq('owner_user_id',user.id).order('approved_at',{ascending:false}),
      client.from('director_cinematic_notes').select('id,media_id,title,body,kind,start_seconds,end_seconds,frame_url,tags,created_at,updated_at').eq('owner_user_id',user.id).order('created_at',{ascending:false}).limit(100),
      client.from('jhadina_entertainment_media').select('id,media_type,title,creator,source_uri,duration_ms,provenance,created_at').eq('owner_user_id',user.id).order('created_at',{ascending:false}).limit(100),
    ])
    if(preferenceError)throw new Error('ENTERTAINMENT_PREFERENCE_READ_FAILED:'+preferenceError.message)
    if(noteError)throw new Error('ENTERTAINMENT_NOTE_READ_FAILED:'+noteError.message)
    if(mediaError)throw new Error('ENTERTAINMENT_MEDIA_READ_FAILED:'+mediaError.message)

    return NextResponse.json({
      ok:true,
      media:media??[],
      hypotheses:engine.detectHypotheses().filter(item=>!domain||item.domain===domain),
      approvedPreferences:(preferences??[]).filter(item=>!domain||item.domain===domain),
      notes:notes??[],
    })
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'ENTERTAINMENT_MEDIA_STUDY_READ_FAILED'},{status:500})
  }
}

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'ENTERTAINMENT_STORE_NOT_CONFIGURED'},{status:503})
    const body=await request.json().catch(()=>({})) as Body
    const action=text(body,'action')

    if(action==='register_media'){
      const media=body.media as MediaItem|undefined
      if(!media||!media.id?.trim()||!media.title?.trim()||!media.sourceUri?.trim())throw new Error('ENTERTAINMENT_MEDIA_INVALID')
      if(media.provenance?.authorized!==true)throw new Error('ENTERTAINMENT_MEDIA_SOURCE_NOT_AUTHORIZED')
      const {error}=await client.from('jhadina_entertainment_media').upsert({
        id:media.id,owner_user_id:user.id,media_type:media.type,title:media.title,creator:media.creator??null,
        source_uri:media.sourceUri,duration_ms:media.durationMs??null,provenance:media.provenance,
      },{onConflict:'id'})
      if(error)throw new Error('ENTERTAINMENT_MEDIA_WRITE_FAILED:'+error.message)
      return NextResponse.json({ok:true,mediaId:media.id,authority:'REFERENCE_OBSERVATION_ONLY'},{status:201})
    }

    if(action==='observe'){
      const observation=body.observation as CreativeObservation|undefined
      if(!observation||!observation.id?.trim()||!observation.mediaId?.trim()||!domains.has(observation.domain))throw new Error('ENTERTAINMENT_OBSERVATION_INVALID')
      if(!Number.isFinite(observation.confidence)||observation.confidence<0||observation.confidence>1)throw new Error('ENTERTAINMENT_OBSERVATION_CONFIDENCE_INVALID')
      if(!observation.evidence?.length)throw new Error('ENTERTAINMENT_OBSERVATION_EVIDENCE_REQUIRED')
      const {data:media,error:mediaError}=await client.from('jhadina_entertainment_media').select('id,provenance').eq('id',observation.mediaId).eq('owner_user_id',user.id).maybeSingle()
      if(mediaError)throw new Error('ENTERTAINMENT_MEDIA_READ_FAILED:'+mediaError.message)
      if(!media)throw new Error('ENTERTAINMENT_MEDIA_NOT_FOUND')
      if((media.provenance as {authorized?:boolean}|null)?.authorized!==true)throw new Error('ENTERTAINMENT_MEDIA_SOURCE_NOT_AUTHORIZED')
      const {error}=await client.from('jhadina_entertainment_observations').upsert({
        id:observation.id,owner_user_id:user.id,media_id:observation.mediaId,domain:observation.domain,technique:observation.technique,
        start_ms:observation.startMs??null,end_ms:observation.endMs??null,measurement:observation.measurement??null,
        interpretation:observation.interpretation,evidence:observation.evidence,confidence:observation.confidence,
      },{onConflict:'id'})
      if(error)throw new Error('ENTERTAINMENT_OBSERVATION_WRITE_FAILED:'+error.message)
      return NextResponse.json({ok:true,observationId:observation.id,authority:'OBSERVATION_ONLY'},{status:201})
    }

    if(action==='feedback'){
      const targetId=text(body,'targetId')
      const signal=text(body,'signal')
      const scope=text(body,'scope')
      if(!['positive','negative'].includes(signal)||!['media','scene','segment','technique'].includes(scope))throw new Error('ENTERTAINMENT_FEEDBACK_INVALID')
      const id=optionalText(body,'id')??crypto.randomUUID()
      const createdAt=optionalText(body,'createdAt')??new Date().toISOString()
      const {error}=await client.from('jhadina_entertainment_feedback').insert({
        id,owner_user_id:user.id,target_id:targetId,signal,scope,reason:optionalText(body,'reason')??null,created_at:createdAt,
      })
      if(error)throw new Error('ENTERTAINMENT_FEEDBACK_WRITE_FAILED:'+error.message)
      const engine=await loadEngine(client,user.id)
      return NextResponse.json({ok:true,feedbackId:id,hypotheses:engine.detectHypotheses()},{status:201})
    }

    if(action==='approve_taste'){
      const hypothesisId=text(body,'hypothesisId')
      const engine=await loadEngine(client,user.id)
      const hypothesis=engine.detectHypotheses().find(item=>item.id===hypothesisId)
      if(!hypothesis)throw new Error('ENTERTAINMENT_TASTE_HYPOTHESIS_NOT_FOUND')
      const preference=engine.approve(hypothesis,optionalText(body,'approvedAt')??new Date().toISOString())
      const {error}=await client.from('jhadina_entertainment_preferences').upsert({
        id:preference.id,owner_user_id:user.id,hypothesis_id:preference.hypothesisId,domain:preference.domain,
        preference:preference.preference,confidence:preference.confidence,provenance:preference.provenance,approved_at:preference.approvedAt,
      },{onConflict:'owner_user_id,hypothesis_id'})
      if(error)throw new Error('ENTERTAINMENT_PREFERENCE_WRITE_FAILED:'+error.message)
      return NextResponse.json({ok:true,preference,authority:'APPROVED_CREATIVE_CONTEXT_ONLY'},{status:201})
    }

    if(action==='note'){
      const kind=text(body,'kind') as CinematicNoteKind
      if(!noteKinds.has(kind))throw new Error('DIRECTOR_CINEMATIC_NOTE_KIND_INVALID')
      const mediaId=text(body,'mediaId')
      const {data:media}=await client.from('jhadina_entertainment_media').select('id').eq('id',mediaId).eq('owner_user_id',user.id).maybeSingle()
      if(!media)throw new Error('ENTERTAINMENT_MEDIA_NOT_FOUND')
      const id=optionalText(body,'id')??crypto.randomUUID()
      const now=optionalText(body,'createdAt')??new Date().toISOString()
      const tags=Array.isArray(body.tags)?body.tags.filter((value):value is string=>typeof value==='string'&&value.trim().length>0):[]
      const {error}=await client.from('director_cinematic_notes').upsert({
        id,owner_user_id:user.id,media_id:mediaId,title:optionalText(body,'title')??null,body:text(body,'body'),kind,
        start_seconds:typeof body.startSeconds==='number'?body.startSeconds:null,
        end_seconds:typeof body.endSeconds==='number'?body.endSeconds:null,
        frame_url:optionalText(body,'frameUrl')??null,tags,created_at:now,updated_at:new Date().toISOString(),
      },{onConflict:'id'})
      if(error)throw new Error('DIRECTOR_CINEMATIC_NOTE_WRITE_FAILED:'+error.message)
      return NextResponse.json({ok:true,noteId:id,authority:'REFERENCE_NOTE_ONLY'},{status:201})
    }

    return NextResponse.json({ok:false,error:'Unsupported media-study action'},{status:400})
  }catch(error){
    const message=error instanceof Error?error.message:'ENTERTAINMENT_MEDIA_STUDY_FAILED'
    const status=/NOT_FOUND/.test(message)?404:/INVALID|REQUIRED|NOT_AUTHORIZED/.test(message)?400:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}
