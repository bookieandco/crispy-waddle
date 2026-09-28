import { NextRequest,NextResponse } from "next/server"
import { rejectSessionMoneyMovement } from "@/lib/money/movement-approval-runtime"

export const dynamic="force-dynamic"

export async function POST(_req:NextRequest,{params}:{params:Promise<{movementId:string}>}){
 try{
  const {movementId}=await params
  return NextResponse.json({success:true,data:await rejectSessionMoneyMovement(movementId)})
 }catch(error){
  const message=error instanceof Error?error.message:"Money movement rejection failed"
  const status=message.includes("SESSION")?401:message.includes("NOT_FOUND")?404:message.includes("NOT_REJECTABLE")?409:500
  return NextResponse.json({success:false,error:message},{status})
 }
}
