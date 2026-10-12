import {describe,it,expect,vi} from "vitest";
import {createSupabaseWeeklyChildOutboxStore,decodeWeeklyChildOutboxRow}
 from "./supabase-weekly-child-outbox-store";
const row={
 schema:"jhadina.social.weekly-child-outbox.v1",
 ownerUserId:"owner",packetId:"packet",childActionId:"child",
 actionKind:"organic_publication",capability:"public.publish",
 actionId:"child:action",fingerprint:"child-fp",approvalReceiptId:"receipt",
 parentApprovalReceiptId:"parent",reviewedWeeklyFingerprint:"weekly-fp",
 childFingerprint:"action-fp",state:"AWAITING_DISPATCH_CERTIFICATION",
 requiresFreshActionSecurityPermit:true,canDispatch:false,canExecute:false,
};
function client(){
  const rpc=vi.fn(async()=>({data:row,error:null}));
  const maybeSingle=vi.fn(async()=>({data:{
    user_id:"owner",packet_id:"packet",child_action_id:"child",
    approval_receipt_id:"receipt",record:row,
  },error:null}));
  const q={select:vi.fn(()=>q),eq:vi.fn(()=>q),maybeSingle};
  const from=vi.fn(()=>q);
  return {rpc,from,q,mock:{rpc,from} as any};
}
const transaction={
 proposed:row as any,expectedOwnerUserId:"owner",
 expectedReceiptActionId:"child:action",expectedReceiptType:"public.publish" as const,
 expectedReceiptFingerprint:"child-fp",expectedParentReceiptId:"parent",
 expectedPacketFingerprint:"weekly-fp",expectedChildFingerprint:"action-fp",
};
describe("SOCIAL-ID.22 proposed outbox adapter remains disabled until commissioning",()=>{
 it("refuses uncommissioned and foreign access before touching the database",async()=>{
  const c=client(),store=createSupabaseWeeklyChildOutboxStore({
   client:c.mock,verifiedOwnerUserId:"owner",commissioned:false,
  });
  await expect(store.consumeApprovalAndStageChild(transaction))
    .rejects.toThrow("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_NOT_COMMISSIONED");
  await expect(store.readStagedChild({
   ownerUserId:"owner",packetId:"packet",childActionId:"child",approvalReceiptId:"receipt",
  })).rejects.toThrow("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_NOT_COMMISSIONED");
  expect(c.rpc).not.toHaveBeenCalled();
  expect(c.from).not.toHaveBeenCalled();
  const enabled=createSupabaseWeeklyChildOutboxStore({
   client:c.mock,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(enabled.consumeApprovalAndStageChild({
   ...transaction,expectedOwnerUserId:"foreign",
  })).rejects.toThrow("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_OWNER_DENIED");
  expect(c.rpc).not.toHaveBeenCalled();
 });
 it("uses a single atomic RPC and decodes only inert payloads",async()=>{
  const c=client(),store=createSupabaseWeeklyChildOutboxStore({
   client:c.mock,verifiedOwnerUserId:"owner",commissioned:true,
  });
  expect((await store.consumeApprovalAndStageChild(transaction)).canDispatch).toBe(false);
  expect(c.rpc).toHaveBeenCalledTimes(1);
  expect(c.rpc).toHaveBeenCalledWith(
   "jhadina_social_weekly_stage_child_outbox_atomic_v1",
   expect.objectContaining({p_owner_user_id:"owner",p_capability:"public.publish"}),
  );
  const recovered=await store.readStagedChild({
   ownerUserId:"owner",packetId:"packet",childActionId:"child",approvalReceiptId:"receipt",
  });
  expect(recovered?.canExecute).toBe(false);
 });
 it("rejects forged execution authority, capability swaps, and mixed receipt scope",async()=>{
  expect(()=>decodeWeeklyChildOutboxRow({...row,canDispatch:true}))
    .toThrow("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_SCHEMA_INVALID");
  expect(()=>decodeWeeklyChildOutboxRow({...row,capability:"paid-ad.publish"}))
    .toThrow("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_CAPABILITY_MISMATCH");
  const c=client(),store=createSupabaseWeeklyChildOutboxStore({
   client:c.mock,verifiedOwnerUserId:"owner",commissioned:true,
  });
  await expect(store.consumeApprovalAndStageChild({
   ...transaction,expectedReceiptFingerprint:"different",
  })).rejects.toThrow("SOCIAL_WEEKLY_CHILD_OUTBOX_DB_INPUT_MISMATCH");
  expect(c.rpc).not.toHaveBeenCalled();
 });
});
