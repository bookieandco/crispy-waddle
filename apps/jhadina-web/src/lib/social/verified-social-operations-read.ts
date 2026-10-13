import {buildSocialOperationsSnapshot,
  type SocialOperationsSnapshot,
  type TrustedWeeklyApprovalSummary,
} from "./social-operations-dashboard";
import {reconcileWeeklyOutboxReadOnly,
  type WeeklyOutboxAuditRepository,
} from "./weekly-outbox-reconciliation";
import {recoverReviewedWeeklyChildBatch,
  type WeeklyChildPlanDependencies,
  type StagedWeeklyChildBatch,
} from "./durable-weekly-child-plans";

/**
 * Selection MUST be obtained server-side from authenticated owner-scoped
 * canonical storage, not from a browser-provided packet/receipt identifier.
 */
export interface TrustedWeeklyOperationsSelection {
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly parentApprovalReceiptId:string;
}
export interface TrustedWeeklyOperationsSelectionReader {
  loadLatest(ownerUserId:string):Promise<TrustedWeeklyOperationsSelection|null>;
}
export interface TrustedWeeklyOperationsApprovalReader {
  listExactReceipts(ownerUserId:string,batch:StagedWeeklyChildBatch):
    Promise<readonly TrustedWeeklyApprovalSummary[]>;
}
export type VerifiedSocialOperationsDependencies=WeeklyChildPlanDependencies & {
  readonly selection:TrustedWeeklyOperationsSelectionReader;
  readonly audit:WeeklyOutboxAuditRepository;
  readonly approvals:TrustedWeeklyOperationsApprovalReader;
};
function requireOwner(value:string):void {
  if(typeof value!=="string" || !value.trim())
    throw new Error("SOCIAL_OPS_TRUSTED_OWNER_REQUIRED");
}
/**
 * Entirely READ-ONLY: revalidates owner/session, canonical weekly packet
 * and active Social identities via .21; reconstructs the .23 report; then
 * reads exact owner-scoped and packet-fingerprint-bound approval receipts.
 *
 * Missing snapshot, mismatched owner, unavailable DB/RLS, changed identity
 * or partial receipt reads all FAIL CLOSED, never convert to fake zero.
 * This service itself does not enable the HTTP route or commission any DB.
 */
export async function loadVerifiedSocialOperations(
  deps:VerifiedSocialOperationsDependencies,
):Promise<SocialOperationsSnapshot> {
  const viewer=await deps.verifyOwner();
  requireOwner(viewer?.userId);
  if(!viewer?.sessionId?.trim())throw new Error("SOCIAL_OPS_TRUSTED_SESSION_REQUIRED");
  const selection=await deps.selection.loadLatest(viewer.userId);
  if(!selection)throw new Error("SOCIAL_OPS_TRUSTED_NO_CANONICAL_PACKET");
  if(selection.ownerUserId!==viewer.userId ||
    !selection.packetId?.trim() || !selection.parentApprovalReceiptId?.trim())
    throw new Error("SOCIAL_OPS_TRUSTED_SELECTION_SCOPE_INVALID");
  const batch=await recoverReviewedWeeklyChildBatch({
    packetId:selection.packetId,
    approvalReceiptId:selection.parentApprovalReceiptId,
  },{...deps,verifyOwner:async()=>viewer});
  if(batch.ownerUserId!==viewer.userId ||
    batch.packetId!==selection.packetId ||
    batch.approvalReceiptId!==selection.parentApprovalReceiptId ||
    batch.canExecute!==false || batch.canPublish!==false ||
    batch.canComment!==false || batch.canSpend!==false)
    throw new Error("SOCIAL_OPS_TRUSTED_BATCH_SCOPE_INVALID");
  const [report,approvals]=await Promise.all([
    reconcileWeeklyOutboxReadOnly({
      packetId:selection.packetId,
      parentApprovalReceiptId:selection.parentApprovalReceiptId,
    },{...deps,verifyOwner:async()=>viewer}),
    deps.approvals.listExactReceipts(viewer.userId,batch),
  ]);
  const now=deps.now();
  if(!(now instanceof Date)|| !Number.isFinite(now.getTime()))
    throw new Error("SOCIAL_OPS_TRUSTED_TIME_INVALID");
  // The projection separately verifies all receipt owners and packet IDs.
  // Assert the reconciliation belongs to the SAME immutable parent batch.
  if(report.parentApprovalReceiptId!==batch.approvalReceiptId ||
    report.packetId!==batch.packetId || report.ownerUserId!==viewer.userId)
    throw new Error("SOCIAL_OPS_TRUSTED_REPORT_MISMATCH");
  return buildSocialOperationsSnapshot({
    verifiedOwnerUserId:viewer.userId,
    asOf:now.toISOString(),
    readiness:"READ_ONLY_EVIDENCE",
    report,approvals,
  });
}
