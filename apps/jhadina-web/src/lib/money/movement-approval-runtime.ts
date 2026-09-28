import "server-only"
import { randomUUID } from "node:crypto"
import {
  createApprovalRequestService,
  type ApprovalReceipt,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import {
  fingerprintMoneyMovementApproval,
  moneyMovementApprovalRequest,
  type MoneyMovementKind,
  type MoneyMovementProposal,
} from "@jhadina/money-core"
import { createClient } from "../supabase/server"
import { createServiceRoleClient } from "../supabase/service-role"

type ProposalRow={
 movement_id:string;user_id:string;coffer_id:string;kind:MoneyMovementKind;amount_minor:string|number;currency:string;source_id:string;destination_id:string;
 idempotency_key:string;standing_mandate_id:string|null;created_at:string;approval_receipt_id:string|null;state:string
}
type ReceiptRow={
 id:string;action_id:string;user_id:string;type:string;fingerprint:string;status:ApprovalReceipt["status"];requested_at:string;approved_at:string|null;expires_at:string;consumed_at:string|null
}
const TYPE="money.movement.execute"

function admin(){const c=createServiceRoleClient();if(!c)throw new Error("MONEY_PRIVATE_STORE_NOT_CONFIGURED");return c}
async function verifiedUserId(){
 const client=await createClient();const {data,error}=await client.auth.getClaims();const id=data?.claims?.sub
 if(error||!id)throw new Error("MONEY_FUND2_SESSION_REQUIRED");return id
}
function toReceipt(x:ReceiptRow):ApprovalReceipt{return {id:x.id,actionId:x.action_id,userId:x.user_id,type:x.type,fingerprint:x.fingerprint,status:x.status,requestedAt:x.requested_at,approvedAt:x.approved_at??undefined,expiresAt:x.expires_at,consumedAt:x.consumed_at??undefined}}
function proposalFromRow(x:ProposalRow):MoneyMovementProposal{
 return Object.freeze({movementId:x.movement_id,kind:x.kind,userId:x.user_id,cofferId:x.coffer_id,amountMinor:BigInt(String(x.amount_minor)),currency:x.currency,sourceId:x.source_id,destinationId:x.destination_id,idempotencyKey:x.idempotency_key,requestedAt:x.created_at,standingMandateId:x.standing_mandate_id??undefined,state:"PENDING_APPROVAL" as const,authority:"PROPOSAL_ONLY" as const,canMoveMoney:false as const})
}

export function createMoneyMovementApprovalStore():ApprovalReceiptStore{
 return {
  async createPending(input){
   const db=admin(),id=randomUUID(),requestedAt=new Date().toISOString()
   const {data,error}=await db.from("money_movement_approval_receipts").insert({id,action_id:input.actionId,user_id:input.userId,type:input.type,fingerprint:input.fingerprint,status:"pending",requested_at:requestedAt,expires_at:input.expiresAt}).select("*").single()
   if(error||!data)throw new Error("MONEY_FUND2_APPROVAL_CREATE_FAILED:"+(error?.message??"no receipt"))
   return toReceipt(data as ReceiptRow)
  },
  async approve(receiptId,userId){
   const db=admin(),now=new Date().toISOString()
   const {data:prior,error:readError}=await db.from("money_movement_approval_receipts").select("*").eq("id",receiptId).eq("user_id",userId).maybeSingle()
   if(readError||!prior)throw new Error("MONEY_FUND2_APPROVAL_NOT_FOUND")
   if(prior.status!=="pending")throw new Error("MONEY_FUND2_APPROVAL_NOT_PENDING")
   if(Date.parse(prior.expires_at)<=Date.parse(now)){
    await db.from("money_movement_approval_receipts").update({status:"expired"}).eq("id",receiptId).eq("status","pending")
    throw new Error("MONEY_FUND2_APPROVAL_EXPIRED")
   }
   const {data,error}=await db.from("money_movement_approval_receipts").update({status:"approved",approved_at:now}).eq("id",receiptId).eq("user_id",userId).eq("status","pending").select("*").single()
   if(error||!data)throw new Error("MONEY_FUND2_APPROVAL_UPDATE_FAILED:"+(error?.message??"no receipt"))
   return toReceipt(data as ReceiptRow)
  },
  async consume(receiptId,expected){
   const db=admin(),now=new Date().toISOString()
   const {data:prior,error}=await db.from("money_movement_approval_receipts").select("*").eq("id",receiptId).eq("user_id",expected.userId).maybeSingle()
   if(error||!prior)return false
   if(prior.status!=="approved")return false
   if(Date.parse(prior.expires_at)<=Date.parse(now)){
    await db.from("money_movement_approval_receipts").update({status:"expired"}).eq("id",receiptId).eq("status","approved")
    return false
   }
   if(prior.action_id!==expected.actionId||prior.type!==expected.type||prior.fingerprint!==expected.fingerprint)return false
   const {data:update,error:updateError}=await db.from("money_movement_approval_receipts").update({status:"consumed",consumed_at:now}).eq("id",receiptId).eq("status","approved").select("id").maybeSingle()
   if(updateError||!update)return false
   return true
  },
 }
}

export async function createPendingMoneyMovementApproval(proposal:MoneyMovementProposal){
 const service=createApprovalRequestService(createMoneyMovementApprovalStore(),fingerprintMoneyMovementApproval)
 const receipt=await service.requestApproval(moneyMovementApprovalRequest(proposal))
 const db=admin()
 const {error}=await db.from("money_movement_proposals").update({approval_receipt_id:receipt.id,updated_at:new Date().toISOString()}).eq("movement_id",proposal.movementId).eq("user_id",proposal.userId)
 if(error)throw new Error("MONEY_FUND2_PROPOSAL_RECEIPT_BIND_FAILED:"+error.message)
 return receipt
}

async function ownedProposal(movementId:string,userId:string){
 const db=admin()
 const {data,error}=await db.from("money_movement_proposals").select("movement_id,user_id,coffer_id,kind,amount_minor,currency,source_id,destination_id,idempotency_key,standing_mandate_id,created_at,approval_receipt_id,state").eq("movement_id",movementId).eq("user_id",userId).maybeSingle()
 if(error||!data)throw new Error("MONEY_FUND2_PROPOSAL_NOT_FOUND")
 return data as ProposalRow
}

export async function approveSessionMoneyMovement(movementId:string){
 const userId=await verifiedUserId(),row=await ownedProposal(movementId,userId)
 if(row.state!=="PENDING_APPROVAL")throw new Error("MONEY_FUND2_PROPOSAL_NOT_PENDING")
 if(!row.approval_receipt_id)throw new Error("MONEY_FUND2_APPROVAL_RECEIPT_REQUIRED")
 const proposal=proposalFromRow(row),expected=fingerprintMoneyMovementApproval(moneyMovementApprovalRequest(proposal))
 const db=admin()
 const {data:receipt,error}=await db.from("money_movement_approval_receipts").select("*").eq("id",row.approval_receipt_id).eq("user_id",userId).maybeSingle()
 if(error||!receipt)throw new Error("MONEY_FUND2_APPROVAL_NOT_FOUND")
 if(receipt.fingerprint!==expected||receipt.action_id!==movementId||receipt.type!==TYPE)throw new Error("MONEY_FUND2_APPROVAL_BINDING_MISMATCH")
 const approved=await createMoneyMovementApprovalStore().approve(row.approval_receipt_id,userId)
 const {error:updateError}=await db.from("money_movement_proposals").update({state:"APPROVED",updated_at:new Date().toISOString()}).eq("movement_id",movementId).eq("user_id",userId).eq("state","PENDING_APPROVAL")
 if(updateError)throw new Error("MONEY_FUND2_PROPOSAL_APPROVE_FAILED:"+updateError.message)
 return {proposal:{movementId,state:"APPROVED" as const},receipt:approved,canMoveMoney:false as const,executionPermitRequired:true as const,liveRailRequired:true as const}
}

export async function rejectSessionMoneyMovement(movementId:string){
 const userId=await verifiedUserId(),row=await ownedProposal(movementId,userId)
 if(row.state!=="PENDING_APPROVAL"&&row.state!=="APPROVED")throw new Error("MONEY_FUND2_PROPOSAL_NOT_REJECTABLE")
 const db=admin()
 const {error}=await db.from("money_movement_proposals").update({state:"REJECTED",updated_at:new Date().toISOString()}).eq("movement_id",movementId).eq("user_id",userId).in("state",["PENDING_APPROVAL","APPROVED"])
 if(error)throw new Error("MONEY_FUND2_PROPOSAL_REJECT_FAILED:"+error.message)
 return {movementId,state:"REJECTED" as const,canMoveMoney:false as const}
}
