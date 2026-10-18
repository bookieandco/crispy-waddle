import {NextRequest,NextResponse} from 'next/server'
import {collectHeliusLaunch,isHeliusWebhookAuthorizationValid,type HeliusLaunchWebhookEvent,type SolanaLaunchCollection} from '@jhadina/shark-intelligence-core/meme-trader'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {persistSharkLaunch} from '@/lib/shark/launch-repository'

export const runtime='nodejs'

export function authorizedHeliusWebhook(headers:Headers,expected:string|undefined):boolean {
  return isHeliusWebhookAuthorizationValid(headers.get('authorization'),expected)
}

export async function POST(request:NextRequest){
  if(!process.env.HELIUS_WEBHOOK_SECRET)
    return NextResponse.json({error:'shark_launch_ingestion_unavailable'},{status:503})
  if(!authorizedHeliusWebhook(request.headers,process.env.HELIUS_WEBHOOK_SECRET))
    return NextResponse.json({error:'unauthorized_webhook'},{status:401})
  const receivedAt=new Date().toISOString()
  let payload:unknown
  try{payload=await request.json()}
  catch{return NextResponse.json({error:'invalid_json'},{status:400})}
  const events=Array.isArray(payload)?payload:[payload]
  if(events.length>500)return NextResponse.json({error:'webhook_batch_too_large'},{status:413})

  // Validate the ENTIRE batch before any privileged persistence. A generic token transfer
  // or Explore listing is never accepted as a launch. Bad proofs remain fail closed.
  const collections:SolanaLaunchCollection[]=[]
  try{
    for(const item of events){
      if(!item||typeof item!=='object'||Array.isArray(item))continue
      const candidate=await collectHeliusLaunch(item as HeliusLaunchWebhookEvent,{},receivedAt)
      if(candidate)collections.push(candidate)
    }
  }catch{
    return NextResponse.json({error:'invalid_launch_proof'},{status:422})
  }
  if(!collections.length)
    return NextResponse.json({received:events.length,accepted:0,ignored:events.length,persisted:0,launches:[]})

  const client=createServiceRoleClient()
  if(!client)
    return NextResponse.json({error:'shark_launch_ingestion_unavailable'},{status:503})
  try{
    const persisted=[]
    for(const collection of collections)persisted.push(await persistSharkLaunch(client,collection))
    return NextResponse.json({
      received:events.length,accepted:collections.length,
      ignored:events.length-collections.length,persisted:persisted.length,
      launches:collections.map(result=>({
        launchId:result.ingested.launch.launchId,
        tokenAddress:result.ingested.launch.tokenAddress,
        observationId:result.observation.observationId,
        duplicate:result.ingested.duplicate,
        signature:result.signature,slot:result.slot,
        attestation:result.provenance.providerAttestation,
        authority:result.provenance.authority,
      })),
    })
  }catch{
    return NextResponse.json({error:'shark_launch_ingestion_unavailable',reason:'persistence_failed'},{status:503})
  }
}
