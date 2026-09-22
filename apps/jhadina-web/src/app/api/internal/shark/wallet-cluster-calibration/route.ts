import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  appendWalletBuyEvidence,
  appendWalletResearchScoreEvidence,
  evaluatePersistedWalletClusterCalibration,
  runPersistedWalletClusterCalibrationProducer,
} from '@/lib/shark/research-evidence-repository'
import type {
  WalletBuyEvidence,
  WalletResearchScoreEvidence,
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
function scoreModelParam(request:NextRequest):string|null{
  const value=request.nextUrl.searchParams.get('scoreModelId')
  return value?.trim()?value.trim():null
}

export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const scoreModelId=scoreModelParam(request)
  if(!scoreModelId)return NextResponse.json({ok:false,error:'score_model_required'},{status:400})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})
  const informationCutoff=request.nextUrl.searchParams.get('cutoff')??new Date().toISOString()
  try{
    const report=await evaluatePersistedWalletClusterCalibration(client,{
      informationCutoff,
      scoreModelId,
      limit:limitParam(request),
    })
    return NextResponse.json({ok:true,report})
  }catch(error){
    console.error('SHARK wallet-cluster calibration evaluation failed',error)
    return NextResponse.json({ok:false,error:'shark_cluster_calibration_failed',reason:error instanceof Error?error.message:'unknown'},{status:400})
  }
}

export async function POST(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})
  try{
    const body=await request.json() as {
      recordType?:'wallet-score'|'wallet-buy'
      source?:string
      score?:WalletResearchScoreEvidence
      buy?:WalletBuyEvidence
    }
    if(typeof body.source!=='string')return NextResponse.json({ok:false,error:'invalid_payload'},{status:400})
    if(body.recordType==='wallet-score'&&body.score){
      const disposition=await appendWalletResearchScoreEvidence(client,{score:body.score,source:body.source})
      return NextResponse.json({ok:true,disposition})
    }
    if(body.recordType==='wallet-buy'&&body.buy){
      const disposition=await appendWalletBuyEvidence(client,{buy:body.buy,source:body.source})
      return NextResponse.json({ok:true,disposition})
    }
    return NextResponse.json({ok:false,error:'invalid_payload'},{status:400})
  }catch(error){
    console.error('SHARK wallet-cluster raw evidence append failed',error)
    return NextResponse.json({ok:false,error:'shark_cluster_raw_evidence_append_failed',reason:error instanceof Error?error.message:'unknown'},{status:400})
  }
}

export async function PUT(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const scoreModelId=scoreModelParam(request)
  if(!scoreModelId)return NextResponse.json({ok:false,error:'score_model_required'},{status:400})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})
  try{
    const result=await runPersistedWalletClusterCalibrationProducer(client,{
      scoreModelId,
      limit:limitParam(request),
    })
    return NextResponse.json({ok:true,result})
  }catch(error){
    console.error('SHARK wallet-cluster calibration producer failed',error)
    return NextResponse.json({ok:false,error:'shark_cluster_calibration_producer_failed',reason:error instanceof Error?error.message:'unknown'},{status:400})
  }
}
