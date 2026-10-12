import {describe,it,expect,vi} from "vitest";
import {
 createSupabaseWeeklyChildBatchStore,decodePersistedWeeklyChildBatch,
} from "./supabase-weekly-child-batch-store";
const batch={
 schema:"jhadina.social.weekly-child-batch.v1",ownerUserId:"owner",packetId:"packet",
 approvalReceiptId:"receipt",packetFingerprint:"packet-fp",
 compositeFingerprint:"weekly-fp",validUntil:"2026-12-12T00:00:00Z",
 state:"PERSISTED_REVIEW_ONLY",
 canPublish:false,canComment:false,canSpend:false,canExecute:false,
 children:[{
  actionId:"a1",actionKind:"organic_publication",campaignId:"campaign",
  brand:"pupsonstuff",actionFingerprint:"action-fp",
  weeklyReviewFingerprint:"weekly-fp",
  requiresIndependentActionPermit:true,canExecute:false,
  state:"AWAITING_INDEPENDENT_ACTION_PERMIT",
 }],
};
function fakeClient(payload:unknown=batch){
 const rpc=vi.fn(async()=>({data:payload,error:null}));
 const maybeSingle=vi.fn(async()=>({data:{
  user_id:"owner",packet_id:"packet",approval_receipt_id:"receipt",batch:payload,
 },error:null}));
 const q={select:vi.fn(()=>q),eq:vi.fn(()=>q),maybeSingle};
 const from=vi.fn(()=>q);
 return {client:{rpc,from} as any,rpc,from,maybeSingle};
}
describe("SOCIAL-ID.21 Supabase adapter is commissioning-gated",()=>{
 it("never makes database calls when uncommissioned or owner differs",async()=>{
  const mock=fakeClient();
  const store=createSupabaseWeeklyChildBatchStore({
   client:mock.client,verifiedOwnerUserId:"owner",commissioned:false,
  });
  await expect(store.readBatch("owner","packet","receipt"))
   .rejects.toThrow("SOCIAL_WEEKLY_CHILD_DB_NOT_COMMISSIONED");
  expect(mock.from).not.toHaveBeenCalled();
  const enabled=createSupabaseWeeklyChildBatchStore({
   client:mock.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(enabled.readBatch("foreign","packet","receipt"))
   .rejects.toThrow("SOCIAL_WEEKLY_CHILD_DB_OWNER_DENIED");
  expect(mock.from).not.toHaveBeenCalled();
 });
 it("decodes owner-scoped read and submits ONE atomic RPC for complete child batch",async()=>{
  const mock=fakeClient();
  const store=createSupabaseWeeklyChildBatchStore({
   client:mock.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  const result=await store.commitApprovedBatch({
   ownerUserId:"owner",packetId:"packet",approvalReceiptId:"receipt",
   expectedReceiptActionId:"social-weekly:packet:sha256",
   expectedReceiptType:"social.weekly.review",expectedFingerprint:"weekly-fp",
   batch:batch as any,
  });
  expect(result.children).toHaveLength(1);
  expect(result.canExecute).toBe(false);
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  expect(mock.rpc).toHaveBeenCalledWith(
   "jhadina_social_weekly_stage_children_atomic_v1",
   expect.objectContaining({p_expected_fingerprint:"weekly-fp"}),
  );
  expect((await store.readBatch("owner","packet","receipt"))?.packetFingerprint)
   .toBe("packet-fp");
 });
 it("rejects schema tampering and fabricated external authority",()=>{
  expect(()=>decodePersistedWeeklyChildBatch({...batch,canExecute:true}))
   .toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_SCHEMA_INVALID");
  expect(()=>decodePersistedWeeklyChildBatch({...batch,children:[
   {...batch.children[0],weeklyReviewFingerprint:"stale"},
  ]})).toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_SCHEMA_INVALID");
  expect(()=>decodePersistedWeeklyChildBatch({...batch,children:[
   batch.children[0],batch.children[0],
  ]})).toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_SCHEMA_INVALID");
 });
 it("fails closed on DB unavailable or corrupt response",async()=>{
  const mock=fakeClient({canExecute:true});
  const store=createSupabaseWeeklyChildBatchStore({
   client:mock.client,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(store.readBatch("owner","packet","receipt"))
   .rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_SCHEMA_INVALID");
  const store2=createSupabaseWeeklyChildBatchStore({
   client:{rpc:async()=>({data:null,error:{code:"57P03"}})} as any,
   verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(store2.commitApprovedBatch({
   ownerUserId:"owner",packetId:"packet",approvalReceiptId:"receipt",
   expectedReceiptActionId:"a",expectedReceiptType:"social.weekly.review",
   expectedFingerprint:"weekly-fp",batch:batch as any,
  })).rejects.toThrow("SOCIAL_WEEKLY_CHILD_DB_COMMIT_UNAVAILABLE");
 });
});
