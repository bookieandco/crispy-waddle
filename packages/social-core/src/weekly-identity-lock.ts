import {fingerprintSocialPublication, type SocialPublicationInput} from "./publication.js";
import {assertEffectiveSocialIdentityTarget, type EffectiveSocialIdentity} from "./effective-identity.js";

/**
 * SOCIAL-ID.12: a restrictive *compatibility* identity lock for organic
 * publication plans. Existing PR #1136 weekly packet also covers comments,
 * Director and paid plans; those must use its immutable action approval.
 * This record does not approve any action or issue a child permit.
 */
export interface WeeklySocialIdentityAction {
  readonly actionId: string;
  readonly publication: SocialPublicationInput;
  readonly identities: readonly EffectiveSocialIdentity[];
}
export interface WeeklySocialIdentityLock {
  readonly weekRef: string;
  readonly ownerUserId: string;
  readonly frozenActions: readonly Readonly<{
    actionId: string;
    publicationFingerprint: string;
    identityFingerprints: readonly string[];
  }>[];
  readonly fingerprint: string;
  readonly requiresExistingPublicPublishApproval: true;
  readonly authority: "FINGERPRINT_ONLY";
  readonly canPublish: false;
}

export function compileWeeklySocialIdentityLock(input:{
  weekRef:string;
  verifiedOwnerUserId:string;
  actions:readonly WeeklySocialIdentityAction[];
}):WeeklySocialIdentityLock {
  const owner=input.verifiedOwnerUserId.trim();
  if (!owner || !input.weekRef.trim() || !input.actions.length)
    throw new Error("SOCIAL_WEEKLY_IDENTITY_SCOPE_REQUIRED");
  const seen=new Set<string>();
  const actions=input.actions.map(action=>{
    if(!action.actionId.trim() || seen.has(action.actionId))
      throw new Error("SOCIAL_WEEKLY_IDENTITY_DUPLICATE_OR_EMPTY_ACTION");
    seen.add(action.actionId);
    if (!action.identities.length || action.identities.length!==action.publication.targets.length)
      throw new Error("SOCIAL_WEEKLY_IDENTITY_TARGET_COVERAGE");
    const fingerprint=fingerprintSocialPublication(action.publication);
    const targets=new Map(action.publication.targets.map(x=>[x.accountId,x]));
    const bound=new Set<string>();
    for(const identity of action.identities){
      const accountId=identity.scope.accountId;
      if(bound.has(accountId) || !targets.has(accountId))
        throw new Error("SOCIAL_WEEKLY_IDENTITY_TARGET_COVERAGE");
      bound.add(accountId);
      assertEffectiveSocialIdentityTarget(identity,targets.get(accountId)!,owner);
      if(identity.authority!=="EXPRESSION_ONLY" || identity.canPublish!==false ||
          identity.canChangeJhadinaPersonality!==false || identity.version<1)
        throw new Error("SOCIAL_WEEKLY_IDENTITY_AUTHORITY_INVALID");
    }
    return Object.freeze({
      actionId:action.actionId,
      publicationFingerprint:fingerprint,
      identityFingerprints:Object.freeze([...action.identities]
        .sort((a,b)=>a.scope.accountId.localeCompare(b.scope.accountId))
        .map(x=>x.fingerprint)),
    });
  }).sort((a,b)=>a.actionId.localeCompare(b.actionId));
  const frozenActions=Object.freeze(actions);
  const fingerprint=JSON.stringify({
    schema:"jhadina.social.weekly-identity-lock.v1",
    weekRef:input.weekRef.trim(), ownerUserId:owner,
    frozenActions,
  });
  return Object.freeze({
    weekRef:input.weekRef.trim(),ownerUserId:owner,frozenActions,fingerprint,
    requiresExistingPublicPublishApproval:true as const,
    authority:"FINGERPRINT_ONLY" as const,canPublish:false as const,
  });
}

/**
 * Compare against the originally owner-reviewed fingerprint before delegating
 * to the existing Social/Action publication gate. Never equate this check with
 * receipt verification, paid authorization or actual transport.
 */
export function assertWeeklyIdentityLockUnchanged(input:{
  approved:WeeklySocialIdentityLock;
  verifiedOwnerUserId:string;
  weekRef:string;
  currentActions:readonly WeeklySocialIdentityAction[];
}):void {
  if(input.approved.ownerUserId!==input.verifiedOwnerUserId)
    throw new Error("SOCIAL_WEEKLY_IDENTITY_OWNER_MISMATCH");
  const current=compileWeeklySocialIdentityLock({
    weekRef:input.weekRef,verifiedOwnerUserId:input.verifiedOwnerUserId,actions:input.currentActions,
  });
  if(input.approved.fingerprint!==current.fingerprint)
    throw new Error("SOCIAL_WEEKLY_IDENTITY_REAPPROVAL_REQUIRED");
}
