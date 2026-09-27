import { randomUUID } from "node:crypto"
import { NextRequest,NextResponse } from "next/server"
import { assertMoneyMovementProposal,type FundingDestination,type MoneyMovementKind,type MoneyMovementProposal } from "@jhadina/money-core"
import { runSessionGovernedMoneyAccountRead } from "@/lib/money/governed-account-read-runtime"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { appendMoneyFeedEvent } from "@/lib/money/feed-runtime"

export const dynamic="force-dynamic"

function admin(){
 const client=createServiceRoleClient()
 if(!client)throw new Error("MONEY_PRIVATE_STORE_NOT_CONFIGURED")
 return client
}
function parseAmountMinor(value:unknown){
 const s=String(value??"").trim()
 if(!/^\d+$/.test(s))throw new Error("MONEY_MOVEMENT_AMOUNT_MINOR_INVALID")
 const n=BigInt(s)
 if(n<=0n)throw new Error("MONEY_MOVEMENT_AMOUNT_MINOR_INVALID")
 return n
}
function kind(value:unknown):MoneyMovementKind{
 if(value==="DEPOSIT"||value==="WITHDRAWAL"||value==="TRANSFER")return value
 throw new Error("MONEY_MOVEMENT_KIND_INVALID")
}

async function context(requestId:string){
 const {accounts,verifiedUserId}=await runSessionGovernedMoneyAccountRead(requestId)
 const db=admin()
 const {data:coffer,error}=await db.from("money_coffers").select("coffer_id,currency").eq("user_id",verifiedUserId).order("updated_at",{ascending:false}).limit(1).maybeSingle()
 if(error)throw new Error("MONEY_COFFER_LOOKUP_FAILED:"+error.message)
 if(!coffer)throw new Error("MONEY_COFFER_NOT_COMMISSIONED")
 const endpoints=new Map<string,FundingDestination>()
 endpoints.set("coffer:"+coffer.coffer_id,Object.freeze({destinationId:"coffer:"+coffer.coffer_id,ownerUserId:verifiedUserId,provider:"money-core",accountId:coffer.coffer_id,currency:coffer.currency,verified:true,kind:"BROKER_CASH",evidenceIds:Object.freeze(["coffer:"+coffer.coffer_id])}))
 for(const account of accounts){
  if(!account.externalId||!account.currency||account.currency==="UNKNOWN")continue
  const id="bank:"+account.externalId
  endpoints.set(id,Object.freeze({destinationId:id,ownerUserId:verifiedUserId,provider:account.provider,accountId:account.externalId,currency:account.currency,verified:true,kind:"BANK",evidenceIds:Object.freeze(["governed-account:"+account.id])}))
 }
 return{db,verifiedUserId,coffer,endpoints}
}

export async function GET(req:NextRequest){
 try{
  const requestId=req.headers.get("x-jhadina-request-id")||randomUUID()
  const {db,verifiedUserId}=await context(requestId)
  const {data,error}=await db.from("money_movement_proposals").select("movement_id,coffer_id,kind,amount_minor,currency,source_id,destination_id,state,created_at,updated_at").eq("user_id",verifiedUserId).order("created_at",{ascending:false}).limit(50)
  if(error)throw new Error("MONEY_MOVEMENT_PROPOSAL_READ_FAILED:"+error.message)
  return NextResponse.json({success:true,data:{proposals:data??[]}})
 }catch(error){
  const message=error instanceof Error?error.message:"Money movement proposal read failed"
  const status=message.includes("SESSION")?401:message.includes("NOT_COMMISSIONED")?409:500
  return NextResponse.json({success:false,error:message},{status})
 }
}

export async function POST(req:NextRequest){
 try{
  const requestId=req.headers.get("x-jhadina-request-id")||randomUUID()
  const {db,verifiedUserId,coffer,endpoints}=await context(requestId)
  const body=await req.json() as Record<string,unknown>
  const movementKind=kind(body.kind)
  const amountMinor=parseAmountMinor(body.amountMinor)
  const currency=String(body.currency??"").trim().toUpperCase()
  const sourceId=String(body.sourceId??"").trim()
  const destinationId=String(body.destinationId??"").trim()
  const source=endpoints.get(sourceId),destination=endpoints.get(destinationId)
  if(!source||!destination)throw new Error("MONEY_MOVEMENT_ENDPOINT_NOT_OWNED")
  if(sourceId===destinationId)throw new Error("MONEY_MOVEMENT_ENDPOINTS_MUST_DIFFER")
  const cofferId="coffer:"+coffer.coffer_id
  if(movementKind==="DEPOSIT"&&destinationId!==cofferId)throw new Error("MONEY_DEPOSIT_DESTINATION_MUST_BE_COFFER")
  if(movementKind==="WITHDRAWAL"&&sourceId!==cofferId)throw new Error("MONEY_WITHDRAWAL_SOURCE_MUST_BE_COFFER")
  const movementId=randomUUID(),idempotencyKey="movement-proposal:"+movementId,requestedAt=new Date().toISOString()
  const proposal:MoneyMovementProposal=Object.freeze({movementId,kind:movementKind,userId:verifiedUserId,cofferId:coffer.coffer_id,amountMinor,currency,sourceId,destinationId,idempotencyKey,requestedAt,state:"PENDING_APPROVAL",authority:"PROPOSAL_ONLY",canMoveMoney:false})
  assertMoneyMovementProposal(proposal,{verifiedSource:source,verifiedDestination:destination})
  const {error}=await db.from("money_movement_proposals").insert({movement_id:movementId,user_id:verifiedUserId,coffer_id:coffer.coffer_id,kind:movementKind,amount_minor:amountMinor.toString(),currency,source_id:sourceId,destination_id:destinationId,idempotency_key:idempotencyKey,state:"PENDING_APPROVAL",evidence_ids:[...source.evidenceIds,...destination.evidenceIds],created_at:requestedAt,updated_at:requestedAt})
  if(error)throw new Error("MONEY_MOVEMENT_PROPOSAL_STORE_FAILED:"+error.message)
  let feedPublished=false
  try{
   const label=movementKind==="DEPOSIT"?"Add-funds":movementKind==="WITHDRAWAL"?"Cash-out":"Transfer"
   await appendMoneyFeedEvent(Object.freeze({
    eventId:"money-funding-proposal:"+movementId,userId:verifiedUserId,type:"FUNDING_PROPOSAL" as const,lane:"MONEY" as const,commitment:"ACCOUNTING" as const,
    title:label+" proposal prepared",body:label+" request is waiting on approval. No money has moved yet.",subjectId:movementId,route:"/money/funding",
    materiality:movementKind==="WITHDRAWAL"?65:55,occurredAt:requestedAt,evidenceIds:Object.freeze(["movement-proposal:"+movementId]),authority:"FEED_EVIDENCE_ONLY" as const,canExecute:false as const,
   }))
   feedPublished=true
  }catch{}
  return NextResponse.json({success:true,data:{proposal:{...proposal,amountMinor:proposal.amountMinor.toString()},feedPublished}},{status:201})
 }catch(error){
  const message=error instanceof Error?error.message:"Money movement proposal failed"
  const status=message.includes("SESSION")?401:message.includes("NOT_COMMISSIONED")?409:message.includes("INVALID")||message.includes("MUST_")||message.includes("NOT_OWNED")?400:500
  return NextResponse.json({success:false,error:message},{status})
 }
}
