import type {SupabaseClient} from "@supabase/supabase-js";
import {
  type AtomicWeeklyChildOutboxStore,
  type WeeklyChildOutboxRecord,
  type WeeklyChildOutboxTransaction,
} from "./weekly-child-action-gate";

function object(value:unknown):value is Record<string,unknown> {
  return !!value && typeof value==="object" && !Array.isArray(value);
}
function nonblank(value:unknown):value is string {
  return typeof value==="string" && !!value.trim();
}
/** A readback is always non-executable even if a DB payload is forged. */
export function decodeWeeklyChildOutboxRow(value:unknown):WeeklyChildOutboxRecord {
  if(!object(value) ||
     value.schema!=="jhadina.social.weekly-child-outbox.v1" ||
     value.state!=="AWAITING_DISPATCH_CERTIFICATION" ||
     value.canDispatch!==false || value.canExecute!==false ||
     value.requiresFreshActionSecurityPermit!==true ||
     !nonblank(value.ownerUserId) || !nonblank(value.packetId) ||
     !nonblank(value.childActionId) || !nonblank(value.parentApprovalReceiptId) ||
     !nonblank(value.approvalReceiptId) || !nonblank(value.actionId) ||
     !nonblank(value.fingerprint) || !nonblank(value.childFingerprint) ||
     !nonblank(value.reviewedWeeklyFingerprint) ||
     !["organic_publication","public_comment","paid_campaign","director_production"]
       .includes(String(value.actionKind)))
    throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_SCHEMA_INVALID");
  const caps:Record<string,string>={
    organic_publication:"public.publish",
    public_comment:"consequential.outreach",
    paid_campaign:"paid-ad.publish",
    director_production:"take.generate",
  };
  if(value.capability!==caps[String(value.actionKind)])
    throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_CAPABILITY_MISMATCH");
  return Object.freeze({...value}) as unknown as WeeklyChildOutboxRecord;
}
/**
 * NO production RPC or table has been commissioned yet. This is a strict
 * client-side contract for the *future* atomic DB function.
 *
 * The SQL function MUST lock/re-read canonical packet, identities, parent
 * batch, and independently approved child receipt; enforce Security gate and
 * owner/capability/fingerprint scope; consume receipt+persist one
 * NON-DISPATCHABLE child row in one transaction; replay exact same row.
 * It cannot be implemented by calling consume() and insert() separately.
 */
export function createSupabaseWeeklyChildOutboxStore(input:{
  client:SupabaseClient;
  verifiedOwnerUserId:string;
  commissioned:boolean;
}):AtomicWeeklyChildOutboxStore {
  function guard(owner:string) {
    if(!input.commissioned)
      throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_NOT_COMMISSIONED");
    if(!nonblank(input.verifiedOwnerUserId) ||
       input.verifiedOwnerUserId!==owner)
      throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_OWNER_DENIED");
  }
  return {
    async consumeApprovalAndStageChild(transaction:WeeklyChildOutboxTransaction) {
      const row=decodeWeeklyChildOutboxRow(transaction.proposed);
      guard(transaction.expectedOwnerUserId);
      if(row.ownerUserId!==transaction.expectedOwnerUserId ||
        row.actionId!==transaction.expectedReceiptActionId ||
        row.capability!==transaction.expectedReceiptType ||
        row.fingerprint!==transaction.expectedReceiptFingerprint ||
        row.parentApprovalReceiptId!==transaction.expectedParentReceiptId ||
        row.reviewedWeeklyFingerprint!==transaction.expectedPacketFingerprint ||
        row.childFingerprint!==transaction.expectedChildFingerprint)
        throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_INPUT_MISMATCH");
      const {data,error}=await input.client.rpc(
        "jhadina_social_weekly_stage_child_outbox_atomic_v1",{
          p_owner_user_id:transaction.expectedOwnerUserId,
          p_packet_id:row.packetId,
          p_child_action_id:row.childActionId,
          p_child_receipt_id:row.approvalReceiptId,
          p_expected_receipt_action_id:transaction.expectedReceiptActionId,
          p_capability:transaction.expectedReceiptType,
          p_expected_fingerprint:transaction.expectedReceiptFingerprint,
          p_parent_receipt_id:transaction.expectedParentReceiptId,
          p_packet_fingerprint:transaction.expectedPacketFingerprint,
          p_child_fingerprint:transaction.expectedChildFingerprint,
          p_proposal:row,
        });
      if(error || !data)
        throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_UNAVAILABLE");
      return decodeWeeklyChildOutboxRow(data);
    },
    async readStagedChild(args) {
      guard(args.ownerUserId);
      if(!nonblank(args.packetId) || !nonblank(args.childActionId) ||
         !nonblank(args.approvalReceiptId))
        throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_SCOPE_REQUIRED");
      const {data,error}=await input.client
        .from("jhadina_social_weekly_child_outbox_v1")
        .select("user_id,packet_id,child_action_id,approval_receipt_id,record")
        .eq("user_id",args.ownerUserId)
        .eq("packet_id",args.packetId)
        .eq("child_action_id",args.childActionId)
        .eq("approval_receipt_id",args.approvalReceiptId)
        .maybeSingle();
      if(error)throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_READ_UNAVAILABLE");
      if(!data)return null;
      if(data.user_id!==args.ownerUserId ||
        data.packet_id!==args.packetId ||
        data.child_action_id!==args.childActionId ||
        data.approval_receipt_id!==args.approvalReceiptId)
        throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_ROW_SCOPE_INVALID");
      const row=decodeWeeklyChildOutboxRow(data.record);
      if(row.ownerUserId!==args.ownerUserId ||
        row.packetId!==args.packetId ||
        row.childActionId!==args.childActionId ||
        row.approvalReceiptId!==args.approvalReceiptId)
        throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_PAYLOAD_SCOPE_INVALID");
      return row;
    },
  };
}
