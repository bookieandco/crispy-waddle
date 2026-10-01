import { NextRequest, NextResponse } from "next/server"
import { runSessionGovernedMoneyPaperSetup } from "@/lib/money/paper-setup-runtime"

export const runtime="nodejs"
export const dynamic="force-dynamic"

export async function POST(request:NextRequest){
  try{
    const body=await request.json()
    const result=await runSessionGovernedMoneyPaperSetup({
      accountId:String(body.accountId??""),
      mode:body.mode,
      symbols:Array.isArray(body.symbols)?body.symbols.map(String):undefined,
      stockFeed:body.stockFeed,
      baseOrderNotionalMinor:body.baseOrderNotionalMinor===undefined?undefined:String(body.baseOrderNotionalMinor),
      maxOrderNotionalMinor:body.maxOrderNotionalMinor===undefined?undefined:String(body.maxOrderNotionalMinor),
      maximumConcurrentPositions:body.maximumConcurrentPositions===undefined?undefined:Number(body.maximumConcurrentPositions),
      riskFractionBps:body.riskFractionBps===undefined?undefined:Number(body.riskFractionBps),
      stopLossBps:body.stopLossBps===undefined?undefined:Number(body.stopLossBps),
      takeProfitBps:body.takeProfitBps===undefined?undefined:Number(body.takeProfitBps),
    })
    return NextResponse.json({success:true,data:result})
  }catch(error){
    const message=error instanceof Error?error.message:"Paper setup failed"
    const status=/identity|session|auth/i.test(message)?401:/invalid|required|unsupported/i.test(message)?400:500
    return NextResponse.json({success:false,error:message},{status})
  }
}
