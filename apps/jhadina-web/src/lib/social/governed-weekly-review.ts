import type {ApprovalReceipt, ApprovalReceiptStore} from "@jhadina/action-core";
import {
  compileIdentityBoundWeeklySocialPacket,
  fingerprintWeeklySocialAction,
  type EffectiveSocialIdentity,
  type IdentityBoundWeeklySocialPacket,
  type WeeklySocialCampaignPacket,
  type WeeklySocialAction,
} from "@jhadina/social-core";

/**
 * Strictly an approval-review preparation service; it neither dispatches
 * provider requests nor issues or substitutes an Action/Security child permit.
 */
export const SOCIAL_WEEKLY_REVIEW_CAPABILITY="social.weekly.review";
export type WeeklyChildActionKind=WeeklySocialAction["kind"];

export interface WeeklySocialReviewIdentity {
  readonly userId:string;
  readonly sessionId:string;
}
export interface WeeklySocialReviewSource {
  /** Authenticated, immutable owner-specific packet from canonical repository. */
  loadPacket(ownerUserId:string,packetId:string):Promise<WeeklySocialCampaignPacket|null>;
  /** Current effective identities resolved from authoritative account/approval storage. */
  loadCurrentIdentities(ownerUserId:string,packet:WeeklySocialCampaignPacket):
    Promise<readonly EffectiveSocialIdentity[]>;
}
export interface WeeklySocialReviewDependencies {
  readonly verifyOwner:()=>Promise<WeeklySocialReviewIdentity>;
  readonly source:WeeklySocialReviewSource;
  /** Durable, atomic, status/expiry-scoped receipt store. */
  readonly approvalStore:ApprovalReceiptStore;
  readonly now:()=>Date;
}
export interface WeeklySocialPendingReview {
  readonly schema:"jhadina.social.weekly-review-request.v1";
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly packetFingerprint:string;
  readonly compositeFingerprint:string;
  readonly approvalReceiptId:string;
  readonly receiptStatus:"pending";
  readonly authority:"REVIEW_REQUEST_ONLY";
  readonly canExecute:false;
}
export interface WeeklyChildReviewPlan {
  readonly actionId:string;
  readonly actionKind:WeeklyChildActionKind;
  readonly campaignId:string;
  readonly brand:string;
  readonly actionFingerprint:string;
  readonly weeklyReviewFingerprint:string;
  readonly requiresIndependentActionPermit:true;
  readonly canExecute:false;
}
export interface WeeklySocialReviewedProposal {
  readonly schema:"jhadina.social.weekly-reviewed-proposal.v1";
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly compositeFingerprint:string;
  readonly consumedReviewReceiptId:string;
  readonly childReviewPlans:readonly WeeklyChildReviewPlan[];
  readonly status:"REVIEW_RECEIPT_CONSUMED_ACTIONS_UNAUTHORIZED";
  readonly canPublish:false;
  readonly canComment:false;
  readonly canSpend:false;
  readonly canExecute:false;
}
function actionId(packetId:string):string {
  return "social-weekly:"+packetId;
}
async function loadCurrent(input:{
  packetId:string;
  deps:WeeklySocialReviewDependencies;
}):Promise<{
  ownerUserId:string;
  packet:WeeklySocialCampaignPacket;
  bound:IdentityBoundWeeklySocialPacket;
}> {
  if(!input.packetId.trim())throw new Error("SOCIAL_WEEKLY_REVIEW_PACKET_ID_REQUIRED");
  const user=await input.deps.verifyOwner();
  if(!user.userId?.trim() || !user.sessionId?.trim())
    throw new Error("SOCIAL_WEEKLY_REVIEW_AUTH_REQUIRED");
  const packet=await input.deps.source.loadPacket(user.userId,input.packetId);
  if(!packet || packet.id!==input.packetId || packet.ownerUserId!==user.userId)
    throw new Error("SOCIAL_WEEKLY_REVIEW_PACKET_OWNER_OR_ID_INVALID");
  const identities=await input.deps.source.loadCurrentIdentities(user.userId,packet);
  const bound=compileIdentityBoundWeeklySocialPacket({
    packet,effectiveIdentities:identities,verifiedOwnerUserId:user.userId,
  });
  return {ownerUserId:user.userId,packet,bound};
}
function requireFuture(expiry:string,now:Date):void {
  if(!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry)<=now.getTime())
    throw new Error("SOCIAL_WEEKLY_REVIEW_RECEIPT_EXPIRED");
}
function assertReceiptFields(input:{
  receipt:ApprovalReceipt;
  packetId:string;
  ownerUserId:string;
  fingerprint:string;
  status:"pending"|"approved";
  now:Date;
}):void {
  const {receipt}=input;
  if(!receipt.id?.trim() ||
     receipt.userId!==input.ownerUserId ||
     receipt.actionId!==actionId(input.packetId) ||
     receipt.type!==SOCIAL_WEEKLY_REVIEW_CAPABILITY ||
     receipt.fingerprint!==input.fingerprint ||
     receipt.status!==input.status)
    throw new Error("SOCIAL_WEEKLY_REVIEW_RECEIPT_SCOPE_OR_FINGERPRINT_INVALID");
  requireFuture(receipt.expiresAt,input.now);
}
/** Stores pending approval only; DOES NOT approve or execute anything. */
export async function requestWeeklySocialReview(input:{
  packetId:string;
},deps:WeeklySocialReviewDependencies):Promise<WeeklySocialPendingReview> {
  const current=await loadCurrent({packetId:input.packetId,deps});
  const now=deps.now();
  if(!Number.isFinite(now.getTime()))throw new Error("SOCIAL_WEEKLY_REVIEW_TIME_INVALID");
  const ends=Date.parse(current.packet.weekEndsAt);
  if(ends<=now.getTime())throw new Error("SOCIAL_WEEKLY_REVIEW_CAMPAIGN_EXPIRED");
  const expiresAt=new Date(Math.min(now.getTime()+5*60_000,ends)).toISOString();
  const receipt=await deps.approvalStore.createPending({
    actionId:actionId(input.packetId),
    userId:current.ownerUserId,
    type:SOCIAL_WEEKLY_REVIEW_CAPABILITY,
    fingerprint:current.bound.compositeFingerprint,
    expiresAt,
  });
  assertReceiptFields({
    receipt,packetId:input.packetId,ownerUserId:current.ownerUserId,
    fingerprint:current.bound.compositeFingerprint,status:"pending",now,
  });
  return Object.freeze({
    schema:"jhadina.social.weekly-review-request.v1" as const,
    ownerUserId:current.ownerUserId,
    packetId:input.packetId,
    packetFingerprint:current.packet.fingerprint,
    compositeFingerprint:current.bound.compositeFingerprint,
    approvalReceiptId:receipt.id,
    receiptStatus:"pending" as const,
    authority:"REVIEW_REQUEST_ONLY" as const,
    canExecute:false as const,
  });
}
/**
 * Re-loads both current packet and current account identities before atomically
 * consuming an already-approved receipt. The client only sends packet ID,
 * reviewed fingerprint and receipt ID. Owner is derived from verifier.
 *
 * This yields child REVIEW plans requiring separate existing Action/Security
 * approval per action. It never starts a job or grants any external permit.
 */
export async function consumeWeeklyReviewIntoChildPlans(input:{
  packetId:string;
  reviewedFingerprint:string;
  approvalReceiptId:string;
},deps:WeeklySocialReviewDependencies):Promise<WeeklySocialReviewedProposal> {
  if(!input.reviewedFingerprint?.trim() || !input.approvalReceiptId?.trim())
    throw new Error("SOCIAL_WEEKLY_REVIEW_INPUT_REQUIRED");
  const current=await loadCurrent({packetId:input.packetId,deps});
  const now=deps.now();
  if(!Number.isFinite(now.getTime()) || Date.parse(current.packet.weekEndsAt)<=now.getTime())
    throw new Error("SOCIAL_WEEKLY_REVIEW_CAMPAIGN_EXPIRED");
  if(current.bound.compositeFingerprint!==input.reviewedFingerprint)
    throw new Error("SOCIAL_WEEKLY_REVIEW_STALE_REAPPROVAL_REQUIRED");
  const consumed=await deps.approvalStore.consume(input.approvalReceiptId,{
    actionId:actionId(input.packetId),
    userId:current.ownerUserId,
    type:SOCIAL_WEEKLY_REVIEW_CAPABILITY,
    fingerprint:current.bound.compositeFingerprint,
  });
  if(!consumed)throw new Error("SOCIAL_WEEKLY_REVIEW_APPROVAL_INVALID_OR_REPLAYED");
  const plans=Object.freeze(current.packet.actions.map(action=>Object.freeze({
    actionId:action.id,
    actionKind:action.kind,
    campaignId:action.campaignId,
    brand:action.brand,
    actionFingerprint:fingerprintWeeklySocialAction(action),
    weeklyReviewFingerprint:current.bound.compositeFingerprint,
    requiresIndependentActionPermit:true as const,
    canExecute:false as const,
  })));
  return Object.freeze({
    schema:"jhadina.social.weekly-reviewed-proposal.v1" as const,
    ownerUserId:current.ownerUserId,
    packetId:current.packet.id,
    compositeFingerprint:current.bound.compositeFingerprint,
    consumedReviewReceiptId:input.approvalReceiptId,
    childReviewPlans:plans,
    status:"REVIEW_RECEIPT_CONSUMED_ACTIONS_UNAUTHORIZED" as const,
    canPublish:false as const,canComment:false as const,
    canSpend:false as const,canExecute:false as const,
  });
}
