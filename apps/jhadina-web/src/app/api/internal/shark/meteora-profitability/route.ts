import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  appendMeteoraCashFlowEvidence,
  appendMeteoraPositionStateEvidence,
  evaluatePersistedMeteoraProfitability,
} from '@/lib/shark/research-evidence-repository'
import {
  applyVerifiedMeteoraCashFlowValuation,
  deriveMeteoraNativeCashFlowEvidence,
  type MeteoraCashFlowValuationEvidence,
  type MeteoraDlmmPositionStateEvidence,
  type MeteoraTransactionCashFlowInput,
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
function transactionFromJson(value:any):MeteoraTransactionCashFlowInput{
  if(!value||!Array.isArray(value.assets))throw new Error('invalid_transaction_cash_flow')
  return {
    transactionId:String(value.transactionId??''),
    position:String(value.position??''),
    kind:value.kind,
    assets:value.assets.map((asset:any)=>({currency:String(asset.currency??''),amountMinor:BigInt(String(asset.amountMinor))})),
    observedAt:String(value.observedAt??''),
    availableAt:String(value.availableAt??''),
    evidenceIds:Array.isArray(value.evidenceIds)?value.evidenceIds.map(String):[],
  }
}
function valuationFromJson(value:any):MeteoraCashFlowValuationEvidence{
  return {
    valuationId:String(value?.valuationId??''),
    sourceCurrency:String(value?.sourceCurrency??''),
    targetCurrency:String(value?.targetCurrency??''),
    sourceAmountMinor:BigInt(String(value?.sourceAmountMinor)),
    valuedAmountMinor:BigInt(String(value?.valuedAmountMinor)),
    informationCutoff:String(value?.informationCutoff??''),
    observedAt:String(value?.observedAt??''),
    availableAt:String(value?.availableAt??''),
    evidenceIds:Array.isArray(value?.evidenceIds)?value.evidenceIds.map(String):[],
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
      recordType?:'transaction-cash-flow'|'position-state'
      source?:string
      transaction?:unknown
      valuations?:unknown[]
      state?:MeteoraDlmmPositionStateEvidence
    }
    if(typeof body.source!=='string')return NextResponse.json({ok:false,error:'invalid_payload'},{status:400})
    if(body.recordType==='transaction-cash-flow'&&body.transaction){
      const transaction=transactionFromJson(body.transaction)
      const nativeFlows=deriveMeteoraNativeCashFlowEvidence(transaction)
      let inserted=0,replayed=0
      for(const flow of nativeFlows){
        const disposition=await appendMeteoraCashFlowEvidence(client,{flow,source:body.source})
        if(disposition==='INSERTED')inserted+=1
        else replayed+=1
      }

      const valuations=(body.valuations??[]).map(valuationFromJson)
      const seenValuations=new Set<string>()
      for(const valuation of valuations){
        const key=`${valuation.sourceCurrency}->${valuation.targetCurrency}`
        if(seenValuations.has(key))throw new Error('duplicate_flow_valuation_in_request')
        seenValuations.add(key)
        const native=nativeFlows.find(flow=>flow.currency===valuation.sourceCurrency&&flow.amountMinor===valuation.sourceAmountMinor)
        if(!native)throw new Error('valuation_source_flow_not_found')
        const valued=applyVerifiedMeteoraCashFlowValuation(native,valuation)
        const disposition=await appendMeteoraCashFlowEvidence(client,{flow:valued,source:body.source})
        if(disposition==='INSERTED')inserted+=1
        else replayed+=1
      }
      return NextResponse.json({ok:true,nativeFlows:nativeFlows.length,valuedFlows:valuations.length,inserted,replayed})
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
