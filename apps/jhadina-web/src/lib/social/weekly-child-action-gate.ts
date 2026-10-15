import {createHash} from "node:crypto";
import {
  createBaseSecurityCoreActionPolicy,
  type ActionPolicy,
  type ActionRequest,
  type ApprovalReceiptStore,
} from "@jhadina/action-core";
import type {WeeklySocialAction} from "@jhadina/social-core";
import {
  preflightWeeklyChildAtDispatch,
  type WeeklyChildPlanDependencies,
  type WeeklyChildDispatchPreflight,
} from "./durable-weekly-child-plans";

export type WeeklyChildCapability=
  | "public.publish"
  | "consequential.outreach"
  | "paid-ad.publish"
  | "take.generate";
export type WeeklyChildActionKind=WeeklySocialAction["kind"];

const CAPS:Readonly<Record<WeeklyChildActionKind,WeeklyChildCapability>>=Object.freeze({
  organic_publication:"public.publish",
  public_comment:"consequential.outreach",
  paid_campaign:"paid-ad.publish",
  director_production:"take.generate",
});
export interface WeeklyChildAuthorizationAction {
  readonly schema:"jhadina.social.weekly-child-authorization.v1";
  readonly packetId:string;
  readonly parentApprovalReceiptId:string;
  readonly childActionId:string;
  readonly childActionKind:WeeklyChildActionKind;
  readonly childFingerprint:string;
  readonly reviewedWeeklyFingerprint:string;
}
/** SHA-256 differentiates revised child actions under unique receipt action IDs. */
export function fingerprintWeeklyChildAuthorization(action:WeeklyChildAuthorizationAction):string {
  return JSON.stringify({
    schema:action.schema,
    packetId:action.packetId,
    parentApprovalReceiptId:action.parentApprovalReceiptId,
    childActionId:action.childActionId,
    childActionKind:action.childActionKind,
    childFingerprint:action.childFingerprint,
    reviewedWeeklyFingerprint:action.reviewedWeeklyFingerprint,
  });
}
function childReceiptActionId(action:WeeklyChildAuthorizationAction):string {
  return "weekly-child:"+action.packetId+":"+action.childActionId+":"+
    createHash("sha256").update(fingerprintWeeklyChildAuthorization(action),"utf8").digest("hex");
}
export interface WeeklyChildApprovalRequest {
  readonly schema:"jhadina.social.child-approval-request.v1";
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly childActionId:string;
  readonly actionKind:WeeklyChildActionKind;
  readonly capability:WeeklyChildCapability;
  readonly approvalReceiptId:string;
  readonly actionId:string;
  readonly fingerprint:string;
  readonly state:"PENDING_INDEPENDENT_OWNER_APPROVAL";
  readonly canExecute:false;
}
export interface WeeklyChildOutboxRecord {
  readonly schema:"jhadina.social.weekly-child-outbox.v1";
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly childActionId:string;
  readonly actionKind:WeeklyChildActionKind;
  readonly capability:WeeklyChildCapability;
  readonly actionId:string;
  readonly fingerprint:string;
  readonly approvalReceiptId:string;
  readonly parentApprovalReceiptId:string;
  readonly reviewedWeeklyFingerprint:string;
  readonly childFingerprint:string;
  readonly state:"AWAITING_DISPATCH_CERTIFICATION";
  readonly requiresFreshActionSecurityPermit:true;
  readonly canDispatch:false;
  readonly canExecute:false;
}
export interface WeeklyChildOutboxTransaction {
  readonly proposed:WeeklyChildOutboxRecord;
  readonly expectedReceiptActionId:string;
  readonly expectedOwnerUserId:string;
  readonly expectedReceiptType:WeeklyChildCapability;
  readonly expectedReceiptFingerprint:string;
  readonly expectedParentReceiptId:string;
  readonly expectedPacketFingerprint:string;
  readonly expectedChildFingerprint:string;
}
/**
 * The trusted DB implementation MUST transactionally:
 * - lock canonical owner, parent batch, latest packet & identity revisions;
 * - prove ALL preflight fingerprints still match;
 * - consume only the approved, unexpired, single-use independent child receipt;
 * - insert one idempotent, NEVER-dispatchable outbox row;
 * - return existing identical committed row after a lost response.
 * No insert-then-consume or consume-then-insert multi-query implementation.
 */
export interface AtomicWeeklyChildOutboxStore {
  consumeApprovalAndStageChild(input:WeeklyChildOutboxTransaction):
    Promise<WeeklyChildOutboxRecord>;
  readStagedChild(input:{
    ownerUserId:string;packetId:string;childActionId:string;
    approvalReceiptId:string;
  }):Promise<WeeklyChildOutboxRecord|null>;
}
export interface WeeklyChildAuthorizationDependencies extends WeeklyChildPlanDependencies {
  readonly childApprovalStore:ApprovalReceiptStore;
  readonly policy?:ActionPolicy<WeeklyChildAuthorizationAction>;
  readonly outbox:AtomicWeeklyChildOutboxStore;
}
function toAction(preflight:WeeklyChildDispatchPreflight):WeeklyChildAuthorizationAction {
  return Object.freeze({
    schema:"jhadina.social.weekly-child-authorization.v1" as const,
    packetId:preflight.packetId,
    parentApprovalReceiptId:preflight.approvedBatchReceiptId,
    childActionId:preflight.actionId,
    childActionKind:preflight.actionKind,
    childFingerprint:preflight.actionFingerprint,
    reviewedWeeklyFingerprint:preflight.currentWeeklyFingerprint,
  });
}
function actionRequest(ownerUserId:string,action:WeeklyChildAuthorizationAction):
ActionRequest<WeeklyChildAuthorizationAction> {
  return {
    id:childReceiptActionId(action),
    userId:ownerUserId,
    type:CAPS[action.childActionKind],
    action,
    requestedAt:new Date(0).toISOString(),
  };
}
async function checked(input:{
  packetId:string;parentApprovalReceiptId:string;childActionId:string;
},deps:WeeklyChildAuthorizationDependencies) {
  // This revalidates authenticated owner, canonical packet+identity, persisted
  // parent batch and exact child fingerprint on every call.
  const preflight=await preflightWeeklyChildAtDispatch({
    packetId:input.packetId,approvalReceiptId:input.parentApprovalReceiptId,
    actionId:input.childActionId,
  },deps);
  const action=toAction(preflight);
  const request=actionRequest(preflight.ownerUserId,action);
  const policy=deps.policy??createBaseSecurityCoreActionPolicy<WeeklyChildAuthorizationAction>("social");
  const decision=await policy.evaluate(request);
  if(decision!=="allow" && decision!=="approval_required")
    throw new Error("SOCIAL_WEEKLY_CHILD_SECURITY_DENIED");
  // Deliberately require independent owner approval EVEN if Security returns
  // allow for e.g. take.generate; broad allow must not authorize this batch.
  return {preflight,action,request};
}
function expectedRow(input:{
  ownerUserId:string;action:WeeklyChildAuthorizationAction;approvalReceiptId:string;
}):WeeklyChildOutboxRecord {
  return Object.freeze({
    schema:"jhadina.social.weekly-child-outbox.v1" as const,
    ownerUserId:input.ownerUserId,
    packetId:input.action.packetId,
    childActionId:input.action.childActionId,
    actionKind:input.action.childActionKind,
    capability:CAPS[input.action.childActionKind],
    actionId:childReceiptActionId(input.action),
    fingerprint:fingerprintWeeklyChildAuthorization(input.action),
    approvalReceiptId:input.approvalReceiptId,
    parentApprovalReceiptId:input.action.parentApprovalReceiptId,
    reviewedWeeklyFingerprint:input.action.reviewedWeeklyFingerprint,
    childFingerprint:input.action.childFingerprint,
    state:"AWAITING_DISPATCH_CERTIFICATION" as const,
    requiresFreshActionSecurityPermit:true as const,
    canDispatch:false as const,
    canExecute:false as const,
  });
}
function assertExactOutbox(actual:WeeklyChildOutboxRecord,expected:WeeklyChildOutboxRecord) {
  const fields:(keyof WeeklyChildOutboxRecord)[]=[
    "schema","ownerUserId","packetId","childActionId","actionKind",
    "capability","actionId","fingerprint","approvalReceiptId",
    "parentApprovalReceiptId","reviewedWeeklyFingerprint","childFingerprint",
    "state","requiresFreshActionSecurityPermit","canDispatch","canExecute",
  ];
  if(fields.some(field=>actual[field]!==expected[field]))
    throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_MISMATCH");
}
export async function requestWeeklyChildIndependentApproval(input:{
  packetId:string;parentApprovalReceiptId:string;childActionId:string;
},deps:WeeklyChildAuthorizationDependencies):Promise<WeeklyChildApprovalRequest> {
  const {preflight,action,request}=await checked(input,deps);
  const now=deps.now().getTime();
  if(!Number.isFinite(now))throw new Error("SOCIAL_WEEKLY_CHILD_APPROVAL_TIME_INVALID");
  const expiresAt=new Date(now+5*60_000).toISOString();
  const receipt=await deps.childApprovalStore.createPending({
    actionId:request.id,userId:request.userId,type:request.type,
    fingerprint:fingerprintWeeklyChildAuthorization(action),expiresAt,
  });
  if(receipt.status!=="pending" || receipt.actionId!==request.id ||
    receipt.userId!==request.userId || receipt.type!==request.type ||
    receipt.fingerprint!==fingerprintWeeklyChildAuthorization(action) ||
    !Number.isFinite(Date.parse(receipt.expiresAt)) ||
    Date.parse(receipt.expiresAt)<=now)
    throw new Error("SOCIAL_WEEKLY_CHILD_PENDING_RECEIPT_MISMATCH");
  return Object.freeze({
    schema:"jhadina.social.child-approval-request.v1" as const,
    ownerUserId:preflight.ownerUserId,packetId:preflight.packetId,
    childActionId:preflight.actionId,actionKind:preflight.actionKind,
    capability:CAPS[preflight.actionKind],
    approvalReceiptId:receipt.id,
    actionId:request.id,
    fingerprint:receipt.fingerprint,
    state:"PENDING_INDEPENDENT_OWNER_APPROVAL" as const,
    canExecute:false as const,
  });
}
/**
 * Server-only guarded admission to a NON-EXECUTABLE outbox. The injected
 * implementation must independently enforce approval receipt + current scope
 * inside the same durable transaction; code here supplies exact claims only.
 */
export async function stageApprovedWeeklyChildOutbox(input:{
  packetId:string;parentApprovalReceiptId:string;childActionId:string;
  approvalReceiptId:string;
},deps:WeeklyChildAuthorizationDependencies):Promise<WeeklyChildOutboxRecord> {
  if(!input.approvalReceiptId?.trim())
    throw new Error("SOCIAL_WEEKLY_CHILD_APPROVAL_RECEIPT_REQUIRED");
  const {preflight,action,request}=await checked(input,deps);
  const proposal=expectedRow({
    ownerUserId:preflight.ownerUserId,action,
    approvalReceiptId:input.approvalReceiptId,
  });
  const recorded=await deps.outbox.consumeApprovalAndStageChild({
    proposed:proposal,
    expectedReceiptActionId:request.id,
    expectedOwnerUserId:request.userId,
    expectedReceiptType:CAPS[action.childActionKind],
    expectedReceiptFingerprint:proposal.fingerprint,
    expectedParentReceiptId:preflight.approvedBatchReceiptId,
    expectedPacketFingerprint:preflight.currentWeeklyFingerprint,
    expectedChildFingerprint:preflight.actionFingerprint,
  });
  assertExactOutbox(recorded,proposal);
  return recorded;
}
/** Read-back and stale-verification after restart; still not a transport lease. */
export async function recoverStagedWeeklyChildOutbox(input:{
  packetId:string;parentApprovalReceiptId:string;childActionId:string;
  approvalReceiptId:string;
},deps:WeeklyChildAuthorizationDependencies):Promise<WeeklyChildOutboxRecord> {
  if(!input.approvalReceiptId?.trim())throw new Error("SOCIAL_WEEKLY_CHILD_APPROVAL_RECEIPT_REQUIRED");
  const {preflight,action}=await checked(input,deps);
  const recorded=await deps.outbox.readStagedChild({
    ownerUserId:preflight.ownerUserId,packetId:preflight.packetId,
    childActionId:preflight.actionId,approvalReceiptId:input.approvalReceiptId,
  });
  if(!recorded)throw new Error("SOCIAL_WEEKLY_CHILD_OUTBOX_NOT_PERSISTED");
  assertExactOutbox(recorded,expectedRow({
    ownerUserId:preflight.ownerUserId,action,approvalReceiptId:input.approvalReceiptId,
  }));
  return recorded;
}
