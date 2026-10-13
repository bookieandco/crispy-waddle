import type {WeeklyOutboxReconciliationReport,WeeklyChildAuditFinding} from "./weekly-outbox-reconciliation";

export type SocialOperationsReadiness=
  | "NOT_COMMISSIONED" | "SOURCE_UNAVAILABLE" | "READ_ONLY_EVIDENCE";
export interface TrustedWeeklyApprovalSummary {
  readonly packetId:string;
  readonly receiptId:string;
  readonly status:"pending"|"approved"|"consumed"|"expired";
  readonly expiresAt:string;
  readonly ownerUserId:string;
}
export interface SocialOperationsQueueCard {
  readonly actionId:string;
  readonly actionKind:WeeklyChildAuditFinding["actionKind"];
  readonly disposition:WeeklyChildAuditFinding["disposition"];
  readonly findings:WeeklyChildAuditFinding["findings"];
  readonly providerVerified:false;
  readonly canRetry:false;
}
export interface SocialOperationsSnapshot {
  readonly schema:"jhadina.social.operations.readonly.v1";
  readonly generatedAt:string;
  readonly authority:"READ_ONLY";
  readonly readiness:SocialOperationsReadiness;
  readonly packetId:string|null;
  readonly pendingApprovals:number|null;
  readonly quarantinedActions:number|null;
  readonly humanReviewActions:number|null;
  readonly unverifiedDeliveryClaims:number|null;
  readonly actions:readonly SocialOperationsQueueCard[]|null;
  readonly blockers:readonly string[];
  readonly canApprove:false;
  readonly canPublish:false;
  readonly canComment:false;
  readonly canSpend:false;
  readonly canRetry:false;
  readonly canDispatch:false;
}
const BLOCKERS=[
  "Weekly owner approvals and the atomic outbox are not commissioned (SOCIAL-ID.22 / issue #1222).",
  "SWLC persistence, restoration and owner-scoped RLS remain under audit (SOCIAL-ID.16 / issue #1211).",
  "No provider delivery claim is proof of publication or spending.",
] as const;
function requireDate(value:string):string {
  if(!Number.isFinite(Date.parse(value)))throw new Error("SOCIAL_OPS_INVALID_DATE");
  return value;
}
/**
 * Projection ONLY. Exact owner and parent packet evidence MUST have been
 * verified by the authenticated server before supplying report and approvals.
 * Never make a missing source appear to be an empty successful queue.
 */
export function buildSocialOperationsSnapshot(input:{
  verifiedOwnerUserId:string;
  asOf:string;
  readiness:SocialOperationsReadiness;
  /** Comes ONLY from independently owner-verified .23 reconciliation. */
  report?:WeeklyOutboxReconciliationReport;
  /** Comes ONLY from owner-scoped trusted receipt readback. */
  approvals?:readonly TrustedWeeklyApprovalSummary[];
}):SocialOperationsSnapshot {
  if(!input.verifiedOwnerUserId?.trim())throw new Error("SOCIAL_OPS_OWNER_REQUIRED");
  const asOf=requireDate(input.asOf);
  if(input.readiness==="READ_ONLY_EVIDENCE" && (!input.report || !input.approvals))
    throw new Error("SOCIAL_OPS_TRUSTED_SOURCES_REQUIRED");
  if(input.readiness!=="READ_ONLY_EVIDENCE" && (input.report || input.approvals))
    throw new Error("SOCIAL_OPS_UNVERIFIED_SOURCES_DENIED");
  const report=input.report;
  if(report){
    if(report.ownerUserId!==input.verifiedOwnerUserId ||
       report.schema!=="jhadina.social.weekly-outbox-audit.v1" ||
       report.status!=="SOURCE_AUDIT_READ_ONLY" ||
       report.canPublish!==false || report.canComment!==false ||
       report.canSpend!==false || report.canDispatch!==false ||
       report.canRetry!==false || report.providerDeliveryVerified!==false ||
       !report.packetId.trim() ||
       !Number.isFinite(Date.parse(report.inspectedAt)) ||
       Date.parse(report.inspectedAt)>Date.parse(asOf))
      throw new Error("SOCIAL_OPS_AUDIT_SCOPE_OR_AUTHORITY_INVALID");
    if(report.findings.some(f=>f.canRetry!==false || f.canDispatch!==false ||
      f.providerDeliveryVerified!==false ||
      !["INFORMATION_ONLY","HUMAN_REVIEW_REQUIRED","QUARANTINED"].includes(f.disposition)))
      throw new Error("SOCIAL_OPS_AUDIT_FINDING_AUTHORITY_INVALID");
  }
  const approvals=input.approvals;
  if(approvals){
    const ids=new Set<string>();
    for(const approval of approvals){
      if(approval.ownerUserId!==input.verifiedOwnerUserId ||
         !report || approval.packetId!==report.packetId ||
         !approval.receiptId.trim() || ids.has(approval.receiptId) ||
         !Number.isFinite(Date.parse(approval.expiresAt)))
        throw new Error("SOCIAL_OPS_APPROVAL_SCOPE_INVALID");
      ids.add(approval.receiptId);
    }
  }
  const items=report ? Object.freeze(report.findings.map(f=>Object.freeze({
    actionId:f.childActionId,actionKind:f.actionKind,
    disposition:f.disposition,findings:Object.freeze([...f.findings]),
    providerVerified:false as const,canRetry:false as const,
  }))) : null;
  return Object.freeze({
    schema:"jhadina.social.operations.readonly.v1" as const,
    generatedAt:asOf,
    authority:"READ_ONLY" as const,
    readiness:input.readiness,
    packetId:report?.packetId??null,
    pendingApprovals:approvals ? approvals.filter(a=>
      a.status==="pending" && Date.parse(a.expiresAt)>Date.parse(asOf)).length : null,
    quarantinedActions:report?.quarantinedCount??null,
    humanReviewActions:report?.humanReviewCount??null,
    unverifiedDeliveryClaims:report?.unverifiedDeliveryClaimCount??null,
    actions:items,
    blockers:Object.freeze(input.readiness==="READ_ONLY_EVIDENCE"
      ? ["Observations are read-only; no verified provider delivery or dispatch authority."] : [...BLOCKERS]),
    canApprove:false as const,canPublish:false as const,
    canComment:false as const,canSpend:false as const,
    canRetry:false as const,canDispatch:false as const,
  });
}
