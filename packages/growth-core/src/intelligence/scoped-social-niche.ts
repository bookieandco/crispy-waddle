
/**
 * SOCIAL-ID.06 scoped learning precondition for Social Juggernaut #1136.
 * Never pool niche/platform outcomes across owners or brands by default.
 * This is source-level analytics, not a provider-certified platform law.
 */
export interface ScopedSocialNicheObservation {
  readonly id: string;
  readonly ownerUserId: string;
  readonly brandId: string;
  readonly accountId: string;
  readonly platform: string;
  readonly nicheKey: string;
  readonly observedAt: string;
  readonly impressions: number;
  readonly views: number;
  readonly shares: number;
  readonly conversions: number;
  readonly evidenceRefs: readonly string[];
}
export interface ScopedSocialNicheProfile {
  readonly ownerUserId: string;
  readonly brandId: string;
  readonly platform: string;
  readonly nicheKey: string;
  readonly accountId?: string;
  readonly sampleSize: number;
  readonly observedFrom: string;
  readonly observedThrough: string;
  readonly shareRatePerView: number;
  readonly conversionRatePerImpression: number;
  readonly evidenceRefs: readonly string[];
  readonly observationIds: readonly string[];
  readonly authority: "ANALYTICS_ONLY";
  readonly canModifyIdentity: false;
}

export function buildScopedSocialNicheProfile(input: {
  scope: {ownerUserId: string;brandId: string;platform: string;nicheKey: string;accountId?: string};
  observations: readonly ScopedSocialNicheObservation[];
  asOf: string;
  maxAgeDays?: number;
}): ScopedSocialNicheProfile {
  const {scope} = input;
  if ([scope.ownerUserId,scope.brandId,scope.platform,scope.nicheKey].some(x=>!x.trim())
      || (scope.accountId!==undefined && !scope.accountId.trim()))
    throw new Error("SOCIAL_NICHE_SCOPE_REQUIRED");
  const now=Date.parse(input.asOf);
  const maxDays=input.maxAgeDays ?? 45;
  if (!Number.isFinite(now) || !Number.isInteger(maxDays) || maxDays<1 || maxDays>365)
    throw new Error("SOCIAL_NICHE_DATE_POLICY_INVALID");
  const cutoff=now-maxDays*86_400_000;
  const rows: ScopedSocialNicheObservation[]=[];
  const seen=new Set<string>();
  for(const row of input.observations){
    if (row.ownerUserId!==scope.ownerUserId || row.brandId!==scope.brandId
        || row.platform!==scope.platform || row.nicheKey!==scope.nicheKey
        || (scope.accountId!==undefined && row.accountId!==scope.accountId))
      throw new Error("SOCIAL_NICHE_FOREIGN_SCOPE_REJECTED");
    if (!row.id.trim() || !row.accountId.trim() || !row.evidenceRefs.length
        || row.evidenceRefs.some(x=>!x.trim()))
      throw new Error("SOCIAL_NICHE_EVIDENCE_REQUIRED");
    if ([row.impressions,row.views,row.shares,row.conversions].some(x=>!Number.isFinite(x)||x<0))
      throw new Error("SOCIAL_NICHE_INVALID_METRICS");
    const observed=Date.parse(row.observedAt);
    if (!Number.isFinite(observed) || observed>now) throw new Error("SOCIAL_NICHE_DATE_INVALID");
    if(observed<cutoff)continue;
    if(seen.has(row.id))continue;
    seen.add(row.id);rows.push(row);
  }
  if(!rows.length)throw new Error("SOCIAL_NICHE_FRESH_OBSERVATIONS_REQUIRED");
  const total=(k: "views"|"impressions"|"shares"|"conversions")=>rows.reduce((s,r)=>s+r[k],0);
  const views=total("views"),impressions=total("impressions");
  return Object.freeze({
    ...scope, sampleSize: rows.length,
    observedFrom:[...rows].sort((a,b)=>a.observedAt.localeCompare(b.observedAt))[0]!.observedAt,
    observedThrough:[...rows].sort((a,b)=>b.observedAt.localeCompare(a.observedAt))[0]!.observedAt,
    shareRatePerView: views>0 ? total("shares")/views : 0,
    conversionRatePerImpression: impressions>0 ? total("conversions")/impressions : 0,
    observationIds: Object.freeze(rows.map(row=>row.id)),
    evidenceRefs: Object.freeze([...new Set(rows.flatMap(row=>row.evidenceRefs))]),
    authority:"ANALYTICS_ONLY" as const,
    canModifyIdentity:false as const,
  });
}
