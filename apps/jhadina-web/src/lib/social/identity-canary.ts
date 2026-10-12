import {
  type SocialAccount,
  type SocialAccountIdentity,
  type SocialIdentityScope,
  type SocialIdentityCommitStore,
  type SocialIdentityCommitRecord,
} from "@jhadina/social-core";

/**
 * Deterministic offline certification fixture. Never represent this as
 * provider-backed live operation, real DB recovery, or production durability.
 */
export interface SocialIdentityCanaryReceipt {
  readonly schema:"jhadina.social.identity-offline-canary.v1";
  readonly category:"OFFLINE_SIMULATION_ONLY";
  readonly attemptedChecks:readonly string[];
  readonly passedChecks:readonly string[];
  readonly identityVersionAfter:number;
  readonly historyLength:number;
  readonly canAuthorizePublication:false;
  readonly productionRestored:false;
}

export async function runOfflineSocialIdentityCanary(input:{
  ownerUserId:string;
  account:SocialAccount;
  initial:SocialAccountIdentity;
}):Promise<SocialIdentityCanaryReceipt> {
  if(input.ownerUserId!==input.account.userId ||
     input.initial.scope.ownerUserId!==input.ownerUserId ||
     input.account.id!==input.initial.scope.accountId)
    throw new Error("SOCIAL_ID_CANARY_SCOPE_MISMATCH");
  const scope:SocialIdentityScope=input.initial.scope;
  let current:SocialAccountIdentity|null=null;
  const history:SocialAccountIdentity[]=[];
  const spentReceipts=new Set<string>();
  const attemptedChecks=["account scope","initialize CAS","duplicate initialization rejection",
    "stale version rejection","single-use approval","isolated serialization restore"];
  const passedChecks:string[]=[];
  const store:SocialIdentityCommitStore={
    load:async queried=>{
      if(queried.ownerUserId!==scope.ownerUserId || queried.accountId!==scope.accountId ||
         queried.providerProfileId!==scope.providerProfileId)
        throw new Error("SOCIAL_ID_CANARY_FOREIGN_SCOPE");
      return current ? structuredClone(current) : null;
    },
    commit:async (queried,record:SocialIdentityCommitRecord)=>{
      if(queried.ownerUserId!==scope.ownerUserId ||
         queried.accountId!==scope.accountId ||
         queried.brandId!==scope.brandId ||
         queried.providerProfileId!==scope.providerProfileId)
        throw new Error("SOCIAL_ID_CANARY_FOREIGN_SCOPE");
      if(spentReceipts.has(record.verifiedApprovalReceiptId))
        throw new Error("SOCIAL_ID_CANARY_REPLAY");
      if((current?.version??0)!==record.expectedVersion)
        throw new Error("SOCIAL_ID_CANARY_CAS_CONFLICT");
      spentReceipts.add(record.verifiedApprovalReceiptId);
      current=structuredClone(record.next);
      history.push(structuredClone(record.next));
    },
  };
  passedChecks.push("account scope");
  await store.commit(scope,{
    proposalId:"fixture:init",expectedVersion:0,next:input.initial,
    verifiedApprovalReceiptId:"fixture:r1",approvalFingerprint:"fixture:not-real",
  });
  passedChecks.push("initialize CAS");
  try {
    await store.commit(scope,{proposalId:"fixture:init",expectedVersion:0,next:input.initial,
      verifiedApprovalReceiptId:"fixture:r2",approvalFingerprint:"fixture:not-real"});
    throw new Error("SOCIAL_ID_CANARY_FALSE_SUCCESS");
  } catch(error) {
    if(!(error instanceof Error) || error.message!=="SOCIAL_ID_CANARY_CAS_CONFLICT")throw error;
    passedChecks.push("duplicate initialization rejection");
  }
  const next={...input.initial,version:2,updatedAt:new Date().toISOString()};
  await store.commit(scope,{proposalId:"fixture:rev2",expectedVersion:1,next,
    verifiedApprovalReceiptId:"fixture:r3",approvalFingerprint:"fixture:mock"});
  try {
    await store.commit(scope,{proposalId:"fixture:stale",expectedVersion:1,next,
      verifiedApprovalReceiptId:"fixture:r4",approvalFingerprint:"fixture:mock"});
    throw new Error("SOCIAL_ID_CANARY_FALSE_SUCCESS");
  } catch(error) {
    if(!(error instanceof Error) || error.message!=="SOCIAL_ID_CANARY_CAS_CONFLICT")throw error;
    passedChecks.push("stale version rejection");
  }
  try {
    await store.commit(scope,{proposalId:"fixture:replay",expectedVersion:2,
      next:{...next,version:3},verifiedApprovalReceiptId:"fixture:r3",
      approvalFingerprint:"fixture:mock"});
    throw new Error("SOCIAL_ID_CANARY_FALSE_SUCCESS");
  } catch(error) {
    if(!(error instanceof Error) || error.message!=="SOCIAL_ID_CANARY_REPLAY")throw error;
    passedChecks.push("single-use approval");
  }
  const restored=JSON.parse(JSON.stringify(history)) as SocialAccountIdentity[];
  if(restored.length!==2 || restored[1]?.version!==2 ||
     restored[1]?.scope.accountId!==scope.accountId)
    throw new Error("SOCIAL_ID_CANARY_ISOLATED_RESTORE_MISMATCH");
  passedChecks.push("isolated serialization restore");
  return Object.freeze({
    schema:"jhadina.social.identity-offline-canary.v1" as const,
    category:"OFFLINE_SIMULATION_ONLY" as const,
    attemptedChecks:Object.freeze(attemptedChecks),
    passedChecks:Object.freeze(passedChecks),
    identityVersionAfter:2,
    historyLength:history.length,
    canAuthorizePublication:false as const,
    productionRestored:false as const,
  });
}
