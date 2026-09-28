import { NextResponse } from "next/server"
import { readSessionFundingReadiness } from "@/lib/money/funding-readiness-runtime"

export const dynamic="force-dynamic"

export async function GET(){
 try{return NextResponse.json({success:true,data:await readSessionFundingReadiness()})}
 catch(error){
  const message=error instanceof Error?error.message:"Funding readiness unavailable"
  return NextResponse.json({success:false,error:message},{status:message.includes("SESSION")?401:500})
 }
}
