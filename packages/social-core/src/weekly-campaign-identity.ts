import {
  assertEffectiveSocialIdentityTarget,
  type EffectiveSocialIdentity,
} from "./effective-identity.js";
import {
  fingerprintWeeklySocialCampaignPacket,
  type WeeklySocialCampaignPacket,
} from "./weekly-campaign.js";

/**
 * SOCIAL-ID.19: a companion fingerprint binding PR #1136's four-kind weekly
 * proposal (organic/comment/paid/Director) to actual owner-scoped account
 * identity revisions. Not an Action permit and not a transport gateway.
 */
export interface IdentityBoundWeeklySocialPacket {
  readonly schema:"jhadina.social.weekly-account-identity.v1";
  readonly ownerUserId:string;
  readonly weeklyPacketId:string;
  readonly packetFingerprint:string;
  readonly accountBindings:readonly Readonly<{
    accountId:string;
    brand:string;
    platform:string;
    identityVersion:number;
    identityFingerprint:string;
  }>[];
  readonly compositeFingerprint:string;
  readonly authority:"PROPOSAL_ONLY";
  readonly requiresActionSecurityApproval:true;
  readonly canExecute:false;
  readonly canPublish:false;
  readonly canSpend:false;
  readonly canComment:false;
}
/** Stable across JSON key ordering after repository round-trips. Arrays retain
 * their order because weekly report sequencing is part of the review. */
function canonicalReviewValue(value:unknown):string {
  if(Array.isArray(value)) return "["+value.map(canonicalReviewValue).join(",")+"]";
  if(value!==null && typeof value==="object") {
    const fields=Object.entries(value as Record<string,unknown>)
      .sort(([a],[b])=>a<b?-1:a>b?1:0)
      .map(([key,part])=>JSON.stringify(key)+":"+canonicalReviewValue(part));
    return "{"+fields.join(",")+"}";
  }
  return JSON.stringify(value) ?? "undefined";
}

function nonblank(value:string):boolean {
  return typeof value==="string" && !!value.trim();
}

export function compileIdentityBoundWeeklySocialPacket(input:{
  verifiedOwnerUserId:string;
  packet:WeeklySocialCampaignPacket;
  /** effective identities must be resolved from authenticated repository. */
  effectiveIdentities:readonly EffectiveSocialIdentity[];
}):IdentityBoundWeeklySocialPacket {
  const {packet}=input;
  if(!nonblank(input.verifiedOwnerUserId) ||
    input.verifiedOwnerUserId!==packet.ownerUserId)
    throw new Error("SOCIAL_WEEKLY_ID_OWNER_MISMATCH");
  if(packet.authority!=="WEEKLY_CAMPAIGN_PROPOSAL_ONLY" ||
     packet.externalActionAuthorized!==false ||
     packet.fingerprint!==fingerprintWeeklySocialCampaignPacket(packet))
    throw new Error("SOCIAL_WEEKLY_ID_PACKET_UNTRUSTED");
  const byId=new Map<string,EffectiveSocialIdentity>();
  for(const identity of input.effectiveIdentities){
    const scope=identity.scope;
    if(scope.ownerUserId!==input.verifiedOwnerUserId ||
       !nonblank(identity.fingerprint) ||
       !Number.isSafeInteger(identity.version) || identity.version<1 ||
       identity.authority!=="EXPRESSION_ONLY" || identity.canPublish!==false ||
       identity.canChangeJhadinaPersonality!==false)
      throw new Error("SOCIAL_WEEKLY_ID_IDENTITY_INVALID");
    if(byId.has(scope.accountId))throw new Error("SOCIAL_WEEKLY_ID_DUPLICATE_IDENTITY");
    byId.set(scope.accountId,identity);
  }
  const required=new Set<string>();
  for(const action of packet.actions) {
    if(action.kind!=="organic_publication" && action.kind!=="public_comment")
      continue;
    const id=action.kind==="organic_publication" ? action.target.accountId : action.accountId;
    const effective=byId.get(id);
    if(!effective)throw new Error("SOCIAL_WEEKLY_ID_MISSING_ACCOUNT_IDENTITY");
    if(effective.scope.brandId!==action.brand ||
       effective.characterProfileRef!==action.profile.characterProfileRef ||
       effective.brandVoiceProfileRef!==action.profile.voiceProfileRef ||
       (effective.speakerIdentityRef??"")!==(action.profile.speakerIdentityRef??""))
      throw new Error("SOCIAL_WEEKLY_ID_BRAND_OR_VOICE_MISMATCH");
    if(action.kind==="organic_publication"){
      assertEffectiveSocialIdentityTarget(effective,action.target,input.verifiedOwnerUserId);
    }else if(effective.scope.platform!==action.platform){
      throw new Error("SOCIAL_WEEKLY_ID_COMMENT_PLATFORM_MISMATCH");
    }
    required.add(id);
  }
  if(required.size!==byId.size)
    throw new Error("SOCIAL_WEEKLY_ID_EXTRA_IDENTITY_NOT_IN_PACKET");
  const accountBindings=Object.freeze([...required].sort().map(id=>{
    const effective=byId.get(id)!;
    return Object.freeze({
      accountId:id,
      brand:effective.scope.brandId,
      platform:effective.scope.platform,
      identityVersion:effective.version,
      identityFingerprint:effective.fingerprint,
    });
  }));
  const compositeFingerprint=JSON.stringify({
    schema:"jhadina.social.weekly-account-identity.v1",
    ownerUserId:input.verifiedOwnerUserId,
    packetId:packet.id,
    packetFingerprint:packet.fingerprint,
    // The base packet fingerprint omits some report/policy fields. Binding
    // their canonical values here prevents silent weekly-review drift.
    reportAndPolicy:canonicalReviewValue({report:packet.report,policy:packet.policy}),
    accountBindings,
  });
  return Object.freeze({
    schema:"jhadina.social.weekly-account-identity.v1" as const,
    ownerUserId:input.verifiedOwnerUserId,
    weeklyPacketId:packet.id,
    packetFingerprint:packet.fingerprint,
    accountBindings,
    compositeFingerprint,
    authority:"PROPOSAL_ONLY" as const,
    requiresActionSecurityApproval:true as const,
    canExecute:false as const,canPublish:false as const,
    canSpend:false as const,canComment:false as const,
  });
}

/**
 * This *only* establishes whether a server-verified review receipt covers
 * the current candidate. The actual approval verifier, child permits,
 * Action/Security checks and transport remain separate. Never return true
 * publication/spend authorization from these user-supplied strings.
 */
export function assertIdentityBoundWeeklyReviewCurrent(input:{
  reviewed:IdentityBoundWeeklySocialPacket;
  current:IdentityBoundWeeklySocialPacket;
  verifiedReviewerUserId:string;
  verifiedReceiptFingerprint:string;
}):{
  readonly status:"REVIEW_FINGERPRINT_MATCH_ONLY";
  readonly canExecute:false;
} {
  if(input.reviewed.ownerUserId!==input.verifiedReviewerUserId ||
     input.current.ownerUserId!==input.verifiedReviewerUserId)
    throw new Error("SOCIAL_WEEKLY_ID_REVIEW_OWNER_MISMATCH");
  if(input.reviewed.compositeFingerprint!==input.verifiedReceiptFingerprint ||
     input.current.compositeFingerprint!==input.reviewed.compositeFingerprint)
    throw new Error("SOCIAL_WEEKLY_ID_REAPPROVAL_REQUIRED");
  return Object.freeze({
    status:"REVIEW_FINGERPRINT_MATCH_ONLY" as const,
    canExecute:false as const,
  });
}
