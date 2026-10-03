import {timingSafeEqual} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {processPumpLogsNotification} from '@/lib/shark/pump-event-runtime'
import type {SolanaLogsNotification} from '@jhadina/shark-intelligence-core/meme-trader'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function sameSecret(left:string|undefined,right:string|undefined):boolean{
  if(!left||!right)return false
  const a=Buffer.from(left),b=Buffer.from(right)
  return a.length===b.length&&timingSafeEqual(a,b)
}

export function authorizedPumpStream(headers:Headers,expected:string|undefined):boolean{
  const value=headers.get('authorization')
  if(!value?.startsWith('Bearer '))return false
  return sameSecret(value.slice(7),expected?.trim())
}

export async function POST(request:NextRequest){
  const secret=process.env.SHARK_PUMP_STREAM_SECRET?.trim()
  if(!secret)return NextResponse.json({ok:false,error:'shark_pump_stream_unavailable'},{status:503})
  if(!authorizedPumpStream(request.headers,secret))return NextResponse.json({ok:false,error:'unauthorized_stream'},{status:401})

  let payload:unknown
  try{payload=await request.json()}catch{
    return NextResponse.json({ok:false,error:'invalid_json'},{status:400})
  }
  if(!payload||typeof payload!=='object')return NextResponse.json({ok:false,error:'invalid_logs_notification'},{status:400})

  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})

  try{
    const receivedAt=new Date().toISOString()
    const results=await processPumpLogsNotification(client,{
      payload:payload as SolanaLogsNotification,
      receivedAt,
      source:'pump-log-stream-worker',
    })
    return NextResponse.json({
      ok:true,
      received:results.length,
      stages:results.map(result=>result.update.radar.stage),
      authority:'EVIDENCE_ONLY',
      canAuthorizeTrade:false,
    })
  }catch(error){
    const message=error instanceof Error?error.message:'unknown'
    if(message.includes('notification_shape_invalid')||message.includes('received_at_invalid')){
      return NextResponse.json({ok:false,error:'invalid_logs_notification'},{status:400})
    }
    console.error('SHARK Pump stream ingest failed',error)
    return NextResponse.json({ok:false,error:'shark_pump_stream_ingest_failed'},{status:502})
  }
}
