import {createHmac,timingSafeEqual} from 'node:crypto'
import {NextResponse} from 'next/server'
import {
  createDirectorSportsWatchEnvelope,
  type DirectorSportsObservationKind,
} from '@jhadina/director-core'
import {
  directorPerceptionToContextFeature,
  ingestDirectorSportsWatchObservation,
} from '@jhadina/money-core'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const SPORTS_KINDS=new Set<DirectorSportsObservationKind>([
  'FORMATION','MATCHUP','TEMPO','FATIGUE','MOMENTUM','TACTICAL_ADJUSTMENT',
  'PLAYER_ROLE','SUBSTITUTION','POSSESSION_CANDIDATE','SCORE_CANDIDATE','CLOCK_CANDIDATE','OTHER',
])
const CREATIVE_DOMAINS=new Set(['music','visual','story','editing','performance','writing','design'])
const NOTE_KINDS=new Set(['general','shot','camera','edit','sound','lighting','performance','transition'])

function authorized(request:Request,jobId:string):boolean{
  const secret=process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_SECRET?.trim()??''
  const header=request.headers.get('authorization')??''
  if(!secret||!jobId||!header.startsWith('Bearer '))return false
  const expected=createHmac('sha256',secret).update(jobId).digest('base64url')
  const provided=header.slice(7)
  const a=Buffer.from(expected),b=Buffer.from(provided)
  return a.length===b.length&&timingSafeEqual(a,b)
}

export async function POST(request:Request){
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_STORE_NOT_CONFIGURED'},{status:503})

  try{
    const body=await request.json() as {
      jobId?:string
      status?:'running'|'completed'|'failed'
      error?:string
      creativeObservations?:Array<{
        id?:string
        domain?:string
        technique?:string
        startMs?:number
        endMs?:number
        measurement?:Record<string,number|string|boolean>
        interpretation?:string
        confidence?:number
        evidenceIds?:string[]
        note?:{title?:string;body?:string;kind?:string;startSeconds?:number;endSeconds?:number;frameUrl?:string;tags?:string[]}
      }>
      sportsObservations?:Array<{
        frameId?:string
        kind?:DirectorSportsObservationKind
        value?:string|number|boolean
        confidence?:number
        normalizedValue?:number
        observedAt?:string
        availableAt?:string
        evidenceIds?:string[]
        methodologyVersion?:string
      }>
    }
    const jobId=body.jobId?.trim()??''
    if(!jobId)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_JOB_ID_REQUIRED'},{status:400})
    if(!authorized(request,jobId))return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_CALLBACK_UNAUTHORIZED'},{status:401})

    const {data:job,error:jobError}=await client.from('director_watch_jobs')
      .select('id,owner_user_id,purpose,media_id,event_id,subject_id,source_locator,status,source_subscription_id')
      .eq('id',jobId).maybeSingle()
    if(jobError)throw new Error('DIRECTOR_WATCH_CALLBACK_JOB_READ_FAILED:'+jobError.message)
    if(!job)return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_JOB_NOT_FOUND'},{status:404})

    if(body.status==='running'){
      const {error}=await client.from('director_watch_jobs').update({
        status:'running',error:null,updated_at:new Date().toISOString(),
      }).eq('id',jobId)
      if(error)throw new Error('DIRECTOR_WATCH_JOB_STATUS_WRITE_FAILED:'+error.message)
      return NextResponse.json({ok:true,jobId,status:'running'})
    }
    if(body.status==='failed'){
      const failedAt=new Date().toISOString()
      const failure=body.error?.trim()||'DIRECTOR_WATCH_WORKER_FAILED'
      const {error}=await client.from('director_watch_jobs').update({
        status:'failed',
        error:failure,
        updated_at:failedAt,
        completed_at:failedAt,
      }).eq('id',jobId)
      if(error)throw new Error('DIRECTOR_WATCH_JOB_STATUS_WRITE_FAILED:'+error.message)
      if(job.source_subscription_id){
        const {error:sourceError}=await client.from('director_watch_sources').update({
          last_error:failure,
          updated_at:failedAt,
        }).eq('id',String(job.source_subscription_id)).eq('owner_user_id',job.owner_user_id)
        if(sourceError)throw new Error('DIRECTOR_WATCH_SOURCE_FAILURE_WRITE_FAILED:'+sourceError.message)
      }
      return NextResponse.json({ok:true,jobId,status:'failed'})
    }
    if(body.status!=='completed')return NextResponse.json({ok:false,error:'DIRECTOR_WATCH_CALLBACK_STATUS_INVALID'},{status:400})

    let resultCount=0
    if(job.purpose==='creative'){
      const mediaId=String(job.media_id??'')
      if(!mediaId)throw new Error('DIRECTOR_WATCH_CREATIVE_MEDIA_ID_MISSING')
      for(const [index,item] of (body.creativeObservations??[]).entries()){
        if(!item.domain||!CREATIVE_DOMAINS.has(item.domain)||!item.technique?.trim()||!item.interpretation?.trim()){
          throw new Error('DIRECTOR_WATCH_CREATIVE_OBSERVATION_INVALID:'+index)
        }
        if(typeof item.confidence!=='number'||!Number.isFinite(item.confidence)||item.confidence<0||item.confidence>1){
          throw new Error('DIRECTOR_WATCH_CREATIVE_CONFIDENCE_INVALID:'+index)
        }
        const confidence=item.confidence
        const evidenceIds=[...new Set([...(item.evidenceIds??[]),`watch-job:${jobId}`,`source:${String(job.source_locator)}`].map(String).filter(Boolean))]
        if(!evidenceIds.length)throw new Error('DIRECTOR_WATCH_CREATIVE_EVIDENCE_REQUIRED:'+index)
        const observationId=item.id?.trim()||`${jobId}:creative:${index+1}`
        const {error}=await client.from('jhadina_entertainment_observations').upsert({
          id:observationId,
          owner_user_id:job.owner_user_id,
          media_id:mediaId,
          domain:item.domain,
          technique:item.technique.trim(),
          start_ms:typeof item.startMs==='number'&&Number.isFinite(item.startMs)?item.startMs:null,
          end_ms:typeof item.endMs==='number'&&Number.isFinite(item.endMs)?item.endMs:null,
          measurement:item.measurement??null,
          interpretation:item.interpretation.trim(),
          evidence:evidenceIds.map(sourceId=>({sourceId,kind:'observation' as const,note:'director-watch-worker'})),
          confidence,
        },{onConflict:'id'})
        if(error)throw new Error('DIRECTOR_WATCH_CREATIVE_OBSERVATION_WRITE_FAILED:'+error.message)
        resultCount+=1

        if(item.note?.body?.trim()){
          const kind=NOTE_KINDS.has(item.note.kind??'')?item.note.kind:'general'
          const {error:noteError}=await client.from('director_cinematic_notes').upsert({
            id:`${observationId}:note`,
            owner_user_id:job.owner_user_id,
            media_id:mediaId,
            title:item.note.title?.trim()||null,
            body:item.note.body.trim(),
            kind,
            start_seconds:typeof item.note.startSeconds==='number'&&Number.isFinite(item.note.startSeconds)?item.note.startSeconds:null,
            end_seconds:typeof item.note.endSeconds==='number'&&Number.isFinite(item.note.endSeconds)?item.note.endSeconds:null,
            frame_url:item.note.frameUrl?.trim()||null,
            tags:Array.isArray(item.note.tags)?item.note.tags.map(String).map(value=>value.trim()).filter(Boolean):[],
            created_at:new Date().toISOString(),
            updated_at:new Date().toISOString(),
          },{onConflict:'id'})
          if(noteError)throw new Error('DIRECTOR_WATCH_CINEMATIC_NOTE_WRITE_FAILED:'+noteError.message)
        }
      }
    }else if(job.purpose==='sports'){
      const eventId=String(job.event_id??''),subjectId=String(job.subject_id??'')
      if(!eventId||!subjectId)throw new Error('DIRECTOR_WATCH_SPORTS_IDENTITY_MISSING')
      for(const [index,item] of (body.sportsObservations??[]).entries()){
        if(
          !item.kind||
          !SPORTS_KINDS.has(item.kind)||
          !['string','number','boolean'].includes(typeof item.value)||
          typeof item.confidence!=='number'||
          !Number.isFinite(item.confidence)||
          item.confidence<0||
          item.confidence>1
        ){
          throw new Error('DIRECTOR_WATCH_SPORTS_OBSERVATION_INVALID:'+index)
        }
        const observedAt=item.observedAt?.trim()||new Date().toISOString()
        const availableAt=item.availableAt?.trim()||observedAt
        const evidenceIds=[...new Set([...(item.evidenceIds??[]),`watch-job:${jobId}`].map(String).filter(Boolean))]
        const envelope=createDirectorSportsWatchEnvelope({
          observationId:`${jobId}:sports:${index+1}`,
          eventId,
          subjectId,
          frameId:item.frameId?.trim()||`${jobId}:frame:${index+1}`,
          kind:item.kind,
          value:item.value,
          confidence:item.confidence,
          observedAt,
          availableAt,
          sourceLocator:String(job.source_locator),
          evidenceIds,
          rightsVerified:true,
          sourceAuthorized:true,
        })
        const perception=ingestDirectorSportsWatchObservation(envelope)
        const normalizedValue=typeof item.normalizedValue==='number'&&Number.isFinite(item.normalizedValue)
          ? item.normalizedValue
          : undefined
        const contextFeature=normalizedValue===undefined?undefined:directorPerceptionToContextFeature({
          update:perception,
          normalizedValue,
          methodologyVersion:item.methodologyVersion?.trim()||'director-watch-worker:v1',
          evidenceIds,
        })
        const {error}=await client.from('sports_director_perception_observations').upsert({
          id:perception.perceptionId,
          owner_user_id:job.owner_user_id,
          event_id:eventId,
          subject_id:subjectId,
          frame_id:perception.frameId,
          kind:perception.kind,
          envelope,
          perception,
          context_feature:contextFeature??null,
          requires_official_reconciliation:perception.requiresOfficialReconciliation,
          observed_at:perception.observation.observedAt,
          available_at:perception.observation.availableAt,
        },{onConflict:'id'})
        if(error)throw new Error('DIRECTOR_WATCH_SPORTS_OBSERVATION_WRITE_FAILED:'+error.message)
        resultCount+=1
      }
    }

    const completedAt=new Date().toISOString()
    const {error:updateError}=await client.from('director_watch_jobs').update({
      status:'completed',
      result_count:resultCount,
      error:null,
      updated_at:completedAt,
      completed_at:completedAt,
    }).eq('id',jobId)
    if(updateError)throw new Error('DIRECTOR_WATCH_JOB_COMPLETE_FAILED:'+updateError.message)
    if(job.source_subscription_id){
      const {error:sourceError}=await client.from('director_watch_sources').update({
        last_completed_at:completedAt,
        last_error:null,
        updated_at:completedAt,
      }).eq('id',String(job.source_subscription_id)).eq('owner_user_id',job.owner_user_id)
      if(sourceError)throw new Error('DIRECTOR_WATCH_SOURCE_COMPLETE_WRITE_FAILED:'+sourceError.message)
    }

    return NextResponse.json({
      ok:true,
      jobId,
      status:'completed',
      resultCount,
      authority:job.purpose==='sports'?'DIRECTOR_INFERENCE_ONLY':'OBSERVATION_ONLY',
      canExecute:false,
    })
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'DIRECTOR_WATCH_CALLBACK_FAILED'},{status:500})
  }
}
