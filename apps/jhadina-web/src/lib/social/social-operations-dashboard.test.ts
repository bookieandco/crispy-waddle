import {describe,it,expect} from "vitest";
import {buildSocialOperationsSnapshot,type TrustedWeeklyApprovalSummary} from "./social-operations-dashboard";
import type {WeeklyOutboxReconciliationReport} from "./weekly-outbox-reconciliation";
const date="2026-10-12T22:00:00Z";
const base={verifiedOwnerUserId:"owner-1",asOf:date,readiness:"NOT_COMMISSIONED" as const};
const report:WeeklyOutboxReconciliationReport={
 schema:"jhadina.social.weekly-outbox-audit.v1",
 ownerUserId:"owner-1",packetId:"packet-1",parentApprovalReceiptId:"parent-1",
 inspectedAt:"2026-10-12T21:00:00Z",status:"SOURCE_AUDIT_READ_ONLY",
 quarantinedCount:1,humanReviewCount:1,unverifiedDeliveryClaimCount:1,
 providerDeliveryVerified:false,canPublish:false,canComment:false,
 canSpend:false,canDispatch:false,canRetry:false,
 findings:[{childActionId:"paid-1",actionKind:"paid_campaign",
  capability:"paid-ad.publish",disposition:"QUARANTINED",
  findings:["UNVERIFIED_PROVIDER_OUTCOME"],localAttemptCount:1,
  hasUnverifiedDeliveryClaim:true,providerDeliveryVerified:false,
  canRetry:false,canDispatch:false}],
};
const approvals:readonly TrustedWeeklyApprovalSummary[]=[
 {ownerUserId:"owner-1",packetId:"packet-1",receiptId:"receipt-1",
  status:"pending",expiresAt:"2026-10-13T01:00:00Z"},
 {ownerUserId:"owner-1",packetId:"packet-1",receiptId:"receipt-2",
  status:"expired",expiresAt:"2026-10-12T19:00:00Z"},
];
describe("SOCIAL-ID.24 owner-phone operations projection",()=>{
 it("shows unknown, never fake zero, when live source is not commissioned",()=>{
  const view=buildSocialOperationsSnapshot(base);
  expect(view.readiness).toBe("NOT_COMMISSIONED");
  expect(view.pendingApprovals).toBeNull();
  expect(view.quarantinedActions).toBeNull();
  expect(view.actions).toBeNull();
  expect(view.canPublish).toBe(false);
  expect(view.canSpend).toBe(false);
  expect(view.canRetry).toBe(false);
 });
 it("projects verified owner-specific read-only evidence without execution authority",()=>{
  const view=buildSocialOperationsSnapshot({...base,readiness:"READ_ONLY_EVIDENCE",
    report,approvals});
  expect(view.pendingApprovals).toBe(1);
  expect(view.quarantinedActions).toBe(1);
  expect(view.actions?.[0]?.findings).toContain("UNVERIFIED_PROVIDER_OUTCOME");
  expect(view.actions?.[0]?.providerVerified).toBe(false);
  expect(view.canDispatch).toBe(false);
  expect(view.canApprove).toBe(false);
 });
 it("denies unverified owner, status, forged authority and cross-account approvals",()=>{
  expect(()=>buildSocialOperationsSnapshot({...base,verifiedOwnerUserId:""}))
    .toThrow("SOCIAL_OPS_OWNER_REQUIRED");
  expect(()=>buildSocialOperationsSnapshot({...base,report}))
    .toThrow("SOCIAL_OPS_UNVERIFIED_SOURCES_DENIED");
  expect(()=>buildSocialOperationsSnapshot({...base,readiness:"READ_ONLY_EVIDENCE"}))
    .toThrow("SOCIAL_OPS_TRUSTED_SOURCES_REQUIRED");
  expect(()=>buildSocialOperationsSnapshot({...base,readiness:"READ_ONLY_EVIDENCE",
    report:{...report,canDispatch:true as never},approvals}))
    .toThrow("SOCIAL_OPS_AUDIT_SCOPE_OR_AUTHORITY_INVALID");
  expect(()=>buildSocialOperationsSnapshot({...base,readiness:"READ_ONLY_EVIDENCE",
    report,approvals:[{...approvals[0]!,ownerUserId:"foreign"}]}))
    .toThrow("SOCIAL_OPS_APPROVAL_SCOPE_INVALID");
 });
});
