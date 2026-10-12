import type {SocialAccount,SocialObservation} from "@jhadina/social-core";
import {
  buildGovernedSocialNicheProjection,
  type ScopedSocialLearningBinding,
  type GovernedSocialNicheProjection,
} from "./scoped-niche-learning";

export interface SocialGrowthAccountInsight {
  readonly accountId:string;
  readonly displayName:string;
  readonly brand:SocialAccount["brand"];
  readonly platform:SocialAccount["platform"];
  readonly observedPerformanceRecords:number;
  readonly observedMetricTotals:Readonly<Record<string,number>>;
  readonly latestObservedAt?:string;
  readonly providerEvidenceRefs:readonly string[];
  readonly nicheAnalysis:readonly GovernedSocialNicheProjection[];
  readonly status:"OBSERVATIONS_ONLY"|"ACCOUNT_SCOPED_ADVISORY"|"NO_EVIDENCE";
  readonly approvedIdentityLearning:false;
  readonly authority:"READ_ONLY";
}
export interface SocialGrowthInsightReadout {
  readonly schema:"jhadina.social.growth-insights.v1";
  readonly ownerUserId:string;
  readonly accounts:readonly SocialGrowthAccountInsight[];
  readonly uncertainty:readonly string[];
  readonly canModifyIdentity:false;
  readonly canPublish:false;
}
/**
 * Authenticated owner-scoped observational readout. Optional bindings MUST be
 * loaded by a server's account/content/approval repository; callers must not
 * construct them from observations or browser data. No binding -> NO niche
 * algorithm conclusions. Even an advisory niche is not causal proof.
 */
export function buildSocialGrowthInsightReadout(input:{
  verifiedOwnerUserId:string;
  accounts:readonly SocialAccount[];
  observations:readonly SocialObservation[];
  asOf:string;
  selectedAccountIds?:readonly string[];
  ownerVerifiedNicheBindings?:readonly ScopedSocialLearningBinding[];
}):SocialGrowthInsightReadout {
  if(!input.verifiedOwnerUserId.trim() || !Number.isFinite(Date.parse(input.asOf)))
    throw new Error("SOCIAL_GROWTH_INSIGHTS_OWNER_OR_DATE_INVALID");
  const scope=new Set(input.selectedAccountIds);
  const eligible=input.accounts.filter(a=>
    a.userId===input.verifiedOwnerUserId && a.status==="connected" &&
    (!input.selectedAccountIds || scope.has(a.id)));
  const distinct=new Set<string>();
  const verified=input.ownerVerifiedNicheBindings??[];
  for(const bound of verified){
    const a=eligible.find(a=>a.id===bound.account.id);
    if(!a || a.userId!==bound.account.userId ||
       a.brand!==bound.account.brand || a.platform!==bound.account.platform ||
       a.provider!==bound.account.provider ||
       a.providerProfileId!==bound.account.providerProfileId)
      throw new Error("SOCIAL_GROWTH_INSIGHTS_UNTRUSTED_BINDING");
    if(distinct.has(a.id))throw new Error("SOCIAL_GROWTH_INSIGHTS_DUPLICATE_BINDING");
    distinct.add(a.id);
  }
  const result=eligible.map(account=>{
    const rows=input.observations.filter(row=>
      row.kind==="performance" && row.userId===account.userId &&
      row.accountId===account.id && row.brand===account.brand &&
      row.platform===account.platform && row.provider===account.provider &&
      row.providerProfileId===account.providerProfileId &&
      !!row.evidence?.length && Number.isFinite(Date.parse(row.observedAt)) &&
      Date.parse(row.observedAt)<=Date.parse(input.asOf)
    );
    const seen=new Set<string>();
    const unique=rows.filter(row=>{
      if(seen.has(row.id))return false;
      seen.add(row.id);
      return true;
    });
    const totals:Record<string,number>={};
    for(const row of unique) {
      for(const [key,value] of Object.entries(row.metrics??{})){
        if(typeof value==="number" && Number.isFinite(value) && value>=0)
          totals[key]=(totals[key]??0)+value;
      }
    }
    const relevant=verified.filter(binding=>binding.account.id===account.id);
    const nicheKeys=[...new Set(relevant.flatMap(b=>b.ownerAttestedContents.map(c=>c.nicheKey)))];
    const nicheAnalysis=nicheKeys.map(nicheKey=>
      buildGovernedSocialNicheProjection({
        verifiedOwnerUserId:account.userId,
        brandId:account.brand,platform:account.platform,
        nicheKey,accountId:account.id,
        bindings:relevant,observations:unique,asOf:input.asOf,
      }));
    const advisory=nicheAnalysis.some(n=>n.disposition==="ADVISORY_ONLY");
    const latest=unique.map(x=>x.observedAt).sort().at(-1);
    return Object.freeze({
      accountId:account.id,displayName:account.displayName,
      brand:account.brand,platform:account.platform,
      observedPerformanceRecords:unique.length,
      observedMetricTotals:Object.freeze(totals),
      ...(latest?{latestObservedAt:latest}:{}),
      providerEvidenceRefs:Object.freeze([...new Set(unique.flatMap(x=>x.evidence))]),
      nicheAnalysis:Object.freeze(nicheAnalysis),
      status:(advisory?"ACCOUNT_SCOPED_ADVISORY":unique.length?"OBSERVATIONS_ONLY":"NO_EVIDENCE") as SocialGrowthAccountInsight["status"],
      approvedIdentityLearning:false as const,
      authority:"READ_ONLY" as const,
    });
  });
  return Object.freeze({
    schema:"jhadina.social.growth-insights.v1" as const,
    ownerUserId:input.verifiedOwnerUserId,
    accounts:Object.freeze(result),
    uncertainty:Object.freeze([
      "Provider observations are descriptive, not proof of incremental growth, conversion causality, or platform algorithms.",
      "Missing metrics are unavailable, not zero; repeated provider snapshots can overlap.",
      "No approved identity learning, account strategy change or public action follows from this readout.",
      ...(verified.length?[]:["No server-attested identity+content+niche lineage is connected; algorithm/niche insights are not certified."]),
    ]),
    canModifyIdentity:false as const,canPublish:false as const,
  });
}
