import {createHash} from "node:crypto";
import {fingerprintWeeklyChildAuthorization,
  type WeeklyChildOutboxRecord,
  type WeeklyChildActionKind,
  type WeeklyChildCapability,
} from "./weekly-child-action-gate";
import {recoverReviewedWeeklyChildBatch,
  type StagedWeeklyChildBatch,
  type WeeklyChildPlanDependencies,
} from "./durable-weekly-child-plans";

/** Observed local outbox/worker state; NOT a provider delivery confirmation. */
export type WeeklyOutboxAttemptState=
  | "STAGED" | "LEASED" | "PROVIDER_SUBMITTED"
  | "FAILED" | "AMBIGUOUS" | "DELIVERED_CLAIM";
export interface WeeklyOutboxAttemptObservation {
  readonly attemptId:string;
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly childActionId:string;
  readonly state:WeeklyOutboxAttemptState;
  readonly observedAt:string;
  /** A string from external systems is NOT verified delivery evidence. */
  readonly providerClaimRef?:string;
}
export interface WeeklyOutboxAuditEntry {
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly parentApprovalReceiptId:string;
  readonly childActionId:string;
  readonly record:WeeklyChildOutboxRecord|null;
  readonly attempts:readonly WeeklyOutboxAttemptObservation[];
}
/**
 * Implementations must perform authenticated, owner-scoped READ-ONLY queries.
 * The caller must not supply browser-derived entries as trusted storage.
 */
export interface WeeklyOutboxAuditRepository {
  listEntries(ownerUserId:string,packetId:string,parentApprovalReceiptId:string):
    Promise<readonly WeeklyOutboxAuditEntry[]>;
}
export type WeeklyOutboxFinding=
  | "NOT_STAGED" | "STAGED_INERT"
  | "STALE_LOCAL_ATTEMPT" | "FAILED_ATTEMPT"
  | "UNVERIFIED_PROVIDER_OUTCOME" | "CORRUPT_RECORD"
  | "DUPLICATE_ATTEMPT" | "FUTURE_ATTEMPT" | "UNRECOGNIZED_ATTEMPT";
export type WeeklyOutboxDisposition=
  | "INFORMATION_ONLY" | "HUMAN_REVIEW_REQUIRED" | "QUARANTINED";
export interface WeeklyChildAuditFinding {
  readonly childActionId:string;
  readonly actionKind:WeeklyChildActionKind;
  readonly capability:WeeklyChildCapability;
  readonly disposition:WeeklyOutboxDisposition;
  readonly findings:readonly WeeklyOutboxFinding[];
  readonly localAttemptCount:number;
  readonly hasUnverifiedDeliveryClaim:boolean;
  readonly providerDeliveryVerified:false;
  readonly canRetry:false;
  readonly canDispatch:false;
}
export interface WeeklyOutboxReconciliationReport {
  readonly schema:"jhadina.social.weekly-outbox-audit.v1";
  readonly ownerUserId:string;
  readonly packetId:string;
  readonly parentApprovalReceiptId:string;
  readonly inspectedAt:string;
  readonly findings:readonly WeeklyChildAuditFinding[];
  readonly quarantinedCount:number;
  readonly humanReviewCount:number;
  readonly unverifiedDeliveryClaimCount:number;
  readonly status:"SOURCE_AUDIT_READ_ONLY";
  readonly providerDeliveryVerified:false;
  readonly canPublish:false;
  readonly canComment:false;
  readonly canSpend:false;
  readonly canDispatch:false;
  readonly canRetry:false;
}
const CAPABILITIES:Readonly<Record<WeeklyChildActionKind,WeeklyChildCapability>>=Object.freeze({
  organic_publication:"public.publish",
  public_comment:"consequential.outreach",
  paid_campaign:"paid-ad.publish",
  director_production:"take.generate",
});
function nonblank(value:unknown):value is string {
  return typeof value==="string" && !!value.trim();
}
function parseTime(value:string):number {
  return Date.parse(value);
}
function validateRow(
  batch:StagedWeeklyChildBatch,
  child:StagedWeeklyChildBatch["children"][number],
  record:WeeklyChildOutboxRecord,
):boolean {
  const action={
    schema:"jhadina.social.weekly-child-authorization.v1" as const,
    packetId:batch.packetId,
    parentApprovalReceiptId:batch.approvalReceiptId,
    childActionId:child.actionId,
    childActionKind:child.actionKind,
    childFingerprint:child.actionFingerprint,
    reviewedWeeklyFingerprint:batch.compositeFingerprint,
  };
  const fingerprint=fingerprintWeeklyChildAuthorization(action);
  const actionId="weekly-child:"+batch.packetId+":"+child.actionId+":"+
    createHash("sha256").update(fingerprint,"utf8").digest("hex");
  return record.schema==="jhadina.social.weekly-child-outbox.v1" &&
    record.ownerUserId===batch.ownerUserId &&
    record.packetId===batch.packetId &&
    record.childActionId===child.actionId &&
    record.actionKind===child.actionKind &&
    record.capability===CAPABILITIES[child.actionKind] &&
    record.parentApprovalReceiptId===batch.approvalReceiptId &&
    nonblank(record.approvalReceiptId) &&
    record.reviewedWeeklyFingerprint===batch.compositeFingerprint &&
    record.childFingerprint===child.actionFingerprint &&
    record.fingerprint===fingerprint &&
    record.actionId===actionId &&
    record.state==="AWAITING_DISPATCH_CERTIFICATION" &&
    record.requiresFreshActionSecurityPermit===true &&
    record.canExecute===false && record.canDispatch===false;
}
function uniqueSorted<T>(values:readonly T[]):T[]{
  return [...new Set(values)];
}
function classifyChild(input:{
  batch:StagedWeeklyChildBatch;
  child:StagedWeeklyChildBatch["children"][number];
  entry?:WeeklyOutboxAuditEntry;
  inspectedAt:number;
  staleAfterMs:number;
}):WeeklyChildAuditFinding {
  const {batch,child,entry}=input;
  const found:WeeklyOutboxFinding[]=[];
  if(!entry?.record)found.push("NOT_STAGED");
  else if(!validateRow(batch,child,entry.record))found.push("CORRUPT_RECORD");
  else found.push("STAGED_INERT");
  const attempts=entry?.attempts??[];
  if(!entry?.record && attempts.length)found.push("CORRUPT_RECORD");
  const ids=new Set<string>();
  let deliveredClaim=false;
  for(const attempt of attempts){
    if(!nonblank(attempt.attemptId) || ids.has(attempt.attemptId))
      found.push("DUPLICATE_ATTEMPT");
    ids.add(attempt.attemptId);
    if(attempt.ownerUserId!==batch.ownerUserId ||
      attempt.packetId!==batch.packetId ||
      attempt.childActionId!==child.actionId ||
      !nonblank(attempt.observedAt))
      throw new Error("SOCIAL_OUTBOX_AUDIT_ATTEMPT_SCOPE_INVALID");
    const observed=parseTime(attempt.observedAt);
    if(!Number.isFinite(observed) || observed>input.inspectedAt)
      found.push("FUTURE_ATTEMPT");
    if(attempt.state==="DELIVERED_CLAIM" || attempt.state==="AMBIGUOUS" ||
       attempt.state==="PROVIDER_SUBMITTED"){
      found.push("UNVERIFIED_PROVIDER_OUTCOME");
      if(attempt.state==="DELIVERED_CLAIM") deliveredClaim=true;
    }else if(attempt.state==="FAILED")found.push("FAILED_ATTEMPT");
    else if(attempt.state==="LEASED" || attempt.state==="STAGED"){
      if(Number.isFinite(observed) && input.inspectedAt-observed>=input.staleAfterMs)
        found.push("STALE_LOCAL_ATTEMPT");
    }else found.push("UNRECOGNIZED_ATTEMPT");
  }
  const dedup=uniqueSorted(found);
  const unsafe=dedup.some(x=>[
    "CORRUPT_RECORD","DUPLICATE_ATTEMPT","FUTURE_ATTEMPT",
    "UNVERIFIED_PROVIDER_OUTCOME","UNRECOGNIZED_ATTEMPT",
  ].includes(x));
  const review=dedup.some(x=>["STALE_LOCAL_ATTEMPT","FAILED_ATTEMPT"].includes(x));
  return Object.freeze({
    childActionId:child.actionId,
    actionKind:child.actionKind,
    capability:CAPABILITIES[child.actionKind],
    disposition:(unsafe?"QUARANTINED":review?"HUMAN_REVIEW_REQUIRED":"INFORMATION_ONLY") as WeeklyOutboxDisposition,
    findings:Object.freeze(dedup),
    localAttemptCount:attempts.length,
    hasUnverifiedDeliveryClaim:deliveredClaim,
    providerDeliveryVerified:false as const,
    canRetry:false as const,
    canDispatch:false as const,
  });
}
/**
 * Only operational readout; no external transport, DB mutation, child
 * approval, worker retry, or outcome certification.
 *
 * Any foreign/extra/duplicate child snapshots abort the WHOLE readout;
 * never silently discard cross-owner rows.
 */
export async function reconcileWeeklyOutboxReadOnly(input:{
  packetId:string;
  parentApprovalReceiptId:string;
  staleAfterMinutes?:number;
},deps:WeeklyChildPlanDependencies & {
  readonly audit:WeeklyOutboxAuditRepository;
}):Promise<WeeklyOutboxReconciliationReport> {
  if(!nonblank(input.packetId) || !nonblank(input.parentApprovalReceiptId))
    throw new Error("SOCIAL_OUTBOX_AUDIT_KEYS_REQUIRED");
  const staleMinutes=input.staleAfterMinutes??30;
  if(!Number.isFinite(staleMinutes) || staleMinutes<=0 || staleMinutes>10080)
    throw new Error("SOCIAL_OUTBOX_AUDIT_STALENESS_INVALID");
  // .21 independently checks the current authenticated owner, packet and
  // identity revision against its persisted parent batch.
  const batch=await recoverReviewedWeeklyChildBatch({
    packetId:input.packetId,approvalReceiptId:input.parentApprovalReceiptId,
  },deps);
  const now=deps.now();
  if(!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new Error("SOCIAL_OUTBOX_AUDIT_NOW_INVALID");
  const entries=await deps.audit.listEntries(
    batch.ownerUserId,batch.packetId,batch.approvalReceiptId,
  );
  const children=new Set(batch.children.map(child=>child.actionId));
  const inspected=new Map<string,WeeklyOutboxAuditEntry>();
  for(const entry of entries){
    if(entry.ownerUserId!==batch.ownerUserId ||
      entry.packetId!==batch.packetId ||
      entry.parentApprovalReceiptId!==batch.approvalReceiptId)
      throw new Error("SOCIAL_OUTBOX_AUDIT_FOREIGN_SCOPE");
    if(!children.has(entry.childActionId))
      throw new Error("SOCIAL_OUTBOX_AUDIT_UNKNOWN_CHILD");
    if(inspected.has(entry.childActionId))
      throw new Error("SOCIAL_OUTBOX_AUDIT_DUPLICATE_CHILD");
    inspected.set(entry.childActionId,entry);
  }
  const findings=batch.children.map(child=>classifyChild({
    batch,child,entry:inspected.get(child.actionId),
    inspectedAt:now.getTime(),staleAfterMs:staleMinutes*60_000,
  }));
  const out=Object.freeze({
    schema:"jhadina.social.weekly-outbox-audit.v1" as const,
    ownerUserId:batch.ownerUserId,
    packetId:batch.packetId,
    parentApprovalReceiptId:batch.approvalReceiptId,
    inspectedAt:now.toISOString(),
    findings:Object.freeze(findings),
    quarantinedCount:findings.filter(x=>x.disposition==="QUARANTINED").length,
    humanReviewCount:findings.filter(x=>x.disposition==="HUMAN_REVIEW_REQUIRED").length,
    unverifiedDeliveryClaimCount:entries.reduce((total,e)=>total+
      e.attempts.filter(a=>a.state==="DELIVERED_CLAIM").length,0),
    status:"SOURCE_AUDIT_READ_ONLY" as const,
    providerDeliveryVerified:false as const,
    canPublish:false as const,canComment:false as const,
    canSpend:false as const,canDispatch:false as const,canRetry:false as const,
  });
  return out;
}
