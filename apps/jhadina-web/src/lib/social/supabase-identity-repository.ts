import type {SupabaseClient} from "@supabase/supabase-js";
import {
  type SocialAccountIdentity,
  type SocialIdentityScope,
  type SocialIdentityCommitStore,
  type SocialIdentityCommitRecord,
  type VerifiedSocialIdentityApproval,
  type SocialIdentityRepository,
} from "@jhadina/social-core";

function object(value:unknown): value is Record<string,unknown> {
  return !!value && typeof value==="object" && !Array.isArray(value);
}
function required(value:unknown):boolean {
  return typeof value==="string" && !!value.trim();
}
function matchesScope(value:unknown, scope:SocialIdentityScope):value is SocialAccountIdentity {
  if(!object(value) || !object(value.scope))return false;
  const s=value.scope;
  return value.schemaVersion==="jhadina.social.account-identity.v1" &&
    s.ownerUserId===scope.ownerUserId && s.brandId===scope.brandId &&
    s.accountId===scope.accountId && s.platform===scope.platform &&
    s.provider===scope.provider && s.providerProfileId===scope.providerProfileId &&
    Number.isSafeInteger(value.version) && (value.version as number)>0 &&
    value.authority==="EXPRESSION_ONLY" &&
    value.canPublish===false && value.canChangeJhadinaPersonality===false &&
    required(value.characterProfileRef) &&
    required(value.brandVoiceProfileRef) &&
    required(value.channelVoiceProfileRef) &&
    Number.isSafeInteger(value.brandVoiceVersion) &&
    Number.isSafeInteger(value.channelVoiceVersion) &&
    (value.brandVoiceVersion as number)>0 && (value.channelVoiceVersion as number)>0 &&
    (value.speakerIdentityRef===undefined || required(value.speakerIdentityRef)) &&
    Array.isArray(value.toneTraits) && value.toneTraits.length>0 &&
    value.toneTraits.every(required) &&
    required(value.pointOfView) &&
    Array.isArray(value.evidenceRefs) && value.evidenceRefs.length>0 &&
    value.evidenceRefs.every(required) &&
    required(value.updatedAt) && Number.isFinite(Date.parse(value.updatedAt as string));
}

/** Strict decoder used both at the service read boundary and during restore. */
export function decodeStoredSocialIdentity(value:unknown,scope:SocialIdentityScope):SocialAccountIdentity {
  if(!matchesScope(value,scope))throw new Error("SOCIAL_ID_PERSISTED_SCOPE_OR_SCHEMA_INVALID");
  return Object.freeze({
    ...value,
    scope:Object.freeze({...scope}),
    toneTraits:Object.freeze([...value.toneTraits]),
    evidenceRefs:Object.freeze([...value.evidenceRefs]),
  });
}

function assertOwner(verifiedOwnerUserId:string,scope:SocialIdentityScope):void {
  if(!verifiedOwnerUserId.trim() || scope.ownerUserId!==verifiedOwnerUserId)
    throw new Error("SOCIAL_ID_REPO_OWNER_MISMATCH");
}

type Querier=Pick<SupabaseClient,"from">;

/** JWT-backed read adapter. RLS must enforce auth.uid() = user_id. */
export function createSupabaseSocialIdentityReader(input:{
  client:Querier;
  verifiedOwnerUserId:string;
}):Pick<SocialIdentityRepository,"load"> {
  return {
    async load(scope) {
      assertOwner(input.verifiedOwnerUserId,scope);
      const {data,error}=await input.client.from("jhadina_social_identity_snapshots")
        .select("user_id,account_id,brand,platform,provider,provider_profile_id,version,snapshot")
        .eq("user_id",scope.ownerUserId)
        .eq("account_id",scope.accountId)
        .eq("brand",scope.brandId)
        .eq("platform",scope.platform)
        .eq("provider",scope.provider)
        .eq("provider_profile_id",scope.providerProfileId)
        .maybeSingle();
      if(error)throw new Error("SOCIAL_ID_REPO_READ_UNAVAILABLE:"+error.code);
      if(!data)return null;
      if(!object(data))throw new Error("SOCIAL_ID_REPO_ROW_INVALID");
      if(data.user_id!==scope.ownerUserId || data.account_id!==scope.accountId ||
          data.brand!==scope.brandId || data.platform!==scope.platform ||
          data.provider!==scope.provider || data.provider_profile_id!==scope.providerProfileId)
        throw new Error("SOCIAL_ID_REPO_ROW_SCOPE_MISMATCH");
      const decoded=decodeStoredSocialIdentity(data.snapshot,scope);
      if(decoded.version!==data.version)throw new Error("SOCIAL_ID_REPO_VERSION_MISMATCH");
      return decoded;
    },
  };
}

/**
 * Privileged writer is NOT an auth boundary. Instantiate only after verifying
 * actual owner request or trusted worker authority. SQL RPC independently
 * checks exact account scope, one approved/unused receipt and atomic version
 * CAS before committing snapshot and append-only history in one transaction.
 * The RPC is GRANTed solely to service_role.
 */
export function createPrivilegedSocialIdentityCommitStore(input:{
  client:SupabaseClient;
  verifiedOwnerUserId:string;
}):SocialIdentityCommitStore {
  const reader=createSupabaseSocialIdentityReader(input);
  return {
    load:reader.load,
    async commit(scope:SocialIdentityScope,record:SocialIdentityCommitRecord) {
      assertOwner(input.verifiedOwnerUserId,scope);
      const validated=decodeStoredSocialIdentity(record.next,scope);
      if(!Number.isSafeInteger(record.expectedVersion) || record.expectedVersion<0 ||
         validated.version!==record.expectedVersion+1)
        throw new Error("SOCIAL_ID_REPO_CAS_VERSION_INVALID");
      if(!required(record.proposalId) || !required(record.verifiedApprovalReceiptId) ||
         !required(record.approvalFingerprint))
        throw new Error("SOCIAL_ID_REPO_APPROVAL_REQUIRED");
      const {data,error}=await input.client.rpc("jhadina_social_commit_identity_snapshot",{
        p_owner_user_id:scope.ownerUserId,
        p_account_id:scope.accountId,
        p_brand:scope.brandId,
        p_platform:scope.platform,
        p_provider:scope.provider,
        p_provider_profile_id:scope.providerProfileId,
        p_expected_version:record.expectedVersion,
        p_next:validated,
        p_proposal_id:record.proposalId,
        p_receipt_id:record.verifiedApprovalReceiptId,
        p_fingerprint:record.approvalFingerprint,
      });
      if(error || data!==validated.version)
        throw new Error("SOCIAL_ID_REPO_ATOMIC_COMMIT_REJECTED");
    },
  };
}

/** Exact server-side receipt read; cannot fabricate owner approval or consume it. */
export function createSupabaseIdentityApprovalVerifier(input:{
  client:SupabaseClient;
  verifiedOwnerUserId:string;
}) {
  return async (receiptId:string,fingerprint:string):Promise<VerifiedSocialIdentityApproval|null>=>{
    if(!required(receiptId)||!required(fingerprint))return null;
    const {data,error}=await input.client.from("jhadina_social_approval_receipts")
      .select("id,action_id,user_id,type,fingerprint,status,expires_at")
      .eq("id",receiptId).eq("user_id",input.verifiedOwnerUserId)
      .eq("type","social.identity.modify")
      .eq("fingerprint",fingerprint)
      .eq("status","approved")
      .maybeSingle();
    if(error)throw new Error("SOCIAL_ID_REPO_APPROVAL_READ_UNAVAILABLE");
    if(!data)return null;
    if(!required(data.action_id) || !required(data.expires_at))return null;
    // proposal action_id is "social-identity:<accountId>:<proposalId>"
    const prefix="social-identity:";
    const identifier=data.action_id as string;
    if(!identifier.startsWith(prefix))return null;
    const after=identifier.slice(prefix.length);
    const separator=after.indexOf(":");
    if(separator<=0)return null;
    const accountId=after.slice(0,separator),proposalId=after.slice(separator+1);
    if(!required(accountId)||!required(proposalId))return null;
    return {
      proposalId,accountId,ownerUserId:input.verifiedOwnerUserId,
      receiptId, fingerprint,expiresAt:data.expires_at,
      status:"APPROVED" as const,
    };
  };
}
