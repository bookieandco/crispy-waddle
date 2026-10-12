import {createHash} from "node:crypto";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {fingerprintWeeklyChildAuthorization,
  type WeeklyChildOutboxRecord} from "./weekly-child-action-gate";
import {recoverReviewedWeeklyChildBatch,
  type StagedWeeklyChildBatch} from "./durable-weekly-child-plans";
import {
  reconcileWeeklyOutboxReadOnly,
  type WeeklyOutboxAuditEntry,
  type WeeklyOutboxAuditRepository,
} from "./weekly-outbox-reconciliation";

// The .21 guarded owner/packet/identity restore has its own integration tests.
// Here it is stubbed to focus on read-only classification and storage trust.
vi.mock("./durable-weekly-child-plans",()=>({
  recoverReviewedWeeklyChildBatch:vi.fn(),
}));
const restore=vi.mocked(recoverReviewedWeeklyChildBatch);
const baseTime="2026-10-12T13:00:00.000Z";
const kinds=[
  ["organic:1","organic_publication","public.publish"],
  ["comment:1","public_comment","consequential.outreach"],
  ["paid:1","paid_campaign","paid-ad.publish"],
  ["director:1","director_production","take.generate"],
] as const;
const batch:StagedWeeklyChildBatch={
  schema:"jhadina.social.weekly-child-batch.v1",
  ownerUserId:"owner-a",packetId:"packet-1",
  approvalReceiptId:"parent-r1",packetFingerprint:"packet-proof",
  compositeFingerprint:"identity-review-proof",
  validUntil:"2026-10-15T00:00:00.000Z",
  state:"PERSISTED_REVIEW_ONLY",
  canPublish:false,canComment:false,canSpend:false,canExecute:false,
  children:kinds.map(([id,kind])=>({
    actionId:id,actionKind:kind,campaignId:"campaign-1",
    brand:"pupsonstuff",actionFingerprint:"child-proof:"+id,
    weeklyReviewFingerprint:"identity-review-proof",
    requiresIndependentActionPermit:true,canExecute:false,
    state:"AWAITING_INDEPENDENT_ACTION_PERMIT",
  })),
};
function validRow(childId:string):WeeklyChildOutboxRecord {
  const child=batch.children.find(c=>c.actionId===childId)!;
  const action={
    schema:"jhadina.social.weekly-child-authorization.v1" as const,
    packetId:batch.packetId,
    parentApprovalReceiptId:batch.approvalReceiptId,
    childActionId:child.actionId,childActionKind:child.actionKind,
    childFingerprint:child.actionFingerprint,
    reviewedWeeklyFingerprint:batch.compositeFingerprint,
  };
  const fingerprint=fingerprintWeeklyChildAuthorization(action);
  return {
    schema:"jhadina.social.weekly-child-outbox.v1",
    ownerUserId:batch.ownerUserId,packetId:batch.packetId,
    childActionId:childId,actionKind:child.actionKind,
    capability:kinds.find(([id])=>id===childId)![2],
    actionId:"weekly-child:"+batch.packetId+":"+childId+":"+
      createHash("sha256").update(fingerprint,"utf8").digest("hex"),
    fingerprint,approvalReceiptId:"approved:"+childId,
    parentApprovalReceiptId:batch.approvalReceiptId,
    reviewedWeeklyFingerprint:batch.compositeFingerprint,
    childFingerprint:child.actionFingerprint,
    state:"AWAITING_DISPATCH_CERTIFICATION",
    requiresFreshActionSecurityPermit:true,
    canDispatch:false,canExecute:false,
  };
}
function entry(childActionId:string):WeeklyOutboxAuditEntry {
  return {
    ownerUserId:batch.ownerUserId,packetId:batch.packetId,
    parentApprovalReceiptId:batch.approvalReceiptId,childActionId,
    record:validRow(childActionId),
    attempts:[],
  };
}
function setup(rows:readonly WeeklyOutboxAuditEntry[]){
  const listEntries=vi.fn(async()=>rows);
  const audit:WeeklyOutboxAuditRepository={listEntries};
  const deps={
    audit,now:()=>new Date(baseTime),
    verifyOwner:vi.fn(async()=>({userId:"owner-a",sessionId:"session"})),
    source:{} as never,batches:{} as never,
  };
  return {deps,listEntries};
}
async function inspect(rows:readonly WeeklyOutboxAuditEntry[]){
  const {deps,listEntries}=setup(rows);
  const report=await reconcileWeeklyOutboxReadOnly({
    packetId:batch.packetId,parentApprovalReceiptId:batch.approvalReceiptId,
  },deps);
  return {report,listEntries};
}
beforeEach(()=>{restore.mockReset();restore.mockResolvedValue(batch);});
describe("SOCIAL-ID.23 read-only reconciliation and quarantine",()=>{
  it("inspects four owner-scoped inert records without treating them as delivery or action permits",async()=>{
    const {report,listEntries}=await inspect(kinds.map(([id])=>entry(id)));
    expect(restore).toHaveBeenCalledWith({
      packetId:"packet-1",approvalReceiptId:"parent-r1",
    },expect.anything());
    expect(listEntries).toHaveBeenCalledWith("owner-a","packet-1","parent-r1");
    expect(report.findings).toHaveLength(4);
    expect(report.findings.every(f=>f.disposition==="INFORMATION_ONLY")).toBe(true);
    expect(report.findings.every(f=>f.findings.includes("STAGED_INERT"))).toBe(true);
    expect(report.canDispatch).toBe(false);
    expect(report.canRetry).toBe(false);
    expect(report.providerDeliveryVerified).toBe(false);
    expect(report.quarantinedCount).toBe(0);
  });
  it("shows missing rows as awaiting independent staging, not automated retry or completion",async()=>{
    const {report}=await inspect([entry("organic:1")]);
    expect(report.findings.filter(f=>f.findings.includes("NOT_STAGED"))).toHaveLength(3);
    expect(report.canPublish).toBe(false);
    expect(report.canRetry).toBe(false);
  });
  it("classifies stale local attempts and failure for human review without retry",async()=>{
    const e=entry("organic:1");
    const {report}=await inspect([{
      ...e,attempts:[
        {attemptId:"lease-1",ownerUserId:"owner-a",packetId:"packet-1",
          childActionId:"organic:1",state:"LEASED",
          observedAt:"2026-10-12T11:00:00.000Z"},
        {attemptId:"fail-1",ownerUserId:"owner-a",packetId:"packet-1",
          childActionId:"organic:1",state:"FAILED",
          observedAt:"2026-10-12T12:50:00.000Z"},
      ],
    }]);
    expect(report.humanReviewCount).toBe(1);
    expect(report.findings[0]?.findings).toContain("STALE_LOCAL_ATTEMPT");
    expect(report.findings[0]?.findings).toContain("FAILED_ATTEMPT");
    expect(report.findings[0]?.canRetry).toBe(false);
  });
  it("quarantines ambiguous and claimed delivery without ever confirming provider results",async()=>{
    const e=entry("paid:1");
    const {report}=await inspect([{
      ...e,attempts:[{
        attemptId:"provider-claim",ownerUserId:"owner-a",packetId:"packet-1",
        childActionId:"paid:1",state:"DELIVERED_CLAIM",
        observedAt:"2026-10-12T12:50:00.000Z",providerClaimRef:"claim:unverified",
      }],
    }]);
    expect(report.quarantinedCount).toBe(1);
    expect(report.unverifiedDeliveryClaimCount).toBe(1);
    expect(report.findings.find(f=>f.childActionId==="paid:1")?.findings)
      .toContain("UNVERIFIED_PROVIDER_OUTCOME");
    expect(report.providerDeliveryVerified).toBe(false);
    expect(report.canSpend).toBe(false);
  });
  it("quarantines forged execution authority, mismatched capability or provider fingerprint",async()=>{
    const current=entry("organic:1");
    const {report}=await inspect([{
      ...current,record:{...current.record!,canDispatch:true as never},
    }]);
    expect(report.quarantinedCount).toBe(1);
    expect(report.findings[0]?.findings).toContain("CORRUPT_RECORD");
    const mismatch=await inspect([{
      ...current,record:{...current.record!,capability:"paid-ad.publish" as never},
    }]);
    expect(mismatch.report.findings[0]?.findings).toContain("CORRUPT_RECORD");
  });
  it("quarantines duplicate, future and unknown attempt states",async()=>{
    const e=entry("organic:1");
    const attempt={attemptId:"same",ownerUserId:"owner-a",packetId:"packet-1",
      childActionId:"organic:1",state:"LEASED" as const,
      observedAt:"2027-10-12T13:00:00Z"};
    const {report}=await inspect([{
      ...e,attempts:[attempt,{...attempt,state:"BOGUS" as never}],
    }]);
    expect(report.findings[0]?.disposition).toBe("QUARANTINED");
    expect(report.findings[0]?.findings).toEqual(expect.arrayContaining([
      "DUPLICATE_ATTEMPT","FUTURE_ATTEMPT","UNRECOGNIZED_ATTEMPT",
    ]));
  });
  it("rejects foreign owners, unexpected children, duplicates and foreign attempt scope",async()=>{
    const x=entry("organic:1");
    await expect(inspect([{...x,ownerUserId:"owner-b"}]))
      .rejects.toThrow("SOCIAL_OUTBOX_AUDIT_FOREIGN_SCOPE");
    await expect(inspect([{...x,childActionId:"alien"}]))
      .rejects.toThrow("SOCIAL_OUTBOX_AUDIT_UNKNOWN_CHILD");
    await expect(inspect([x,x]))
      .rejects.toThrow("SOCIAL_OUTBOX_AUDIT_DUPLICATE_CHILD");
    await expect(inspect([{
      ...x,attempts:[{attemptId:"x",ownerUserId:"owner-b",packetId:"packet-1",
        childActionId:"organic:1",state:"LEASED",observedAt:baseTime}],
    }])).rejects.toThrow("SOCIAL_OUTBOX_AUDIT_ATTEMPT_SCOPE_INVALID");
  });
  it("fails closed on stale parent, unavailable owner storage or audit DB outage",async()=>{
    restore.mockRejectedValueOnce(new Error("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH"));
    await expect(inspect([])).rejects.toThrow("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
    const {deps}=setup([]);
    deps.audit.listEntries=async()=>{throw new Error("DATABASE_OFFLINE");};
    await expect(reconcileWeeklyOutboxReadOnly({
      packetId:"packet-1",parentApprovalReceiptId:"parent-r1",
    },deps)).rejects.toThrow("DATABASE_OFFLINE");
  });
});
