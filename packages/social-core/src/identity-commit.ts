import {
  assertSocialIdentityScope,
  decideSocialIdentityRevision,
  type SocialAccountIdentity,
  type SocialIdentityRevision,
  type SocialIdentityScope,
} from "./identity-projection.js";
import type { SocialAccount } from "./types.js";

/** The approval service—not the caller—must authenticate and attest this record. */
export interface VerifiedSocialIdentityApproval {
  readonly proposalId: string;
  readonly ownerUserId: string;
  readonly accountId: string;
  readonly receiptId: string;
  readonly fingerprint: string;
  readonly status: "APPROVED";
  readonly expiresAt: string;
}

export interface SocialIdentityCommitRecord {
  readonly proposalId: string;
  readonly expectedVersion: number;
  readonly next: SocialAccountIdentity;
  readonly verifiedApprovalReceiptId: string;
  readonly approvalFingerprint: string;
}

export interface SocialIdentityCommitStore {
  load(scope: SocialIdentityScope): Promise<SocialAccountIdentity | null>;
  /** Atomic CAS + append-only audit + single-use receipt consumption, one transaction. */
  commit(scope: SocialIdentityScope, record: SocialIdentityCommitRecord): Promise<void>;
}

export interface SocialIdentityCommitDeps {
  /** May read only an authenticated owner's connected Social account. */
  loadAccount(ownerUserId: string, accountId: string): Promise<SocialAccount | null>;
  /** Server-side receipt verification, tied to the exact proposed mutation. */
  verifyApprovalReceipt(receiptId: string, fingerprint: string): Promise<VerifiedSocialIdentityApproval | null>;
  store: SocialIdentityCommitStore;
}

export function fingerprintSocialIdentityChange(input: {
  scope: SocialIdentityScope;
  proposal: SocialIdentityRevision;
}): string {
  const {scope,proposal} = input;
  return JSON.stringify({
    schema:"jhadina.social.identity-approval.v1",
    ownerUserId:scope.ownerUserId,
    accountId:scope.accountId,
    brandId:scope.brandId,
    platform:scope.platform,
    provider:scope.provider,
    providerProfileId:scope.providerProfileId,
    proposalId:proposal.id,
    expectedVersion:proposal.expectedVersion,
    toneTraits:[...proposal.proposedToneTraits],
    pointOfView:proposal.proposedPointOfView,
    evidenceRefs:[...proposal.evidenceRefs].sort(),
  });
}

/**
 * Returns only after storage atomically consumes the verified receipt and
 * persists a versioned snapshot with immutable audit.
 * No public route is exposed. Caller authentication is performed by the host.
 */
export async function commitReviewedSocialIdentity(input:{
  verifiedOwnerUserId:string;
  proposal:SocialIdentityRevision;
  approvalReceiptId:string;
  decidedAt:string;
}, deps:SocialIdentityCommitDeps):Promise<SocialAccountIdentity> {
  const scope=input.proposal.scope;
  if (!input.verifiedOwnerUserId.trim() || input.verifiedOwnerUserId!==scope.ownerUserId)
    throw new Error("SOCIAL_ID_COMMIT_OWNER_DENIED");
  const account=await deps.loadAccount(scope.ownerUserId,scope.accountId);
  if(!account || account.status!=="connected")
    throw new Error("SOCIAL_ID_COMMIT_ACCOUNT_NOT_CONNECTED");
  assertSocialIdentityScope(scope,account);
  const current=await deps.store.load(scope);
  if(!current)throw new Error("SOCIAL_ID_COMMIT_NOT_INITIALIZED");
  assertSocialIdentityScope(current.scope,account);
  const fingerprint=fingerprintSocialIdentityChange({scope,proposal:input.proposal});
  const receipt=await deps.verifyApprovalReceipt(input.approvalReceiptId,fingerprint);
  if(!receipt || receipt.status!=="APPROVED" ||
      receipt.proposalId!==input.proposal.id ||
      receipt.ownerUserId!==scope.ownerUserId ||
      receipt.accountId!==scope.accountId ||
      receipt.receiptId!==input.approvalReceiptId ||
      receipt.fingerprint!==fingerprint ||
      !Number.isFinite(Date.parse(receipt.expiresAt)) ||
      Date.parse(receipt.expiresAt)<=Date.parse(input.decidedAt))
    throw new Error("SOCIAL_ID_COMMIT_APPROVAL_UNVERIFIED");
  const result=decideSocialIdentityRevision({
    current,proposal:input.proposal,
    verifiedApproverUserId:input.verifiedOwnerUserId,
    approvalReceiptId:receipt.receiptId,
    decision:"APPROVE",decidedAt:input.decidedAt,
  });
  if(!result.next)throw new Error("SOCIAL_ID_COMMIT_NEXT_MISSING");
  await deps.store.commit(scope,{
    proposalId:input.proposal.id,
    expectedVersion:current.version,
    next:result.next,
    verifiedApprovalReceiptId:receipt.receiptId,
    approvalFingerprint:fingerprint,
  });
  return result.next;
}

/**
 * Consistent audited initialization contract. The actual DB transaction
 * consumes an approved scoped receipt just like a later revision.
 */
export async function initializeReviewedSocialIdentity(input:{
  verifiedOwnerUserId:string;
  account:SocialAccount;
  proposedInitial:SocialAccountIdentity;
  proposalId:string;
  approvalReceiptId:string;
  decidedAt:string;
}, deps:SocialIdentityCommitDeps):Promise<SocialAccountIdentity> {
  const scope=input.proposedInitial.scope;
  if(input.verifiedOwnerUserId!==scope.ownerUserId || input.account.userId!==scope.ownerUserId)
    throw new Error("SOCIAL_ID_COMMIT_OWNER_DENIED");
  assertSocialIdentityScope(scope,input.account);
  if(input.account.status!=="connected")throw new Error("SOCIAL_ID_COMMIT_ACCOUNT_NOT_CONNECTED");
  const live=await deps.loadAccount(scope.ownerUserId,scope.accountId);
  if(!live || live.status!=="connected")throw new Error("SOCIAL_ID_COMMIT_ACCOUNT_NOT_CONNECTED");
  assertSocialIdentityScope(scope,live);
  if(await deps.store.load(scope))throw new Error("SOCIAL_ID_COMMIT_ALREADY_INITIALIZED");
  const next=input.proposedInitial;
  if(next.version!==1 || next.authority!=="EXPRESSION_ONLY" ||
     next.canPublish!==false || next.canChangeJhadinaPersonality!==false)
    throw new Error("SOCIAL_ID_COMMIT_INITIAL_INVALID");
  const fingerprint=JSON.stringify({
    schema:"jhadina.social.identity-initial.v1",...scope,
    proposalId:input.proposalId,version:1,
    characterProfileRef:next.characterProfileRef,
    brandVoiceProfileRef:next.brandVoiceProfileRef,
    channelVoiceProfileRef:next.channelVoiceProfileRef,
    speakerIdentityRef:next.speakerIdentityRef??null,
    toneTraits:[...next.toneTraits],pointOfView:next.pointOfView,
    evidenceRefs:[...next.evidenceRefs].sort(),
  });
  const receipt=await deps.verifyApprovalReceipt(input.approvalReceiptId,fingerprint);
  if(!receipt || receipt.status!=="APPROVED" ||
     receipt.ownerUserId!==scope.ownerUserId || receipt.accountId!==scope.accountId ||
     receipt.proposalId!==input.proposalId || receipt.fingerprint!==fingerprint ||
     receipt.receiptId!==input.approvalReceiptId ||
     !Number.isFinite(Date.parse(receipt.expiresAt)) ||
     Date.parse(receipt.expiresAt)<=Date.parse(input.decidedAt))
    throw new Error("SOCIAL_ID_COMMIT_APPROVAL_UNVERIFIED");
  await deps.store.commit(scope,{
    proposalId:input.proposalId,expectedVersion:0,next,
    verifiedApprovalReceiptId:receipt.receiptId,approvalFingerprint:fingerprint,
  });
  return next;
}
