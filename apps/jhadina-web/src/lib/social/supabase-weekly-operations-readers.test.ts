import {describe,it,expect,vi} from "vitest";
import {weeklyReviewReceiptActionId} from "./governed-weekly-review";
import {createSupabaseWeeklyOperationsReaders}
 from "./supabase-weekly-operations-readers";
import type {StagedWeeklyChildBatch} from "./durable-weekly-child-plans";
const future="2099-10-12T23:00:00Z";
const batch:StagedWeeklyChildBatch={
 schema:"jhadina.social.weekly-child-batch.v1",
 ownerUserId:"owner",packetId:"packet",approvalReceiptId:"parent-approval",
 packetFingerprint:"packet-fp",compositeFingerprint:"composite-fp",
 validUntil:future,state:"PERSISTED_REVIEW_ONLY",
 canPublish:false,canComment:false,canSpend:false,canExecute:false,
 children:[{actionId:"child",actionKind:"organic_publication",
  campaignId:"campaign",brand:"pupsonstuff",actionFingerprint:"child-fp",
  weeklyReviewFingerprint:"composite-fp",
  requiresIndependentActionPermit:true,canExecute:false,
  state:"AWAITING_INDEPENDENT_ACTION_PERMIT"}],
};
function mockDB(approvalRows:unknown[]=[],batchPayload:unknown=batch){
 const from=vi.fn((name:string)=>{
  const source=name==="jhadina_social_weekly_child_batches_v1"
   ? {data:{user_id:"owner",packet_id:"packet",
       approval_receipt_id:"parent-approval",batch:batchPayload,
       created_at:"2026-10-12T10:00:00Z"},error:null}
   : {data:approvalRows,error:null};
  const query={
   select:vi.fn(()=>query),eq:vi.fn(()=>query),order:vi.fn(()=>query),
   limit:vi.fn(()=>query),in:vi.fn(()=>query),
   maybeSingle:vi.fn(async()=>source),
   then:(resolve:(value:typeof source)=>unknown)=>Promise.resolve(source).then(resolve),
  };
  return query;
 });
 return {from,client:{from} as never};
}
const parent=()=>({
 id:"parent-approval",user_id:"owner",
 action_id:weeklyReviewReceiptActionId("packet","composite-fp"),
 type:"social.weekly.review",fingerprint:"composite-fp",status:"consumed",
 expires_at:future,
});
describe("SOCIAL-ID.25 exact canonical packet+approval readback",()=>{
 it("never queries DB before source commissioning or with foreign owner",async()=>{
  const db=mockDB([parent()]);
  const off=createSupabaseWeeklyOperationsReaders({
    client:db.client,verifiedOwnerUserId:"owner",commissioned:false,
  });
  await expect(off.selection.loadLatest("owner"))
    .rejects.toThrow("SOCIAL_OPS_READ_DB_NOT_COMMISSIONED");
  await expect(off.approvals.listExactReceipts("owner",batch))
    .rejects.toThrow("SOCIAL_OPS_READ_DB_NOT_COMMISSIONED");
  const on=createSupabaseWeeklyOperationsReaders({
    client:db.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(on.selection.loadLatest("foreign"))
    .rejects.toThrow("SOCIAL_OPS_READ_DB_OWNER_DENIED");
  expect(db.from).not.toHaveBeenCalled();
 });
 it("selects the newest owner-scoped persisted batch and exact parent receipt",async()=>{
  const db=mockDB([parent()]);
  const reader=createSupabaseWeeklyOperationsReaders({
    client:db.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  expect(await reader.selection.loadLatest("owner")).toEqual({
    ownerUserId:"owner",packetId:"packet",
    parentApprovalReceiptId:"parent-approval",
  });
  const receipts=await reader.approvals.listExactReceipts("owner",batch);
  expect(receipts).toHaveLength(1);
  expect(receipts[0]?.status).toBe("consumed");
  expect(db.from).toHaveBeenCalledWith("jhadina_social_approval_receipts");
 });
 it("rejects forged child authority, foreign row, altered fingerprint and missing consumed parent",async()=>{
  const wrong={...parent(),fingerprint:"evil"};
  const db=mockDB([wrong]);
  const reader=createSupabaseWeeklyOperationsReaders({
    client:db.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(reader.approvals.listExactReceipts("owner",batch))
    .rejects.toThrow("SOCIAL_OPS_RECEIPT_DB_SCOPE_OR_PROOF_INVALID");
  const absent=mockDB([]);
  const other=createSupabaseWeeklyOperationsReaders({
    client:absent.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(other.approvals.listExactReceipts("owner",batch))
    .rejects.toThrow("SOCIAL_OPS_RECEIPT_PARENT_MISSING");
  const modified=mockDB([parent()],{...batch,canExecute:true});
  const third=createSupabaseWeeklyOperationsReaders({
    client:modified.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(third.selection.loadLatest("owner"))
    .rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_SCHEMA_INVALID");
 });
 it("refuses a parent marked approved but not consumed",async()=>{
  const db=mockDB([{...parent(),status:"approved"}]);
  const r=createSupabaseWeeklyOperationsReaders({
    client:db.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(r.approvals.listExactReceipts("owner",batch))
    .rejects.toThrow("SOCIAL_OPS_RECEIPT_PARENT_NOT_CONSUMED");
 });
});
