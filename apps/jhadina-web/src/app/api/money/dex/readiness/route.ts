import { NextResponse } from "next/server"
import { readDexRuntimeReadiness } from "@/lib/money/dex-runtime-readiness"

export const dynamic="force-dynamic"

export async function GET(){
 try{
  const data=await readDexRuntimeReadiness()
  return NextResponse.json({success:true,data},{
   headers:{"Cache-Control":"no-store","Pragma":"no-cache"},
  })
 }catch(error){
  const message=error instanceof Error?error.message:"DEX readiness failed"
  const status=message.includes("SESSION")?401:500
  return NextResponse.json({success:false,error:message},{status,headers:{"Cache-Control":"no-store"}})
 }
}
