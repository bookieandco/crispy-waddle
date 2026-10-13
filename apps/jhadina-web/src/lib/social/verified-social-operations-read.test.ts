import {beforeEach,describe,it,expect,vi} from "vitest";
import {loadVerifiedSocialOperations,
  type VerifiedSocialOperationsDependencies,
} from "./verified-social-operations-read";
import {recoverReviewedWeeklyChildBatch} from "./durable-weekly-child-plans";
import {reconcileWeeklyOutboxReadOnly} from "./weekly-outbox-reconciliation";
import type {StagedWeeklyChildBatch} from "./durable-weekly-child-plans";
import type {WeeklyOutboxReconciliationReport} from "./weekly-outbox-reconciliation";
vi.mock("./durable-weekly-child-plans",()=>({
 recoverReviewedWeeklyChildBatch:vi.fn(),
}));
vi.mock("./weekly-outbox-reconciliation",()=>({
 reconcileWeeklyOutboxReadOnly:vi.fn(),
}));
const recover=vi.mocked(recoverReviewedWeeklyChildBatch),
  reconcile=vi.mocked(reconcileWeeklyOutboxReadOnly);
const batch:StagedWeeklyChildBatch={
 schema:"jhadina.social.weekly-child-batch.v1",
 ownerUserId:"owner-a",packetId:"packet-a",
 approvalReceiptId:"parent-a",packetFingerprint:"packet-fp",
 compositeFingerprint:"identity-fp",validUntil:"2026-10-13T00:00:00Z",
 children:[{actionId:"post-1",actionKind:"organic_publication",
 campaignId:"campaign",brand:"pupsonstuff",actionFingerprint:"child-fp",
 weeklyReviewFingerprint:"identity-fp",
 requiresIndependentActionPermit:true,canExecute:false,
 state:"AWAITING_INDEPENDENT_ACTION_PERMIT"}],
 state:"PERSISTED_REVIEW_ONLY",canExecute:false,canPublish:false,
 canComment:false,canSpend:false,
};
const report:WeeklyOutboxReconciliationReport={
 schema:"jhadina.social.weekly-outbox-audit.v1",
 ownerUserId:"owner-a",packetId:"packet-a",parentApprovalReceiptId:"parent-a",
 inspectedAt:"2026-10-12T20:00:00Z",
 findings:[{childActionId:"post-1",actionKind:"organic_publication",
 capability:"public.publish",disposition:"QUARANTINED",
 findings:["UNVERIFIED_PROVIDER_OUTCOME"],localAttemptCount:1,
 hasUnverifiedDeliveryClaim:true,providerDeliveryVerified:false,
 canRetry:false,canDispatch:false}],
 quarantinedCount:1,humanReviewCount:0,unverifiedDeliveryClaimCount:1,
 status:"SOURCE_AUDIT_READ_ONLY",providerDeliveryVerified:false,
 canPublish:false,canComment:false,canSpend:false,canDispatch:false,canRetry:false,
};
const receipt={
 ownerUserId:"owner-a",packetId:"packet-a",receiptId:"pending-one",
 status:"pending" as const,expiresAt:"2026-10-12T23:00:00Z",
};
function harness(){
 const verifyOwner=vi.fn(async()=>({userId:"owner-a",sessionId:"session-a"}));
 const loadLatest=vi.fn(async()=>({
  ownerUserId:"owner-a",packetId:"packet-a",parentApprovalReceiptId:"parent-a",
 }));
 const listExactReceipts=vi.fn(async()=>[receipt]);
 const deps={
  verifyOwner,selection:{loadLatest},
  approvals:{listExactReceipts},
  source:{} as never,batches:{} as never,audit:{} as never,
  now:()=>new Date("2026-10-12T22:00:00Z"),
 } satisfies VerifiedSocialOperationsDependencies;
 return {deps,verifyOwner,loadLatest,listExactReceipts};
}
beforeEach(()=>{
 vi.clearAllMocks();
 recover.mockResolvedValue(batch);
 reconcile.mockResolvedValue(report);
});
describe("SOCIAL-ID.25 trusted owner-scoped operations service",()=>{
 it("requires canonical identity+batch and exact receipt lineage; still read only",async()=>{
  const h=harness();
  const view=await loadVerifiedSocialOperations(h.deps);
  expect(view.pendingApprovals).toBe(1);
  expect(view.quarantinedActions).toBe(1);
  expect(view.unverifiedDeliveryClaims).toBe(1);
  expect(view.readiness).toBe("READ_ONLY_EVIDENCE");
  expect(view.canPublish).toBe(false);
  expect(view.canApprove).toBe(false);
  expect(view.canDispatch).toBe(false);
  expect(h.loadLatest).toHaveBeenCalledWith("owner-a");
  expect(h.listExactReceipts).toHaveBeenCalledWith("owner-a",batch);
  expect(recover).toHaveBeenCalledWith({
    packetId:"packet-a",approvalReceiptId:"parent-a",
  },expect.anything());
 });
 it("fails for foreign source selection and missing canonical packet",async()=>{
  const h=harness();
  h.loadLatest.mockResolvedValueOnce({
   ownerUserId:"foreign",packetId:"packet-a",parentApprovalReceiptId:"parent-a",
  });
  await expect(loadVerifiedSocialOperations(h.deps))
   .rejects.toThrow("SOCIAL_OPS_TRUSTED_SELECTION_SCOPE_INVALID");
  const other=harness();
  other.loadLatest.mockResolvedValueOnce(null as never);
  await expect(loadVerifiedSocialOperations(other.deps))
   .rejects.toThrow("SOCIAL_OPS_TRUSTED_NO_CANONICAL_PACKET");
 });
 it("denies foreign batch, report and approval receipts",async()=>{
  const h=harness();
  recover.mockResolvedValueOnce({...batch,ownerUserId:"foreign"});
  await expect(loadVerifiedSocialOperations(h.deps))
   .rejects.toThrow("SOCIAL_OPS_TRUSTED_BATCH_SCOPE_INVALID");
  reconcile.mockResolvedValueOnce({...report,parentApprovalReceiptId:"wrong"});
  await expect(loadVerifiedSocialOperations(h.deps))
   .rejects.toThrow("SOCIAL_OPS_TRUSTED_REPORT_MISMATCH");
  h.listExactReceipts.mockResolvedValueOnce([{...receipt,ownerUserId:"foreign"}]);
  await expect(loadVerifiedSocialOperations(h.deps))
   .rejects.toThrow("SOCIAL_OPS_APPROVAL_SCOPE_INVALID");
 });
 it("rejects expired owner session, changed current identities or DB failure",async()=>{
  const h=harness();
  h.verifyOwner.mockResolvedValueOnce({userId:"owner-a",sessionId:""});
  await expect(loadVerifiedSocialOperations(h.deps))
   .rejects.toThrow("SOCIAL_OPS_TRUSTED_SESSION_REQUIRED");
  recover.mockRejectedValueOnce(new Error("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH"));
  await expect(loadVerifiedSocialOperations(h.deps))
   .rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
  h.listExactReceipts.mockRejectedValueOnce(new Error("DATABASE_DOWN"));
  await expect(loadVerifiedSocialOperations(h.deps))
   .rejects.toThrow("DATABASE_DOWN");
 });
});
