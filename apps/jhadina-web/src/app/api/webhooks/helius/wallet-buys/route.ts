import { NextRequest, NextResponse } from 'next/server'
import {
  collectTrackedWalletBuysFromHelius,
  isHeliusWebhookAuthorizationValid,
  type HeliusLaunchWebhookEvent,
  type WalletQuoteAsset,
} from '@jhadina/shark-intelligence-core/meme-trader'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { appendWalletBuyEvidence } from '@/lib/shark/research-evidence-repository'

export const runtime='nodejs'

function authorized(headers:Headers):boolean{
  return isHeliusWebhookAuthorizationValid(headers.get('authorization'),process.env.HELIUS_WEBHOOK_SECRET)
}

function quoteAssets():WalletQuoteAsset[]|null{
  const raw=process.env.SHARK_WALLET_BUY_QUOTE_ASSETS_JSON
  if(!raw)return null
  try{
    const parsed=JSON.parse(raw)
    if(!Array.isArray(parsed)||!parsed.length||parsed.length>32)return null
    const assets=parsed.flatMap((row:any)=>{
      if(!row||typeof row.mint!=='string'||!row.mint.trim())return []
      const usdValuePerUnit=row.usdValuePerUnit===undefined?undefined:Number(row.usdValuePerUnit)
      if(usdValuePerUnit!==undefined&&(!Number.isFinite(usdValuePerUnit)||usdValuePerUnit<=0))return []
      return [{mint:row.mint.trim(),...(usdValuePerUnit===undefined?{}:{usdValuePerUnit})}]
    })
    return assets.length===parsed.length?assets:null
  }catch{return null}
}

function candidateWalletIds(events:readonly HeliusLaunchWebhookEvent[]):string[]{
  const ids=new Set<string>()
  for(const event of events){
    for(const transfer of event.tokenTransfers??[]){
      if(typeof transfer.fromUserAccount==='string'&&transfer.fromUserAccount.trim())ids.add(transfer.fromUserAccount.trim())
      if(typeof transfer.toUserAccount==='string'&&transfer.toUserAccount.trim())ids.add(transfer.toUserAccount.trim())
    }
  }
  return [...ids]
}

export async function POST(request:NextRequest){
  if(!process.env.HELIUS_WEBHOOK_SECRET)return NextResponse.json({error:'shark_wallet_buy_ingestion_unavailable'},{status:503})
  if(!authorized(request.headers))return NextResponse.json({error:'unauthorized_webhook'},{status:401})
  const quotes=quoteAssets()
  if(!quotes)return NextResponse.json({error:'shark_wallet_buy_quote_assets_unconfigured'},{status:503})

  let payload:unknown
  try{payload=await request.json()}catch{return NextResponse.json({error:'invalid_json'},{status:400})}
  const rows=(Array.isArray(payload)?payload:[payload]).filter((row):row is HeliusLaunchWebhookEvent=>typeof row==='object'&&row!==null)
  if(rows.length>500)return NextResponse.json({error:'webhook_batch_too_large'},{status:413})
  const candidates=candidateWalletIds(rows)
  if(candidates.length>5000)return NextResponse.json({error:'webhook_wallet_set_too_large'},{status:413})

  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({error:'shark_wallet_buy_ingestion_unavailable'},{status:503})
  if(!candidates.length)return NextResponse.json({received:rows.length,trackedWallets:0,buys:0,persisted:0})

  const {data:scoreRows,error:scoreError}=await client
    .from('jhadina_shark_wallet_score_evidence')
    .select('wallet_id')
    .eq('chain_id','solana-mainnet')
    .in('wallet_id',candidates)
  if(scoreError){
    console.error('SHARK tracked-wallet lookup failed',scoreError)
    return NextResponse.json({error:'shark_wallet_buy_ingestion_unavailable',reason:'tracked_wallet_lookup_failed'},{status:503})
  }
  const trackedWalletIds=[...new Set((scoreRows??[]).map((row:any)=>String(row.wallet_id)))]
  if(!trackedWalletIds.length)return NextResponse.json({received:rows.length,trackedWallets:0,buys:0,persisted:0})

  const availableAt=new Date().toISOString()
  try{
    const buys=rows.flatMap(event=>collectTrackedWalletBuysFromHelius({
      event,
      chainId:'solana-mainnet',
      trackedWalletIds,
      quoteAssets:quotes,
      availableAt,
      source:'helius-wallet-buy-webhook',
    }))
    let persisted=0,replayed=0
    for(const buy of buys){
      const disposition=await appendWalletBuyEvidence(client,{buy})
      if(disposition==='INSERTED')persisted+=1
      else replayed+=1
    }
    return NextResponse.json({
      received:rows.length,
      trackedWallets:trackedWalletIds.length,
      buys:buys.length,
      persisted,
      replayed,
    })
  }catch(error){
    console.error('SHARK wallet-buy persistence failed',error)
    return NextResponse.json({error:'shark_wallet_buy_ingestion_unavailable',reason:'persistence_failed'},{status:503})
  }
}
