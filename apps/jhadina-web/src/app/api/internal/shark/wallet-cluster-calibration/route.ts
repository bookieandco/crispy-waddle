import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  appendWalletClusterCalibrationObservation,
  evaluatePersistedWalletClusterCalibration,
} from '@/lib/shark/research-evidence-repository'
import type { WalletClusterCalibrationObservation } from '@jhadina/shark-intelligence-core/meme-trader'

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

export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'shark_persistence_unavailable'},{status:503})
  const informationCutoff=request.nextUrl.searchParams.get('cutoff')??new Date().toISOString()
  try{
    const report=await evaluatePersistedWalletClusterCalibration(client,{
      informationCutoff,
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
    const body=await request.json() as {observation?:WalletClusterCalibrationObservation;source?:string}
    if(!body.observation||typeof body.source!=='string')return NextResponse.json({ok:false,error:'invalid_payload'},{status:400})
    const disposition=await appendWalletClusterCalibrationObservation(client,{observation:body.observation,source:body.source})
    return NextResponse.json({ok:true,disposition})
  }catch(error){
    console.error('SHARK wallet-cluster calibration append failed',error)
    return NextResponse.json({ok:false,error:'shark_cluster_calibration_append_failed',reason:error instanceof Error?error.message:'unknown'},{status:400})
  }
}
