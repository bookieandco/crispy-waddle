import {describe,it,expect,vi} from "vitest";
import {createSupabaseWeeklyOutboxAuditRepository}
 from "./supabase-weekly-outbox-audit-repository";

function fakeClient(outbox:unknown[]=[],history:unknown[]=[]) {
 const requests:string[]=[];
 const from=vi.fn((table:string)=>{
  requests.push(table);
  const chain={
   select:vi.fn(()=>chain),eq:vi.fn(()=>chain),
   then:(resolve:(result:{data:unknown[];error:null})=>void)=>Promise.resolve(
     {data:table.includes("attempt_audit")?history:outbox,error:null}
   ).then(resolve),
  };
  return chain;
 });
 return {from,requests};
}
const args={ownerUserId:"owner-a",packetId:"packet-a",parentApprovalReceiptId:"parent-a"};
describe("SOCIAL-ID.23 RLS read-only audit adapter",()=>{
 it("never touches disabled or foreign owner tables",async()=>{
  const db=fakeClient();
  const off=createSupabaseWeeklyOutboxAuditRepository({
   client:{from:db.from} as never,verifiedOwnerUserId:"owner-a",commissioned:false,
  });
  await expect(off.listEntries(args.ownerUserId,args.packetId,args.parentApprovalReceiptId))
   .rejects.toThrow("SOCIAL_OUTBOX_AUDIT_DB_NOT_COMMISSIONED");
  const on=createSupabaseWeeklyOutboxAuditRepository({
   client:{from:db.from} as never,verifiedOwnerUserId:"owner-a",commissioned:true,
  });
  await expect(on.listEntries("other",args.packetId,args.parentApprovalReceiptId))
   .rejects.toThrow("SOCIAL_OUTBOX_AUDIT_DB_OWNER_DENIED");
  expect(db.from).not.toHaveBeenCalled();
 });
 it("reads only owner-scoped outbox + attempt rows and preserves orphan attempts",async()=>{
  const history=[{
    user_id:"owner-a",packet_id:"packet-a",parent_approval_receipt_id:"parent-a",
    child_action_id:"orphan",attempt_id:"a1",state:"AMBIGUOUS",
    observed_at:"2026-10-12T11:00:00Z",provider_claim_ref:"unverified",
  }];
  const db=fakeClient([],history);
  const on=createSupabaseWeeklyOutboxAuditRepository({
   client:{from:db.from} as never,verifiedOwnerUserId:"owner-a",commissioned:true,
  });
  const read=await on.listEntries(args.ownerUserId,args.packetId,args.parentApprovalReceiptId);
  expect(read).toHaveLength(1);
  expect(read[0]?.record).toBeNull();
  expect(read[0]?.attempts[0]?.state).toBe("AMBIGUOUS");
  expect(db.requests).toEqual([
    "jhadina_social_weekly_child_outbox_v1",
    "jhadina_social_weekly_child_attempt_audit_v1",
  ]);
 });
 it("refuses RLS-filter-escaping foreign rows",async()=>{
  const db=fakeClient([],[
    {user_id:"foreign",packet_id:"packet-a",parent_approval_receipt_id:"parent-a",
      child_action_id:"x",attempt_id:"e",state:"STAGED",observed_at:"2026-10-12T11:00:00Z"},
  ]);
  const on=createSupabaseWeeklyOutboxAuditRepository({
   client:{from:db.from} as never,verifiedOwnerUserId:"owner-a",commissioned:true,
  });
  await expect(on.listEntries(args.ownerUserId,args.packetId,args.parentApprovalReceiptId))
   .rejects.toThrow("SOCIAL_OUTBOX_AUDIT_DB_ATTEMPT_SCOPE_DENIED");
 });
});
