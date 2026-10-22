import { NextRequest, NextResponse } from 'next/server'
import { SniperFastpathDiscoveryIntake, isHeliusWebhookAuthorizationValid } from '@jhadina/shark-intelligence-core/meme-trader'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { persistSharkLaunch } from '@/lib/shark/launch-repository'
import { persistSniperHeliusBatch } from '@/lib/shark/sniper-live-ingress'

export const runtime = 'nodejs'

// Process-local deduplication is only an optimization. Canonical Supabase
// jhadina_shark_persist_launch_bundle remains the durable cross-worker guard.
const sniperIntake = new SniperFastpathDiscoveryIntake({maxKeys:4096,dedupeTtlMs:60000})

export function authorizedHeliusWebhook(headers: Headers, expected: string | undefined): boolean {
 return isHeliusWebhookAuthorizationValid(headers.get('authorization'), expected)
}

export async function POST(request: NextRequest) {
 if (!process.env.HELIUS_WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'shark_launch_ingestion_unavailable' }, { status: 503 })
 }
 if (!authorizedHeliusWebhook(request.headers, process.env.HELIUS_WEBHOOK_SECRET)) {
  return NextResponse.json({ error: 'unauthorized_webhook' }, { status: 401 })
 }
 const receivedAt=new Date().toISOString()
 let payload:unknown
 try{payload=await request.json()}catch{return NextResponse.json({error:'invalid_json'},{status:400})}
 const events=Array.isArray(payload)?payload:[payload]
 if(events.length>500)return NextResponse.json({error:'webhook_batch_too_large'},{status:413})
 const client=createServiceRoleClient()
 if(!client)return NextResponse.json({error:'shark_launch_ingestion_unavailable'},{status:503})

 try{
  const receipt=await persistSniperHeliusBatch({
   events,receivedAt,intake:sniperIntake,clock:()=>performance.now(),
   persist:collection=>persistSharkLaunch(client,collection),
  })
  return NextResponse.json(receipt)
 }catch(error){
  console.error('SHARK fastpath launch persistence failed',error)
  return NextResponse.json({error:'shark_launch_ingestion_unavailable',reason:'persistence_failed'},{status:503})
 }
}
