import { NextRequest,NextResponse } from "next/server"
import { approveSessionMoneyMovement } from "@/lib/money/movement-approval-runtime"
import { appendMoneyFeedEvent } from "@/lib/money/feed-runtime"
import { createClient } from "@/lib/supabase/server"

export const dynamic="force-dynamic"

async function sessionUser(){const c=await createClient();const {data,error}=await c.auth.getClaims();const id=data?.claims?.sub;if(error||!id)throw new Error("MONEY_FUND2_SESSION_REQUIRED");return id}

export async function POST(_req:NextRequest,{params}:{params:{movementId:string}}){
 try{
  const {movementId}=params
  const data=await approveSessionMoneyMovement(movementId)
  try{
   const userId=await sessionUser(),now=new Date().toISOString()
   await appendMoneyFeedEvent(Object.freeze({eventId:"money-funding-approved:"+movementId,userId,type:"FUNDING_PROPOSAL" as const,lane:"MONEY" as const,commitment:"ACCOUNTING" as const,title:"Money movement approved",body:"Owner approval is recorded. No money has moved; a bound Money execution permit and commissioned live funding rail are still required.",subjectId:movementId,route:"/money/funding",materiality:70,occurredAt:now,evidenceIds:Object.freeze(["movement-approval:"+data.receipt.id]),authority:"FEED_EVIDENCE_ONLY" as const,canExecute:false as const}))
  }catch{}
  return NextResponse.json({success:true,data})
 }catch(error){
  const message=error instanceof Error?error.message:"Money movement approval failed"
  const status=message.includes("SESSION")?401:message.includes("NOT_FOUND")?404:message.includes("NOT_PENDING")||message.includes("EXPIRED")||message.includes("BINDING")?409:500
  return NextResponse.json({success:false,error:message},{status})
 }
}
