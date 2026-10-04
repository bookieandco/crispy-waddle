import {NextResponse} from 'next/server'
import {
  createDirectorSportsWatchEnvelope,
  type DirectorSportsObservationKind,
} from '@jhadina/director-core'
import {
  directorPerceptionToContextFeature,
  ingestDirectorSportsWatchObservation,
} from '@jhadina/money-core'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

const KINDS=new Set<DirectorSportsObservationKind>([
  'FORMATION','MATCHUP','TEMPO','FATIGUE','MOMENTUM','TACTICAL_ADJUSTMENT',
  'PLAYER_ROLE','SUBSTITUTION','POSSESSION_CANDIDATE','SCORE_CANDIDATE','CLOCK_CANDIDATE','OTHER',
])

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})

    const body=await request.json() as {
      observationId?:string
      eventId?:string
      subjectId?:string
      frameId?:string
      kind?:DirectorSportsObservationKind
      value?:string|number|boolean
      confidence?:number
      normalizedValue?:number
      observedAt?:string
      availableAt?:string
      sourceLocator?:string
      evidenceIds?:string[]
      rightsVerified?:boolean
      sourceAuthorized?:boolean
      methodologyVersion?:string
    }
    if(!body.kind||!KINDS.has(body.kind))return NextResponse.json({ok:false,error:'DIRECTOR_SPORTS_KIND_INVALID'},{status:400})
    if(body.value===undefined)return NextResponse.json({ok:false,error:'DIRECTOR_SPORTS_VALUE_REQUIRED'},{status:400})

    const envelope=createDirectorSportsWatchEnvelope({
      observationId:body.observationId??'',
      eventId:body.eventId??'',
      subjectId:body.subjectId??'',
      frameId:body.frameId??'',
      kind:body.kind,
      value:body.value,
      confidence:Number(body.confidence),
      observedAt:body.observedAt??'',
      availableAt:body.availableAt??'',
      sourceLocator:body.sourceLocator??'',
      evidenceIds:body.evidenceIds??[],
      rightsVerified:body.rightsVerified===true,
      sourceAuthorized:body.sourceAuthorized===true,
    })
    const perception=ingestDirectorSportsWatchObservation(envelope)
    const feature=body.normalizedValue===undefined
      ? undefined
      : directorPerceptionToContextFeature({
          update:perception,
          normalizedValue:body.normalizedValue,
          methodologyVersion:body.methodologyVersion?.trim()||'director-watch:v1',
          evidenceIds:body.evidenceIds,
        })

    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'SPORTS_DIRECTOR_PERCEPTION_STORE_NOT_CONFIGURED'},{status:503})
    const {error}=await client.from('sports_director_perception_observations').upsert({
      id:perception.perceptionId,
      owner_user_id:user.id,
      event_id:perception.eventId,
      subject_id:perception.observation.subjectId,
      frame_id:perception.frameId,
      kind:perception.kind,
      envelope,
      perception,
      context_feature:feature??null,
      requires_official_reconciliation:perception.requiresOfficialReconciliation,
      observed_at:perception.observation.observedAt,
      available_at:perception.observation.availableAt,
    },{onConflict:'id'})
    if(error)throw new Error('SPORTS_DIRECTOR_PERCEPTION_WRITE_FAILED:'+error.message)

    return NextResponse.json({
      ok:true,
      perception,
      contextFeature:feature??null,
      officialReconciliationRequired:perception.requiresOfficialReconciliation,
      canonicalRealityEligible:false,
      bettingAuthority:'NONE',
      financialAuthority:'NONE',
      canExecute:false,
    },{status:201})
  }catch(error){
    const message=error instanceof Error?error.message:'SPORTS_DIRECTOR_WATCH_FAILED'
    const status=/REQUIRED|INVALID|NOT_VERIFIED|NOT_AUTHORIZED|BEFORE_OBSERVED|CONFIDENCE/.test(message)?400:500
    return NextResponse.json({ok:false,error:message},{status})
  }
}

export async function GET(request:Request){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
  const eventId=new URL(request.url).searchParams.get('eventId')?.trim()
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'SPORTS_DIRECTOR_PERCEPTION_STORE_NOT_CONFIGURED'},{status:503})
  let query=client.from('sports_director_perception_observations')
    .select('id,event_id,subject_id,frame_id,kind,perception,context_feature,requires_official_reconciliation,observed_at,available_at')
    .eq('owner_user_id',user.id)
    .order('available_at',{ascending:false})
    .limit(200)
  if(eventId)query=query.eq('event_id',eventId)
  const {data,error}=await query
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
  return NextResponse.json({
    ok:true,
    observations:data??[],
    canonicalRealityEligible:false,
    bettingAuthority:'NONE',
    financialAuthority:'NONE',
    canExecute:false,
  })
}
