import { NextResponse } from "next/server"
import { readSessionMoneyWorkspace } from "@/lib/money/workspace-read-runtime"

export const dynamic="force-dynamic"

export async function GET(){
 try{
  const data=await readSessionMoneyWorkspace()
  return NextResponse.json({success:true,data})
 }catch(error){
  const message=error instanceof Error?error.message:"Money workspace read failed"
  const status=message.includes("SESSION")?401:500
  return NextResponse.json({success:false,error:message},{status})
 }
}
