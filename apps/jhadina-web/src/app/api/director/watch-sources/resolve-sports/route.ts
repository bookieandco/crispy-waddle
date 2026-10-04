import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createTheSportsDbEventResolver} from '@/lib/intelligence/sports-simulation-context-provider'

export async function POST(request:Request){
  try{
    const supabase=await createClient()
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})

    const body=await request.json() as {query?:string;liveRequested?:boolean}
    const query=body.query?.trim()??''
    if(!query)return NextResponse.json({ok:false,error:'SPORT_WATCH_QUERY_REQUIRED'},{status:400})

    const event=await createTheSportsDbEventResolver().resolve({
      query,
      liveRequested:body.liveRequested===true,
    })
    if(!event)return NextResponse.json({
      ok:false,
      error:body.liveRequested===true
        ?'SPORT_WATCH_LIVE_EVENT_NOT_RESOLVED'
        :'SPORT_WATCH_EVENT_NOT_RESOLVED',
    },{status:404})

    return NextResponse.json({
      ok:true,
      event:{
        eventId:event.eventId,
        providerEventId:event.providerEventId,
        eventLabel:event.eventLabel,
        sport:event.sport,
        league:event.league??null,
        scheduledAt:event.scheduledAt??null,
        status:event.status,
        progress:event.progress??null,
        homeTeam:event.homeTeam,
        awayTeam:event.awayTeam,
        observedAt:event.observedAt,
        evidenceIds:event.evidenceIds,
      },
      authority:'EVENT_REALITY_ONLY',
      canWager:false,
      canExecute:false,
    })
  }catch(error){
    const message=error instanceof Error?error.message:'SPORT_WATCH_EVENT_RESOLUTION_FAILED'
    return NextResponse.json({ok:false,error:message},{status:/HTTP_/.test(message)?502:500})
  }
}
