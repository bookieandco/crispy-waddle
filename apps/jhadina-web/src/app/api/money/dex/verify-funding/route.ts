import { NextResponse } from "next/server"
import { verifyDexCanaryFunding } from "@/lib/money/dex-funding-verification"

export const dynamic="force-dynamic"

export async function POST(){
 try{
  const data=await verifyDexCanaryFunding()
  return NextResponse.json({success:true,data},{headers:{"Cache-Control":"no-store"}})
 }catch(error){
  const message=error instanceof Error?error.message:"DEX funding verification failed"
  const status=message.includes("SESSION")?401:message.includes("REQUIRED")||message.includes("INVALID")||message.includes("HTTPS")?400:500
  return NextResponse.json({success:false,error:message},{status,headers:{"Cache-Control":"no-store"}})
 }
}
