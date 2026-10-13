import {createHash} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {weeklyReviewReceiptActionId} from "./governed-weekly-review";
import {fingerprintWeeklyChildAuthorization} from "./weekly-child-action-gate";
import {decodePersistedWeeklyChildBatch} from "./supabase-weekly-child-batch-store";
import type {StagedWeeklyChildBatch} from "./durable-weekly-child-plans";
import type {TrustedWeeklyApprovalSummary} from "./social-operations-dashboard";
import type {
  TrustedWeeklyOperationsSelectionReader,
  TrustedWeeklyOperationsApprovalReader,
} from "./verified-social-operations-read";

type ReceiptExpectation={actionId:string;type:string;fingerprint:string};
function nonblank(value:unknown):value is string{
  return typeof value==="string" && !!value.trim();
}
function receiptExpectations(batch:StagedWeeklyChildBatch):Map<string,ReceiptExpectation>{
  const result=new Map<string,ReceiptExpectation>();
  const parent=weeklyReviewReceiptActionId(batch.packetId,batch.compositeFingerprint);
  result.set(parent,{
    actionId:parent,type:"social.weekly.review",fingerprint:batch.compositeFingerprint,
  });
  const capabilities={
    organic_publication:"public.publish",
    public_comment:"consequential.outreach",
    paid_campaign:"paid-ad.publish",
    director_production:"take.generate",
  } as const;
  for(const child of batch.children){
    const action={
      schema:"jhadina.social.weekly-child-authorization.v1" as const,
      packetId:batch.packetId,
      parentApprovalReceiptId:batch.approvalReceiptId,
      childActionId:child.actionId,
      childActionKind:child.actionKind,
      childFingerprint:child.actionFingerprint,
      reviewedWeeklyFingerprint:batch.compositeFingerprint,
    };
    const fingerprint=fingerprintWeeklyChildAuthorization(action);
    const actionId="weekly-child:"+batch.packetId+":"+child.actionId+":"+
      createHash("sha256").update(fingerprint,"utf8").digest("hex");
    if(result.has(actionId))throw new Error("SOCIAL_OPS_RECEIPT_DUPLICATE_ACTION");
    result.set(actionId,{actionId,type:capabilities[child.actionKind],fingerprint});
  }
  return result;
}
/**
 * Staged adapter. Canonical weekly batch and approval receipt readback must
 * pass actual RLS, schema rehearsal and backup/restore checks BEFORE true.
 * Setting a UI environment flag alone never commissions these readers.
 */
export function createSupabaseWeeklyOperationsReaders(input:{
  client:SupabaseClient;
  verifiedOwnerUserId:string;
  commissioned:boolean;
}):{
  readonly selection:TrustedWeeklyOperationsSelectionReader;
  readonly approvals:TrustedWeeklyOperationsApprovalReader;
}{
  function guard(ownerUserId:string){
    if(!input.commissioned)
      throw new Error("SOCIAL_OPS_READ_DB_NOT_COMMISSIONED");
    if(!nonblank(input.verifiedOwnerUserId) ||
       ownerUserId!==input.verifiedOwnerUserId)
      throw new Error("SOCIAL_OPS_READ_DB_OWNER_DENIED");
  }
  return {
    selection:{
      async loadLatest(ownerUserId){
        guard(ownerUserId);
        const {data,error}=await input.client
          .from("jhadina_social_weekly_child_batches_v1")
          .select("user_id,packet_id,approval_receipt_id,batch,created_at")
          .eq("user_id",ownerUserId)
          .order("created_at",{ascending:false})
          .limit(1)
          .maybeSingle();
        if(error)throw new Error("SOCIAL_OPS_READ_DB_PACKET_UNAVAILABLE");
        if(!data)return null;
        if(data.user_id!==ownerUserId ||
           !nonblank(data.packet_id) || !nonblank(data.approval_receipt_id))
          throw new Error("SOCIAL_OPS_READ_DB_PACKET_SCOPE_INVALID");
        const batch=decodePersistedWeeklyChildBatch(data.batch);
        if(batch.ownerUserId!==ownerUserId ||
           batch.packetId!==data.packet_id ||
           batch.approvalReceiptId!==data.approval_receipt_id)
          throw new Error("SOCIAL_OPS_READ_DB_BATCH_SCOPE_INVALID");
        return Object.freeze({
          ownerUserId,packetId:batch.packetId,
          parentApprovalReceiptId:batch.approvalReceiptId,
        });
      },
    },
    approvals:{
      async listExactReceipts(ownerUserId,batch){
        guard(ownerUserId);
        if(batch.ownerUserId!==ownerUserId ||
           batch.state!=="PERSISTED_REVIEW_ONLY" ||
           batch.canExecute!==false)
          throw new Error("SOCIAL_OPS_RECEIPT_BATCH_SCOPE_DENIED");
        const expected=receiptExpectations(batch);
        const {data,error}=await input.client
          .from("jhadina_social_approval_receipts")
          .select("id,user_id,action_id,type,fingerprint,status,expires_at")
          .eq("user_id",ownerUserId)
          .in("action_id",[...expected.keys()]);
        if(error || !Array.isArray(data))
          throw new Error("SOCIAL_OPS_RECEIPT_DB_UNAVAILABLE");
        const found=new Set<string>();
        const summaries:TrustedWeeklyApprovalSummary[]=[];
        let parentSeen=false;
        const expectedParent=weeklyReviewReceiptActionId(
          batch.packetId,batch.compositeFingerprint);
        for(const row of data){
          const expectedRow=expected.get(row.action_id);
          if(!expectedRow || row.user_id!==ownerUserId ||
             !nonblank(row.id) || found.has(row.id) ||
             found.has(row.action_id) ||
             row.type!==expectedRow.type ||
             row.fingerprint!==expectedRow.fingerprint ||
             !["pending","approved","consumed","expired"].includes(row.status) ||
             !Number.isFinite(Date.parse(row.expires_at)))
            throw new Error("SOCIAL_OPS_RECEIPT_DB_SCOPE_OR_PROOF_INVALID");
          found.add(row.id);found.add(row.action_id);
          if(row.action_id===expectedParent){
            if(row.id!==batch.approvalReceiptId ||
               row.status!=="consumed")
              throw new Error("SOCIAL_OPS_RECEIPT_PARENT_NOT_CONSUMED");
            parentSeen=true;
          }
          const status:TrustedWeeklyApprovalSummary["status"]=
            Date.parse(row.expires_at)<=Date.now() &&
            (row.status==="pending"||row.status==="approved")
              ? "expired" : row.status;
          summaries.push(Object.freeze({
            ownerUserId,packetId:batch.packetId,
            receiptId:row.id,status,
            expiresAt:row.expires_at,
          }));
        }
        if(!parentSeen)throw new Error("SOCIAL_OPS_RECEIPT_PARENT_MISSING");
        return Object.freeze(summaries);
      },
    },
  };
}
