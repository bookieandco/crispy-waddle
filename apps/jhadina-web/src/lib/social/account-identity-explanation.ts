import {
  assertSocialIdentityScope,
  type SocialAccount,
  type SocialAccountIdentity,
  type SocialIdentityRepository,
  type SocialObservation,
} from "@jhadina/social-core";
import type {EvidenceRef} from "@jhadina/core-spine";

export interface SocialAccountIdentityExplanation {
  readonly recommendation: string;
  readonly evidence: readonly EvidenceRef[];
  readonly limitations: readonly string[];
  readonly authority: "READ_ONLY";
}

/**
 * Read-only answer assembly. An authenticated caller must select account IDs
 * from its own repository before invoking this function. Untyped/raw provider
 * metrics are not silently promoted to learned identity traits.
 */
export async function explainSocialAccountIdentity(input: {
  verifiedUserId: string;
  accounts: readonly SocialAccount[];
  observations: readonly SocialObservation[];
  selectedAccountIds: readonly string[];
  identityRepository?: Pick<SocialIdentityRepository,"load">;
  observedAt: string;
}): Promise<SocialAccountIdentityExplanation> {
  const eligible = input.accounts.filter(account =>
    account.userId===input.verifiedUserId &&
    account.status==="connected" &&
    input.selectedAccountIds.includes(account.id));
  const evidence:EvidenceRef[]=[];
  const limitations:string[]=[];
  if(!eligible.length) {
    return Object.freeze({
      recommendation:"No authenticated connected account is in scope for identity analysis.",
      evidence:Object.freeze([]),
      limitations:Object.freeze(["Cannot evaluate an unknown or disconnected Social account."]),
      authority:"READ_ONLY" as const,
    });
  }
  const summaries=await Promise.all(eligible.map(async account=>{
    let identity: SocialAccountIdentity | null=null;
    if (input.identityRepository) {
      try {
        identity=await input.identityRepository.load({
          ownerUserId:account.userId,brandId:account.brand,accountId:account.id,
          platform:account.platform,provider:account.provider,
          providerProfileId:account.providerProfileId,
        });
        if(identity) assertSocialIdentityScope(identity.scope,account);
        if(identity && (identity.authority!=="EXPRESSION_ONLY" ||
            identity.canPublish!==false || identity.canChangeJhadinaPersonality!==false ||
            !Number.isSafeInteger(identity.version) || identity.version<1))
          throw new Error("SOCIAL_ID_READ_IDENTITY_AUTHORITY_INVALID");
      } catch {
        identity=null;
        limitations.push(account.displayName+": identity snapshot is unavailable or has invalid scope.");
      }
    } else {
      limitations.push(account.displayName+": no durable identity reader configured.");
    }
    const observations=input.observations.filter(row=>
      row.userId===account.userId && row.brand===account.brand &&
      row.accountId===account.id && row.provider===account.provider &&
      row.providerProfileId===account.providerProfileId &&
      row.platform===account.platform && row.kind==="performance" &&
      !!row.evidence?.length && Number.isFinite(Date.parse(row.observedAt)));
    for(const observation of observations.slice(0,10)) {
      evidence.push({
        id:"social-account-observation:"+observation.id,
        source:observation.source,
        observedAt:observation.observedAt,
        summary:"Observed performance for "+account.displayName+
          " on "+account.platform+"; contentId="+(observation.contentId??"unknown")+
          "; evidence is not proof of identity evolution.",
        immutable:false,
      });
    }
    const identityStatus=identity
      ? "stored identity snapshot v"+identity.version+" (live approval history not established here)"
      : "no verified persisted account-identity snapshot";
    const last=observations.reduce<string | undefined>((latest,row)=>
      !latest||row.observedAt>latest?row.observedAt:latest,undefined);
    return account.displayName+" ("+account.platform+"): "+identityStatus+
      "; "+observations.length+" scoped performance observation(s)"+
      (last ? ", latest "+last : "")+
      ". Performance is NOT a verified identity change.";
  }));
  return Object.freeze({
    recommendation:summaries.join(" | ")+" No approved identity-learning promotion or strategy change was established by these observations.",
    evidence:Object.freeze(evidence),
    limitations:Object.freeze(limitations),
    authority:"READ_ONLY" as const,
  });
}
