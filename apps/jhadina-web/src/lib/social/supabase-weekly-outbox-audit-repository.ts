import type {SupabaseClient} from "@supabase/supabase-js";
import type {WeeklyChildOutboxRecord} from "./weekly-child-action-gate";
import type {
  WeeklyOutboxAuditRepository,WeeklyOutboxAuditEntry,
  WeeklyOutboxAttemptObservation,WeeklyOutboxAttemptState,
} from "./weekly-outbox-reconciliation";

/**
 * Read-only, commissioning-gated adapter for FUTURE verified RLS tables.
 * This never writes, retries, dispatches or makes external provider calls.
 *
 * Neither audit relation is certified to exist in SWLC. Use commissioned=false
 * until actual RLS and independent restore proof. No runtime route wires it on.
 */
export function createSupabaseWeeklyOutboxAuditRepository(input:{
  client:SupabaseClient;
  verifiedOwnerUserId:string;
  commissioned:boolean;
}):WeeklyOutboxAuditRepository {
  return {
    async listEntries(ownerUserId,packetId,parentApprovalReceiptId){
      if(!input.commissioned)
        throw new Error("SOCIAL_OUTBOX_AUDIT_DB_NOT_COMMISSIONED");
      if(!ownerUserId.trim() || ownerUserId!==input.verifiedOwnerUserId)
        throw new Error("SOCIAL_OUTBOX_AUDIT_DB_OWNER_DENIED");
      if(!packetId.trim() || !parentApprovalReceiptId.trim())
        throw new Error("SOCIAL_OUTBOX_AUDIT_DB_KEYS_REQUIRED");
      // Queries are scoped to authenticated owner and exact packet before
      // examining any rows. RLS must independently enforce the same.
      const [rows,attempts]=await Promise.all([
        input.client.from("jhadina_social_weekly_child_outbox_v1")
          .select("user_id,packet_id,parent_approval_receipt_id,child_action_id,record")
          .eq("user_id",ownerUserId)
          .eq("packet_id",packetId)
          .eq("parent_approval_receipt_id",parentApprovalReceiptId),
        input.client.from("jhadina_social_weekly_child_attempt_audit_v1")
          .select("user_id,packet_id,parent_approval_receipt_id,child_action_id,attempt_id,state,observed_at,provider_claim_ref")
          .eq("user_id",ownerUserId)
          .eq("packet_id",packetId)
          .eq("parent_approval_receipt_id",parentApprovalReceiptId),
      ]);
      if(rows.error || attempts.error || !Array.isArray(rows.data) ||
         !Array.isArray(attempts.data))
        throw new Error("SOCIAL_OUTBOX_AUDIT_DB_READ_UNAVAILABLE");
      const entries:WeeklyOutboxAuditEntry[]=[];
      const byId=new Map<string,WeeklyOutboxAttemptObservation[]>();
      for(const row of attempts.data){
        if(row.user_id!==ownerUserId || row.packet_id!==packetId ||
          row.parent_approval_receipt_id!==parentApprovalReceiptId)
          throw new Error("SOCIAL_OUTBOX_AUDIT_DB_ATTEMPT_SCOPE_DENIED");
        if(typeof row.child_action_id!=="string" ||
          typeof row.attempt_id!=="string" ||
          typeof row.state!=="string" ||
          typeof row.observed_at!=="string")
          throw new Error("SOCIAL_OUTBOX_AUDIT_DB_ATTEMPT_INVALID");
        const found:WeeklyOutboxAttemptObservation={
          ownerUserId,packetId,childActionId:row.child_action_id,
          attemptId:row.attempt_id,
          state:row.state as WeeklyOutboxAttemptState,
          observedAt:row.observed_at,
          ...(typeof row.provider_claim_ref==="string"
            ? {providerClaimRef:row.provider_claim_ref}:{}),
        };
        const list=byId.get(row.child_action_id)??[];
        list.push(found);
        byId.set(row.child_action_id,list);
      }
      const seen=new Set<string>();
      for(const row of rows.data){
        if(row.user_id!==ownerUserId || row.packet_id!==packetId ||
          row.parent_approval_receipt_id!==parentApprovalReceiptId)
          throw new Error("SOCIAL_OUTBOX_AUDIT_DB_ROW_SCOPE_DENIED");
        if(typeof row.child_action_id!=="string" ||
          !row.record || typeof row.record!=="object")
          throw new Error("SOCIAL_OUTBOX_AUDIT_DB_ROW_INVALID");
        const id=row.child_action_id as string;
        if(seen.has(id))throw new Error("SOCIAL_OUTBOX_AUDIT_DB_DUPLICATE_CHILD");
        seen.add(id);
        entries.push({
          ownerUserId,packetId,parentApprovalReceiptId,childActionId:id,
          record:row.record as WeeklyChildOutboxRecord,
          attempts:Object.freeze(byId.get(id)??[]),
        });
        byId.delete(id);
      }
      // Attempts with no staged row must remain visible as suspicious.
      for(const [childActionId,history] of byId)
        entries.push({
          ownerUserId,packetId,parentApprovalReceiptId,
          childActionId,record:null,attempts:Object.freeze(history),
        });
      return entries;
    },
  };
}
