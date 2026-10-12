import type {SupabaseClient} from "@supabase/supabase-js";
import type {
  AtomicWeeklyChildBatchStore,
  StagedWeeklyChildBatch,
  StagedWeeklyChildPlan,
  WeeklyChildBatchTransactionInput,
} from "./durable-weekly-child-plans";

function record(value:unknown):value is Record<string,unknown> {
  return value!==null && typeof value==="object" && !Array.isArray(value);
}
function nonempty(value:unknown):value is string {
  return typeof value==="string" && !!value.trim();
}

/** Never allow a malformed stored JSONB payload to become a plan or permit. */
export function decodePersistedWeeklyChildBatch(value:unknown):StagedWeeklyChildBatch {
  if(!record(value) ||
    value.schema!=="jhadina.social.weekly-child-batch.v1" ||
    value.state!=="PERSISTED_REVIEW_ONLY" ||
    value.canPublish!==false || value.canComment!==false ||
    value.canSpend!==false || value.canExecute!==false ||
    !nonempty(value.ownerUserId) || !nonempty(value.packetId) ||
    !nonempty(value.approvalReceiptId) ||
    !nonempty(value.packetFingerprint) || !nonempty(value.compositeFingerprint) ||
    !nonempty(value.validUntil) || !Number.isFinite(Date.parse(value.validUntil)) ||
    !Array.isArray(value.children) || value.children.length===0)
    throw new Error("SOCIAL_WEEKLY_CHILD_PERSISTED_SCHEMA_INVALID");
  const seen=new Set<string>();
  const children:StagedWeeklyChildPlan[]=value.children.map(item=>{
    if(!record(item) ||
      !nonempty(item.actionId) || seen.has(item.actionId) ||
      !nonempty(item.campaignId) || !nonempty(item.brand) ||
      !nonempty(item.actionFingerprint) ||
      item.weeklyReviewFingerprint!==value.compositeFingerprint ||
      !["organic_publication","public_comment","paid_campaign","director_production"].includes(String(item.actionKind)) ||
      item.state!=="AWAITING_INDEPENDENT_ACTION_PERMIT" ||
      item.requiresIndependentActionPermit!==true || item.canExecute!==false)
      throw new Error("SOCIAL_WEEKLY_CHILD_PERSISTED_SCHEMA_INVALID");
    seen.add(item.actionId);
    return Object.freeze({...item}) as unknown as StagedWeeklyChildPlan;
  });
  return Object.freeze({...value,children:Object.freeze(children)}) as unknown as StagedWeeklyChildBatch;
}

/**
 * This client adapter is INERT until a reviewed, independently tested
 * single-transaction RPC exists and the operator opts in. Never implement
 * the RPC by chaining existing consume + insert HTTP calls: that loses plans
 * on interruption after receipt consumption.
 *
 * The RPC must re-read authoritative packet and identity revisions inside
 * its SQL transaction, atomically consume the real approved receipt, stage
 * all child rows and return a replay-safe committed snapshot.
 */
export function createSupabaseWeeklyChildBatchStore(input:{
  client:SupabaseClient;
  verifiedOwnerUserId:string;
  /** Require explicit operator commissioning following SQL/RLS/restore proof. */
  commissioned:boolean;
}):AtomicWeeklyChildBatchStore {
  function guard(owner:string){
    if(!input.commissioned)
      throw new Error("SOCIAL_WEEKLY_CHILD_DB_NOT_COMMISSIONED");
    if(!nonempty(input.verifiedOwnerUserId) || owner!==input.verifiedOwnerUserId)
      throw new Error("SOCIAL_WEEKLY_CHILD_DB_OWNER_DENIED");
  }
  return {
    async commitApprovedBatch(data:WeeklyChildBatchTransactionInput){
      guard(data.ownerUserId);
      const expected=decodePersistedWeeklyChildBatch(data.batch);
      if(expected.ownerUserId!==data.ownerUserId ||
        expected.packetId!==data.packetId ||
        expected.approvalReceiptId!==data.approvalReceiptId ||
        expected.compositeFingerprint!==data.expectedFingerprint ||
        data.expectedReceiptType!=="social.weekly.review")
        throw new Error("SOCIAL_WEEKLY_CHILD_DB_INPUT_SCOPE_INVALID");
      const {data:result,error}=await input.client.rpc(
        "jhadina_social_weekly_stage_children_atomic_v1",{
          p_owner_user_id:data.ownerUserId,
          p_packet_id:data.packetId,
          p_approval_receipt_id:data.approvalReceiptId,
          p_expected_receipt_action_id:data.expectedReceiptActionId,
          p_expected_receipt_type:data.expectedReceiptType,
          p_expected_fingerprint:data.expectedFingerprint,
          p_batch:expected,
        });
      if(error || !result)throw new Error("SOCIAL_WEEKLY_CHILD_DB_COMMIT_UNAVAILABLE");
      return decodePersistedWeeklyChildBatch(result);
    },
    async readBatch(owner,packetId,receiptId){
      guard(owner);
      if(!nonempty(packetId) || !nonempty(receiptId))
        throw new Error("SOCIAL_WEEKLY_CHILD_DB_READ_SCOPE_REQUIRED");
      const {data,error}=await input.client
        .from("jhadina_social_weekly_child_batches_v1")
        .select("user_id,packet_id,approval_receipt_id,batch")
        .eq("user_id",owner)
        .eq("packet_id",packetId)
        .eq("approval_receipt_id",receiptId)
        .maybeSingle();
      if(error)throw new Error("SOCIAL_WEEKLY_CHILD_DB_READ_UNAVAILABLE");
      if(!data)return null;
      if(data.user_id!==owner || data.packet_id!==packetId ||
        data.approval_receipt_id!==receiptId)
        throw new Error("SOCIAL_WEEKLY_CHILD_DB_ROW_SCOPE_MISMATCH");
      const batch=decodePersistedWeeklyChildBatch(data.batch);
      if(batch.ownerUserId!==owner || batch.packetId!==packetId ||
        batch.approvalReceiptId!==receiptId)
        throw new Error("SOCIAL_WEEKLY_CHILD_DB_PAYLOAD_SCOPE_MISMATCH");
      return batch;
    },
  };
}
