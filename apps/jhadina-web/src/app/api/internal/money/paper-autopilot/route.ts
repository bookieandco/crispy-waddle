import { NextRequest, NextResponse } from "next/server"
import { authorizedSchedulerRequest } from "@/lib/internal-scheduler-auth"
import { runMoneyPaperAutopilotCycle } from "@/lib/money/paper-autopilot-worker"

export const runtime="nodejs"
export const dynamic="force-dynamic"

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false,error:"unauthorized"},{status:401})
  try{
    const receipt=await runMoneyPaperAutopilotCycle()
    return NextResponse.json({ok:true,receipt})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:503})
  }
}
export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
