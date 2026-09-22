import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  appendMeteoraCashFlowEvidence,
  appendMeteoraPositionStateEvidence,
  evaluatePersistedMeteoraProfitability,
} from '@/lib/shark/research-evidence-repository'
import type {
  MeteoraDlmmCashFlowEvidence,
  MeteoraDlmmPositionStateEvidence,
} from '@jhadina/shark-intelligence-core/meme-trader'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function authorized(request:NextRequest):boolean{
  const secret=process.env.CRON_SECRET
  return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`)
}
function limitParam(request:NextRequest):number|undefined{
  const raw=request.nextUrl.searchParams.get('limit')
  if(raw===null)return undefined
  const n=Number(raw)
  return Number.isInteger(n)?n:Number.NaN
}
function serialize(result:Awaited<ReturnType<typeof evaluatePersistedMeteoraProfitability>>){
  return {
    ...result,
    depositsMinor:result.depositsMinor.toString(),
    withdrawalsMinor:result.withdrawalsMinor.toString(),
    feesMinor:result.feesMinor.toString(),
    netCashFlowMinor:result.netCashFlowMinor.toString(),
    realizedPnlMinor:result.realizedPnlMinor===null?null:result.realizedPnlMinor.toString(),
  }
}

export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const position=request.nextUrl.searchParams.get('position')
  const currency=request.nextUrl.searchParams.get('currency')
  if(!position||!currency)return NextResponse.json({ok:false,error:'position_and_currency_required'},{status:400})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})
  try{
    const result=await evaluatePersistedMeteoraProfitability(client,{
      position,
      currency,
      informationCutoff:request.nextUrl.searchParams.get('cutoff')??new Date().toISOString(),
      limit:limitParam(request),
    })
    return NextResponse.json({ok:true,result:serialize(result)})
  }catch(error){
    console.error('SHARK Meteora profitability evaluation failed',error)
    return NextResponse.json({ok:false,error:'shark_meteora_profitability_failed',reason:error instanceof Error?error.message:'unknown'},{status:400})
  }
}

export async function POST(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})
  try{
    const body=await request.json() as {
      recordType?:'cash-flow'|'position-state'
      source?:string
      flow?:Omit<MeteoraDlmmCashFlowEvidence,'amountMinor'>&{amountMinor:string|number}
      state?:MeteoraDlmmPositionStateEvidence
    }
    if(typeof body.source!=='string')return NextResponse.json({ok:false,error:'invalid_payload'},{status:400})
    if(body.recordType==='cash-flow'&&body.flow){
      const flow:MeteoraDlmmCashFlowEvidence={...body.flow,amountMinor:BigInt(String(body.flow.amountMinor))}
      const disposition=await appendMeteoraCashFlowEvidence(client,{flow,source:body.source})
      return NextResponse.json({ok:true,disposition})
    }
    if(body.recordType==='position-state'&&body.state){
      const disposition=await appendMeteoraPositionStateEvidence(client,{state:body.state,source:body.source})
      return NextResponse.json({ok:true,disposition})
    }
    return NextResponse.json({ok:false,error:'invalid_payload'},{status:400})
  }catch(error){
    console.error('SHARK Meteora research evidence append failed',error)
    return NextResponse.json({ok:false,error:'shark_meteora_evidence_append_failed',reason:error instanceof Error?error.message:'unknown'},{status:400})
  }
}
