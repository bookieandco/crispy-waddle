import {
  compileIdentityBoundWeeklySocialPacket,
  fingerprintWeeklySocialAction,
  type WeeklySocialAction,
} from "@jhadina/social-core";
import {
  SOCIAL_WEEKLY_REVIEW_CAPABILITY,
  weeklyReviewReceiptActionId,
  type WeeklySocialReviewDependencies,
  type WeeklyChildReviewPlan,
} from "./governed-weekly-review";

export interface StagedWeeklyChildPlan extends WeeklyChildReviewPlan {
  readonly state:"AWAITING_INDEPENDENT_ACTION_PERMIT";
}
export interface StagedWeeklyChildBatch {
  readonly schema:"jhadina.social.weekly-child-batch.v1";
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly approvalReceiptId:string;
  readonly packetFingerprint:string;
  readonly compositeFingerprint:string;
  readonly validUntil:string;
  readonly children:readonly StagedWeeklyChildPlan[];
  readonly state:"PERSISTED_REVIEW_ONLY";
  readonly canPublish:false;
  readonly canComment:false;
  readonly canSpend:false;
  readonly canExecute:false;
}
export interface WeeklyChildBatchTransactionInput {
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly approvalReceiptId:string;
  readonly expectedReceiptActionId:string;
  readonly expectedReceiptType:typeof SOCIAL_WEEKLY_REVIEW_CAPABILITY;
  readonly expectedFingerprint:string;
  readonly batch:StagedWeeklyChildBatch;
}
/**
 * A single database transaction MUST:
 * 1. Lock/verify current owner-scoped canonical packet + identity revision
 *    fingerprint (from actual DB records, not this caller's JSON);
 * 2. Lock the already-approved, unexpired weekly receipt with exact
 *    owner/action/type/fingerprint;
 * 3. Insert immutable batch + every child and consume receipt atomically.
 * On retry: return existing identical committed batch for the SAME
 * owner/receipt/fingerprint; reject conflicts and mixed scopes.
 *
 * A plain multi-query wrapper is NOT a valid implementation.
 */
export interface AtomicWeeklyChildBatchStore {
  commitApprovedBatch(input:WeeklyChildBatchTransactionInput):Promise<StagedWeeklyChildBatch>;
  readBatch(ownerUserId:string,packetId:string,approvalReceiptId:string):
    Promise<StagedWeeklyChildBatch|null>;
}
export type WeeklyChildPlanDependencies=Omit<WeeklySocialReviewDependencies,"approvalStore"> & {
  readonly batches:AtomicWeeklyChildBatchStore;
};

type CurrentWeeklyContext={
  readonly ownerUserId:string;
  readonly fingerprint:string;
  readonly packetFingerprint:string;
  readonly packetId:string;
  readonly weekEndsAt:string;
  readonly actions:readonly WeeklySocialAction[];
};

function validDate(value:string):number {
  const ts=Date.parse(value);
  if(!Number.isFinite(ts))throw new Error("SOCIAL_WEEKLY_CHILD_INVALID_DATE");
  return ts;
}

async function currentContext(packetId:string,deps:WeeklyChildPlanDependencies):
Promise<CurrentWeeklyContext> {
  if(!packetId?.trim())throw new Error("SOCIAL_WEEKLY_CHILD_PACKET_REQUIRED");
  const verified=await deps.verifyOwner();
  if(!verified?.userId?.trim() || !verified?.sessionId?.trim())
    throw new Error("SOCIAL_WEEKLY_CHILD_AUTH_REQUIRED");
  const packet=await deps.source.loadPacket(verified.userId,packetId);
  if(!packet || packet.id!==packetId || packet.ownerUserId!==verified.userId)
    throw new Error("SOCIAL_WEEKLY_CHILD_PACKET_UNAVAILABLE_OR_FOREIGN");
  const identities=await deps.source.loadCurrentIdentities(verified.userId,packet);
  const bound=compileIdentityBoundWeeklySocialPacket({
    packet,effectiveIdentities:identities,verifiedOwnerUserId:verified.userId,
  });
  const now=deps.now().getTime();
  if(!Number.isFinite(now) || now>=validDate(packet.weekEndsAt))
    throw new Error("SOCIAL_WEEKLY_CHILD_PACKET_EXPIRED");
  return {
    ownerUserId:verified.userId,packetId:packet.id,
    fingerprint:bound.compositeFingerprint,
    packetFingerprint:packet.fingerprint,
    weekEndsAt:packet.weekEndsAt,actions:packet.actions,
  };
}

function makeChild(
  action:WeeklySocialAction,fingerprint:string,
):StagedWeeklyChildPlan {
  return Object.freeze({
    actionId:action.id,actionKind:action.kind,
    campaignId:action.campaignId,brand:action.brand,
    actionFingerprint:fingerprintWeeklySocialAction(action),
    weeklyReviewFingerprint:fingerprint,
    requiresIndependentActionPermit:true as const,
    canExecute:false as const,
    state:"AWAITING_INDEPENDENT_ACTION_PERMIT" as const,
  });
}
function candidate(
  current:CurrentWeeklyContext,approvalReceiptId:string,
):StagedWeeklyChildBatch {
  const ids=new Set<string>();
  const children=current.actions.map(action=>{
    if(!action.id?.trim() || ids.has(action.id))
      throw new Error("SOCIAL_WEEKLY_CHILD_DUPLICATE_ACTION");
    ids.add(action.id);
    return makeChild(action,current.fingerprint);
  });
  return Object.freeze({
    schema:"jhadina.social.weekly-child-batch.v1" as const,
    ownerUserId:current.ownerUserId,packetId:current.packetId,
    approvalReceiptId,packetFingerprint:current.packetFingerprint,
    compositeFingerprint:current.fingerprint,
    validUntil:current.weekEndsAt,
    children:Object.freeze(children),
    state:"PERSISTED_REVIEW_ONLY" as const,
    canPublish:false as const,canComment:false as const,
    canSpend:false as const,canExecute:false as const,
  });
}
function assertExactStoredBatch(
  stored:StagedWeeklyChildBatch,expected:StagedWeeklyChildBatch,
):void {
  if(stored.schema!=="jhadina.social.weekly-child-batch.v1" ||
    stored.state!=="PERSISTED_REVIEW_ONLY" ||
    stored.canExecute!==false || stored.canPublish!==false ||
    stored.canComment!==false || stored.canSpend!==false ||
    stored.ownerUserId!==expected.ownerUserId ||
    stored.packetId!==expected.packetId ||
    stored.approvalReceiptId!==expected.approvalReceiptId ||
    stored.packetFingerprint!==expected.packetFingerprint ||
    stored.compositeFingerprint!==expected.compositeFingerprint ||
    stored.validUntil!==expected.validUntil ||
    stored.children.length!==expected.children.length)
    throw new Error("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
  const byId=new Map(expected.children.map(child=>[child.actionId,child]));
  const seen=new Set<string>();
  for(const child of stored.children) {
    const wanted=byId.get(child.actionId);
    if(!wanted || seen.has(child.actionId) ||
      child.actionKind!==wanted.actionKind ||
      child.brand!==wanted.brand ||
      child.campaignId!==wanted.campaignId ||
      child.actionFingerprint!==wanted.actionFingerprint ||
      child.weeklyReviewFingerprint!==expected.compositeFingerprint ||
      child.requiresIndependentActionPermit!==true ||
      child.canExecute!==false ||
      child.state!=="AWAITING_INDEPENDENT_ACTION_PERMIT")
      throw new Error("SOCIAL_WEEKLY_CHILD_PERSISTED_MISMATCH");
    seen.add(child.actionId);
  }
}

/**
 * Atomic and idempotent staging. If an RPC commits then its response is lost,
 * retrying the exact input must read the same batch from durable storage.
 * Never issue child permits, engage providers, or mark anything executable.
 */
export async function stageReviewedWeeklyChildBatch(input:{
  packetId:string;
  approvalReceiptId:string;
  reviewedFingerprint:string;
},deps:WeeklyChildPlanDependencies):Promise<StagedWeeklyChildBatch> {
  if(!input.approvalReceiptId?.trim() || !input.reviewedFingerprint?.trim())
    throw new Error("SOCIAL_WEEKLY_CHILD_APPROVAL_FIELDS_REQUIRED");
  const current=await currentContext(input.packetId,deps);
  if(current.fingerprint!==input.reviewedFingerprint)
    throw new Error("SOCIAL_WEEKLY_CHILD_REAPPROVAL_REQUIRED");
  const expected=candidate(current,input.approvalReceiptId);
  const stored=await deps.batches.commitApprovedBatch({
    ownerUserId:current.ownerUserId,packetId:current.packetId,
    approvalReceiptId:input.approvalReceiptId,
    expectedReceiptActionId:weeklyReviewReceiptActionId(current.packetId,current.fingerprint),
    expectedReceiptType:SOCIAL_WEEKLY_REVIEW_CAPABILITY,
    expectedFingerprint:current.fingerprint,
    batch:expected,
  });
  assertExactStoredBatch(stored,expected);
  return stored;
}

/** Restore previously committed batch from durable store after process restart. */
export async function recoverReviewedWeeklyChildBatch(input:{
  packetId:string;
  approvalReceiptId:string;
},deps:WeeklyChildPlanDependencies):Promise<StagedWeeklyChildBatch> {
  if(!input.approvalReceiptId?.trim())
    throw new Error("SOCIAL_WEEKLY_CHILD_RECEIPT_REQUIRED");
  const current=await currentContext(input.packetId,deps);
  const stored=await deps.batches.readBatch(
    current.ownerUserId,current.packetId,input.approvalReceiptId,
  );
  if(!stored)throw new Error("SOCIAL_WEEKLY_CHILD_NOT_PERSISTED");
  assertExactStoredBatch(stored,candidate(current,input.approvalReceiptId));
  return stored;
}

export interface WeeklyChildDispatchPreflight {
  readonly status:"REVALIDATED_ONLY";
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly actionId:string;
  readonly actionKind:WeeklySocialAction["kind"];
  readonly actionFingerprint:string;
  readonly currentWeeklyFingerprint:string;
  readonly approvedBatchReceiptId:string;
  readonly requiresIndependentActionCorePermit:true;
  readonly canExecute:false;
  readonly canPublish:false;
  readonly canSpend:false;
  readonly canComment:false;
}

/**
 * Called at the provider-handler boundary, immediately before the separate
 * Action/Security authorization path. Re-checks latest canonical account
 * identities, full packet, approved batch and exact scheduled action.
 * This is an inert preflight, NOT a permit, lease, or authorization.
 *
 * The eventual production handler MUST perform this check inside the same
 * guarded dispatch boundary (or revalidate via CAS) and use a separately
 * consumed action-specific Action Core approval.
 */
export async function preflightWeeklyChildAtDispatch(input:{
  packetId:string;approvalReceiptId:string;actionId:string;
},deps:WeeklyChildPlanDependencies):Promise<WeeklyChildDispatchPreflight> {
  if(!input.actionId?.trim())throw new Error("SOCIAL_WEEKLY_CHILD_ACTION_REQUIRED");
  const current=await currentContext(input.packetId,deps);
  const stored=await deps.batches.readBatch(
    current.ownerUserId,current.packetId,input.approvalReceiptId,
  );
  if(!stored)throw new Error("SOCIAL_WEEKLY_CHILD_NOT_PERSISTED");
  assertExactStoredBatch(stored,candidate(current,input.approvalReceiptId));
  const action=current.actions.find(action=>action.id===input.actionId);
  if(!action)throw new Error("SOCIAL_WEEKLY_CHILD_ACTION_NOT_IN_PACKET");
  const child=stored.children.find(child=>child.actionId===input.actionId);
  if(!child || child.actionFingerprint!==fingerprintWeeklySocialAction(action))
    throw new Error("SOCIAL_WEEKLY_CHILD_ACTION_CHANGED");
  return Object.freeze({
    status:"REVALIDATED_ONLY" as const,
    ownerUserId:current.ownerUserId,packetId:current.packetId,
    actionId:action.id,actionKind:action.kind,
    actionFingerprint:child.actionFingerprint,
    currentWeeklyFingerprint:current.fingerprint,
    approvedBatchReceiptId:stored.approvalReceiptId,
    requiresIndependentActionCorePermit:true as const,
    canExecute:false as const,canPublish:false as const,
    canSpend:false as const,canComment:false as const,
  });
}
