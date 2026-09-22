import { NextRequest, NextResponse } from 'next/server'
import { runSharkProviderSoak } from '@jhadina/shark-intelligence-core/meme-trader'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function authorized(request:NextRequest):boolean{
  const secret=process.env.CRON_SECRET
  return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`)
}

async function run(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const receipt=await runSharkProviderSoak({
    solanaRpcUrl:process.env.SOLANA_RPC_URL,
    heliusRpcUrl:process.env.HELIUS_RPC_URL,
    heliusApiKey:process.env.HELIUS_API_KEY,
    coinGeckoApiKey:process.env.COINGECKO_API_KEY,
    publicOrigin:process.env.SHARK_PUBLIC_ORIGIN ?? request.nextUrl.origin,
  })
  return NextResponse.json({ok:receipt.passed,receipt},{status:receipt.passed?200:503})
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
